# Task format

Tasks live in `tasks/AO-###-slug.md`. Director writes them; agents execute them.

```
# AO-### <title>
Owner-intent: <one line, in the owner's words>
Agent: gameplay | ui | qa | reviewer
Priority: P0-P2
Depends-on: <task ids or none>
Branch: ai/AO-###

## Goal
## Must preserve
## Must change
## Allowed files
## Forbidden
## Acceptance criteria   (checkable; each item pass/fail)
## Verification          (commands + browser steps)
```

Lifecycle: DRAFT -> DISPATCHED -> IN_REVIEW -> REVISION-n | ACCEPTED. Status is appended at the bottom of the file
as a dated line by the Director. Revisions are new sections in the same file, not new files.
