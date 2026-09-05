import path from 'node:path';
import { json, write } from '../src/fs.mjs';

export async function renderClaude(root, plugin, catalog) {
  await write(path.join(root, '.claude-plugin/plugin.json'), json({
    name: plugin.name, version: plugin.version, description: plugin.description, author: catalog.author,
  }));
  if (Object.keys(plugin.mcp).length) await write(path.join(root, '.mcp.json'), json({
    mcpServers: { [`${plugin.name}-visual-explainer`]: {
      command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/runtime/launch.mjs'],
    } },
  }));
}
export function claudeMarketplace(catalog, plugins) {
  return { name: catalog.name, owner: catalog.author, plugins: plugins.map(p => ({
    name: p.name, source: `./plugins/${p.name}`, description: p.description, version: p.version,
  })) };
}
