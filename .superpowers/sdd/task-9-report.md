# Task 9 implementation report

Status: DONE

Baseline: `42e1884`

Implementation commits: `6498293`, `c57ff56`, `441a01b`

## Implemented

- Added a dependency-injected main-process `ReadingService` for `buildCase`, hash-bound `selectIntent`, `analyze`, and `followUp`. It rereads authoritative Store state, uses stable `plate:${sessionId}:v2` identities, serializes work per session, and rejects stale interaction/Case writes.
- Replaced public renderer `ai:*` and `retrieval:search` business channels with a narrow `reading:*` IPC surface. Preload and main process both apply nested allowlists; caller-supplied plate, facts, evidence, hashes, validation, analysis, and messages cannot cross the authority boundary.
- Split Store writes into renderer interaction writes and main-process Case/analysis/message writes. Renderer timestamps are ignored; question/category/cast time are immutable; toss progress, derived status, revisions, CAS guards, tombstones, and atomic delete semantics are enforced.
- Added raw-byte V1-to-V2 migration before Store construction. Migration creates and verifies one byte-exact atomic backup, fails closed on corrupt JSON or a stale backup, preserves `needs-review` payloads, and atomically replaces only validated output.
- Added the shared `ReadingClient` contract, Electron adapter, and browser-preview adapter with a synchronous browser SHA-256 port, lowered runtime trust, service-owned messages, monotonic browser persistence, and the same clarification-delta behavior.
- Changed the sixth-confirmation flow to save final interaction state, enter `building-case`, build exactly one authoritative Case, then route to result/analysis. Interrupted complete sessions recover on reopen; stale Case/report/message responses update only their matching history entry and never the active session.
- Added a compatibility projection from authoritative Case data for the existing result/AI adapters. Calendar facts are side-aware and raw day clash is not confused with conditional day break.
- Added safe `needs-review` history view models and HistoryPanel fallbacks. Incomplete records never enter the normal result route, never dereference missing fields, never call `sessions.get` with a synthetic view key, and do not expose unsafe deletion.
- The normal Electron `start` script now builds the ignored domain artifact before launch.

## Design and review resolutions

- Runtime trust is persisted beside the Case as `caseRuntimeTrust`; it never enters `DivinationCaseV2` or its hashes.
- An intent-ID change clears provenance fields owned by the previous intent, while a same-intent relation/target delta retains authoritative provenance. Electron and browser adapters share this behavior.
- Cached analysis is returned with freshly retrieved evidence without invoking the model again, so reopening history restores evidence context without a duplicate cloud request.
- Follow-up calls retrieval and AI against the last complete conversation, then atomically persists exactly one user/assistant pair. Retrieval failure, model failure, deletion, or a changed Case leaves the conversation unchanged; retries cannot create orphan or duplicate turns.
- A newly built Case clears analysis and messages from an absent or different previous Case in the Store, browser adapter, and renderer presentation. Same-hash rebuilds preserve both.
- Electron and browser creation reject invalid immutable identity fields, including padded IDs, empty or overlong questions, unknown categories, and non-exact ISO cast times; questions are normalized before persistence.
- Final independent re-review found no Critical or Important findings and returned Spec PASS / Quality PASS.

## TDD evidence

- Initial Store/migration authority tests failed against the legacy implementation, then passed after raw migration and writer separation.
- `reading-service.test.cjs` first failed because the service did not exist; the final suite passes 11/11, including renderer spoofing, stable IDs, intent deltas, serialization, CAS, AI projection, and message ownership.
- IPC/client contract tests first failed because the narrow adapters did not exist; final ReadingClient tests pass 10/10 and IPC/migration integration is included in the Electron suite.
- App integration initially had 9 failures out of 15 after removing renderer authority paths; it reached 15/15, then the added recovery/history/delete/review regressions reached 20/20. The real HistoryPanel safety test also passes.
- Review reproductions were observed red before their fixes: incoherent toss faces, base/changed fact leakage, raw day-clash loss, stale intent provenance, interrupted Case recovery, stale history visibility, cached-analysis model duplication, stale backups, forged status, delete failures, browser contract drift, and incomplete review records.

## Final verification

- `npm run test:unit`: success; 669/669 tests passed, 0 failed or pending.
- `npm run test:electron`: 57/57 tests passed after a clean domain build.
- `npm run typecheck`: passed.
- `npm run build:renderer`: passed; Vite reported only the existing non-blocking large-chunk warning.
- `node --check` on main, preload, Store, migration, ReadingService, reading IPC, and payload sanitizer: passed.
- `git diff --check 42e1884`: passed; Git reported only Windows LF/CRLF conversion notices.

## Remaining concerns

- No Task 9 blocker remains.
- The full Vitest run still prints pre-existing Three.js duplicate-instance and one React `act(...)` warning; neither causes a test failure and neither was introduced as a Task 9 behavior change.
