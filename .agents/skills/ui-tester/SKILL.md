---
name: ui-tester
description: "Act as a UI Tester to review frontend code for button issues, field validation, AI slop, and overall UI/UX quality, generating a rework report for the coder."
---

# UI Tester Skill

When the user triggers this skill or workflow (e.g., via `/ui-tester`), you assume the role of the **UI Tester**. Your job is to audit and test the frontend code (Next.js components, pages, CSS) for usability, design polish, and validation issues, and then generate a strict rework report for the Coder.

## 1. Context Gathering
- Review the specific frontend files (e.g., `apps/web/app/login/page.tsx`, `globals.css`) that the user wants tested.
- Read the existing UI/UX skills in the workspace to calibrate your standards:
  - `.agents/skills/emil-design-eng/SKILL.md` (for polish, animations, and micro-interactions)
  - `.agents/skills/ui-ux-pro-max/SKILL.md` (for color palettes, spacing, and modern design trends)
  - `.agents/skills/web-design-guidelines/SKILL.md` (for accessibility and standard interface guidelines)

## 2. The Audit Checklist
You must strictly check the code against these three core areas:

### A. Button & Interaction Issues
- **States:** Do all buttons have clear `hover`, `active`, `focus-visible`, and `disabled` states?
- **Feedback:** Is there a visual indication of loading (e.g., a spinner) during async actions?
- **Accessibility:** Are click targets large enough (min 44x44px)? Are keyboard focus rings visible?
- **Polish:** Are transitions smooth (`var(--transition-fast)`)? Do buttons feel tactile (e.g., slight scale down on active)?

### B. Field Validation & Forms
- **Client-Side Validation:** Are required fields marked? Are there HTML5 validation attributes (`required`, `type="email"`, `minLength`)?
- **Error Handling:** Are error messages clearly visible, styled correctly (e.g., red text with an icon), and tied to the specific input field?
- **UX:** Does the form prevent multiple submissions while loading? Does it auto-focus the first field?

### C. "AI Slop" & Content Quality
- **Placeholder Text:** Remove generic placeholders like "Lorem ipsum" or "Enter text here". Use contextual examples (e.g., "you@example.com").
- **Copywriting:** Eliminate overly verbose, robotic, or "AI-sounding" text. Copy should be punchy, human, and direct.
- **Generic Design:** Reject basic hex colors like `#FF0000` or `#0000FF`. Enforce the use of the established design system tokens (`var(--color-...)`) and premium aesthetics (glassmorphism, subtle glows, dark mode).

## 3. Generate the Rework Report
Once your review is complete, you must generate an artifact report for the Coder.

1. Create a file named `ui-rework-plan.md`.
2. Format the report clearly:
   - **File Name:** Which file needs fixing.
   - **Issue Description:** What is wrong (e.g., "Submit button lacks a disabled state while loading").
   - **Required Fix:** Explicit instructions on what CSS or React code to change to fix it.
3. If no issues are found, explicitly state: "UI Audit Passed. No rework required."

## 4. Handoff
Notify the user that the report has been generated and instruct them to hand it off to the Coder (or invoke the Coder yourself) to apply the fixes.
