# Phase 9 - Step 3: Cross-session Adaptive Question Targeting

## PLANNER OUTPUT

### Step Analysis
This step implements the mechanism to read the user's skill profile **before** a new session starts, so weak areas get prioritized in question selection rather than asking random questions every time.

### Current State
- ✅ `skill_profile` table exists with mastery scores per topic/subtopic
- ✅ `session_answers` table stores every answer with classification
- ✅ `SkillProfileService.getWeakAreas(userId)` method exists (Step 6, completed)
- ✅ `questions` module already supports excluding question IDs via `excludeQuestionIds` parameter (Step 1)

### What Needs to Be Built
Modify `SessionsService.createSession()` to:
1. Call `skillProfileService.getWeakAreas(userId)` to get topics sorted by lowest mastery
2. Store weak areas in session metadata for use during question selection
3. Pass weak topics to question selection logic when questions are asked

### Schema Impact
The `Session` model may need a JSON field to store weak areas metadata. Current schema check needed.

### Module Boundaries
- `sessions/` calls `skill-profile/` service (exported method) ✅
- Never directly queries `skill_profile` table ✅
- Later step will update `questions/` to accept and use this metadata

### Dependencies
- Depends on: Step 6 (getWeakAreas method) ✅ COMPLETE
- Needed by: Step 4 (question weighting logic)

### Risk Level
**normal** - touches session creation but no auth, provider keys, or classification logic

---

## HANDOFF → coder

**Step:** Implement cross-session adaptive question targeting

**Module:** apps/api/src/sessions, apps/api/src/skill-profile, apps/api/src/questions

**Done when:** When createSession() is called, fetch user's skill profile via SkillProfileService.getWeakAreas(userId), rank topics by lowest mastery_score. Store weak areas in session metadata so question selection can prioritize them.

**Relevant schema/conventions:**
- Module boundary rule: sessions/ must import and call SkillProfileService, never query skill_profile table directly
- The Session model in Prisma schema may need a JSON field for storing weak area metadata (check schema first)
- getWeakAreas() returns WeakArea[] with { topic, subtopic, mastery_score, incorrect_count, misunderstood_count }
- Store result as JSON in session record for use during question selection
- Question selection happens via SessionsService methods that ask for next question - these will need to read the stored metadata and pass to QuestionsService

**Files to check first:**
- `apps/api/prisma/schema.prisma` - check if Session model has metadata field
- `apps/api/src/skill-profile/skill-profile.service.ts` - interface of getWeakAreas()
- `apps/api/src/sessions/sessions.service.ts` - createSession() method

**Implementation approach:**
1. Check if Session model has a `metadata` or `weak_areas` JSON field. If not, add it to schema and run migration.
2. In SessionsService constructor, inject SkillProfileService
3. In createSession(), after creating the session record:
   - Call `await this.skillProfileService.getWeakAreas(userId)`
   - Update the session record with weak areas stored in metadata JSON field
4. Return the session with metadata included

**Risk flag:** normal
