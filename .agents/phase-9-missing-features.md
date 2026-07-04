# Phase 9: Missing Report Generation & Skill Profile Features

**Date:** 2026-07-04  
**Status:** NEW PHASE ADDED  
**Priority:** HIGH (Core functionality from 0-context.md not yet implemented)

---

## Overview

Analysis of the codebase against `.agents/0-context.md` (section "Report generation & skill-profile updates", lines 168-220) revealed that several critical features described in the architecture document are **not yet implemented**.

---

## What's Missing

### 1. ❌ LLM-Powered Narrative Session Reports

**Current State:**
- `GET /sessions/:id/report` computes statistics on-the-fly
- Returns answer counts, topic breakdown, strengths/weaknesses
- NO narrative summary generated
- NO data persisted to `session_reports` table (table exists but unused)

**What's Required (per 0-context.md lines 168-176):**
- When session status → `completed`, trigger report generation
- Call `provider-router` with `purpose: 'report-generation'`
- Generate narrative summary from structured data (strengths, weaknesses, recommended topics)
- Store result in `session_reports` table as one row
- Frontend reads from persisted report, not computed stats

**Why It Matters:**
- Provides actionable feedback in natural language
- Reduces compute load (report generated once, not every API call)
- Follows architecture: all LLM calls go through provider-router

---

### 2. ❌ Cross-Session Adaptive Targeting

**Current State:**
- `createSession()` creates session record
- Does NOT read user's skill profile
- Does NOT identify weak areas from previous sessions
- Question selection is random within topic/difficulty

**What's Required (per 0-context.md lines 182-220):**
- At session start, fetch user's skill profile via `SkillProfileService`
- Rank topics/subtopics by weakness (lowest `mastery_score`)
- Store weak areas in session context/metadata
- Use this to bias question selection toward weak topics

**Why It Matters:**
- Core value proposition: personalized learning paths
- Without this, the system can't focus on what the user needs to improve
- Skill profile data is collected but never used proactively

---

### 3. ❌ Skill-Profile-Aware Question Weighting

**Current State:**
- `getMockQuestion(topic, difficulty)` returns random question
- NO awareness of mastery scores
- NO weighting toward weak areas
- NO balancing between review and drilling

**What's Required (per 0-context.md lines 200-206):**
- Weight selection 70% toward weak subtopics, 30% toward strong ones
- Within weak subtopics, prefer questions user hasn't seen yet
- Balance drilling weak areas with validating retention of strong areas

**Why It Matters:**
- Adaptive learning requires intelligent question selection
- Pure weak-topic drilling is discouraging
- Mixed difficulty maintains engagement

---

### 4. ❌ Question History Tracking (Avoid Repeats)

**Current State:**
- NO check for previously asked questions
- Same question can appear multiple times across sessions
- NO LLM-generation trigger when seed bank exhausted

**What's Required (per 0-context.md lines 207-211):**
- Before selecting question, query `session_answers` for user's history
- Filter out already-asked questions for target topic/subtopic
- If seed bank exhausted (all questions seen), trigger LLM generation via `provider-router` (purpose: 'question-generation')
- Generated questions insert into `questions` table for reuse

**Why It Matters:**
- Repeating identical questions provides no new signal
- Seed bank is finite (~50-100 questions per topic)
- LLM generation keeps sessions fresh indefinitely

---

### 5. ❌ SkillProfileService.getWeakAreas() Method

**Current State:**
- `SkillProfileService` only has `updateSkillProfile()`
- NO export for fetching weak areas
- Other modules can't query skill profile (violates module boundary)

**What's Required:**
- Export method: `getWeakAreas(userId): Promise<WeakArea[]>`
- Returns topics/subtopics sorted by `mastery_score` ascending
- Includes only topics with `mastery_score < 7.0`
- Used by `SessionsService` for adaptive targeting

**Why It Matters:**
- Respects module boundaries (sessions module can't query skill_profile table directly)
- Encapsulates mastery score logic in one place
- Enables cross-session targeting

---

## Implementation Plan (5 Steps Added to Ledger)

The following steps have been added to **Phase 9** in `.agents/ledger.md`:

### Step 1: LLM-Powered Narrative Session Report Generation
**Module:** `apps/api/src/sessions`  
**Risk:** normal  
**Done when:** Session completion triggers `provider-router` call (purpose: 'report-generation'), result stored in `session_reports`, GET endpoint returns persisted report.

### Step 2: Cross-Session Adaptive Question Targeting
**Module:** `apps/api/src/sessions`, `apps/api/src/skill-profile`, `apps/api/src/questions`  
**Risk:** normal  
**Done when:** `createSession()` fetches weak areas via `SkillProfileService.getWeakAreas()`, stores in session metadata for question selection.

### Step 3: Skill-Profile-Aware Question Weighting
**Module:** `apps/api/src/questions`  
**Risk:** normal  
**Done when:** `getNextQuestion()` accepts weak topics, weights 70% toward weak/30% strong areas, prioritizes higher difficulty within improving weak subtopics.

### Step 4: Question History Tracking to Avoid Repeats
**Module:** `apps/api/src/questions`, `apps/api/src/sessions`  
**Risk:** high (involves LLM generation fallback)  
**Done when:** Question selection queries `session_answers` history, filters out seen questions, triggers LLM generation when seed bank exhausted.

### Step 5: Add SkillProfileService.getWeakAreas() Method
**Module:** `apps/api/src/skill-profile`  
**Risk:** normal  
**Done when:** Export method that returns weak topics sorted by mastery_score, used by sessions module.

---

## Why This Matters

These aren't "nice-to-have" enhancements — they're **core architectural requirements** described in the original design document (0-context.md). Without them:

- ❌ Reports are computed stats, not actionable narratives
- ❌ Sessions don't learn from past performance
- ❌ Questions repeat unnecessarily
- ❌ Skill profile data is collected but not used for targeting
- ❌ System can't adapt beyond within-session difficulty

With them:
- ✅ Personalized learning paths based on historical performance
- ✅ Natural language feedback that guides improvement
- ✅ Infinite question variety via LLM generation
- ✅ Intelligent balancing of weak/strong topics
- ✅ True adaptive learning system

---

## Next Steps

Run the Planner-Coder-Auditor-Tester cycle for **Phase 9, Step 1** (LLM-powered report generation) to begin implementing these missing features.

---

## References

- **Architecture source:** `.agents/0-context.md` lines 168-220
- **Ledger:** `.agents/ledger.md` Phase 9
- **Implementation status analysis:** Completed 2026-07-04 via context-gatherer subagent
