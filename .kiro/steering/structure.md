# Project Structure

## Monorepo Layout

```
ai-interview-coach/
├── apps/
│   ├── api/                 # NestJS backend
│   ├── web/                 # Next.js frontend
│   └── docs/                # Documentation site
├── packages/
│   ├── ui/                  # Shared React components (@repo/ui)
│   ├── eslint-config/       # Shared ESLint configs (@repo/eslint-config)
│   └── typescript-config/   # Shared TS configs (@repo/typescript-config)
├── .agents/                 # AI agent prompts and workflows
└── .kiro/                   # Kiro configuration
```

## API Structure (`apps/api`)

NestJS modules follow domain-driven design, each mapped to a feature:

```
apps/api/src/
├── auth/              # JWT authentication, guards
├── questions/         # Question bank aggregator, seeding
├── sessions/          # Session lifecycle, pacing, segmentation
├── assessment/        # Rubric scoring, classification
├── tutor/             # Persona switch, retry loop, hint escalation
├── provider-router/   # LLM fallback across providers
├── provider-health/   # Circuit breaker, usage/cost logging
├── voice/             # WebSocket gateway, ephemeral token issuance
├── skill-profile/     # Mastery score aggregation
├── prisma/            # Prisma client module
├── app.module.ts      # Root module
└── main.ts            # Entry point
```

Each module typically contains:
- `*.module.ts` - NestJS module definition
- `*.service.ts` - Business logic
- `*.controller.ts` - HTTP endpoints (if needed)
- `*.gateway.ts` - WebSocket gateway (if needed)
- `*.dto.ts` - Data transfer objects

## Web Structure (`apps/web`)

Next.js App Router with feature-based organization:

```
apps/web/
├── app/
│   ├── login/          # Login page
│   ├── onboarding/     # Session configuration
│   ├── interview/      # Live session UI
│   │   └── [sessionId]/ # Dynamic session routes
│   ├── dashboard/      # Mastery trends, session history
│   ├── reports/        # Session summaries
│   ├── components/     # Shared components
│   └── layout.tsx      # Root layout
├── hooks/              # Custom React hooks
│   └── useVoiceInterviewer.ts
└── public/             # Static assets
```

## Database Schema

PostgreSQL with Prisma ORM. Key models:

- **User** - Single user authentication
- **Question** - Question bank with rubric points
- **Session** - Interview session lifecycle
- **SessionSegment** - Voice provider segments (for session caps)
- **SessionAnswer** - Classified answers with reasoning
- **SkillProfile** - Per-topic mastery tracking
- **TutorAttempt** - Socratic retry attempts
- **SessionReport** - End-of-session summaries
- **ProviderUsage** - Token/cost tracking
- **ProviderHealth** - Circuit breaker state

## Conventions

### Naming

- **Files**: kebab-case (`session.service.ts`, `tutor.module.ts`)
- **Classes**: PascalCase (`SessionService`, `TutorModule`)
- **Variables/Functions**: camelCase
- **Database tables**: snake_case (Prisma convention)

### Imports

Import order in TypeScript files:
1. External packages (NestJS, React, etc.)
2. Internal modules (relative imports)
3. Types (type-only imports)

### Module Pattern

NestJS modules are feature-based. Each domain has its own module with:
- Service for business logic
- Controller for HTTP routes
- Gateway for WebSocket (voice features)
- DTOs for validation (Zod or class-validator)
