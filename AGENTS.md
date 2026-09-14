<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

GitHub Issues are the active implementation backlog. Keep `IMPLEMENTATION_PLAN.md` as the high-level roadmap/checklist and synchronize relevant issue links and status. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository; domain guidance is rooted at `CONTEXT.md` with decisions in `docs/adr/` when those files exist. See `docs/agents/domain.md`.

## Engineering workflow

- Keep the normal loop lightweight: inspect the repository, make the smallest sound change, verify it, use the Codex Playwright CLI skill when UI behavior matters, run lint/validation, and summarize the result.
- Use `triage` when reviewing or organizing the GitHub Issues backlog.
- Use `code-review` before considering a meaningful feature or branch complete.
- Use `diagnosing-bugs` when a bug survives one or two normal fix attempts.
- Use `tdd` selectively for logic-heavy, regression-sensitive work and bug fixes.
- Use `research` when implementation depends on current technical documentation or external behavior.
- Do not add heavyweight workflow ceremony to trivial changes.
