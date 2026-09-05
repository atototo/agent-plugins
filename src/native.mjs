import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { exists } from './fs.mjs';

const exec = promisify(execFile);
export async function run(command, args) {
  try {
    const { stdout } = await exec(command, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    return stdout;
  } catch (error) {
    // Native output can include account/config data. Do not persist or print it.
    throw new Error(`${command} ${args.slice(0, 3).join(' ')} failed (${error.code ?? 'unknown'}). Inspect this command directly for details.`);
  }
}
export function parseNativeJson(text) {
  try { return JSON.parse(text); } catch { throw new Error('Native CLI returned non-JSON output; check harness version/authentication'); }
}
function values(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(values)];
}
export function hasPlugin(value, selector) {
  const [name, marketplace] = selector.split('@');
  return values(value).some(v => {
    if ([v.id, v.pluginId, v.plugin_id, v.name].includes(selector)) return v.installed !== false;
    const pluginName = v.name ?? v.pluginName ?? v.plugin?.name;
    const marketName = v.marketplaceName ?? v.marketplace_name ?? v.marketplace?.name ?? v.marketplace;
    return pluginName === name && marketName === marketplace && v.installed !== false;
  });
}
export function marketplaceRows(value) {
  return values(value).filter(v => typeof v.name === 'string' && (v.path || v.root || v.source || v.installLocation));
}
export class NativeHarness {
  constructor(name, runner = run) { this.name = name; this.run = runner; }
  async check() {
    const version = (await this.run(this.name, ['--version'])).trim();
    minimumVersion(version, this.name === 'codex' ? [0, 153, 4] : [2, 1, 212]);
    const installCommand = this.name === 'codex' ? 'add' : 'install';
    await this.run(this.name, ['plugin', installCommand, '--help']);
    if (this.name === 'claude') {
      const help = await this.run(this.name, ['plugin', 'uninstall', '--help']);
      if (!help.includes('--keep-data')) throw new Error('Claude Code must support plugin uninstall --keep-data; update the harness first');
    }
    return version;
  }
  async plugins() { return parseNativeJson(await this.run(this.name, ['plugin', 'list', '--json'])); }
  async marketplaces() { return parseNativeJson(await this.run(this.name, ['plugin', 'marketplace', 'list', '--json'])); }
  async checkMarketplace(root, name) {
    const rows = marketplaceRows(await this.marketplaces());
    const existing = rows.find(row => row.name === name);
    if (existing) {
      const candidate = existing.path ?? existing.root ?? existing.installLocation ?? existing.source?.path;
      // Some harnesses copy a local marketplace to a cache. Its source still must match.
      const source = existing.source?.path ?? existing.marketplaceSource?.source;
      if (![candidate, source].some(p => typeof p === 'string' && path.resolve(p) === path.resolve(root))) {
        throw new Error(`Marketplace name conflict: ${name}. Existing source was not changed.`);
      }
      return true;
    }
    return false;
  }
  async ensureMarketplace(root, name) {
    if (await this.checkMarketplace(root, name)) return;
    await this.run(this.name, ['plugin', 'marketplace', 'add', root, ...(this.name === 'codex' ? ['--json'] : ['--scope', 'user'])]);
  }
  async install(selector) {
    await this.run(this.name, ['plugin', this.name === 'codex' ? 'add' : 'install', selector, ...(this.name === 'codex' ? ['--json'] : ['--scope', 'user'])]);
    if (!hasPlugin(await this.plugins(), selector)) throw new Error(`Native install not confirmed: ${selector}`);
  }
  async remove(selector) {
    if (!hasPlugin(await this.plugins(), selector)) return;
    await this.run(this.name, ['plugin', this.name === 'codex' ? 'remove' : 'uninstall', selector, ...(this.name === 'codex' ? ['--json'] : ['--scope', 'user', '--keep-data'])]);
    if (hasPlugin(await this.plugins(), selector)) throw new Error(`Native removal not confirmed: ${selector}`);
  }
}

export function minimumVersion(text, required) {
  const match = text.match(/\b(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error('Cannot determine native harness version');
  const actual = match.slice(1).map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i] > required[i]) return;
    if (actual[i] < required[i]) throw new Error(`Harness ${required.join('.')} or newer required (found ${actual.join('.')})`);
  }
}

export async function chooseOpenCodeConfig(env = process.env, userHome) {
  if (env.OPENCODE_CONFIG) throw new Error('OPENCODE_CONFIG is set. Pass --opencode-config explicitly to select the config to manage.');
  const base = env.OPENCODE_CONFIG_DIR || path.join(env.XDG_CONFIG_HOME || path.join(userHome, '.config'), 'opencode');
  const candidates = ['opencode.jsonc', 'opencode.json'].map(x => path.join(base, x));
  const present = [];
  for (const file of candidates) if (await exists(file)) present.push(file);
  if (present.length > 1) throw new Error('Both opencode.json and opencode.jsonc exist. Select one with --opencode-config.');
  return present[0] ?? candidates[0];
}
