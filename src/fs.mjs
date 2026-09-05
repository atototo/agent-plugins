import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export const json = value => JSON.stringify(value, null, 2) + '\n';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export async function exists(file) {
  try { await lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
export async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
export function inside(root, name) {
  if (!name || name.includes('\\') || path.posix.isAbsolute(name) || name.split('/').some(x => !x || x === '.' || x === '..') || /[\x00-\x1f:]/.test(name)) {
    throw new Error(`Unsafe relative path: ${name}`);
  }
  const target = path.resolve(root, name);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error(`Path escapes root: ${name}`);
  return target;
}
export async function noSymlinks(target) {
  let current = path.resolve(target);
  while (true) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symlink: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
export async function files(root, prefix = '') {
  await noSymlinks(root);
  const result = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${name}`);
    if (entry.isDirectory()) result.push(...await files(path.join(root, entry.name), name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Unsupported file type: ${name}`);
  }
  return result;
}
export async function write(file, content) {
  await noSymlinks(file);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}
// Configs and receipts may contain private paths: atomic replacement, private mode.
export async function atomicWrite(file, content, expected) {
  await noSymlinks(file);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const current = await exists(file) ? await readFile(file, 'utf8') : null;
  if (expected !== undefined && current !== expected) throw new Error(`File changed concurrently: ${file}`);
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, content, { flag: 'wx', mode: 0o600 });
    const latest = await exists(file) ? await readFile(file, 'utf8') : null;
    if (latest !== current) throw new Error(`File changed concurrently: ${file}`);
    await rename(tmp, file);
  } finally { await unlink(tmp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
