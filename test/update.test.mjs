import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Installer } from '../src/installer.mjs';
import { HARNESSES, verifyBundle } from '../src/bundle.mjs';
import { exists, files, json, sha256, write } from '../src/fs.mjs';
import { parseConfig } from '../src/config.mjs';
import { repo } from '../scripts/build.mjs';
import { fixture } from './helpers.mjs';

const plugins = ['eli5-visual', 'another-plugin'];
const pairs = records => records.map(r => `${r.plugin}/${r.harness}`).sort();

// Small, checksummed test bundles for receipt/selection tests, not native-runtime evidence.
async function bundle(root, label, { version = '0.1.0', names = plugins, catalog = 'agent-plugins' } = {}) {
  const source = path.join(root, label);
  for (const harness of HARNESSES) {
    for (const name of names) {
      const base = path.join(source, harness, 'plugins', name);
      if (harness === 'opencode') {
        await write(path.join(base, 'package.json'), json({ name: `agent-plugins-${name}`, version, type: 'module' }));
        await write(path.join(base, 'index.mjs'), 'export default async () => ({});\n');
      } else {
        await write(path.join(base, `.${harness}-plugin/plugin.json`), json({ name, version }));
      }
    }
    if (harness !== 'opencode') {
      await write(path.join(source, harness, harness === 'codex' ? '.agents/plugins/marketplace.json' : '.claude-plugin/marketplace.json'),
        json({ name: catalog, plugins: names.map(name => ({ name, source: `./plugins/${name}` })) }));
    }
  }
  const hashes = {};
  for (const file of (await files(source)).sort()) hashes[file] = sha256(await readFile(path.join(source, file)));
  const body = { schemaVersion: 1, name: catalog, plugins: names.map(name => ({ name, version })), files: hashes };
  await write(path.join(source, 'bundle.json'), json({ ...body, digest: sha256(json(body)) }));
  await verifyBundle(source);
  return source;
}

async function updateFixture(t) {
  const context = await fixture(t);
  context.installer.source = await bundle(context.root, 'v1');
  const source = await bundle(context.root, 'v2', { version: '0.1.1' });
  const updater = new Installer({ source, stateDir: context.stateDir, runner: context.native.run,
    userHome: path.join(context.root, 'different-home'), env: { OPENCODE_CONFIG: '/must-not-be-selected.json' } });
  return { ...context, updater };
}

const cli = (installer, ...args) => promisify(execFile)(process.execPath, [path.join(repo, 'bin/agent-plugins.mjs'), ...args,
  '--source', installer.source, '--state-dir', installer.stateDir]);

test('argument-free update preserves exact multi-plugin/harness pairs and saved OpenCode config', async t => {
  const { installer, updater, native, opencodeConfig } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['codex']);
  await installer.install(['another-plugin'], ['opencode']);
  const before = pairs((await installer.state()).records);
  const plan = await updater.plan([], [], { update: true });
  assert.deepEqual(pairs(plan.records), before);
  assert(plan.records.every(r => r.fromVersions[0] === '0.1.0' && r.version === '0.1.1'));
  assert.equal(plan.records.find(r => r.harness === 'opencode').configFile, opencodeConfig);
  await updater.install(undefined, undefined, { update: true });
  const after = (await updater.state()).records;
  assert.deepEqual(pairs(after), before);
  assert(after.every(r => r.version === '0.1.1' && r.status === 'installed' && !('fromVersions' in r)));
  assert.equal(native.plugins.codex.size, 1);
  assert(!native.calls.some(call => call[0] === 'claude'));
  assert.equal(parseConfig(await readFile(opencodeConfig, 'utf8')).plugin.length, 1);
});

test('update filters intersect receipts; all never expands to uninstalled pairs', async t => {
  const { installer, updater } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['codex', 'opencode']);
  await installer.install(['another-plugin'], ['claude']);
  assert.deepEqual(pairs((await updater.plan(['eli5-visual'], HARNESSES, { update: true })).records), ['eli5-visual/codex', 'eli5-visual/opencode']);
  assert.deepEqual(pairs((await updater.plan([], ['claude'], { update: true })).records), ['another-plugin/claude']);
  await updater.install(['eli5-visual'], ['opencode'], { update: true });
  const state = (await updater.state()).records;
  assert.equal(state.find(r => r.harness === 'opencode').version, '0.1.1');
  assert(state.filter(r => r.harness !== 'opencode').every(r => r.version === '0.1.0'));
  await updater.install(['eli5-visual'], HARNESSES, { update: true });
  const afterAll = (await updater.state()).records;
  assert.deepEqual(pairs(afterAll), pairs(state));
  assert(afterAll.filter(r => r.plugin === 'eli5-visual').every(r => r.version === '0.1.1'));
  assert.equal(afterAll.find(r => r.plugin === 'another-plugin').version, '0.1.0');
});

test('invalid or unmatched update filters fail without any state/config/native changes', async t => {
  const { installer, updater, native, opencodeConfig } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['opencode']);
  const before = await readFile(installer.stateFile, 'utf8');
  const config = await readFile(opencodeConfig, 'utf8');
  const count = native.calls.length;
  for (const [names, harnesses, error] of [
    [['typo'], [], /Unknown plugin/], [[], ['typo'], /Choose codex/],
    [['eli5-visual', 'eli5-visual'], [], /distinct/],
    [['another-plugin'], [], /No managed/], [['eli5-visual'], ['claude'], /No managed/],
  ]) await assert.rejects(updater.install(names, harnesses, { update: true }), error);
  assert.equal(await readFile(installer.stateFile, 'utf8'), before);
  assert.equal(await readFile(opencodeConfig, 'utf8'), config);
  assert.equal(native.calls.length, count);
});

test('empty argument-free update is a no-op without creating state, snapshots, or settings', async t => {
  const { updater, stateDir, opencodeConfig, native } = await updateFixture(t);
  assert.deepEqual(await updater.install([], [], { update: true }), []);
  const result = JSON.parse((await cli(updater, 'update')).stdout);
  assert.deepEqual(result.targets, []);
  assert.match(result.message, /Nothing changed/);
  assert(!await exists(stateDir));
  assert(!await exists(opencodeConfig));
  assert.equal(native.calls.length, 0);
});

test('CLI update preview defaults to receipts, displays versions and accepts optional all filter', async t => {
  const { installer, updater, opencodeConfig } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['codex']);
  await installer.install(['another-plugin'], ['opencode']);
  const before = await readFile(installer.stateFile, 'utf8');
  const config = await readFile(opencodeConfig, 'utf8');
  for (const args of [[], ['--harness', 'all']]) {
    const plan = JSON.parse((await cli(updater, 'update', ...args, '--dry-run')).stdout);
    assert.deepEqual(pairs(plan.targets), ['another-plugin/opencode', 'eli5-visual/codex']);
    assert(plan.targets.every(r => r.version === '0.1.1' && r.fromVersions[0] === '0.1.0'));
  }
  assert.equal(await readFile(installer.stateFile, 'utf8'), before);
  assert.equal(await readFile(opencodeConfig, 'utf8'), config);
});

test('CLI update requires confirmation and applies the selected saved OpenCode path', async t => {
  const { installer, updater, opencodeConfig } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['opencode']);
  const before = await readFile(installer.stateFile, 'utf8');
  await assert.rejects(cli(updater, 'update'), /Use --yes/);
  assert.equal(await readFile(installer.stateFile, 'utf8'), before);
  await cli(updater, 'update', '--yes');
  const [record] = (await updater.state()).records;
  assert.equal(record.configFile, opencodeConfig);
  assert.equal(record.version, '0.1.1');
  assert.deepEqual(parseConfig(await readFile(opencodeConfig, 'utf8')).plugin, [record.reference]);
});

test('install and remove still require explicit names and harnesses in noninteractive CLI', async t => {
  const { updater, stateDir } = await updateFixture(t);
  for (const command of ['install', 'remove']) {
    await assert.rejects(cli(updater, command, 'eli5-visual', '--dry-run'), /Specify --harness/);
    await assert.rejects(cli(updater, command, '--harness', 'all', '--dry-run'), /Specify a plugin/);
  }
  assert(!await exists(stateDir));
});

test('update refuses to migrate an existing OpenCode registration to a different config', async t => {
  const { installer, updater, root, opencodeConfig } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['opencode']);
  updater.config = path.join(root, 'new-config.json');
  const before = await readFile(opencodeConfig, 'utf8');
  await assert.rejects(updater.install([], [], { update: true }), /different OpenCode config/);
  assert.equal(await readFile(opencodeConfig, 'utf8'), before);
  assert(!await exists(updater.config));
});

test('a plugin absent from the new bundle blocks a default update without removing it', async t => {
  const { installer, updater, root, native } = await updateFixture(t);
  await installer.install(plugins, ['codex']);
  updater.source = await bundle(root, 'reduced', { version: '0.1.1', names: ['eli5-visual'] });
  const before = await readFile(installer.stateFile, 'utf8');
  const count = native.calls.length;
  await assert.rejects(updater.install([], [], { update: true }), /another-plugin is missing/);
  assert.equal(await readFile(installer.stateFile, 'utf8'), before);
  assert.equal(native.calls.length, count);
  await updater.install(['eli5-visual'], [], { update: true });
  assert.equal((await updater.state()).records.find(r => r.plugin === 'another-plugin').version, '0.1.0');
});

test('update does not touch same-named plugins belonging to another catalog', async t => {
  const { installer, updater, root, stateDir, native } = await updateFixture(t);
  const other = new Installer({ source: await bundle(root, 'other', { catalog: 'other-catalog' }), stateDir, runner: native.run });
  await other.install(['eli5-visual'], ['codex']);
  const foreign = (await other.state()).records[0];
  await installer.install(['eli5-visual'], ['claude']);
  assert.deepEqual(pairs((await updater.plan([], [], { update: true })).records), ['eli5-visual/claude']);
  await updater.install([], [], { update: true });
  assert.deepEqual((await updater.state()).records.find(r => r.catalog === 'other-catalog'), foreign);
  assert(native.plugins.codex.has(foreign.selector));
});

test('update retries failed retirement without duplicating or expanding selected pairs', async t => {
  const { installer, updater, native } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['codex', 'opencode']);
  const old = (await installer.state()).records.find(r => r.harness === 'codex');
  native.failure = (name, args) => name === 'codex' && args[1] === 'remove' && args[2] === old.selector;
  await assert.rejects(updater.install([], [], { update: true }), /Partial progress/);
  assert.equal(native.plugins.codex.size, 2);
  assert((await updater.state()).records.some(r => r.status === 'failed'));
  native.failure = null;
  await updater.install([], [], { update: true });
  const state = (await updater.state()).records;
  assert.deepEqual(pairs(state), ['eli5-visual/codex', 'eli5-visual/opencode']);
  assert(state.every(r => r.version === '0.1.1' && r.status === 'installed'));
  assert.equal(native.plugins.codex.size, 1);
});

test('update can resume a failed receipt but never invents not-yet-recorded install targets', async t => {
  const { installer, updater, native, opencodeConfig } = await updateFixture(t);
  native.failure = (name, args) => name === 'codex' && args[1] === 'add' && !args.includes('--help');
  await assert.rejects(installer.install(['eli5-visual'], ['codex', 'opencode']), /Partial progress/);
  native.failure = null;
  await updater.install([], [], { update: true });
  assert.deepEqual(pairs((await updater.state()).records), ['eli5-visual/codex']);
  assert(!await exists(opencodeConfig));
});

test('unfinished removal blocks updates instead of reinstalling a removal target', async t => {
  const { installer, updater, native } = await updateFixture(t);
  await installer.install(['eli5-visual'], ['codex']);
  native.failure = (name, args) => name === 'codex' && args[1] === 'remove';
  await assert.rejects(installer.remove(['eli5-visual'], ['codex']), /Injected/);
  native.failure = null;
  const before = await readFile(installer.stateFile, 'utf8');
  const count = native.calls.length;
  await assert.rejects(updater.install([], [], { update: true }), /unfinished removal/);
  assert.equal(await readFile(installer.stateFile, 'utf8'), before);
  assert.equal(native.calls.length, count);
});
