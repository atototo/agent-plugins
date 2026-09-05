import path from 'node:path';
import { json, write } from '../src/fs.mjs';

export async function renderOpenCode(root, plugin) {
  // A real OpenCode config hook: resources remain inside this plugin package.
  await write(path.join(root, 'index.mjs'), `import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
export default async function AgentPlugin() {
  return { async config(config) {
    config.skills ??= {};
    config.skills.paths ??= [];
    const skills = join(root, 'skills');
    if (!config.skills.paths.includes(skills)) config.skills.paths.push(skills);
    ${Object.keys(plugin.mcp).length ? `config.mcp ??= {};
    const key = ${JSON.stringify(`${plugin.name}-visual-explainer`)};
    const desired = { type: 'local', command: ['node', join(root, 'runtime/launch.mjs')], enabled: true };
    if (config.mcp[key] && JSON.stringify(config.mcp[key]) !== JSON.stringify(desired)) {
      throw new Error('MCP configuration conflict: ' + key + '. Existing configuration was not overwritten.');
    }
    config.mcp[key] = desired;` : ''}
  } };
}
`);
  await write(path.join(root, 'package.json'), json({
    name: `agent-plugins-${plugin.name}`, version: plugin.version, private: true, type: 'module', main: './index.mjs',
  }));
}
