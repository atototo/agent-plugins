import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixture } from './helpers.mjs';
import { verifyBundle } from '../src/bundle.mjs';
import { exists, inside, readJson } from '../src/fs.mjs';
import { repo } from '../scripts/build.mjs';

test('build emits native manifests, local MCP config and identical shared editorial content', async () => {
  const root = path.join(repo, 'dist');
  await verifyBundle(root);
  const bodies = [];
  for (const h of ['codex', 'claude', 'opencode']) bodies.push(await readFile(path.join(root, h, 'plugins/eli5-visual/skills/eli5-visual/SKILL.md'), 'utf8'));
  assert.equal(new Set(bodies).size, 1);
  const codex = await readJson(path.join(root, 'codex/plugins/eli5-visual/.mcp.json'));
  assert.equal(codex.mcpServers['eli5-visual-visual-explainer'].cwd, '.');
  const claude = await readJson(path.join(root, 'claude/plugins/eli5-visual/.mcp.json'));
  assert(claude.mcpServers['eli5-visual-visual-explainer'].args[0].startsWith('${CLAUDE_PLUGIN_ROOT}'));
});

test('rejects file tampering and unexpected inventory', async t => {
  const { root, installer } = await fixture(t);
  const target = path.join(root, 'bundle');
  await cp(installer.source, target, { recursive: true });
  await writeFile(path.join(target, 'opencode/plugins/eli5-visual/index.mjs'), 'malicious change');
  await assert.rejects(verifyBundle(target), /checksum/);
  await writeFile(path.join(target, 'unexpected.txt'), 'extra');
  await assert.rejects(verifyBundle(target), /inventory/);
});

test('all relative artifact paths stay contained', () => {
  for (const name of ['../outside', '/absolute', 'a/../b', 'a\\b', 'C:/a', './file', 'a//b']) assert.throws(() => inside('/tmp/example', name));
  assert.equal(inside('/tmp/example', 'a/b'), '/tmp/example/a/b');
});

test('OpenCode module config hook registers actual skill paths and MCP without overwriting user entries', async () => {
  const entry = path.join(repo, 'dist/opencode/plugins/eli5-visual/index.mjs');
  const plugin = (await import(pathToFileURL(entry))).default;
  const hooks = await plugin({});
  const config = { skills: { paths: ['/existing'] }, mcp: { existing: { type: 'remote', url: 'https://example.invalid' } } };
  await hooks.config(config);
  await hooks.config(config);
  assert.equal(config.skills.paths.length, 2);
  assert(config.skills.paths[1].endsWith('/eli5-visual/skills'));
  assert.equal(config.mcp.existing.url, 'https://example.invalid');
  assert.equal(config.mcp['eli5-visual-visual-explainer'].command[0], 'node');
  await assert.rejects(hooks.config({ mcp: { 'eli5-visual-visual-explainer': { enabled: false } } }), /conflict/);
});

test('CLI dry-run does not create installer state, settings, or run native commands', async t => {
  const { stateDir, opencodeConfig } = await fixture(t);
  const { stdout } = await promisify(execFile)(process.execPath, [path.join(repo, 'bin/agent-plugins.mjs'), 'install', 'eli5-visual', '--harness', 'all', '--state-dir', stateDir, '--opencode-config', opencodeConfig, '--dry-run']);
  assert.equal(JSON.parse(stdout).targets.length, 3);
  assert(!await exists(stateDir));
  assert(!await exists(opencodeConfig));
});
