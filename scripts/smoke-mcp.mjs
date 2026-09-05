import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { repo } from './build.mjs';

export async function smokeMcp(root = path.join(repo, 'dist/codex/plugins/eli5-visual')) {
  const output = await mkdtemp(path.join(tmpdir(), 'agent-plugins-mcp-'));
  const transport = new StdioClientTransport({
    command: process.execPath, args: [path.join(root, 'runtime/launch.mjs')],
    env: { PATH: process.env.PATH || '', AGENT_PLUGINS_OUTPUT_DIR: output }, stderr: 'pipe',
  });
  const client = new Client({ name: 'agent-plugins-smoke', version: '0.1.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    for (const name of ['visual_explainer_prepare', 'visual_explainer_render_html', 'visual_explainer_render_quick']) assert(tools.some(t => t.name === name));
    const prepared = await client.callTool({ name: 'visual_explainer_prepare', arguments: { topic: '큐', goal: '처리 순서 이해' } });
    assert(!prepared.isError);
    const resources = await client.listResources();
    assert(resources.resources.some(x => x.uri === 'visual-explainer://quick/schema.json'));
    await client.readResource({ uri: 'visual-explainer://quick/schema.json' });
    const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>큐</title></head><body><main><h1>작업을 순서대로 처리하는 큐</h1><p>먼저 들어온 작업을 먼저 꺼냅니다.</p></main></body></html>';
    const rendered = await client.callTool({ name: 'visual_explainer_render_html', arguments: { filename: 'full.html', html, open: false } });
    assert(!rendered.isError, JSON.stringify(rendered));
    assert((await readFile(path.join(output, 'full.html'), 'utf8')).includes('먼저 들어온'));
    const quick = await client.callTool({ name: 'visual_explainer_render_quick', arguments: { filename: 'quick.html', spec: { title: 'Queue', sections: [{ title: 'Sequence', steps: [{ title: 'Submit', body: 'Create a task' }] }] } } });
    assert(!quick.isError, JSON.stringify(quick));
    assert((await readFile(path.join(output, 'quick.html'), 'utf8')).includes('Queue'));
    const invalid = await client.callTool({ name: 'visual_explainer_render_html', arguments: { filename: '../outside.html', html } });
    assert(invalid.isError, 'Traversal must be rejected');
    assert.deepEqual((await readdir(output)).sort(), ['full.html', 'quick.html']);
    return { protocol: 'passed', fullHtml: 'passed', quickHtml: 'passed', pathConfinement: 'passed', browserInspection: 'not-performed' };
  } finally { await client.close(); await transport.close(); await rm(output, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(repo, 'scripts/smoke-mcp.mjs')) console.log(JSON.stringify(await smokeMcp(), null, 2));
