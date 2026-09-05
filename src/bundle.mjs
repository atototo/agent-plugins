import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { files, inside, json, readJson, sha256 } from './fs.mjs';

export const HARNESSES = ['codex', 'claude', 'opencode'];
export const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function checkName(name) {
  if (typeof name !== 'string' || name.length > 64 || !identifier.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}
export async function verifyBundle(root) {
  const manifest = await readJson(path.join(root, 'bundle.json'));
  if (manifest.schemaVersion !== 1 || !manifest.files || !Array.isArray(manifest.plugins) || !manifest.plugins.length) throw new Error('Unsupported bundle manifest');
  checkName(manifest.name);
  const names = new Set();
  for (const plugin of manifest.plugins) {
    checkName(plugin.name);
    if (names.has(plugin.name)) throw new Error('Duplicate plugin');
    names.add(plugin.name);
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(plugin.version)) throw new Error('Invalid plugin version');
  }
  const actual = (await files(root)).filter(x => x !== 'bundle.json').sort();
  const declared = Object.keys(manifest.files).sort();
  if (json(actual) !== json(declared)) throw new Error('Bundle file inventory mismatch');
  for (const name of declared) {
    if (sha256(await readFile(inside(root, name))) !== manifest.files[name]) throw new Error(`Bundle checksum mismatch: ${name}`);
  }
  for (const harness of HARNESSES) for (const plugin of manifest.plugins) {
    const base = `${harness}/plugins/${plugin.name}`;
    const entry = harness === 'opencode' ? `${base}/index.mjs` : `${base}/.${harness === 'codex' ? 'codex' : 'claude'}-plugin/plugin.json`;
    if (!manifest.files[entry]) throw new Error(`Missing harness entry: ${entry}`);
    const metadata = await readJson(inside(root, harness === 'opencode' ? `${base}/package.json` : entry));
    if (metadata.version !== plugin.version || metadata.name !== (harness === 'opencode' ? `agent-plugins-${plugin.name}` : plugin.name)) throw new Error(`Plugin metadata mismatch: ${entry}`);
  }
  const { digest, ...body } = manifest;
  if (digest !== sha256(json(body))) throw new Error('Bundle manifest digest mismatch');
  return manifest;
}
