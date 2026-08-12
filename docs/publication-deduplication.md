# Publication deduplication

Status: implemented, unit-tested, and browser-verified in the configured development environment
Last reviewed: 2026-08-12

## Understanding summary

- Publishing must never change or delete the browser-local map or its private cloud revision.
- Clicking **Publish publicly now** again for the same synced revision and identical sharing settings must not create another publication or another pair of R2 derivatives.
- A new publication remains valid when the synced revision changes, including changes to anchors, metadata, or the source image.
- A new publication also remains valid when public visibility, rights basis, source, license, or attribution changes.
- The server must enforce the rule before downloading the private original or writing public R2 objects; the client-side disabled state is explanatory rather than a security boundary.
- Idempotent retries of the request that originally succeeded must still return their original result.
- Existing Public/Unlisted publications and all three current local maps remain untouched.

## Assumptions and boundary

- The current immutable revision identifier is the authoritative signal that map content changed.
- Stored publication strings and submitted strings are compared after trimming.
- This increment does not delete older superseded publications or R2 objects.
- Rotating an existing Unlisted secret requires a future explicit **Create new link** operation. It must not be disguised as republishing an unchanged map.
- No database migration is required because current publication records already contain the revision and sharing fields needed for comparison.

## Design

The owner-status response includes the current publication's revision identifier and frozen sharing fields. A shared pure comparison function determines whether the current revision and proposed settings exactly match that publication. The dialog uses the result to show **Already published** and disable the final action while leaving the fields editable.

The publish service repeats the same comparison after checking whether the request is an idempotent retry. When unchanged, it returns a conflict before reading the private R2 object, decoding the image, or creating derivative keys. Legitimate changed revisions and changed settings continue through the existing checks and compare-and-swap publication flow.

## Decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Compare immutable revision plus frozen sharing fields | Compare only revision; compare image hashes | Settings changes are legitimate publications, while the revision already captures image, anchor, and metadata changes. |
| Enforce on both client and server | Client-only disable; database-only rejection | The client explains the state; the server prevents bypasses, races, and wasted R2 work. |
| Check idempotent retry before rejecting a no-op | Reject every matching request | A network retry must recover the original successful response, especially its one-time Unlisted link. |
| Require a future explicit Unlisted-link rotation | Treat a repeated publish as link rotation | Link invalidation is consequential and should be named directly without regenerating identical public images. |

## Acceptance criteria

1. Opening Share for an unchanged Public map loads its frozen settings and shows **Already published**.
2. The publish action is disabled until at least one relevant setting or the current synced revision differs.
3. A direct unchanged request receives a clear conflict before any R2 object read or write.
4. Changing visibility or any sharing field enables publication.
5. Syncing a changed map revision enables publication.
6. An idempotent retry of a successful request still returns its original publication result.
7. Lint, TypeScript, unit tests, security audit, and a browser smoke test pass.
