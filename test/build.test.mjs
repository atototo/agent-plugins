import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { buildBundle, repo } from '../scripts/build.mjs';
import { verifyBundle } from '../src/bundle.mjs';
import { fixture } from './helpers.mjs';
import { write } from '../src/fs.mjs';
import { smokeMcp } from '../scripts/smoke-mcp.mjs';

test('build is deterministic and the relocated package runs without its original node_modules', async t => {
  const { root } = await fixture(t);
  const output = path.join(root, 'relocated-bundle');
  const built = await buildBundle(output);
  assert.equal(built.digest, (await verifyBundle(path.join(repo, 'dist'))).digest);
  const runtime = path.join(output, 'claude/plugins/eli5-visual');
  assert.equal((await smokeMcp(runtime)).protocol, 'passed');
  const licenses = await readFile(path.join(runtime, 'runtime/THIRD_PARTY_NOTICES.md'), 'utf8');
  assert(!licenses.includes('undefined'));
  assert(licenses.includes('## zod '));
  assert(licenses.includes('Permission is hereby granted'));
});

test('build never replaces an unrelated output directory', async t => {
  const { root } = await fixture(t);
  const output = path.join(root, 'user-data');
  await write(path.join(output, 'precious.txt'), 'preserve');
  await assert.rejects(buildBundle(output));
  assert.equal(await readFile(path.join(output, 'precious.txt'), 'utf8'), 'preserve');
});
