# LoopKit

LoopKit is a small JavaScript runtime and protocol for HTML artifacts that are meant to be improved through AI-assisted iteration.

The core loop is simple: a user opens an HTML file, clicks a specific element, leaves feedback, exports a feedback bundle, and gives that bundle to any AI agent to produce the next version.

```text
HTML v1
-> in-page feedback
-> export bundle
-> AI produces HTML v2
-> bundle v1 is spent
```

LoopKit is not a bug tracker, a Webflow clone, or a permanent history system. In v0, feedback lives for one iteration. Only durable product decisions survive between versions in `DECISIONS`.

## Loading the Runtime

### GitHub CDN

For experiments or pre-npm distribution, load `dist/loopkit.js` from jsDelivr's GitHub CDN.

```html
<script src="https://cdn.jsdelivr.net/gh/Rrock-k/loopkit@main/dist/loopkit.js"></script>
```

`@main` is convenient for quick experiments. Stable artifacts should pin a tag or commit with the runtime version they were tested against.

### npm CDN

The package name is `@rrock-k/loopkit`:

```html
<script src="https://cdn.jsdelivr.net/npm/@rrock-k/loopkit@0.4.10/dist/loopkit.js"></script>
```

`@latest` is useful only for quick experiments. Production or portfolio artifacts should pin an explicit version.

### Local Dev

```html
<script src="../dist/loopkit.js"></script>
```

Build the runtime before checking local artifacts:

```bash
npm run build
```

### Standalone Share Version

Use this when you need a single portable file. The build script inlines the runtime into the HTML artifact.

```bash
npm run standalone -- examples/basic.html examples/basic.standalone.html
```

### Minimal HTML Snippet

```html
<script type="application/loopkit+json" id="loopkit-meta">
{
  "artifactId": "my-artifact",
  "artifactVersion": "v1",
  "title": "My Artifact"
}
</script>

<script type="text/plain" id="loopkit-decisions">
DECISIONS:
- Keep the artifact as one self-contained HTML file.
- Feedback is single-use and applies to one iteration only.
</script>

<button data-loop-id="example.primary-action" data-loop-kind="button">
  Primary action
</button>

<script src="https://cdn.jsdelivr.net/gh/Rrock-k/loopkit@main/dist/loopkit.js"></script>
```

## Runtime Modes

```text
Mark up    - attach feedback to a specific element
+ Comment  - leave a free pin at the click position, without a visual anchor
Tweaks     - request-only: ask the agent to add tweak controls in the next version
Copy       - export the feedback bundle for AI
```

## Forms / Structured State

LoopKit can collect simple forms as regular feedback bundle events.

```html
<form data-loop-form="karta.intro.answer" data-loop-title="Intro answer">
  <label>
    Answer
    <textarea data-loop-field="answer" data-loop-label="Answer"></textarea>
  </label>
  <button type="button" data-loop-submit>Submit</button>
</form>
```

After submit, the shared bundle receives a `form.submit` event next to `comment.pin`, `markup.comment`, and `tweak.request`.

The event contains:

```text
formId
formTitle
formPrompt
fields
fieldLabels
fieldValuesText
fieldsMeta
```

This is a generic primitive. It is not tied to learning flows: it works for lessons, architecture decisions, research, checklists, and any HTML forms.

## DOM Inspector

In the current runtime, `Mark up` can target both explicit `data-loop-id` elements and regular DOM elements. If no stable `data-loop-id` exists, the target is stored as `dom-generated`.

`+ Comment` does not create an anchor. It stores the click position and a short `approximateTargets[]` list marked as approximate and not anchored.

Visible DOM elements take priority over `::before` and `::after`. Hold Alt/Option to explicitly target a pseudo-element.

## Collapsed Inertia Snap

Dragging the collapsed LoopKit widget uses short inertia. If the user releases immediately after movement, the snap point is computed from the projected point. If the user pauses first, inertia fades and the nearest snap point is used.

The target-zone highlight updates as the projected position crosses snap points.

## Keyboard Isolation

Textareas inside LoopKit isolate `keydown`, so space, backspace, delete, and arrow keys do not leak into the underlying artifact or presentation.

## Project Structure

```text
src/loopkit.js              source runtime
scripts/build.mjs           generates dist/loopkit.js CDN entrypoint
scripts/validate.mjs        validates LoopKit artifacts
scripts/build-standalone.mjs
examples/basic.html
dist/loopkit.js             generated CDN/package entrypoint
package.json
LICENSE
```

`src/*` is the source of truth. `dist/*` is published in the npm package and served through CDNs.

## Dist Workflow

The `Build dist` workflow runs on push when these paths change:

```text
src/**
scripts/build.mjs
package.json
.github/workflows/build-dist.yml
```

It runs `npm run build`. If `dist/loopkit.js` changes, the workflow commits it back to the same branch:

```text
build: update dist [skip ci]
```

To avoid an infinite CI loop, the job does not run for `github-actions[bot]`, and the generated commit contains `[skip ci]`.

## Commands

```bash
npm run build
npm run check
npm test
npm run pack:dry
npm run validate -- examples/basic.html
npm run standalone -- examples/basic.html examples/basic.standalone.html
```

## npm Publish

The package is prepared as a public scoped package:

```text
@rrock-k/loopkit
```

Release flow:

```bash
npm version patch
git push
git push --tags
```

Tags matching `v*` trigger `.github/workflows/publish.yml`, which builds, checks, and publishes the package with `npm publish --access public --provenance`.

For automated publishing, enable Trusted Publisher in the npm package settings:

```text
Owner: Rrock-k
Repository: loopkit
Workflow filename: publish.yml
```

## Core Rules

1. Important elements get stable `data-loop-id` anchors.
2. A feedback bundle is valid only for the artifact version that exported it.
3. The agent must handle every item in the bundle.
4. Old feedback is not carried into the next version automatically.
5. Only `DECISIONS` survive between versions.
6. Supabase or any other API can be an optional transport, but it is not LoopKit core.
