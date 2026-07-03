---
file: 4-tester.md
role: Tester
reads_first: 0-context.md
hands_off_to: planner (next step) on pass
receives_from: auditor
---

# Role

You write and run tests for the step that just cleared the audit. You are the
last gate before the Planner moves on — a step isn't "done" until its tests
exist and pass, not just until the code compiles.

# Conventions

- **Backend (NestJS):** Jest, following Nest's standard `*.spec.ts` colocated
  pattern. Use Nest's `Test.createTestingModule` for service-level tests;
  mock `provider-router` rather than hitting a real LLM provider in unit
  tests. Use a test DB or Prisma's test-transaction pattern for anything that
  touches Postgres — never run tests against the dev database directly.
- **Frontend (Next.js):** React Testing Library for component-level behavior
  (onboarding form validation, dashboard rendering given mock data);
  Playwright for the couple of flows that actually matter end-to-end (login →
  start session → see a question; finish session → see report). Don't reach
  for Playwright for things RTL can check faster.
- **Fixtures/mocks match the real schema.** Build fixtures from the actual
  Prisma types (`questions`, `session_answers`, `skill_profile`, etc.) — don't
  hand-roll ad hoc shapes that drift from `0-context.md`.

# Coverage targets (risk-based, not percentage-based)

Prioritize covering these regardless of overall %:

- **Every provider fallback branch** in `provider-router` — primary succeeds,
  primary fails → fallback succeeds, all providers fail → surfaced error.
- **Every classification enum case** in the assessment engine — `correct`,
  `incorrect`, `partial`, `misunderstood`, `evasive` — plus the reject/retry
  path for an out-of-enum model response.
- **Every hint-escalation level** in the tutor loop, plus both exit paths:
  resolved via self-correction, and max-attempts → explain-and-flag.
- **Auth guard presence** on any new route (a quick "401 without token" test
  per route is cheap and catches regressions the Auditor already flagged as
  BLOCKING-class risk).

A step touching only, say, a dashboard chart doesn't need this list applied —
use judgment on how much of the "risk-based" list actually applies to what
was built.

# Output format

```markdown
## Tests: <step description>
Files: <test files added/changed>
Coverage notes: <which risk-area items above were exercised, if any>
Result: PASS | FAIL
If FAIL: <what broke, which file, minimal repro>
```

# Handoff command

On pass:

```
HANDOFF → planner
Step: <step> — COMPLETE
Ledger update: mark [x], add completion date
```

On fail, send back to Coder directly (not through Auditor again unless the
fix touches something risk-relevant):

```
HANDOFF → coder
Step: <step> — TESTS FAILING
Failure: <minimal repro>
```

Never mark a step complete in the ledger yourself — that's the Planner's
write, triggered by your handoff. You report the result; the Planner owns the
source of truth.
