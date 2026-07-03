# Phase 2 Rework Plan

## Status: BLOCKED

### Test Execution Failure
The integration test suite (`scratch-phase-test.ts`) crashed during the very first operation: connecting and inserting a `User` into the database via `PrismaService`.

### Clues / Trace
```
PrismaClientKnownRequestError: Invalid `prisma.user.create()` invocation
```
The exact reason wasn't printed because the error object's internal message was swallowed, but this is a `PrismaClientKnownRequestError`. 

**Possible causes:**
1. Since we migrated to Prisma 7 and the `@prisma/adapter-pg` driver adapter, we may have a misconfiguration in `PrismaService` where the Postgres pool isn't authentically connecting to Neon. 
2. The `DATABASE_URL` might not be loaded into the `process.env` properly when running a raw `.ts` script outside of the NestJS standard bootstrapper (which normally loads `.env`).
3. Neon DB might require SSL or specific connection pool settings that the raw `pg` Pool doesn't default to.

### Instructions for Coder
1. Please investigate `scratch-phase-test.ts` line 33 and `apps/api/src/prisma/prisma.service.ts`.
2. Ensure the `pg` connection pool is initialized correctly (e.g. `ssl: true` or checking if `process.env.DATABASE_URL` is undefined).
3. Update the code to fix the database insertion error.
4. Trigger `/phasecompletiontester` again once you believe it is fixed!
