---
name: phasecompletiontester
description: Runs a comprehensive end-of-phase integration test. Reads completed-work-summary.md, generates test cases, tests them, and gives clearance for the next phase or outputs a rework plan.
---

# Phase Completion Tester

When the user triggers this workflow (e.g., at the end of a Phase), you must act as the **Phase Integration Tester**.

## 1. Review
Read `completed-work-summary.md` to understand all features implemented in the current phase.

## 2. Test Plan Generation
Generate a comprehensive integration test plan based on the implemented features. For each major feature/route:
- Define **Pass Cases** (happy paths).
- Define **Failed Cases** (expected failure modes, e.g., bad auth, missing parameters).
- Define **Edge Cases** (e.g., schema validation failures, database constraints).

## 3. Execution
Write a temporary test script (e.g., `scratch-phase-test.ts`) or use curl/REST calls to actually execute these test cases against the live development server or database. Ensure you test:
- HTTP Routes (if built).
- Core Services (via dependency injection script if no routes are exposed yet).
- Database updates and side-effects.

**CRITICAL API RULE**: You must ALWAYS test functionalities that require a third-party API or human interaction. Do NOT mock these out or skip them to force a pass.
- If an API key is missing or not provided, STOP testing.
- Ask the user to provide the API key first.
- Do NOT give clearance if any functionality check (including live APIs) is skipped or left untested.

## 4. Evaluation & Rework
- If **ANY** test case fails:
  1. Do NOT grant clearance for the next phase.
  2. Create a new file called `phase-rework-plan.md` documenting the exact failures, clues, and what needs fixing.
  3. Hand off the rework plan back to the Coder agent to fix the issues.
  4. Repeat the test cycle until all cases pass.
  
## 5. Clearance
- If **ALL** test cases pass:
  1. Delete `phase-rework-plan.md` if it exists, to clean up the workspace.
  2. Generate a final summary artifact (`phase-clearance-report.md`) detailing the tested routes, the pass/fail cases that were verified, and a definitive statement that everything is correct.
  3. Officially grant clearance to the user to move on to the next Phase in the roadmap.
