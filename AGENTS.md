<!-- PROJECT DOCS START -->
## Project knowledge

- Before any substantive task, read `docs/project/PROJECT.md`.
- Read `docs/project/PROJECT_CONTEXT.md` for requirements, scope, domain rules, data boundaries, or project-specific preferences.
- Read `docs/project/DECISIONS.md` before architecture or other consequential design choices, when the file exists.
- Read `docs/project/LESSONS.md` for bugs, regressions, incidents, or previously failed approaches, when the file exists.
- Read `docs/project/CHANGELOG.md` for reports, releases, or project-status summaries, when the file exists.
- Search `.agents/notes` before changing behavior, architecture, contracts, persistence, process, or test strategy. Update the existing Note for the same decision; otherwise create one with `$project-knowledge` and keep it in the same commit as the implementation.
- Keep `DECISIONS.md` as a cross-project decision navigator. Store complete per-change rationale in the authoritative Agent Note and link to it instead of duplicating the body.
- When project documentation conflicts with code, configuration, tests, Git, or live state, report the conflict and verify the relevant authority before editing.
- Never store credentials, cookies, personal information, or production data in project documentation or Agent Notes.
- At task closeout, verify the result, run the project-knowledge impact check and strict audit, update only affected records, and keep implementation plus related knowledge in the same commit. Report project-document and Agent Note impact separately when neither changes.
<!-- PROJECT DOCS END -->
