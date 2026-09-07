---
name: eli5-visual
description: Explain a topic for a complete beginner with plain-language prose and visual storytelling. Use for /eli5-style, picture-based explainers, and scrollable visual briefs; not for editing technical documentation.
---

# ELI5 Visual

Create an explanation someone can understand by reading a little and looking a lot.
The visual reinforces the explanation; it does not replace needed context. For a
whole-document overview, make one coherent visual story, not a generic diagram
with a long essay appended underneath. Ease of reading comes from translation
and structure, never from discarding the information that makes the source useful.

## Outcome

For concepts with unfamiliar terms or several moving parts, deliver a short
progressive explanation and visuals that directly illustrate it. Keep words
inside diagrams sparse, but explain why the concept exists, what its terms mean,
and how the pieces connect.

For a source-based visual brief, the reader should recover the source's important
current state, target state, constraints, decisions, examples, and next actions
without reopening the source. Simplify the language, not decision-relevant content.

## Rendering and delivery partnership

This skill is the editorial layer. It decides what a beginner must understand,
what source facts must survive, how the story is ordered, and how headings retain
their meaning. The bundled visual-explainer MCP is a local HTML-output tool, not
an author, a factual verifier, or a browser test.

Before rendering, read [rendering.md](references/rendering.md) and the generated
[harness.md](references/harness.md). Prefer full HTML for source-based briefs;
quick-mode templates are optional and must not erase source-specific structure.

The portable delivery is an editable, self-contained HTML document with a working
file reference. If the current host actually exposes a live Visualize skill and
inline surface, reload that skill and follow its current fragment and content-
reference contract instead. Do not invent native tools or copy remembered host
tokens. Never describe a linked HTML file as an inline-rendered visualization.
An explicit user request for a file, export, or inline output takes precedence.

Do not create a separate site, app scaffold, or component library unless requested.
Keep the editable HTML as the deliverable. Compact-layout preferences must not
discard the story: a well-structured vertical document is allowed and encouraged.

## Choose the delivery shape

- **Concept explainer:** short prose interleaved with one or more visuals that
  directly clarify their nearby paragraph. A small concept does not need a poster.
- **Visual brief:** use for a whole document/system, long source, or reference
  deliverable. Make one continuous, scrollable document with a clear title,
  ordered sections, and a visual form chosen for each section. A broad overview
  should not be squeezed into one diagram at the top of a long prose response.

## Source fidelity for visual briefs

Before designing, internally inventory the facts that must survive:

- The concrete problem and why it matters now.
- Current state versus target state, including explicitly unfinished work.
- Exact component names, schema fields, keys, versions, dates, counts, thresholds,
  and ranges when they support a decision.
- Operating rules, exceptions, risks, gates, and "do not" conditions.
- Source-specific examples that make abstract mechanisms real.
- Decisions the reader can make next and remaining unknowns.

Map these facts into sections. Do not substitute generic labels like "validation",
"catalog", or "safe path" for a specific rule, owner, metric, status, or condition.
Do not invent precision. If a reader understands the system but cannot decide or
act because facts disappeared, restore them: an attractive poster is not a faithful
explanatory document.

## Visual-brief art direction

Treat the result as an editorial diagram document, not a chat widget. Use a
restrained palette, deliberate type hierarchy, a title block, and a legend when
it earns its place. Match information-design quality, not another brand's identity.

Use as many named sections as the source needs, often 3–6 but not a fixed count.
Each section makes one claim with the appropriate grammar: before/after, pipeline,
layered architecture, record anatomy, timeline, comparison, or decision checklist.
Make the reader's question visible first, then progress from problem to mechanism,
concrete example, and implication or next decision. Do not make every section a
row of cards or use decorative boxes without an information relationship.

Use short headings, labels, and captions; explain unfamiliar mechanisms nearby.
Short sentences are not a cap on facts. A record can show its relevant fields;
a timeline its milestones; a gate its actual acceptance conditions. Keep the story
visible while scrolling. Do not hide it in tabs, collapsed panels, or a stepper
unless interaction is requested. Use whitespace, alignment, grouping and connectors
to communicate relationships; vary diagram grammar across a consistent visual system.

## Headings are navigation, not copywriting

Name the actual subject using source terminology; use a subtitle for its scope,
relationship, or condition. Prefer factual headings such as "10분 주기 용어 생성 흐름",
"후보와 기여를 저장하는 두 테이블", or "최종 레지스트리로 넘기는 조건".

Avoid slogans like "전체 흐름은 한 줄입니다", "두 저장소면 충분합니다", or
"A가 아니라 B입니다" unless that exact contrast is a central sourced decision
whose sides are already clear. Do not strengthen a claim, urgency, metaphor, or
promise merely to make a heading memorable. Let titles wrap naturally; no manual
line breaks to manufacture a slogan.

Apply a standalone test to every heading and subtitle: without the diagram, can
a reader tell what this section explains and why it is here? Rewrite with real
nouns, actions, and conditions if not.

## Workflow

1. Establish essential facts from the supplied material; otherwise verify technical
   or changeable claims with primary sources. Inventory source fidelity before
   choosing a brief's diagrams.
2. Choose the story and delivery shape. Read the rendering and harness references.
3. Write the smallest useful explanation: definition, why it matters, key pieces,
   and a concrete example. For a brief retain status, decisions and conditions.
   Teach one new term at a time, define it plainly, then show its role.
4. Build only the scenes needed. Place concept visuals next to the prose they
   clarify; give each brief section a visual form that does its job. Keep concrete
   labels and meaningful changes between steps. Apply the heading standalone test.
5. Read [verification.md](references/verification.md). Inspect source structure,
   then inspect the actual rendered final HTML economically. Correct material
   defects and recheck affected output. Do not manufacture a second visualization
   as a substitute for testing the deliverable. If permissions or the execution
   environment block a check, follow the reference's blocked-check fallback;
   retain the generated artifact's path and proceed to delivery with limitations.
6. Deliver a working reference to every created or updated visual, cite factual
   sources, and accurately state any verification limitation. When native inline
   delivery was chosen, satisfy its live content-reference contract.

## Constraints

- Do not lead with a wall of prose, terminology index, review table, or implementation guide.
- "Few words" applies to visual labels, not an arbitrary limit on the explanation.
  ELI5 does not mean overview-only. Preserve decision-relevant detail and translate
  jargon beside it or through a diagram, field table, status list, timeline, or gate.
- Add enough explanation to answer why, what a term does, and what happens next.
  Stop when answered; avoid redundant prose and padding.
- Use examples to make the concept visible, not to turn it into an unsolicited tutorial.
  Make an analogy's limits visible when it could create a wrong mental model.
- Never return only prose after deciding an HTML visual is needed. HTML generation
  without delivery is incomplete. If HTML output is genuinely impossible, use a
  compact Mermaid diagram and short explanation, explicitly naming the limitation.
  A missing browser for verification alone does not make HTML generation impossible.
- Do not modify the user's project. Use host-owned visualization storage or the
  plugin's dedicated artifact directory. Use a new task-unique filename for new
  work; update an existing artifact only when the request actually targets it.
- Do not install browser tools, change permissions, publish files, or expose a
  network service merely to satisfy this skill without the required authorization.
