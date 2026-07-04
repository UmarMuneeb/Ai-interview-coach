# NEXT STEPS - Start Here Next Session

**Date:** 2026-07-04  
**Current Phase:** Phase 9 (in-progress)  
**Priority:** HIGH

---

## 🎯 What to Run Next

Execute the following command to start the Planner-Coder-Auditor-Tester cycle for the **first step of Phase 9**:

```
/runs-one-full-planner-coder-auditor-tester-cycle-using-the-agents-files start cycle for next step
```

This will automatically:
1. **PLANNER** - Read ledger, identify next uncompleted step (Phase 9, Step 1)
2. **CODER** - Implement LLM-powered narrative session report generation
3. **AUDITOR** - Security review (provider routing, cost logging, etc.)
4. **TESTER** - Verify report generation works end-to-end

---

## 📋 Phase 9: Report Generation & Skill Profile Enhancements

### Status: 0/5 Steps Complete

**Why This Phase Exists:**  
Analysis of the codebase revealed that several core features described in `.agents/0-context.md` (section "Report generation & skill-profile updates") are **not yet implemented**. These aren't enhancements — they're architectural requirements that make the system truly adaptive.

### Steps in Phase 9

#### ⏭️ NEXT: Step 1 - LLM-Powered Narrative Session Report Generation
**Module:** `apps/api/src/sessions`  
**Risk:** normal  
**Done when:** Session completion triggers `provider-router` call (purpose: 'report-generation'), result stored in `session_reports`, GET endpoint returns persisted report.

**What's Missing:**
- Current: Reports are computed stats only (counts, percentages)
- Required: Natural language narrative summarizing performance, actionable advice
- Impact: Provides meaningful feedback instead of raw numbers

---

#### Step 2 - Cross-Session Adaptive Question Targeting
**Module:** `apps/api/src/sessions`, `apps/api/src/skill-profile`, `apps/api/src/questions`  
**Risk:** normal  
**Done when:** `createSession()` fetches weak areas from skill profile, stores in session metadata for question selection.

**What's Missing:**
- Current: Question selection is random within topic/difficulty
- Required: Prioritize weak topics from previous sessions
- Impact: Personalized learning paths based on history

---

#### Step 3 - Skill-Profile-Aware Question Weighting
**Module:** `apps/api/src/questions`  
**Risk:** normal  
**Done when:** Question selection weights 70% toward weak areas, 30% toward strong areas (to validate retention).

**What's Missing:**
- Current: No awareness of mastery scores
- Required: Intelligent balancing of weak/strong topics
- Impact: Maintains engagement while drilling weak areas

---

#### Step 4 - Question History Tracking (Avoid Repeats)
**Module:** `apps/api/src/questions`, `apps/api/src/sessions`  
**Risk:** high (involves LLM generation)  
**Done when:** Question selection filters out previously asked questions. Triggers LLM generation when seed bank exhausted.

**What's Missing:**
- Current: Same question can repeat across sessions
- Required: Check `session_answers` history, generate new questions when needed
- Impact: Infinite question variety, no boring repeats

---

#### Step 5 - Add SkillProfileService.getWeakAreas() Method
**Module:** `apps/api/src/skill-profile`  
**Risk:** normal  
**Done when:** Export method that returns weak topics sorted by mastery score, used by sessions module.

**What's Missing:**
- Current: No way to query weak areas (module boundary violation if sessions queries directly)
- Required: Encapsulated service method
- Impact: Enables Steps 2-4 while respecting architecture

---

## 📖 Key Documentation

- **Full feature analysis:** `.agents/phase-9-missing-features.md`
- **Ledger (all steps):** `.agents/ledger.md`
- **Architecture reference:** `.agents/0-context.md` (lines 168-220)
- **Agent workflows:** `.agents/1-planner.md`, `2-coder.md`, `3-auditor.md`, `4-tester.md`

---

## 🔄 How Agent Cycles Work

When you run the command above, the system will:

1. **PLANNER** reads `.agents/ledger.md` to find next `[ ]` uncompleted step
2. **PLANNER** hands off to **CODER** with:
   - Step description
   - Module to modify
   - "Done when" acceptance criteria
   - Risk level
3. **CODER** implements the feature, creates/modifies files
4. **CODER** hands off to **AUDITOR** with file list
5. **AUDITOR** runs security checklist (auth, secrets, provider routing, etc.)
6. If **BLOCKING** issues → **AUDITOR** sends back to **CODER** with fix list
7. If **PASS** → **AUDITOR** hands off to **TESTER**
8. **TESTER** writes tests, verifies acceptance criteria
9. If **PASS** → **TESTER** hands off to **PLANNER** to mark step complete
10. If **FAIL** → **TESTER** sends back to **CODER** with failure details

---

## ✅ What's Already Done

**Phases 1-8 are complete:**
- ✅ Foundation (DB, auth, schema)
- ✅ Core loop (questions, assessment, sessions, skill profile)
- ✅ Expansion (provider router, health tracking, multi-DB)
- ✅ Voice (WebSocket gateway, real-time audio)
- ✅ Tutor mode (Socratic retry, hint escalation)
- ✅ Frontend (login, onboarding, interview, tutor, dashboard, reports)
- ✅ Deployment (Vercel, Railway, CI/CD)
- ✅ Voice polish (Inworld TTS, Alex persona, difficulty progression)

---

## 🚀 Quick Start

Just run this command to begin Phase 9:

```
/runs-one-full-planner-coder-auditor-tester-cycle-using-the-agents-files start cycle for next step
```

The agents will handle the rest! 🎉
