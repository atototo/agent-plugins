import { spawn } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'server.json'), 'utf8'));
const output = resolve(process.env.AGENT_PLUGINS_OUTPUT_DIR || join(homedir(), '.agent', 'diagrams', config.plugin));
// Only configure/start the upstream stdio server; no tool/protocol implementation here.
for (let dir = output; ; dir = dirname(dir)) {
  if (lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Output directory contains a symlink: ${dir}`);
  if (dirname(dir) === dir) break;
}
mkdirSync(output, { recursive: true, mode: 0o700 });
const child = spawn(process.execPath, [join(root, config.entry)], {
  stdio: 'inherit',
  env: { ...process.env, VISUAL_EXPLAINER_OUTPUT_DIR: output },
});
child.on('error', error => { process.stderr.write(`Cannot launch visual-explainer: ${error.message}\n`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
