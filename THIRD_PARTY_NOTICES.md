# Third-party software

The ELI5 Visual plugin bundles **visual-explainer 0.11.0** by Nico Bailon under
the MIT license: https://github.com/nicobailon/visual-explainer.

Its server and runtime dependencies are assembled from the exact versions in
package-lock.json. Full discovered license texts and package versions are emitted
into each generated plugin's `runtime/THIRD_PARTY_NOTICES.md`. The upstream quick
renderer and resources retain their original directory structure. The build bundles
server dependencies and adds a local process launcher; it does not replace the
upstream MCP implementation or claim authorship of it.

jsonc-parser is used by the installer. esbuild, the MCP client SDK, and Playwright
are development tools with their own licenses. Their package metadata and license
files remain in their npm distributions. Source publication of this repository does
not change those licenses or automatically license the user's original skill.
