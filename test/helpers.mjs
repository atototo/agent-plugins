import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { Installer } from '../src/installer.mjs';
import { repo } from '../scripts/build.mjs';

export async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-plugins-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const stateDir = path.join(root, 'state with spaces');
  const opencodeConfig = path.join(root, 'config/opencode.jsonc');
  const native = fakeNative();
  const installer = new Installer({ source: path.join(repo, 'dist'), stateDir, opencodeConfig, runner: native.run, ...options });
  return { root, stateDir, opencodeConfig, native, installer };
}

// Test double only: not evidence that an installed harness accepted the package.
export function fakeNative() {
  const plugins = { codex: new Set(), claude: new Set() };
  const markets = { codex: new Map(), claude: new Map() };
  const calls = [];
  const mock = { plugins, markets, calls, failure: null };
  mock.run = async (name, args) => {
    calls.push([name, ...args]);
    if (mock.failure?.(name, args)) throw new Error('Injected native failure');
    if (args[0] === '--version') return name === 'codex' ? 'codex-cli 0.153.4' : '2.1.232 (Claude Code test-double)';
    if (args.includes('--help')) return 'test-double --keep-data';
    if (args[1] === 'marketplace') {
      if (args[2] === 'list') return JSON.stringify([...markets[name]].map(([market, root]) => ({ name: market, source: { path: root }, path: root })));
      if (args[2] === 'add') {
        const { readJson } = await import('../src/fs.mjs');
        const file = path.join(args[3], name === 'codex' ? '.agents/plugins/marketplace.json' : '.claude-plugin/marketplace.json');
        markets[name].set((await readJson(file)).name, args[3]); return '{}';
      }
    }
    if (args[1] === 'list') return JSON.stringify([...plugins[name]].map(id => ({ id, installed: true })));
    if (['install', 'add'].includes(args[1])) { plugins[name].add(args[2]); return '{}'; }
    if (['remove', 'uninstall'].includes(args[1])) { plugins[name].delete(args[2]); return '{}'; }
    throw new Error(`Unexpected test command: ${name} ${args.join(' ')}`);
  };
  return mock;
}
