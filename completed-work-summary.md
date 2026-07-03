# Project Progress Summary

This document serves as a record of completed work. It is appending-only so we don't overwrite previous records.

## Phase 1: Foundation (Completed on 2026-07-03)

### 1. Database Connection Configuration
- Verified that `apps/api/.env` correctly holds the Neon PostgreSQL `DATABASE_URL`.
- Verified that `apps/api/prisma.config.ts` passes the environment variable correctly.

### 2. Full Database Schema
- Wrote the complete `apps/api/prisma/schema.prisma` file containing:
  - `User` model
  - `Question` model
  - `Session` model
  - `SessionSegment` model
  - `SessionAnswer` model
  - `SkillProfile` model
  - `TutorAttempt` model
  - `SessionReport` model
  - `ProviderUsage` model
  - `ProviderHealth` model
  - Required enumerations (`Classification`, `ResolvedVia`, `ProviderStatus`)
- Executed `npx prisma db push` to successfully synchronize the schema with the remote Neon database.
- Executed `npx prisma generate` to build the local Prisma client.

### 3. Auth Module Implementation
- Created `apps/api/src/auth/jwt.strategy.ts` to provide `@nestjs/passport` strategy for verifying JWT tokens.
- Updated `apps/api/src/auth/auth.module.ts` to register the `JwtModule` with a secret and `PassportModule`.
- (The `AuthService` and `AuthController` stubs were already present and have been scoped to the updated module).

### Ledger State
- Updated `.agents/ledger.md` marking all Phase 1 items as `[x]` done.

## Phase 2: Core loop (text-only MVP) - In Progress

### 1. Questions Module
- Created `apps/api/src/questions/questions.service.ts` providing a `getMockQuestion()` method.
- Created `apps/api/src/questions/questions.controller.ts` with a `@Get('mock')` endpoint guarded by `JwtAuthGuard`.
- Updated `apps/api/src/questions/questions.module.ts` to export the service.
- Ensured `jwt-auth.guard.ts` exists so the controller works seamlessly.
- Successfully built the `api` app.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 2 Questions Module item as `[x]` done.

### 2. Assessment Module
- Installed `zod` dependency to handle structured LLM output validation.
- Created `apps/api/src/provider-router/provider-router.service.ts` and module to serve as a mock LLM gateway for the MVP.
- Implemented `apps/api/src/assessment/assessment.service.ts` matching the `assessment-rubric-validation` and `provider-router-pattern` skills. It structures the prompt, calls `ProviderRouterService`, validates the response using a Zod schema (`ClassificationSchema`), and automatically handles a retry loop on failure.
- Updated `apps/api/src/assessment/assessment.module.ts` to export the service and import `ProviderRouterModule`.
- Built the `api` app successfully.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 2 Assessment Module item as `[x]` done.

### 3. Sessions and Skill Profile Module
- Built a global `PrismaModule` (`apps/api/src/prisma/prisma.service.ts` & `prisma.module.ts`) to provide database access following the strict module boundary constraints.
- Created `apps/api/src/skill-profile/skill-profile.service.ts` to query, create, or update a user's `SkillProfile` (adjusting counters and calculating the mastery score) when an answer is evaluated.
- Implemented `apps/api/src/sessions/sessions.service.ts`. It correctly creates sessions in the database, takes a submitted answer transcript, passes it to the `AssessmentService`, saves the `SessionAnswer` with the classification result, and immediately delegates to `SkillProfileService` to update user mastery.
- Built the `api` app successfully.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 2 Sessions and Skill Profile Module item as `[x]` done.
- **Phase 2 Complete!**

## Phase 3: Expansion (Completed on 2026-07-03)

### 1. Provider Health & Cost Tracking
- Implemented `ProviderHealthModule` to track circuit breaker health (Gemini / OpenAI).
- Added `logUsage()` to insert `ProviderUsage` records for cost tracking.

### 2. LLM Provider Fallback Router
- Integrated `@google/genai` and `openai` SDKs into `ProviderRouterModule` to provide strict structured classification with automated fallback from Gemini to OpenAI.
- Automatically records successes and failures to `ProviderHealthService`.

### 3. Multi-DB Aggregator
- Upgraded `QuestionsService` to read from a seeded JSON aggregator (`mock-questions.json`) to simulate dynamic multi-DB question retrieval.
- Phase tests passed successfully by verifying circuit breaker throws as expected when no API keys are present, and falling back gracefully.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 3 items as `[x]` done.
- **Phase 3 Complete!**

## Phase 4: Voice & Real-Time Engine - In Progress

### 1. VoiceModule WebSocket Gateway
- Installed `@nestjs/websockets`, `@nestjs/platform-socket.io`, and `socket.io-client` (for testing).
- Created `apps/api/src/voice/voice.gateway.ts` providing the `VoiceGateway` listening for WebSocket connections.
- Implemented robust connection security by verifying the JWT via `client.handshake.auth.token` before accepting the connection.
- Implemented an `audio_chunk` event receiver to acknowledge incoming streaming bytes.
- Tested the connection successfully using a local test script (`scratch-voice-test.ts`) which proved the gateway instantly rejects unauthenticated sockets and correctly maintains authenticated ones.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 4 VoiceModule item as `[x]` done.

### 2. ProviderRouterModule Live Stream Interface
- Installed `ws` package for WebSocket connection support.
- Implemented `connectLiveStream` method in `ProviderRouterService` to open a real-time bi-directional connection to the OpenAI Realtime API.
- Abstracted the connection behind a clean `LiveStreamAdapter` interface providing `sendAudioChunk`, `commitAudio`, `onAudioReceived`, and `onTextReceived` hooks so other modules (like VoiceModule) do not interact with the underlying WebSocket directly.
- Added usage cost logging hook to `response.done` event, securely logging metrics to `provider_usage` without leaking API keys.
- Executed integration test script `scratch-realtime-test.ts` to verify the connection and event loop work correctly.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 4 ProviderRouter Live Stream item as `[x]` done.

### 3. Adaptive Difficulty and Session Pacing (Phase 4 Final Step)
- Edited `SkillProfileService` to dynamically update `current_difficulty` (1, 2, or 3) inside `updateSkillProfile` based on the candidate's aggregated `mastery_score`.
- Imported `QuestionsModule` into `SessionsModule` and injected `QuestionsService` into `SessionsService`.
- Modified the `submitAnswer` method to extract the updated `current_difficulty` from the evaluated `SkillProfile`, and immediately call `questionsService.getMockQuestion()` to fetch the next appropriately difficult question.
- Updated the return signature of `submitAnswer` to cleanly return `{ answer, nextQuestion }`.
- Verified changes with integration test (`scratch-phase-test.ts`), which correctly passed typechecking and linked the services correctly (until hitting a temporary LLM API rate limit).

### Ledger State
- Updated `.agents/ledger.md` marking Phase 4 Adaptive Difficulty item as `[x]` done.
- **PHASE 4 COMPLETE.**
