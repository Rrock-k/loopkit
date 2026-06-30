# AGENTS.md

Instructions for AI agents that create or improve LoopKit artifacts.

LoopKit is not a bug tracker and not a permanent history system. It is a portable feedback runtime: the user leaves feedback inside the current HTML file, exports a bundle, and the agent creates the next version.

## When Creating a New Artifact

1. Create HTML that can open as a normal page.
2. Add metadata:

```html
<script type="application/loopkit+json" id="loopkit-meta">
{
  "artifactId": "my-artifact",
  "artifactVersion": "v1",
  "title": "My Artifact"
}
</script>
```

3. Add `#loopkit-decisions` with short durable decisions.
4. Prefer adding `#loopkit-agent-instructions` so the file remains understandable without a GitHub link.
5. Mark important elements with `data-loop-id`, `data-loop-kind`, and `data-loop-title`.
6. Load the runtime:

```html
<script src="./loopkit.js"></script>
```

7. For a standalone version, inline `loopkit.js` into the HTML with the build script.
8. Do not add heavy dependencies without a clear reason.

## When Creating the Next Version from a Feedback Bundle

1. Verify that the bundle belongs to the current artifact version.
2. Read `DECISIONS` and do not violate them silently.
3. Process every feedback item.
4. If items conflict with each other, surface the conflict to the user.
5. Create a new artifact version and increment `artifactVersion`.
6. In the response, list what was done for each item.
7. Do not carry the old bundle forward automatically. It is single-use.

## Single-Use Feedback Rule

A feedback bundle lives for exactly one iteration.

```text
HTML v1 + feedback bundle v1 -> HTML v2
```

After a new version is released, the old bundle is considered spent. If the issue remains, the user will leave new feedback on the new version.

## Runtime Scope v0

- `Mark up` is an element-anchored comment.
- `Comments` is a free pin comment.
- `Tweaks` is request-only. Do not generate a complex tweak panel unless the user explicitly asks for one.
- `Copy bundle` is the primary way to transfer feedback to another chat or agent.

## Do Not

- Do not ignore feedback items silently.
- Do not apply a bundle to a different HTML version.
- Do not turn LoopKit into Jira, Figma, or Webflow.
- Do not make Supabase or any API a required part of the core.
- Do not violate `DECISIONS` without explicit user confirmation.
