import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { repo } from '../scripts/build.mjs';

test('public npm archive includes runtime and licenses, excludes local credentials and test artifacts', async () => {
  const pkg = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@atototo/agent-plugins');
  assert.equal(pkg.license, 'MIT');
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  const { stdout } = await promisify(execFile)('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: repo, maxBuffer: 4e6 });
  const [archive] = JSON.parse(stdout);
  const paths = new Set(archive.files.map(file => file.path));
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'bin/agent-plugins.mjs', 'src/installer.mjs', 'dist/bundle.json']) assert(paths.has(file), file);
  for (const file of paths) assert(!/(^|\/)(?:\.npmrc|\.env(?:\..*)?|\.git|\.test-output|node_modules|test|scripts)(?:\/|$)/.test(file), `Private/development path leaked: ${file}`);
  const license = await readFile(path.join(repo, 'LICENSE'), 'utf8');
  for (const harness of ['codex', 'claude', 'opencode']) {
    const root = `dist/${harness}/plugins/eli5-visual`;
    for (const file of ['LICENSE', 'runtime/launch.mjs', 'runtime/THIRD_PARTY_NOTICES.md', 'skills/eli5-visual/SKILL.md']) assert(paths.has(`${root}/${file}`), `${root}/${file}`);
    assert.equal(await readFile(path.join(repo, root, 'LICENSE'), 'utf8'), license);
  }
});
