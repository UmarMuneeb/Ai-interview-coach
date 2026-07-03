---
name: assessment-rubric-validation
description: Use whenever writing or reviewing code in the assessment or tutor modules that classifies an answer via an LLM call. Ensures the model's output is structurally constrained to the fixed five-value classification enum rather than validated after the fact with string matching.
---

# Assessment rubric validation

## Why this exists

The classification enum is fixed: `correct | incorrect | partial |
misunderstood | evasive`. Every downstream feature — skill_profile scoring,
tutor mode triggering, session reports — assumes this enum is exhaustive and
exact. If the assessment engine ever lets a model return `"mostly correct"`
or `"unclear"`, every downstream consumer either crashes or silently
misclassifies. This has to be enforced structurally, not by hoping the model
follows the prompt.

## Wrong pattern (prompt-only enforcement)

```typescript
// WRONG — trusts free-text output
const prompt = `Classify this answer as correct, incorrect, partial,
misunderstood, or evasive: ${answer}`;
const result = await providerRouter.complete({ messages: [{ role: 'user', content: prompt }] });
const classification = result.content.trim().toLowerCase(); // could be anything
```

This breaks the moment the model adds punctuation, explanation text, or a
near-miss synonym.

## Correct pattern — structured output + validation at the boundary

```typescript
import { z } from 'zod';

const ClassificationSchema = z.object({
  classification: z.enum(['correct', 'incorrect', 'partial', 'misunderstood', 'evasive']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  missingPoints: z.array(z.string()).optional(),
});

async function classifyAnswer(answer: string, rubricPoints: string[]) {
  const result = await providerRouter.complete({
    purpose: 'assessment',
    responseSchema: ClassificationSchema, // provider-router requests structured/JSON output
    messages: [buildRubricPrompt(answer, rubricPoints)],
  });

  const parsed = ClassificationSchema.safeParse(result.content);
  if (!parsed.success) {
    // Do NOT coerce or guess. Retry once with an explicit correction prompt,
    // then fail loudly if it still doesn't validate — don't let a bad
    // classification silently enter the DB.
    return retryWithCorrection(answer, rubricPoints, parsed.error);
  }

  return parsed.data;
}
```

## Rules

- **Never coerce a near-miss value.** If the model returns `"partially
  correct"`, don't map it to `partial` with a string-similarity heuristic —
  retry the call with the schema violation shown back to the model.
- **Cap retries at 2.** If it still doesn't validate after a correction
  retry, surface an explicit error (`AssessmentValidationError`) rather than
  defaulting to some fallback classification like `evasive`. A silent default
  corrupts the skill profile.
- **`session_answers.classification` column in Postgres should itself be a
  Postgres enum type**, not a free-text column — this gives you a second,
  DB-level backstop in case application-level validation is ever bypassed.
- **Log validation failures** (not just successes) to help catch prompt
  drift over time — if retries start climbing, the rubric prompt itself
  probably needs tightening.

## Checklist

- [ ] Classification call uses a structured schema, not free-text parsing.
- [ ] Schema enum values exactly match `0-context.md`'s five values, same spelling.
- [ ] Failed validation retries with correction, doesn't coerce or default.
- [ ] DB column is a real enum type, not a string column trusted to only ever
      contain five values.
