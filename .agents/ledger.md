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

- [ ] Step: Implement audio streaming interface in ProviderRouterModule
  Module: provider-router
  Done when: Router can establish a persistent connection to an LLM Live API (OpenAI Realtime or Gemini Live) and proxy audio chunks bi-directionally.
  Risk: high

- [ ] Step: Implement adaptive difficulty and session pacing
  Module: sessions
  Done when: `submitAnswer` updates `current_difficulty` dynamically based on recent classifications, and uses it to fetch the appropriately difficult next question.
  Risk: normal
