import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { checkName, HARNESSES, verifyBundle } from '../src/bundle.mjs';
import { exists, files, inside, json, noSymlinks, readJson, sha256, write } from '../src/fs.mjs';
import { renderCodex, codexMarketplace } from '../renderers/codex.mjs';
import { renderClaude, claudeMarketplace } from '../renderers/claude.mjs';
import { renderOpenCode } from '../renderers/opencode.mjs';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function vendorRuntime(destination, plugin) {
  const upstream = path.join(repo, 'node_modules/visual-explainer');
  const metadata = await readJson(path.join(upstream, 'package.json'));
  if (metadata.version !== plugin.mcp['visual-explainer'].version) throw new Error('Upstream version does not match plugin definition');
  const vendor = path.join(destination, 'vendor/visual-explainer');
  await cp(path.join(upstream, 'plugins/visual-explainer'), path.join(vendor, 'plugins/visual-explainer'), { recursive: true });
  await write(path.join(vendor, 'package.json'), json({ name: metadata.name, version: metadata.version, type: 'module', license: metadata.license }));
  // Keep quick/render.mjs separate: its import.meta.url locates its own CSS.
  const bundle = await build({
    absWorkingDir: repo,
    entryPoints: [path.join(upstream, 'plugins/visual-explainer/mcp/server.mjs')],
    outfile: path.join(vendor, 'plugins/visual-explainer/mcp/server.mjs'),
    bundle: true, platform: 'node', target: 'node22', format: 'esm',
    external: ['../quick/render.mjs'], metafile: true,
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
    legalComments: 'eof', logLevel: 'silent',
  });
  const packages = new Set([upstream]);
  for (const input of Object.keys(bundle.metafile.inputs)) {
    let dir = path.dirname(path.resolve(repo, input));
    while (dir.startsWith(path.join(repo, 'node_modules'))) {
      if (await exists(path.join(dir, 'package.json'))) {
        const candidate = await readJson(path.join(dir, 'package.json'));
        if (candidate.name && candidate.version) { packages.add(dir); break; }
      }
      dir = path.dirname(dir);
    }
  }
  let notices = '# Bundled third-party code\n\n';
  for (const dir of [...packages].sort()) {
    const pkg = await readJson(path.join(dir, 'package.json'));
    notices += `## ${pkg.name} ${pkg.version}\n\nLicense: ${pkg.license || 'see upstream'}\n\n`;
    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
      if (await exists(path.join(dir, name))) { notices += (await readFile(path.join(dir, name), 'utf8')) + '\n\n'; break; }
    }
  }
  await write(path.join(destination, 'THIRD_PARTY_NOTICES.md'), notices);
  await cp(path.join(repo, 'runtime/launch.mjs'), path.join(destination, 'launch.mjs'));
  await write(path.join(destination, 'server.json'), json({ plugin: plugin.name, entry: 'vendor/visual-explainer/plugins/visual-explainer/mcp/server.mjs', version: metadata.version }));
}

function validateDefinition(p, name) {
  const allowed = ['schemaVersion', 'name', 'version', 'displayName', 'description', 'category', 'skills', 'mcp', 'browserVerification'];
  for (const key of Object.keys(p)) if (!allowed.includes(key)) throw new Error(`Unsupported capability/field: ${key}`);
  if (p.schemaVersion !== 1 || p.name !== name) throw new Error('Invalid plugin identity');
  checkName(p.name);
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(p.version)) throw new Error('Invalid semantic version');
  for (const key of ['displayName', 'description', 'category']) if (typeof p[key] !== 'string' || !p[key].trim()) throw new Error(`Missing ${key}`);
  if (!Array.isArray(p.skills) || !p.skills.length || new Set(p.skills).size !== p.skills.length) throw new Error('Invalid skills');
  for (const skill of p.skills) checkName(skill);
  p.mcp ??= {};
  for (const [key, value] of Object.entries(p.mcp)) if (key !== 'visual-explainer' || value.provider !== key || value.version !== '0.11.0') throw new Error('Unsupported MCP provider/version; add and test a build adapter first');
  if (p.browserVerification !== 'host-first') throw new Error('Unsupported verification policy');
}

export async function buildBundle(output = path.join(repo, 'dist')) {
  output = path.resolve(output);
  await noSymlinks(output);
  const catalog = await readJson(path.join(repo, 'catalog.json'));
  checkName(catalog.name);
  if (catalog.schemaVersion !== 1 || !catalog.plugins?.length || new Set(catalog.plugins).size !== catalog.plugins.length) throw new Error('Invalid catalog');
  const plugins = [];
  for (const name of catalog.plugins) {
    checkName(name);
    const plugin = await readJson(inside(repo, `plugins/${name}/plugin.json`));
    validateDefinition(plugin, name);
    plugins.push(plugin);
  }
  await mkdir(path.dirname(output), { recursive: true });
  const stage = await mkdtemp(path.join(path.dirname(output), '.agent-plugins-build-'));
  try {
    for (const plugin of plugins) {
      for (const harness of HARNESSES) {
        const target = path.join(stage, harness, 'plugins', plugin.name);
        await mkdir(target, { recursive: true });
        await cp(path.join(repo, 'LICENSE'), path.join(target, 'LICENSE'));
        for (const name of plugin.skills) {
          const source = path.join(repo, 'plugins', plugin.name, 'skills', name);
          await files(source); // Reject symlinks before copying any source resource.
          const skillRoot = path.join(target, 'skills', name);
          await cp(source, skillRoot, { recursive: true });
          await write(path.join(skillRoot, 'references/harness.md'), await readFile(path.join(repo, `renderers/guidance/${harness}.md`)));
        }
        if (Object.keys(plugin.mcp).length) await vendorRuntime(path.join(target, 'runtime'), plugin);
        await { codex: renderCodex, claude: renderClaude, opencode: renderOpenCode }[harness](target, plugin, catalog);
      }
    }
    await write(path.join(stage, 'codex/.agents/plugins/marketplace.json'), json(codexMarketplace(catalog, plugins)));
    await write(path.join(stage, 'claude/.claude-plugin/marketplace.json'), json(claudeMarketplace(catalog, plugins)));
    const hashes = {};
    for (const name of (await files(stage)).sort()) hashes[name] = sha256(await readFile(inside(stage, name)));
    const body = { schemaVersion: 1, name: catalog.name, plugins: plugins.map(p => ({ name: p.name, version: p.version })), files: hashes };
    const manifest = { ...body, digest: sha256(json(body)) };
    await write(path.join(stage, 'bundle.json'), json(manifest));
    await verifyBundle(stage);
    if (await exists(output)) {
      // Never clear an arbitrary directory. Only replace a previously verified build.
      await verifyBundle(output);
      const previous = `${stage}-previous`;
      await rename(output, previous);
      try { await rename(stage, output); } catch (error) { await rename(previous, output); throw error; }
      await rm(previous, { recursive: true });
    } else await rename(stage, output);
    return manifest;
  } finally { await rm(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildBundle();
  console.log(`Built ${result.plugins.length} plugin(s) for ${HARNESSES.join(', ')}: ${result.digest.slice(0,12)}`);
}
