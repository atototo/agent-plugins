import path from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { cp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { HARNESSES, checkName, verifyBundle } from './bundle.mjs';
import { atomicWrite, exists, files, inside, json, noSymlinks, readJson, sha256, write } from './fs.mjs';
import { changePlugin, pluginRefs, readConfig } from './config.mjs';
import { NativeHarness, chooseOpenCodeConfig, hasPlugin, run } from './native.mjs';

export const defaultStateDir = () => path.join(homedir(), '.local', 'share', 'agent-plugins');
const recordId = r => `${r.plugin}@${r.harness}@${r.sourceDigest}`;

export class Installer {
  constructor({ source, stateDir = defaultStateDir(), opencodeConfig, runner = run, userHome = homedir(), env = process.env } = {}) {
    this.source = source && path.resolve(source);
    this.stateDir = path.resolve(stateDir);
    this.config = opencodeConfig && path.resolve(opencodeConfig);
    this.runner = runner; this.userHome = userHome; this.env = env;
    this.stateFile = path.join(this.stateDir, 'state.json');
    this.lockFile = path.join(this.stateDir, 'operation.lock');
  }
  native(name) { return new NativeHarness(name, this.runner); }
  async state() {
    await noSymlinks(this.stateFile);
    if (!await exists(this.stateFile)) return { schemaVersion: 1, records: [] };
    const state = await readJson(this.stateFile);
    if (state.schemaVersion !== 1 || !Array.isArray(state.records)) throw new Error('Unsupported installer state; not overwritten');
    for (const r of state.records) {
      checkName(r.plugin);
      if (!HARNESSES.includes(r.harness) || !/^[a-f0-9]{64}$/.test(r.sourceDigest) || !['installing', 'installed', 'failed', 'removing'].includes(r.status)) throw new Error('Invalid installer receipt');
      if (path.resolve(r.snapshot) !== path.join(this.stateDir, 'releases', r.sourceDigest)) throw new Error('Receipt snapshot escapes managed storage');
      const marketName = `${r.catalog.slice(0, 40)}-${r.sourceDigest.slice(0, 12)}`;
      if (r.selector !== `${r.plugin}@${marketName}`) throw new Error('Invalid managed plugin selector');
      if (r.harness === 'opencode' && r.reference !== pathToFileURL(path.join(r.snapshot, 'opencode/plugins', r.plugin, 'index.mjs')).href) throw new Error('Invalid managed OpenCode reference');
    }
    return state;
  }
  async save(state) { await atomicWrite(this.stateFile, json(state)); }
  async locked(action) {
    await noSymlinks(this.lockFile);
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    try { await writeFile(this.lockFile, json({ pid: process.pid, started: new Date().toISOString() }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Another operation is running or interrupted. Use status; unlock only after the process exits.'); throw error; }
    try { return await action(); } finally { await unlink(this.lockFile); }
  }
  async unlock() {
    await noSymlinks(this.lockFile);
    if (!await exists(this.lockFile)) return;
    const lock = await readJson(this.lockFile);
    if (!Number.isInteger(lock.pid) || lock.pid < 1) throw new Error('Invalid lock file; inspect manually');
    try { process.kill(lock.pid, 0); } catch (error) {
      if (error.code === 'ESRCH') { await unlink(this.lockFile); return; }
      throw error;
    }
    throw new Error('Lock owner is still running; lock was not removed');
  }
  targets(targets) {
    if (!Array.isArray(targets) || !targets.length || targets.some(x => !HARNESSES.includes(x))) throw new Error('Choose codex, claude, opencode, or all');
    return [...new Set(targets)];
  }
  async plan(names, targets, { update = false } = {}) {
    targets = this.targets(targets);
    const manifest = await verifyBundle(this.source);
    const state = await this.state();
    if (!names.length || new Set(names).size !== names.length) throw new Error('Select one or more distinct plugin names');
    const snapshot = path.join(this.stateDir, 'releases', manifest.digest);
    const marketplace = `${manifest.name.slice(0, 40)}-${manifest.digest.slice(0, 12)}`;
    const records = [];
    for (const name of names) {
      checkName(name);
      const plugin = manifest.plugins.find(p => p.name === name);
      if (!plugin) throw new Error(`Unknown plugin: ${name}`);
      for (const harness of targets) {
        const old = state.records.filter(r => r.plugin === name && r.harness === harness && r.sourceDigest !== manifest.digest);
        if (old.length && !update) throw new Error(`${name} has another managed version in ${harness}; use update explicitly`);
        const receipt = state.records.find(r => r.plugin === name && r.harness === harness && r.sourceDigest === manifest.digest);
        const configFile = harness === 'opencode' ? (receipt?.configFile || this.config || await chooseOpenCodeConfig(this.env, this.userHome)) : undefined;
        if (receipt?.configFile && this.config && receipt.configFile !== this.config) throw new Error('Existing receipt uses a different OpenCode config');
        records.push({ plugin: name, version: plugin.version, harness, catalog: manifest.name, sourceDigest: manifest.digest, snapshot,
          selector: `${name}@${marketplace}`, configFile,
          reference: harness === 'opencode' ? pathToFileURL(path.join(snapshot, 'opencode/plugins', name, 'index.mjs')).href : undefined,
          status: receipt?.status ?? 'installing', owned: Boolean(receipt), previous: old,
        });
      }
    }
    return { manifest, records };
  }
  async preflight(records) {
    for (const harness of [...new Set(records.map(r => r.harness))]) {
      if (harness !== 'opencode') await this.native(harness).check();
    }
    for (const r of records) {
      await noSymlinks(r.snapshot);
      if (r.harness === 'opencode') {
        const { value } = await readConfig(r.configFile);
        if (pluginRefs(value).includes(r.reference) && !r.owned) throw new Error('OpenCode entry exists but is not owned by this installer');
      } else {
        await this.native(r.harness).checkMarketplace(path.join(r.snapshot, r.harness), r.selector.split('@')[1]);
        if (hasPlugin(await this.native(r.harness).plugins(), r.selector) && !r.owned) throw new Error(`Native plugin already exists outside installer ownership: ${r.selector}`);
      }
    }
  }
  async stage(manifest) {
    const snapshot = path.join(this.stateDir, 'releases', manifest.digest);
    await noSymlinks(snapshot);
    if (await exists(snapshot)) {
      const stored = await verifyBundle(snapshot);
      if (stored.sourceDigest !== manifest.digest) throw new Error('Managed snapshot provenance mismatch');
      return;
    }
    // Write into a uniquely named staging directory, never publish a partial snapshot.
    const staging = path.join(this.stateDir, 'releases', `.stage-${randomUUID()}`);
    await mkdir(path.dirname(staging), { recursive: true, mode: 0o700 });
    await cp(this.source, staging, { recursive: true, errorOnExist: true, force: false });
    await verifyBundle(staging);
    const marketplace = `${manifest.name.slice(0, 40)}-${manifest.digest.slice(0, 12)}`;
    for (const file of ['codex/.agents/plugins/marketplace.json', 'claude/.claude-plugin/marketplace.json']) {
      const catalog = await readJson(inside(staging, file)); catalog.name = marketplace;
      await write(inside(staging, file), json(catalog));
    }
    const hashes = {};
    for (const file of (await files(staging)).filter(x => x !== 'bundle.json').sort()) hashes[file] = sha256(await readFile(inside(staging, file)));
    const body = { schemaVersion: 1, name: manifest.name, sourceDigest: manifest.digest, plugins: manifest.plugins, files: hashes };
    await write(path.join(staging, 'bundle.json'), json({ ...body, digest: sha256(json(body)) }));
    await verifyBundle(staging);
    const { rename } = await import('node:fs/promises');
    await rename(staging, snapshot);
  }
  async install(names, targets, { update = false } = {}) {
    return this.locked(async () => {
      const { manifest, records } = await this.plan(names, targets, { update });
      await this.preflight(records); // All selected native tools/configs checked before changes.
      await this.stage(manifest);
      const state = await this.state();
      const outcomes = [];
      for (const planned of records) {
        const { owned, previous, ...r } = planned;
        let saved = state.records.find(x => recordId(x) === recordId(r));
        if (!saved) { saved = r; state.records.push(saved); }
        saved.status = 'installing'; saved.phase = 'registered-intent'; delete saved.error;
        await this.save(state);
        try {
          if (r.harness === 'opencode') await changePlugin(r.configFile, r.reference, 'add');
          else {
            const native = this.native(r.harness);
            await native.ensureMarketplace(path.join(r.snapshot, r.harness), r.selector.split('@')[1]);
            saved.phase = 'marketplace-ready'; await this.save(state);
            if (!hasPlugin(await native.plugins(), r.selector)) await native.install(r.selector);
          }
          saved.status = 'installed'; saved.phase = 'configured';
          await this.save(state);
          // New configuration is confirmed before retiring this installer's old version.
          for (const old of previous) {
            await this.removeRecord(old);
            state.records = state.records.filter(x => recordId(x) !== recordId(old));
            await this.save(state);
          }
          outcomes.push({ plugin: r.plugin, harness: r.harness, status: 'configured', restartRequired: true });
        } catch (error) {
          saved.status = 'failed'; saved.error = error.message;
          await this.save(state);
          throw new Error(`${r.harness}/${r.plugin}: ${error.message}\nPartial progress is recorded. Retry the same ${update ? 'update' : 'install'} command or remove the managed plugin. No cross-harness rollback is claimed.`);
        }
      }
      return outcomes;
    });
  }
  async removeRecord(r) {
    if (r.harness === 'opencode') await changePlugin(r.configFile, r.reference, 'remove');
    else await this.native(r.harness).remove(r.selector);
  }
  async remove(names, targets) {
    this.targets(targets);
    return this.locked(async () => {
      const state = await this.state();
      const selected = state.records.filter(r => names.includes(r.plugin) && targets.includes(r.harness));
      for (const name of names) checkName(name);
      for (const harness of [...new Set(selected.map(r => r.harness))]) if (harness !== 'opencode') await this.native(harness).check();
      const removed = [];
      for (const r of selected) {
        r.status = 'removing'; await this.save(state);
        try {
          await this.removeRecord(r);
          state.records = state.records.filter(x => recordId(x) !== recordId(r));
          await this.save(state); removed.push({ plugin: r.plugin, harness: r.harness });
        } catch (error) { r.error = error.message; await this.save(state); throw error; }
      }
      return { removed, retained: 'HTML artifacts, immutable release snapshots, and native marketplace registrations are retained.' };
    });
  }
  async doctor() {
    const state = await this.state();
    const result = [];
    for (const r of state.records) {
      try {
        await verifyBundle(r.snapshot);
        const configured = r.harness === 'opencode'
          ? pluginRefs((await readConfig(r.configFile)).value).includes(r.reference)
          : hasPlugin(await this.native(r.harness).plugins(), r.selector);
        result.push({ plugin: r.plugin, harness: r.harness, receipt: r.status, configured, snapshot: 'verified', runtime: 'not-probed', browser: 'session-dependent' });
      } catch (error) { result.push({ plugin: r.plugin, harness: r.harness, error: error.message }); }
    }
    return result;
  }
}
