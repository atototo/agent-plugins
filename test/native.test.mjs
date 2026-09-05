import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPlugin, marketplaceRows, minimumVersion, parseNativeJson, chooseOpenCodeConfig } from '../src/native.mjs';
import { fixture } from './helpers.mjs';
import { write } from '../src/fs.mjs';
import path from 'node:path';

test('Codex JSON response shape observed from CLI 0.153.4 is understood', () => {
  assert(hasPlugin({ installed: [{ pluginId: 'demo@catalog', name: 'demo', marketplaceName: 'catalog', installed: true, enabled: true }], available: [] }, 'demo@catalog'));
  assert(!hasPlugin({ available: [{ pluginId: 'demo@catalog', installed: false }] }, 'demo@catalog'));
  assert(!hasPlugin([{ id: 'demo@other' }], 'demo@catalog'));
  assert.equal(marketplaceRows({ marketplaces: [{ name: 'catalog', root: '/plugins', marketplaceSource: { sourceType: 'local', source: '/plugins' } }] }).length, 1);
});

test('unsupported output and old unsafe versions fail closed', () => {
  assert.throws(() => parseNativeJson('Please sign in first'), /non-JSON/);
  assert.throws(() => minimumVersion('2.1.211 (Claude Code)', [2, 1, 212]), /required/);
  assert.throws(() => minimumVersion('unknown', [0, 153, 4]), /determine/);
  minimumVersion('codex-cli 0.153.4', [0, 153, 4]);
  minimumVersion('Claude Code 3.0.0', [2, 1, 212]);
});

test('ambiguous OpenCode config requires explicit selection', async t => {
  const { root } = await fixture(t);
  const env = { XDG_CONFIG_HOME: path.join(root, 'xdg') };
  const base = path.join(env.XDG_CONFIG_HOME, 'opencode');
  await write(path.join(base, 'opencode.json'), '{}');
  assert.equal(await chooseOpenCodeConfig(env, root), path.join(base, 'opencode.json'));
  await write(path.join(base, 'opencode.jsonc'), '{}');
  await assert.rejects(chooseOpenCodeConfig(env, root), /Both/);
  await assert.rejects(chooseOpenCodeConfig({ OPENCODE_CONFIG: '/custom' }, root), /explicitly/);
});
