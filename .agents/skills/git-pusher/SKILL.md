---
name: git-pusher
description: Use whenever executing git commands (branching, committing, pushing). Enforces proper branch naming, commit structure, and strict syntax rules for Windows PowerShell to prevent syntax errors.
---

# Git Pusher Guidelines

## Why this exists
Git operations in this environment happen via Windows PowerShell, which does not support the `&&` operator by default. Agents frequently break when attempting to chain Git commands with `&&`. Furthermore, proper version control practices (conventional commits, semantic branching) are required for project maintainability.

## 1. PowerShell Syntax Rule (CRITICAL)
- **NEVER** use `&&` to chain commands.
- **ALWAYS** use `;` to chain commands in PowerShell.
- Example **WRONG**: `git add . && git commit -m "..." && git push`
- Example **CORRECT**: `git add . ; git commit -m "..." ; git push`

## 2. Branch Naming Conventions
Always create a new branch for new work. Never commit directly to `main`.
- Features: `feature/<phase-name>-<feature-name>` (e.g., `feature/phase-3-provider-router`)
- Bug Fixes: `fix/<module-name>-<bug-description>` (e.g., `fix/prisma-initialization`)
- Chores/Docs: `chore/<description>` or `docs/<description>`

## 3. Commit Message Structure (Conventional Commits)
Use the conventional commit format: `<type>(<optional scope>): <description>`
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes (including ledger or agent files)
- `chore:` for tooling, dependencies, or minor maintenance

Examples:
- `feat(assessment): implement LLM validation with Zod`
- `fix(prisma): configure driver adapter for Prisma 7`
- `docs(ledger): update Phase 2 completion status`

## 4. Execution Workflow
When instructed to save, push, or version control changes:
1. Check status: `git status`
2. Create branch: `git checkout -b <branch-name>`
3. Stage changes: `git add .`
4. Commit: `git commit -m "<type>: <description>"`
5. Push: `git push -u origin <branch-name>`

You can chain these safely using `;` in a single command execution:
`git checkout -b feature/example ; git add . ; git commit -m "feat: added example" ; git push -u origin feature/example`
