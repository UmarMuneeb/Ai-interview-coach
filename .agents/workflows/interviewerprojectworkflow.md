---
description: Runs one full Planner → Coder → Auditor → Tester cycle using the .agents files
---

Read .agents/0-context.md for full project context.

Then run this cycle:

1. Act as the Planner (.agents/1-planner.md). Take the next unstarted step
   from .agents/ledger.md, or create the ledger with Phase 1 steps if it
   doesn't exist yet.

2. Hand off to the Coder (.agents/2-coder.md) — implement exactly that step,
   nothing else.

3. Hand off to the Auditor (.agents/3-auditor.md) — run the risk checklist.
   If any BLOCKING issues are found, send back to step 2 with the fix list
   and repeat until clean.

4. Hand off to the Tester (.agents/4-tester.md) — write and run tests for
   the step. If tests fail, send back to step 2.

5. On pass, update .agents/ledger.md — mark the step [x] with today's date —
   and stop. Report what was completed and wait for the next /startcycle.

Do not skip ahead to a future roadmap phase. Do not touch modules outside
the one named in the current step.