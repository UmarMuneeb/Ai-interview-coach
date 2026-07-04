---
file: 0-context.md
read_by: [planner, coder, auditor, tester]
purpose: single source of truth all agents load before doing anything else
---

# Project context — AI interview coach

Read this file first, every session, before touching `1-planner.md`, `2-coder.md`,
`3-auditor.md`, or `4-tester.md`. It exists so the four agent files never have to
repeat the project description — if the schema or stack changes, it changes here
once, not in four places.

## What this is

A voice-driven AI agent that runs mock interviews for full-stack development,
system design, and agentic AI roles. It pulls questions from a self-owned
question bank, classifies each answer live (`correct | incorrect | partial |
misunderstood | evasive`), adapts difficulty per topic, and — once the interview
ends — switches into a strict Socratic feedback-tutor mode that re-asks weak
questions with escalating hints until the candidate produces the right answer
or hits the attempt cap. All results roll up into a per-topic skill profile
that drives future session targeting.

Single-user tool. Not multi-tenant. User brings their own OpenAI/Gemini/
OpenRouter keys; the system falls back across providers rather than dying when
one is rate-limited.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | NestJS (TypeScript) |
| Frontend | Next.js, App Router |
| DB | Postgres + Prisma (pgvector deferred, post-MVP) |
| Voice | OpenAI Realtime API or Gemini Live API, behind one shared interface |
| LLM routing | OpenRouter / custom fallback chain — reasoning & assessment calls only, never voice |
| Auth | JWT via `@nestjs/passport` + `@nestjs/jwt`, single user |
| Monorepo | Nx or Turborepo — `apps/api`, `apps/web` |
| Deploy | Vercel (web) + Railway/Render (api — needs a persistent process for the voice WebSocket gateway, not serverless) |
| CI | GitHub Actions — lint + test on PR |

## Modules (backend = source of truth for boundaries)

```
apps/api/src/
  auth/              JWT login, guards
  questions/         aggregator, seeding, embeddings (post-MVP)
  sessions/          lifecycle, pacing, segmentation
  assessment/        rubric scoring, classification
  tutor/             persona switch, retry loop, hint escalation
  provider-router/   LLM fallback across providers
  provider-health/   circuit breaker, usage/cost logging
  voice/             WebSocket gateway, ephemeral token issuance
  skill-profile/     mastery score aggregation
apps/web/app/
  login/  onboarding/  interview/  dashboard/  reports/[id]/
```

## Database schema (Prisma / Postgres)

```
users(id, email, password_hash, created_at)

questions(id, source_db, topic, subtopic, difficulty, prompt,
          rubric_points[], tags[], embedding vector(1536) NULL, last_refreshed_at)

sessions(id, user_id, started_at, ended_at, field, phase, status,
         target_duration_minutes, questions_planned)

session_segments(id, session_id, provider, started_at, ended_at, resumed_from_id)

session_answers(id, session_id, question_id, transcript,
                classification, confidence, reasoning,
                follow_up_asked, timestamp)

skill_profile(user_id, topic, subtopic,
              correct_count, incorrect_count, misunderstood_count, evasive_count,
              mastery_score, current_difficulty, last_seen_at)

tutor_attempts(id, session_id, question_id, attempt_number,
               hint_level, transcript, missing_points[],
               resolved boolean, resolved_via ENUM(self, explained), timestamp)

session_reports(id, session_id, summary, strengths[], weaknesses[],
                recommended_topics[], generated_at)

provider_usage(id, provider, model, session_id,
               tokens_in, tokens_out, audio_seconds, cost_usd, created_at)

provider_health(provider, status, consecutive_failures, cooldown_until,
                last_error, updated_at)
```

## Build phases (source: `build-roadmap-gantt.mermaid`)

1. **Foundation** — auth, Postgres schema, Prisma setup
2. **Core loop (text-only MVP)** — single question source, assessment engine, session + skill-profile logic
3. **Expansion** — multi-DB aggregator, LLM provider fallback router, provider health/cost tracking
4. **Voice** — *[DEFERRED TO PHASE 8]* Infrastructure built, but frontend integration deferred to post-MVP.
5. **Feedback tutor mode** — persona switch, Socratic retry loop, tutor schema
6. **Frontend** — onboarding, live session screen, dashboard/reports
7. **Deployment & polish** — Vercel + Railway/Render, tests, optional eval harness
8. **Phase 8 (Add-ons)** — Full Voice Interviewer integration (OpenAI Realtime/Gemini Live), plus additional post-MVP features.

Do not skip ahead to voice or tutor work before the text-only core loop
(phase 2) is fully working end-to-end. The whole plan hinges on validating
classification and scoring before audio complexity is added.

## Question bank pipeline (seed + LLM fallback)

Questions are populated two ways, in this order of preference:

**1. Seed file (primary source, `source_db = "seed"`)**
Curated questions live as JSON under `apps/api/prisma/seed/questions/<topic>.json`,
one file per topic (`fullstack.json`, `system-design.json`, `agentic-ai.json`),
each an array of:
```json
{ "topic": "fullstack", "subtopic": "react", "difficulty": 2,
  "prompt": "...", "rubricPoints": ["...", "..."], "tags": ["react", "hooks"] }
```
`prisma/seed.ts` reads these and upserts into the `questions` table
(`npx prisma db seed`). This is the question bank's foundation — the core
loop must work end-to-end on seed data alone before LLM-generation is added.

**2. LLM-generated fallback/expansion (`source_db = "generated"`)**
When `questions/` is asked for the next question at a given topic+difficulty
and the seed bank is exhausted (or has too few at that difficulty for the
session length), it generates one on demand:
- Goes through `provider-router` (`purpose: 'question-generation'`) — same
  rule as every other LLM call in this project.
- Output is validated against a structural schema before it touches the DB:
  `topic`, `subtopic`, `difficulty` (1-5), `prompt` (non-empty), `rubricPoints`
  (non-empty array), `tags`. Reject and retry once on schema failure, same
  pattern as assessment classification — never insert an unvalidated question.
- A lightweight dedup check runs before insert: skip generation if a
  seed-bank question at the same topic/subtopic/difficulty hasn't been asked
  yet this session. True semantic dedup via the `embedding` column is
  deferred post-MVP, per the schema note.
- Generated questions get inserted into `questions` like any other row, so
  they accumulate into the bank over time rather than being thrown away
  after one use.

**Roadmap placement:** seed ingestion belongs in **Phase 2** (core loop can't
run without questions). LLM-generation fallback belongs in **Phase 3**, since
it depends on `provider-router` existing first — don't build it before that.

## Report generation & skill-profile updates

Two distinct triggers, not one:

**1. Real-time, after every answer (during the session)**
Immediately after `assessment/` classifies an answer, it calls
`skill-profile/`'s update method synchronously — increment the relevant
correct/incorrect/partial/misunderstood/evasive counter for that
topic+subtopic, recompute `mastery_score`, and adjust `current_difficulty`
for future question selection in this same session. This is what makes
adaptive difficulty possible — it can't wait until session end.

**2. End-of-session report (once, when session status → completed)**
`sessions/` module, on marking a session complete, triggers report
generation:
- Pull all `session_answers` + the skill-profile deltas accumulated during
  this session.
- Call `provider-router` (`purpose: 'report-generation'`) to produce the
  narrative summary — strengths, weaknesses, recommended topics — from that
  structured data. This is a summarization call, not a classification one,
  so it doesn't need the strict enum validation assessment does, but it still
  goes through the router, not a direct SDK call.
- Store the result as one row in `session_reports`.
- Frontend reads it via `GET /sessions/:id/report` → renders on
  `dashboard/reports/[id]`. The aggregate `skill_profile` table (not tied to
  one session) powers the main dashboard view across all sessions.

**Roadmap placement:** basic report generation belongs in **Phase 2**
alongside skill-profile (a session without a report is an incomplete core
loop). The richer narrative version that leans on multi-provider fallback
naturally improves once Phase 3's router lands, but the feature itself isn't
new work in Phase 3 — same code, just more reliable underneath it.

## Cross-session adaptive targeting (using stored answer history)

The tables already store the raw data this needs — `session_answers` has
every question ever asked and how it was classified; `skill_profile` has the
per-topic aggregate. What was missing is the mechanism that reads this back
*before* a new session starts, so weak areas actually get prioritized rather
than the system asking random questions every time.

**What gets stored (already in schema, restated for clarity):**
- Every individual answer, correct or not, is a permanent row in
  `session_answers` — this is the durable "what did they get right/wrong/miss"
  record, queryable by topic/subtopic via join with `questions`.
- `skill_profile` is the rolled-up view per topic+subtopic: counts of each
  classification, a `mastery_score`, and `current_difficulty`.

**What was missing — reading it back at session start:**

When a new session is created, `sessions/` calls `skill-profile/`'s exported
service (never queries its table directly — module boundary rule applies
here too) to fetch the user's current profile, then:

1. Ranks topics/subtopics by weakness — lowest `mastery_score`, or highest
   `incorrect_count + misunderstood_count`, whichever the actual formula in
   `skill-profile/` settles on (this is a Coder-level detail, not fixed here).
2. Weights question selection toward weak areas — not exclusively (a session
   that's 100% weak-topic drilling is discouraging and doesn't validate
   whether earlier gains held), but enough that a topic sitting at low
   mastery shows up more often than one already strong.
3. Within a weak subtopic, prefers questions the user hasn't seen yet over
   ones already asked (check against `session_answers` history) — repeating
   the identical question isn't useful signal, a *new* question on the same
   weak subtopic is.
4. If the weak subtopic's seed-bank questions are exhausted, this is exactly
   when the LLM-generation fallback (see above) earns its keep — generate a
   fresh question specifically for that gap rather than falling back to an
   already-seen one.

**Mid-session, this already existed:** the live skill-profile update after
each answer (described above) adjusts `current_difficulty` within the
session. Cross-session targeting is the same idea one level up — it decides
which *topics* get emphasis at the start of the next session, not just how
hard a question is within the current one.

**Where the tutor loop fits in:** feedback-tutor mode (Phase 5) already
re-asks specifically the questions a user got `incorrect | misunderstood |
evasive` on, tracked in `tutor_attempts` — that's the same weak-area data,
applied at the end of a session instead of the start of the next one.

**Roadmap placement:** basic weighting (steps 1-3 above) belongs in
**Phase 2**, since it only needs `skill_profile` and `session_answers`, both
already scoped there. Step 4 (generation targeting a specific gap) naturally
lands in **Phase 3** once LLM-generation exists.

## Non-negotiable conventions (all agents enforce these)

- **Strict module boundaries.** A module only talks to another module through
  its exported service interface — never reach into another module's Prisma
  queries or internals directly.
- **Classification enum is fixed:** `correct | incorrect | partial |
  misunderstood | evasive`. Don't invent new values; extend the rubric instead.
- **All LLM calls go through `provider-router`.** No module calls an OpenAI/
  Gemini/OpenRouter SDK directly — this is what makes fallback and cost
  logging (`provider-health`) actually work.
- **No hardcoded secrets.** API keys and DB URLs come from env vars only,
  validated at boot (fail fast if missing), never committed or logged.
- **Every provider call is logged to `provider_usage`.** Cost tracking isn't
  optional instrumentation, it's how free-tier limits get avoided proactively.

## Source documents

- `ai-interview-coach-documentation.md` — full architecture, module table, schema, approach
- `build-roadmap-gantt.mermaid` — the phase roadmap referenced above
