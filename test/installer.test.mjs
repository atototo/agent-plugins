import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, readFile, symlink, writeFile } from 'node:fs/promises';
import { exists, json, readJson, write } from '../src/fs.mjs';
import { parseConfig } from '../src/config.mjs';
import { fixture } from './helpers.mjs';
import { Installer } from '../src/installer.mjs';

test('one install configures all three adapters and repeated install is idempotent', async t => {
  const { installer, native, opencodeConfig } = await fixture(t);
  assert.equal((await installer.install(['eli5-visual'], ['codex', 'claude', 'opencode'])).length, 3);
  assert.equal((await installer.state()).records.length, 3);
  const count = native.calls.filter(x => ['add', 'install'].includes(x[2]) && x[1] === 'plugin' && !x.includes('--help')).length;
  await installer.install(['eli5-visual'], ['codex', 'claude', 'opencode']);
  assert.equal(native.calls.filter(x => ['add', 'install'].includes(x[2]) && x[1] === 'plugin' && !x.includes('--help')).length, count);
  assert.equal(parseConfig(await readFile(opencodeConfig, 'utf8')).plugin.length, 1);
  assert((await installer.doctor()).every(x => x.configured));
});

test('OpenCode install/remove preserves unrelated settings, comments, and later edits', async t => {
  const { installer, opencodeConfig, stateDir } = await fixture(t);
  await write(opencodeConfig, '{\n  // keep this explanation\n  "model": "provider/model",\n  "plugin": [\n    // existing plugin\n    "existing-plugin",\n  ],\n}\n');
  await installer.install(['eli5-visual'], ['opencode']);
  let text = await readFile(opencodeConfig, 'utf8');
  assert(text.includes('// existing plugin'));
  text = text.replace('provider/model', 'provider/new-model');
  await writeFile(opencodeConfig, text);
  await installer.remove(['eli5-visual'], ['opencode']);
  const after = await readFile(opencodeConfig, 'utf8');
  assert(after.includes('// keep this explanation'));
  assert(after.includes('// existing plugin'));
  assert.equal(parseConfig(after).model, 'provider/new-model');
  assert.deepEqual(parseConfig(after).plugin, ['existing-plugin']);
  assert(await exists(path.join(stateDir, 'releases')));
});

test('preflight fails before changing any harness if one selected CLI is missing', async t => {
  const { installer, native, opencodeConfig } = await fixture(t);
  native.failure = (name, args) => name === 'claude' && args[0] === '--version';
  await assert.rejects(installer.install(['eli5-visual'], ['codex', 'claude', 'opencode']), /Injected/);
  assert.equal(native.plugins.codex.size, 0);
  assert(!await exists(opencodeConfig));
  assert.equal((await installer.state()).records.length, 0);
});

test('partial native failure is recorded and can be resumed without duplicating successful targets', async t => {
  const { installer, native } = await fixture(t);
  native.failure = (name, args) => name === 'claude' && args[1] === 'install' && !args.includes('--help');
  await assert.rejects(installer.install(['eli5-visual'], ['codex', 'claude', 'opencode']), /Partial progress/);
  const state = await installer.state();
  assert.equal(state.records.find(x => x.harness === 'codex').status, 'installed');
  assert.equal(state.records.find(x => x.harness === 'claude').status, 'failed');
  native.failure = null;
  await installer.install(['eli5-visual'], ['codex', 'claude', 'opencode']);
  assert.equal((await installer.state()).records.filter(x => x.status === 'installed').length, 3);
  assert.equal(native.plugins.codex.size, 1);
});

test('uninstall never removes an unowned native plugin or the entire marketplace', async t => {
  const { installer, native } = await fixture(t);
  native.plugins.codex.add('eli5-visual@someone-else');
  await installer.install(['eli5-visual'], ['codex', 'claude']);
  await installer.remove(['eli5-visual'], ['codex', 'claude']);
  assert(native.plugins.codex.has('eli5-visual@someone-else'));
  assert(!native.calls.some(x => x[2] === 'marketplace' && x[3] === 'remove'));
  assert(native.calls.some(x => x[0] === 'claude' && x[2] === 'uninstall' && x.includes('--keep-data')));
});

test('rejects unowned entries and invalid JSONC without overwriting anything', async t => {
  const { installer, opencodeConfig } = await fixture(t);
  const { records } = await installer.plan(['eli5-visual'], ['opencode']);
  await write(opencodeConfig, json({ plugin: [records[0].reference] }));
  await assert.rejects(installer.install(['eli5-visual'], ['opencode']), /not owned/);
  await writeFile(opencodeConfig, '{ "plugin": [], "plugin": [] }');
  await assert.rejects(installer.install(['eli5-visual'], ['opencode']), /Duplicate/);
});

test('rejects symlinked config without modifying target', async t => {
  const { installer, root, opencodeConfig } = await fixture(t);
  const target = path.join(root, 'private.json');
  await write(target, '{}');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(path.dirname(opencodeConfig), { recursive: true });
  await symlink(target, opencodeConfig);
  await assert.rejects(installer.install(['eli5-visual'], ['opencode']), /symlink/);
  assert.equal(await readFile(target, 'utf8'), '{}');
});

test('operation lock prevents concurrent mutations and live locks cannot be cleared', async t => {
  const { installer } = await fixture(t);
  await installer.locked(async () => {
    await assert.rejects(installer.install(['eli5-visual'], ['opencode']), /Another operation/);
    await assert.rejects(installer.unlock(), /still running/);
  });
});

test('explicit update replaces only the owned old plugin entry', async t => {
  const { installer, root, native, opencodeConfig } = await fixture(t);
  await installer.install(['eli5-visual'], ['codex', 'opencode']);
  const source = path.join(root, 'new-bundle');
  await cp(installer.source, source, { recursive: true });
  // Simulate another verified release without changing real source files.
  const { sha256 } = await import('../src/fs.mjs');
  const manifest = await readJson(path.join(source, 'bundle.json'));
  manifest.plugins[0].version = '0.1.1';
  for (const name of ['codex/plugins/eli5-visual/.codex-plugin/plugin.json', 'claude/plugins/eli5-visual/.claude-plugin/plugin.json', 'opencode/plugins/eli5-visual/package.json']) {
    const data = await readJson(path.join(source, name)); data.version = '0.1.1';
    const text = json(data); await write(path.join(source, name), text); manifest.files[name] = sha256(text);
  }
  const { digest, ...body } = manifest;
  await write(path.join(source, 'bundle.json'), json({ ...body, digest: sha256(json(body)) }));
  const updater = new Installer({ source, stateDir: installer.stateDir, opencodeConfig, runner: native.run });
  await assert.rejects(updater.install(['eli5-visual'], ['codex']), /update explicitly/);
  await updater.install(['eli5-visual'], ['codex', 'opencode'], { update: true });
  assert.equal(native.plugins.codex.size, 1);
  assert.equal(parseConfig(await readFile(opencodeConfig, 'utf8')).plugin.length, 1);
  assert((await updater.state()).records.every(x => x.version === '0.1.1'));
});
