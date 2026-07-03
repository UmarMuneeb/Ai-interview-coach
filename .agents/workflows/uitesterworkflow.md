---
name: uitesterworkflow
description: "Runs a full UI testing and rework cycle. Acts as the UI Tester to audit frontend code, then loops with the Coder to fix any issues until the UI passes."
---

# UI Tester Workflow

When the user triggers this workflow (e.g., via `/uitesterworkflow`), follow this exact cycle:

## 1. UI Tester Phase
Read `.agents/skills/ui-tester/SKILL.md` to load your instructions.
Audit the specific frontend files requested by the user (or the most recently modified frontend files) against the UI Tester checklist (buttons, field validation, AI slop).

## 2. Evaluation
- If **NO ISSUES** are found:
  1. Delete `ui-rework-plan.md` if it exists.
  2. Output a summary stating "UI Audit Passed. The frontend is clean and premium."
  3. STOP. The workflow is complete.

- If **ISSUES** are found:
  1. Generate or update the `ui-rework-plan.md` artifact detailing the exact file names, the issues found, and the required fixes.
  2. Proceed to the Coder Phase.

## 3. Coder Phase
Act as the Coder (read `.agents/2-coder.md` for role guidelines).
Open `ui-rework-plan.md` and implement the exact fixes requested by the UI Tester.
Do not introduce unrelated changes.

## 4. Loop
Once the Coder finishes the fixes, loop back to **Step 1 (UI Tester Phase)**. Re-audit the files to ensure the fixes were applied correctly and didn't break anything else. Repeat this cycle until the UI Tester passes with zero issues.
