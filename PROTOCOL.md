# LoopKit Protocol v0

The LoopKit Protocol defines how to create HTML artifacts that can collect feedback directly inside the interface and pass that feedback to AI for the next iteration.

## 1. Core Loop

```text
HTML v1
-> user leaves feedback inside the HTML
-> user exports a feedback bundle
-> AI produces HTML v2
-> bundle v1 is spent
```

## 2. Artifact

A minimal LoopKit artifact contains:

- metadata;
- `DECISIONS`;
- `data-loop-id` anchors on important elements;
- a linked `loopkit.js` runtime or an inline runtime;
- a way to export a feedback bundle.

## 3. Metadata

```html
<script type="application/loopkit+json" id="loopkit-meta">
{
  "artifactId": "my-artifact",
  "artifactVersion": "v1",
  "title": "My Artifact"
}
</script>
```

Snake_case aliases are also supported: `artifact_id`, `artifact_version`.

## 4. DECISIONS

`DECISIONS` is a short list of durable decisions that survive between versions.

```html
<script type="text/plain" id="loopkit-decisions">
DECISIONS:
- Feedback is single-use.
- Do not add sound.
- Keep the UI minimal.
</script>
```

It is not a changelog and not a comment history.

## 5. Anchors

Important elements get semantic anchors:

```html
<section data-loop-id="hero" data-loop-kind="section" data-loop-title="Hero section"></section>
<button data-loop-id="hero.cta" data-loop-kind="button" data-loop-title="Hero CTA"></button>
```

`data-loop-id` must be unique within the current artifact version.

## 6. Runtime Modes

- `Mark up` selects an element and attaches a comment to it.
- `Comments` leaves a free pin comment.
- `Tweaks` is request-only: it asks the agent to add tweak controls in the next version.
- `Copy bundle` exports the feedback bundle.

In v0, `Tweaks` does not have to render an interactive control panel. Tweak panels are a future layer on top of this protocol.

## 7. Keyboard Behavior

When LoopKit is only floating above the artifact and no mode is active, the artifact should receive keyboard input normally.

When `Mark up`, `Comments`, or `Tweaks` is active, or when the composer or drawer is open, LoopKit should intercept keyboard input so it does not conflict with the artifact.

## 8. Feedback Bundle

A feedback bundle is a portable package of feedback for AI.

It is valid only for the artifact version that exported it.

Minimal item shape:

```json
{
  "type": "markup.comment",
  "target": {
    "id": "hero.cta",
    "title": "Hero CTA"
  },
  "message": "The button is too quiet"
}
```

## 9. Single-Use Rule

Feedback lives for one iteration.

After a new version is released, the old bundle is considered spent and is not carried forward.

If the issue remains, the user should leave new feedback on the new version.

## 10. Agent Obligations

The agent must:

1. verify the bundle version;
2. read `DECISIONS`;
3. respond to every feedback item;
4. surface conflicts instead of resolving them silently;
5. create a new version;
6. avoid carrying old feedback forward automatically.

## 11. Linked and Standalone

These are not two product modes. They are two delivery formats for the same runtime.

```text
Linked:     artifact.html + loopkit.js
Standalone: artifact.standalone.html with loopkit.js inlined
```

Linked is better for development. Standalone is better when you need to send one file to anyone.
