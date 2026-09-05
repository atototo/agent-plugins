#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { Installer } from '../src/installer.mjs';
import { HARNESSES, verifyBundle } from '../src/bundle.mjs';

const usage = `agent-plugins <command> [plugin ...] [options]

  list                 List plugins in the prebuilt bundle
  validate             Verify prebuilt files and checksums (no writes)
  install / update     Configure selected plugins in selected harnesses
  status / doctor      Show receipts / check configured state
  remove               Remove owned registrations; preserve HTML and snapshots
  unlock               Remove an interrupted operation lock only if its owner exited

  --harness all|codex,claude,opencode  Target harnesses (repeatable)
  --source DIR         Prebuilt bundle directory (default: packaged dist/)
  --state-dir DIR      Installer-owned storage directory
  --opencode-config FILE  Explicit global OpenCode JSON/JSONC config
  --dry-run            Print install/update/remove plan; do not execute it
  --yes                Confirm mutations non-interactively

Node 22+ required. Nothing is installed through npm lifecycle scripts.
`;

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    harness: { type: 'string', multiple: true }, source: { type: 'string' },
    'state-dir': { type: 'string' }, 'opencode-config': { type: 'string' },
    'dry-run': { type: 'boolean' }, yes: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  const [command, ...names] = positionals;
  if (values.help || !command) { console.log(usage); return; }
  const source = values.source || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  const installer = new Installer({ source, stateDir: values['state-dir'], opencodeConfig: values['opencode-config'] });
  const print = value => console.log(JSON.stringify(value, null, 2));
  if (['list', 'validate'].includes(command)) {
    const bundle = await verifyBundle(source);
    print(command === 'list' ? bundle.plugins : { valid: true, digest: bundle.digest, files: Object.keys(bundle.files).length }); return;
  }
  if (command === 'status') { print(await installer.state()); return; }
  if (command === 'doctor') {
    const result = await installer.doctor(); print(result);
    if (result.some(x => x.error || !x.configured || x.receipt !== 'installed')) process.exitCode = 1;
    return;
  }
  if (!['install', 'update', 'remove', 'unlock'].includes(command)) throw new Error(`Unknown command: ${command}`);
  let targets = (values.harness || []).flatMap(x => x.split(','));
  if (targets.includes('all')) {
    if (targets.length !== 1) throw new Error('Use all alone'); targets = HARNESSES;
  }
  if (command !== 'unlock' && !targets.length) {
    if (!process.stdin.isTTY) throw new Error('Specify --harness all or a comma-separated selection');
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { const answer = (await input.question('Target harnesses [all/codex/claude/opencode, comma-separated]: ')).trim(); targets = answer === 'all' ? HARNESSES : answer.split(','); }
    finally { input.close(); }
  }
  if (command !== 'unlock' && !names.length) throw new Error('Specify a plugin name; use list to see available plugins');
  if (command === 'install' || command === 'update') {
    const { manifest, records } = await installer.plan(names, targets, { update: command === 'update' });
    print({ action: command, digest: manifest.digest, targets: records.map(r => ({ plugin: r.plugin, harness: r.harness, version: r.version, config: r.configFile, selector: r.selector })) });
  } else if (command === 'remove') {
    installer.targets(targets);
    print({ action: command, records: (await installer.state()).records.filter(r => names.includes(r.plugin) && targets.includes(r.harness)).map(r => ({ plugin: r.plugin, harness: r.harness, version: r.version })) });
  }
  if (values['dry-run']) return;
  if (!values.yes) {
    if (!process.stdin.isTTY) throw new Error('Use --yes to apply this plan or --dry-run to inspect it');
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { if ((await input.question('Apply these changes? [y/N] ')).trim().toLowerCase() !== 'y') return; }
    finally { input.close(); }
  }
  if (command === 'unlock') { await installer.unlock(); print({ unlocked: true }); }
  else if (command === 'remove') print(await installer.remove(names, targets));
  else print(await installer.install(names, targets, { update: command === 'update' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
