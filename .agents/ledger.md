## Phase 1: Foundation
Status: in-progress

- [x] Step: Set up Postgres DB connection and initial configuration
  Completed: 2026-07-03

- [x] Step: Implement full database schema
  Completed: 2026-07-03

- [x] Step: Implement Auth module
  Completed: 2026-07-03

## Phase 2: Core loop (text-only MVP)
Status: in-progress

- [x] Step: Implement basic Questions module for single question source
  Completed: 2026-07-03

- [x] Step: Implement Assessment module
  Completed: 2026-07-03

- [x] Step: Implement Sessions and Skill Profile logic
  Completed: 2026-07-03

## Phase 3: Expansion
Status: done

- [x] Step: Implement Provider Health & Cost Tracking (ProviderHealthModule)
  Completed: 2026-07-03
- [x] Step: Implement LLM Provider Fallback Router (ProviderRouterModule)
  Completed: 2026-07-03
- [x] Step: Implement Multi-DB Question Aggregator (QuestionsModule expansion)
  Completed: 2026-07-03

## Phase 4: Voice & Real-Time Engine
Status: in-progress

- [x] Step: Setup VoiceModule WebSocket Gateway for audio streaming
  Completed: 2026-07-03

- [x] Step: Implement audio streaming interface in ProviderRouterModule
  Completed: 2026-07-03

- [x] Step: Implement adaptive difficulty and session pacing
  Completed: 2026-07-03

## Phase 5: Feedback tutor mode
Status: done

- [x] Step: Implement Tutor schema and basic TutorModule
  Completed: 2026-07-03
- [x] Step: Implement persona switch and Socratic retry loop logic
  Completed: 2026-07-03

## Phase 6: Frontend
Status: in-progress

- [x] Step: Implement global design system, layout, and login page
  Completed: 2026-07-03

- [x] Step: Implement onboarding page to configure a new session
  Completed: 2026-07-03

- [x] Step: Implement the live interview session screen
  Completed: 2026-07-03

- [ ] Step: Implement the tutor / feedback screen
  Module: apps/web/app/interview
  Done when: When the session phase is `tutor`, the screen shows the weak question + AI hint and a text/voice input for the candidate's retry answer. Calls `POST /sessions/:id/tutor-answer` and loops until the session status is `completed`.
  Risk: normal

- [ ] Step: Implement the dashboard and session report pages
  Module: apps/web/app/dashboard, apps/web/app/reports
  Done when: `/dashboard` lists all past sessions with status and date. `/reports/[id]` shows the full session report (summary, strengths, weaknesses, topic mastery scores from `skill_profile`).
  Risk: normal
