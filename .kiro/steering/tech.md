# Tech Stack

## Monorepo

- **Turborepo** - Build system for monorepo management
- **npm workspaces** - Package management

## Apps

### API (`apps/api`)

- **NestJS** (TypeScript) - Backend framework
- **Prisma** - ORM with PostgreSQL
- **Passport JWT** - Authentication
- **Socket.IO** - WebSocket support for voice gateway
- **OpenAI SDK** - OpenAI Realtime API integration
- **Google GenAI** - Gemini Live API integration
- **Jest** - Testing framework

### Web (`apps/web`)

- **Next.js 16** (App Router) - Frontend framework
- **React 19** - UI library
- **Tailwind CSS 4** - Styling
- **Socket.IO Client** - Real-time communication with API

### Docs (`apps/docs`)

- **Next.js** - Documentation site

## Shared Packages

- **@repo/ui** - Shared React components
- **@repo/eslint-config** - ESLint configurations (base, next-js, react-internal)
- **@repo/typescript-config** - Shared TypeScript configurations

## Database

- **PostgreSQL** - Primary database
- **Prisma** - Schema management and migrations

## External Services

- **OpenAI** - Realtime API for voice, LLM for assessment
- **Google Gemini** - Live API for voice, LLM for assessment
- **OpenRouter** - LLM fallback provider

## Common Commands

```bash
# Development (runs all apps)
npm run dev

# Build all apps and packages
npm run build

# Run specific app
npx turbo dev --filter=web
npx turbo dev --filter=api

# Lint all
npm run lint

# Type check all
npm run check-types

# Run all tests
npm run test

# Format code
npm run format

# Prisma commands (from apps/api)
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

## Environment Variables

API requires:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key (optional)
- `OPENROUTER_API_KEY` - OpenRouter API key (optional)

Web requires:
- `NEXT_PUBLIC_API_URL` - API base URL
