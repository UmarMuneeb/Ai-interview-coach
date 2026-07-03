---
name: provider-router-pattern
description: Use whenever writing or reviewing code that makes an LLM call (assessment, tutor, question generation, embeddings). Enforces that every reasoning call goes through the shared provider-router service instead of hitting an OpenAI/Gemini/OpenRouter SDK directly, so fallback and cost logging actually work.
---

# Provider router pattern

## Why this exists

This project's reliability model depends on one rule: **no module talks to an
LLM SDK directly.** Every reasoning/assessment call goes through
`provider-router`, which is the only place that knows how to fall back across
OpenAI → Gemini → OpenRouter and log usage to `provider_usage`. If a module
bypasses this and calls `openai.chat.completions.create()` directly, that
module's calls become invisible to cost tracking and immune to fallback —
exactly the failure mode this architecture exists to prevent.

This applies to `assessment/`, `tutor/`, `questions/` (for generation/
embedding), and any future module that needs a completion. It does **not**
apply to `voice/`, which uses OpenAI Realtime / Gemini Live directly since
those are a different call shape (streaming audio, not the router's job).

## Wrong pattern (never do this)

```typescript
// assessment.service.ts — WRONG
import OpenAI from 'openai';

@Injectable()
export class AssessmentService {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async classify(answer: string, rubric: string[]) {
    const res = await this.openai.chat.completions.create({ ... });
    return res.choices[0].message.content;
  }
}
```

Problems: no fallback if OpenAI is rate-limited, no cost log written, API key
touched outside `provider-router`/`provider-health`.

## Correct pattern

```typescript
// assessment.service.ts — CORRECT
import { ProviderRouterService } from '../provider-router/provider-router.service';

@Injectable()
export class AssessmentService {
  constructor(private readonly providerRouter: ProviderRouterService) {}

  async classify(answer: string, rubric: string[]) {
    const result = await this.providerRouter.complete({
      purpose: 'assessment',           // used for cost attribution
      sessionId: this.currentSessionId,
      messages: [...],
      responseSchema: classificationSchema, // structured output, see assessment-rubric-validation skill
    });
    return result.content;
  }
}
```

`provider-router.complete()` internally:
1. Checks `provider-health` for the healthiest available provider (not in cooldown).
2. Makes the call.
3. On failure, checks whether it was a rate-limit/outage (retry next provider)
   or an auth/config error (don't retry, surface immediately).
4. Logs a `provider_usage` row regardless of success/failure, with
   `purpose`, `session_id`, tokens, and cost.

## Checklist when reviewing a diff

- [ ] No `import OpenAI`, `import { GoogleGenerativeAI }`, or raw `fetch()` to
      a provider's API endpoint anywhere outside `provider-router/` and `voice/`.
- [ ] Every call to `providerRouter.complete()` passes a `purpose` string —
      this is what makes `provider_usage` queryable per feature later.
- [ ] If the module needs a new call shape (e.g. streaming), extend
      `provider-router`'s interface — don't work around it in the caller.
