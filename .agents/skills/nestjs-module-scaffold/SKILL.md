---
name: nestjs-module-scaffold
description: Use whenever creating a new backend module or adding a new endpoint to an existing one. Defines the standard file structure, guard placement, and DTO conventions so every module in apps/api looks the same regardless of which agent session built it.
---

# NestJS module scaffold

## Why this exists

Modules built across different sessions (and different agents — Planner
handing different steps to Coder over time) drift in structure if there's no
fixed template. This skill is that template.

## Standard module shape

For a module called `<name>`:

```
src/<name>/
  <name>.module.ts
  <name>.controller.ts        (only if it exposes HTTP routes)
  <name>.service.ts
  <name>.service.spec.ts      (stub is fine — Tester fills this in properly)
  dto/
    create-<name>.dto.ts
    update-<name>.dto.ts       (if applicable)
  entities/                    (only if the module needs types beyond Prisma's generated ones)
```

## Module file

```typescript
// <name>.module.ts
import { Module } from '@nestjs/common';
import { <Name>Controller } from './<name>.controller';
import { <Name>Service } from './<name>.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [<Name>Controller],
  providers: [<Name>Service],
  exports: [<Name>Service], // exported so OTHER modules can inject it — this is the module-boundary contract
})
export class <Name>Module {}
```

Only export the service, never the Prisma client or internal helpers — that's
what keeps module boundaries real rather than aspirational.

## Controller — guard placement

Every controller except `auth`'s login route gets the JWT guard, either at
the class level (preferred, so you can't forget it on a new route later) or
method level if the module has a genuine public endpoint:

```typescript
@UseGuards(JwtAuthGuard)
@Controller('<name>')
export class <Name>Controller {
  constructor(private readonly service: <Name>Service) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
```

If a route is intentionally public, don't just omit the guard silently —
comment why:
```typescript
@Public() // health check endpoint, no auth required
@Get('health')
```

## DTOs — validation, not just typing

```typescript
// dto/create-question.dto.ts
import { IsString, IsInt, Min, Max, IsArray } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  topic: string;

  @IsInt()
  @Min(1)
  @Max(5)
  difficulty: number;

  @IsArray()
  rubricPoints: string[];
}
```

Every DTO that accepts external input needs `class-validator` decorators —
don't rely on TypeScript types alone, they don't exist at runtime.

## Checklist for a new module

- [ ] Module registered in `app.module.ts` imports (Nest CLI does this
      automatically via `nest g module`, but verify after manual edits).
- [ ] Service exported, nothing else.
- [ ] Controller has the JWT guard unless explicitly and visibly marked public.
- [ ] Every DTO has `class-validator` decorators matching the Prisma schema's
      constraints (matching types, matching enum values).
- [ ] No direct Prisma queries for another module's tables — inject that
      module's service instead.
