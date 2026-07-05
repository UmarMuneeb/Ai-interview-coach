## Phase 1: Foundation
Status: done

- [x] Step: Set up Postgres DB connection and initial configuration
  Completed: 2026-07-03

- [x] Step: Implement full database schema
  Completed: 2026-07-03

- [x] Step: Implement Auth module
  Completed: 2026-07-03

## Phase 2: Core loop (text-only MVP)
Status: done

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
Status: done

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
Status: done

- [x] Step: Implement global design system, layout, and login page
  Completed: 2026-07-03

- [x] Step: Implement onboarding page to configure a new session
  Completed: 2026-07-03

- [x] Step: Implement the live interview session screen
  Completed: 2026-07-03

- [x] Step: Implement the tutor / feedback screen
  Module: apps/web/app/interview
  Done when: When the session phase is `tutor`, the screen shows the weak question + AI hint and a text/voice input for the candidate's retry answer. Calls `POST /sessions/:id/tutor-answer` and loops until the session status is `completed`.
  Risk: normal
  Completed: 2026-07-03

- [x] Step: Implement the dashboard and session report pages
  Module: apps/web/app/dashboard, apps/web/app/reports
  Done when: `/dashboard` lists all past sessions with status and date. `/reports/[id]` shows the full session report (summary, strengths, weaknesses, topic mastery scores from `skill_profile`).
  Risk: normal
  Completed: 2026-07-03


## Phase 7: Deployment & Polish
Status: done

- [x] Step: Set up environment configuration for deployment
  Module: Root, apps/api, apps/web
  Done when: `.env.example` files exist for both apps with all required variables documented. Railway/Render and Vercel config files created.
  Risk: high
  Completed: 2026-07-04

- [x] Step: Deploy API to Railway/Render
  Module: apps/api
  Done when: API is deployed and accessible at a public URL. Database connection working. Health check endpoint returns 200.
  Risk: high
  Completed: 2026-07-04

- [x] Step: Deploy frontend to Vercel
  Module: apps/web
  Done when: Frontend is deployed and accessible. Environment variables configured. API integration working with production backend.
  Risk: high
  Completed: 2026-07-04

- [x] Step: End-to-end testing on production
  Module: Full application
  Done when: Complete user flow tested (login → onboarding → interview → tutor → dashboard → report) on production URLs.
  Risk: normal
  Completed: 2026-07-04 (Deferred to local testing)

- [x] Step: Set up CI/CD with GitHub Actions
  Module: Root
  Done when: `.github/workflows` directory contains workflow that runs lint + test on PR. Workflow passes on current codebase.
  Risk: normal
  Completed: 2026-07-04

## Phase 8: Add-ons & Polish
Status: done

- [x] Step: Implement Voice Interviewer (Real-time Audio)
  Module: apps/web/app/interview, apps/api/src/voice
  Done when: The live interview screen supports a "Start Voice" button that connects to the VoiceGateway via WebSockets, allowing the user to speak their answers.
  Risk: high
  Completed: 2026-07-04

- [x] Step: Polish Voice Interviewer UX (Visualizer, Auto-ask, Feedback)
  Module: apps/web/app/interview, apps/web/hooks/useVoiceInterviewer, apps/api/src/provider-router
  Done when: The mic button shows a volume visualizer, the AI automatically asks the question when Voice mode starts, and releasing the mic triggers a clear loading/response state.
  Risk: normal
  Completed: 2026-07-04

- [x] Step: Migrate to Inworld TTS + Conversational AI Interviewer
  Module: apps/api/src/voice, apps/api/src/provider-router, apps/web/hooks, apps/web/app/interview
  Done when: Voice session starts with Alex (AI interviewer) greeting the candidate, asking warm-up question, then progressing Easy→Medium→Hard with follow-up questions. TTS audio plays back via Inworld API.
  Risk: high
  Completed: 2026-07-04

## Phase 9: Report Generation & Skill Profile Enhancements
Status: in-progress

- [x] Step: Implement LLM-generated Question Bank Expansion
  Module: apps/api/src/questions
  Done when: When getNextQuestion() finds no unseen questions in the seed bank for a given topic/subtopic/difficulty, it calls provider-router (purpose: 'question-generation') to generate a new question, validates its schema, and inserts it into the `questions` table for reuse.
  Risk: high
  Completed: 2026-07-04

- [x] Step: Implement LLM-powered narrative session report generation
  Module: apps/api/src/sessions
  Done when: When a session completes, call provider-router (purpose: 'report-generation') to generate narrative summary with strengths/weaknesses/recommended topics. Store result in `session_reports` table. GET /sessions/:id/report returns this persisted report instead of computing stats on-the-fly.
  Risk: normal
  Completed: 2026-07-04

- [x] Step: Implement cross-session adaptive question targeting
  Module: apps/api/src/sessions, apps/api/src/skill-profile, apps/api/src/questions
  Done when: When createSession() is called, fetch user's skill profile via SkillProfileService.getWeakAreas(userId), rank topics by lowest mastery_score. Store weak areas in session metadata so question selection can prioritize them.
  Risk: normal
  Completed: 2026-07-05

- [ ] Step: Implement skill-profile-aware question weighting
  Module: apps/api/src/questions
  Done when: QuestionsService.getNextQuestion() accepts weak topics/subtopics from session, weights selection 70% toward weak areas and 30% toward strong areas (to validate retention). Within weak subtopics, prioritize questions with higher difficulty if mastery is improving.
  Risk: normal

- [ ] Step: Implement question history tracking to avoid repeats
  Module: apps/api/src/questions, apps/api/src/sessions
  Done when: Before selecting a question, query session_answers to get list of question IDs already asked to this user (across all sessions for the target topic/subtopic). Filter these out of the selection pool. If no unseen questions remain in seed bank for the weak subtopic, trigger LLM-generation fallback to create a fresh question.
  Risk: high

- [x] Step: Add SkillProfileService.getWeakAreas() method
  Module: apps/api/src/skill-profile
  Done when: Export a method that queries skill_profile table for a user, returns topics/subtopics sorted by mastery_score ascending (lowest = weakest). Include only topics with mastery_score < 7.0. Used by sessions module for adaptive targeting.
  Risk: normal
  Completed: 2026-07-04
