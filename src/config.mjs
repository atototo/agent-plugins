import { parse, parseTree, modify, applyEdits } from 'jsonc-parser';
import { readFile } from 'node:fs/promises';
import { atomicWrite, exists, noSymlinks } from './fs.mjs';

export function parseConfig(text) {
  const errors = [];
  const value = parse(text, errors, { allowTrailingComma: true });
  if (errors.length || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('OpenCode config must be a valid JSON/JSONC object');
  // Duplicate keys are ambiguous; do not edit them using last-key-wins semantics.
  function unique(node) {
    if (node?.type === 'object') {
      const seen = new Set();
      for (const child of node.children || []) {
        const key = child.children[0].value;
        if (seen.has(key)) throw new Error(`Duplicate config key: ${key}`);
        seen.add(key); unique(child.children[1]);
      }
    } else for (const child of node?.children || []) unique(child);
  }
  unique(parseTree(text));
  if (value.plugin !== undefined && (!Array.isArray(value.plugin) || value.plugin.some(x => typeof x !== 'string' && !(Array.isArray(x) && typeof x[0] === 'string')))) throw new Error('Unsupported OpenCode plugin list');
  return value;
}
export async function readConfig(file) {
  await noSymlinks(file);
  const raw = await exists(file) ? await readFile(file, 'utf8') : null;
  return { raw, value: parseConfig(raw ?? '{}\n') };
}
export function pluginRefs(config) { return (config.plugin || []).map(x => typeof x === 'string' ? x : x[0]); }
export async function changePlugin(file, reference, operation) {
  const { raw, value } = await readConfig(file);
  const refs = pluginRefs(value);
  const index = refs.indexOf(reference);
  if (operation === 'add' && index >= 0) return false;
  if (operation === 'remove' && index < 0) return false;
  if (refs.filter(x => x === reference).length > 1) throw new Error('Duplicate managed plugin reference; resolve manually');
  const text = raw ?? '{}\n';
  const options = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: text.includes('\r\n') ? '\r\n' : '\n' } };
  const edits = operation === 'remove'
    ? modify(text, ['plugin', index], undefined, options)
    : value.plugin === undefined
      ? modify(text, ['plugin'], [reference], options)
      : modify(text, ['plugin', refs.length], reference, { ...options, isArrayInsertion: true });
  const next = applyEdits(text, edits);
  parseConfig(next);
  await atomicWrite(file, next, raw);
  return true;
}
