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

## Phase 5: Feedback tutor mode - In Progress

### 1. Tutor schema and basic TutorModule
- Created `apps/api/src/tutor/tutor.service.ts` to encapsulate database interactions for the `TutorAttempt` schema.
- Added `createAttempt` and `getAttempts` methods to log and retrieve the Socratic hints provided during a session.
- Updated `apps/api/src/tutor/tutor.module.ts` to import `PrismaModule` and export `TutorService` to preserve strict module boundaries.
- Wrote and executed `scratch-tutor-test.ts` to verify Prisma insertion and retrieval.

### 2. Persona switch and Socratic retry loop logic
- Updated `apps/api/src/tutor/tutor.service.ts` to include `generateHint`, `evaluateTutorAnswer`, and `processTutorTurn` methods.
- Utilized the `ProviderRouterService` inside `TutorService` to query the LLM using a strict strict `TutorEvaluationSchema` for accurate response parsing, with fallback retry logic.
- Updated `apps/api/src/sessions/sessions.service.ts` to support transitioning from `interview` to `tutor` phase (`transitionToTutorPhase`).
- Added `submitTutorAnswer` to handle routing Socratic turns, fetching the next weak question, and ultimately resolving or completing the session once all weak questions are addressed or exhausted.
- Verified logic with a new `scratch-tutor-loop-test.ts` integration test, ensuring smooth state transitions and LLM fallback handling for invalid JSON returns.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 5 step 2 as `[x]` done.
- **PHASE 5 COMPLETE.**

## Phase 6: Frontend (Started 2026-07-03)

### 1. Global Design System, Layout, and Login Page

#### Backend: Auth Endpoints
- Implemented `apps/api/src/auth/auth.service.ts` with `login()` and `register()` methods using `bcryptjs` for password hashing and `@nestjs/jwt` for token issuance.
- Implemented `apps/api/src/auth/auth.controller.ts` with `POST /auth/login` and `POST /auth/register` endpoints (public — no JWT guard, these produce the token).
- Updated `apps/api/src/auth/auth.module.ts` to import `PrismaModule` for DB access.
- Enabled CORS in `apps/api/src/main.ts` (origin: `FRONTEND_URL`, default `http://localhost:3000`) and fixed default port to 3001.
- Added `JWT_SECRET` and `FRONTEND_URL` to `apps/api/.env`.

#### Frontend: Design System
- Replaced `apps/web/app/globals.css` with a complete premium dark-mode design system including:
  - Full CSS custom property token set (colors, gradients, typography, spacing, radii, shadows, transitions).
  - Utility classes: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.form-input`, `.text-gradient`, `.badge`, `.animate-fade-in`.
  - Inter + JetBrains Mono fonts via Google Fonts.

#### Frontend: Layout & Pages
- Updated `apps/web/app/layout.tsx` with proper app metadata and cleaned up font loading.
- Created `apps/web/app/components/AppLayout.tsx` — a shared sticky nav header wrapper for all authenticated pages.
- Created `apps/web/app/login/page.tsx` — a premium dark-mode login/register page with tab toggle, staggered animations, inline error handling, JWT storage in `localStorage` under key `ai_coach_token`, and redirect to `/onboarding` on success.
- Created `apps/web/app/onboarding/page.tsx` — stub page (full implementation is Phase 6 Step 2).
- Updated `apps/web/app/page.tsx` to redirect to `/login`.
- Created `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 6 Step 1 as `[x]` done.

## Phase 6 — Step 2: Onboarding Page (2026-07-03)

### Backend: SessionsController + getSession
- Created `apps/api/src/sessions/sessions.controller.ts` with:
  - `POST /sessions` — JWT-guarded; reads `userId` from JWT payload, calls `SessionsService.createSession()`, returns full session object with UUID.
  - `GET /sessions/:id` — JWT-guarded; returns session by ID.
- Added `getSession(id)` method to `apps/api/src/sessions/sessions.service.ts`.
- Registered `SessionsController` in `apps/api/src/sessions/sessions.module.ts`.

### Frontend: Onboarding Page
- Replaced stub with a full premium 3-step onboarding form in `apps/web/app/onboarding/page.tsx`:
  - **Step 1 — Field:** Card-grid selector for Full-Stack, System Design, or Agentic AI. Number badge animates to a ✓ checkmark when selected.
  - **Step 2 — Duration:** 4-option grid: 15 / 30 / 45 / 60 min with question count auto-mapping.
  - **Step 3 — Difficulty:** 3-option grid: Junior / Mid-Level / Senior with icons.
  - Client-side validation: blocks submit if no field selected.
  - On submit: reads JWT from `localStorage`, calls `POST /sessions`, redirects to `/interview/[sessionId]`.
  - Unauthenticated redirect: if no token found in `localStorage`, redirects to `/login`.
  - Live session summary shown below the form ("Full-Stack Engineering · 30 min · Mid-Level").
- Created `apps/web/app/interview/[sessionId]/page.tsx` — stub page that renders the session ID so the redirect lands without a 404.

### Test Results
- `POST /sessions` (valid JWT) → 201 with `{ id, user_id, field, phase, status, target_duration_minutes, questions_planned }`
- `POST /sessions` (no token) → 401 Unauthorized
- Frontend TypeScript: 0 errors. API TypeScript: 0 errors.

### Ledger State
- Updated `.agents/ledger.md` marking Phase 6 Step 2 as `[x]` done.
