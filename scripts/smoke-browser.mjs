import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { repo } from './build.mjs';

const output = path.join(repo, '.test-output/browser');
await mkdir(output, { recursive: true });
const source = await readFile(path.join(repo, 'test/fixtures/visual-brief.html'), 'utf8');
const transport = new StdioClientTransport({ command: process.execPath,
  args: [path.join(repo, 'dist/codex/plugins/eli5-visual/runtime/launch.mjs')],
  env: { PATH: process.env.PATH || '', AGENT_PLUGINS_OUTPUT_DIR: output }, stderr: 'pipe' });
const client = new Client({ name: 'browser-smoke', version: '0.1.0' });
let browser;
let server;
try {
  await client.connect(transport);
  const result = await client.callTool({ name: 'visual_explainer_render_html', arguments: { filename: 'brief.html', html: source, open: false } });
  assert(!result.isError, JSON.stringify(result));
  const html = await readFile(path.join(output, 'brief.html'));
  // Serve only the generated fixture; no arbitrary filesystem or external interface.
  server = createServer((req, res) => {
    if (req.url !== '/') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  for (const [name, width] of [['desktop', 1200], ['mobile', 390]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    const checks = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      title: document.title, headings: [...document.querySelectorAll('h2')].map(x => x.textContent),
      fields: [...document.querySelectorAll('code')].map(x => x.textContent),
    }));
    assert.equal(checks.overflow, false, `${name}: horizontal overflow`);
    assert.equal(checks.headings.length, 3);
    assert(checks.fields.includes('status'));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ rendered: true, viewportChecks: [1200, 390], pageErrors: 0, screenshotDirectory: output, visualReview: 'Screenshots must be inspected separately; automated checks do not establish visual quality.' }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await client.close(); await transport.close();
}
