# AGENTS.md

Project-level guidance for contributors and coding agents.

## Overview

FIRE Balance is a monorepo:
- `implementations/typescript/` (maintained): React + TypeScript web app (primary)
- `implementations/python/` (legacy): no new features; may lag behind schema/UI
- `shared/`: shared assets (notably i18n JSON)
- `docs/`: documentation

## TypeScript architecture (maintained)

Working dir: `implementations/typescript/`
- `src/core/`: calculation engine + planner logic (domain layer)
- `src/stores/`: Zustand state (planner data, overrides, import/export)
- `src/components/`: UI (Stage1/Stage2/Stage3 content, tables, charts)
- `src/services/`: orchestration glue (e.g. running calculations)
- `src/types/` + `src/types/ui.ts`: plan schema + UI↔core conversions
- i18n: `shared/i18n/{en,zh-CN,ja}.json` (consumed via `@shared` alias)

## Development commands

CI uses Node.js 20 for TypeScript and Python 3.12 for Python.

TypeScript:
- Dev: `npm -C implementations/typescript run dev`
- Type-check: `npm -C implementations/typescript run type-check`
- Lint/format: `npm -C implementations/typescript run lint`, `npm -C implementations/typescript run format`
- Tests: `npm -C implementations/typescript test`
- Build: `npm -C implementations/typescript run build`
- One-shot checks: `npm -C implementations/typescript run prepare`

Python (legacy):
- Only touch if necessary; keep changes minimal.
- Quality gates still exist in CI and pre-commit for `implementations/python/`.

## Quality gates (before pushing / opening a PR)

Pre-commit (repo-level):
- Install once: `pre-commit install`
- Run: `pre-commit run --all-files`

Match GitHub Actions (TypeScript Checks workflow):
- `npm -C implementations/typescript ci`
- `npm -C implementations/typescript run format:check`
- `npm -C implementations/typescript run lint`
- `npm -C implementations/typescript run type-check`
- `npm -C implementations/typescript test`
- `npm -C implementations/typescript run build`

Notes:
- If you change `shared/i18n/*.json`, keep keys consistent across languages; JSON validity is enforced by pre-commit and CI.
- Deployment to Cloudflare Pages is gated by the TypeScript Checks workflow on `main`.
