---
name: prisma-safe-migration
description: Use whenever changing prisma/schema.prisma or running any Prisma migration command against the Neon database. Prevents accidental data loss and drift between local schema and the live Neon instance.
---

# Prisma safe migration

## Why this exists

The database is Neon — a real, persistent instance, not a disposable local
container. Once Phase 2+ has real session/answer data in it, a careless
migration can silently drop a column or table. This skill is the checklist
that prevents that.

## The only two commands you should reach for

**`npx prisma migrate dev --name <description>`**
Use this for every schema change during development. It:
1. Generates a new SQL migration file in `prisma/migrations/`.
2. Shows you the SQL before applying it (read it).
3. Applies it to the DB configured in `DATABASE_URL`.
4. Regenerates the Prisma Client.

**`npx prisma migrate deploy`**
Use this only in a deploy/CI context, applying already-generated migration
files — never to author new migrations.

## Never use these against Neon without explicit confirmation

- `npx prisma db push` — skips the migration history entirely; fine for a
  throwaway local DB, dangerous against Neon since there's no record of what
  changed or a clean way to roll back.
- `npx prisma migrate reset` — **drops the entire database** and reapplies
  migrations from scratch. Only acceptable against Neon if the person
  explicitly confirms they're OK losing all current data (e.g. early Phase 1
  before real sessions exist). Never run this automatically as part of a
  "fix the migration" loop.

## Before running `migrate dev`

1. Read the diff in `schema.prisma` — confirm you're adding/changing what the
   step actually asked for, nothing else drifting in.
2. If the change **removes or renames** a column/table that might have data
   (anything past Phase 1), that's a BLOCKING-severity item for the Auditor
   to catch — flag it explicitly in your handoff rather than letting it pass
   silently: "this migration drops column X, confirm before applying."
3. Check the generated migration SQL Prisma prints before confirming — if it
   contains `DROP TABLE` or `DROP COLUMN` on something you didn't expect,
   stop and re-check the schema diff.

## Migration naming

Name migrations for what they do, not the ticket/step number:

```
npx prisma migrate dev --name add_user_model
npx prisma migrate dev --name add_session_and_answers_tables
npx prisma migrate dev --name add_tutor_attempts_table
```

Not `--name step-3` or `--name update` — future sessions (yours or another
agent's) need to understand migration history by reading file names.

## Checklist

- [ ] Used `migrate dev`, not `db push`, for this schema change.
- [ ] Read the generated SQL before it applied.
- [ ] No unexpected `DROP` on a table/column with real data.
- [ ] Migration name describes the change, not the step number.
- [ ] `schema.prisma` matches what `0-context.md`'s schema section describes
      (or `0-context.md` needs updating to match — flag this to the Planner
      if they diverge).
