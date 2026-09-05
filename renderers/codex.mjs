import path from 'node:path';
import { json, write } from '../src/fs.mjs';

export async function renderCodex(root, plugin, catalog) {
  const manifest = {
    name: plugin.name, version: plugin.version, description: plugin.description,
    author: catalog.author, skills: './skills/',
    ...(Object.keys(plugin.mcp).length ? { mcpServers: './.mcp.json' } : {}),
    interface: {
      displayName: plugin.displayName, shortDescription: plugin.description,
      longDescription: plugin.description, developerName: catalog.author.name,
      category: plugin.category, capabilities: ['Write'],
      defaultPrompt: ['Explain this topic with a source-faithful visual brief.'],
    },
  };
  await write(path.join(root, '.codex-plugin/plugin.json'), json(manifest));
  if (Object.keys(plugin.mcp).length) await write(path.join(root, '.mcp.json'), json({
    mcpServers: { [`${plugin.name}-visual-explainer`]: { command: 'node', args: ['./runtime/launch.mjs'], cwd: '.' } },
  }));
}
export function codexMarketplace(catalog, plugins) {
  return { name: catalog.name, interface: { displayName: catalog.displayName }, plugins: plugins.map(p => ({
    name: p.name, source: { source: 'local', path: `./plugins/${p.name}` },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: p.category,
  })) };
}
