# Verify the delivered artifact

Keep three checks separate:

1. **Source fidelity:** compare the output against the internal must-preserve fact
   inventory. No browser can establish that a decision, condition, or number from
   the source survived.
2. **Structure:** read the final saved HTML, verify the required document/fragment
   shape, references, headings, and responsive rules. Native inline output must
   satisfy its live root-ID and delivery-reference requirements.
3. **Rendered inspection:** open that same artifact in an available browser and
   actually inspect its rendered appearance. For a tall brief, inspect across the
   document by scrolling or using readable captures, not a tiny full-page thumbnail.
   Check hierarchy, labels/connectors, readable text, clipping, contrast and scroll
   rhythm. Check narrow layout where responsive behavior matters. DOM measurements
   and console checks supplement visual inspection; neither replaces it.

Use the current host's browser tools and their live instructions first. Otherwise
use a suitable already-connected browser MCP, installed CLI, or existing local
test runner. Choose one working route; do not duplicate the test across tools.
No specific browser vendor or MCP is required. A CLI screenshot is useful only
when the current model can actually inspect it; an accessibility snapshot alone
is not a visual layout review.

Inspect the finished candidate once, then iterate only for material findings.
If the artifact changes, recheck the affected parts. Do not keep taking near-
identical intermediate screenshots. A native fragment should be tested in its
actual host or a genuinely equivalent preview, not an unrelated standalone theme.

## When a check is blocked

Retain the exact artifact path returned by a successful HTML-output tool before
starting checks. A later verification failure does not undo that result.

If a check fails because of permissions, sandbox/namespace creation (such as
`bwrap`), or missing tools, distinguish an unavailable checker from a defect in
the HTML. Try another route only if it is already available, authorized, and
addresses the cause. Rephrasing the same shell command does not resolve a
namespace failure. If no such route exists, stop the blocked check and deliver
the existing artifact reference; do not regenerate the HTML just to obtain a link.

State only checks actually completed. If saved-file readback was blocked, say
the output tool reported the file saved but you could not independently read it
back. Reviewing the submitted HTML or its source facts is not saved-file
verification. If no rendered inspection was possible, say so separately; do not
claim source checks passed merely because the browser was unavailable. Give the
concrete blocker and the remaining check alongside the link, without burying the
deliverable in diagnostics. If saving itself failed, do not invent a file path.

Do not silently install tools or weaken security. A browser failure is not a
passing test. A failed display reference is not delivery. Do not claim screenshots
were reviewed unless they were actually available to and inspected by the agent.
