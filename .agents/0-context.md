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
4. **Voice** — OpenAI Realtime / Gemini Live behind the shared interface, adaptive difficulty, session pacing
5. **Feedback tutor mode** — persona switch, Socratic retry loop, tutor schema
6. **Frontend** — onboarding, live session screen, dashboard/reports
7. **Deployment & polish** — Vercel + Railway/Render, tests, optional eval harness

Do not skip ahead to voice or tutor work before the text-only core loop
(phase 2) is fully working end-to-end. The whole plan hinges on validating
classification and scoring before audio complexity is added.

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
