# AI Interview Coach

A voice-driven AI agent that conducts mock interviews for **full-stack development**, **system design**, and **agentic AI** roles. The agent asks questions from a self-owned question bank, classifies answers in real-time (correct/incorrect/partial/misunderstood/evasive), adapts difficulty as the session progresses, and switches into a Socratic **feedback tutor mode** after the interview phase to drill weak answers.

## Key Features

- **Voice-first interface** (text-only fallback) using OpenAI Realtime or Gemini Live APIs
- **Adaptive difficulty** - per-topic difficulty tier (1-5) adjusted after each answer
- **LLM provider routing** with automatic fallback across OpenAI, Gemini, and OpenRouter
- **Skill profile tracking** - long-term mastery scores per topic/subtopic for personalized sessions
- **Socratic tutor mode** - escalates hints, caps attempts, gracefully explains and flags for review

## Core User Flow

1. User logs in and configures session (topic, difficulty, duration, voice/text mode)
2. Interview phase: Agent asks questions, classifies answers, queues weak responses
3. Tutor phase: Agent re-asks weak questions with escalating hints until mastered or max attempts
4. Report: Session summary with strengths, weaknesses, and recommended topics

## Constraints

- Single-user tool (not multi-tenant)
- User brings their own API keys (OpenAI, Gemini, OpenRouter)
- Backend requires persistent process for WebSocket voice gateway (not serverless)
