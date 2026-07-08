# Boilerplate — Working Rules

Multi-tenant modular SaaS boilerplate: pnpm monorepo with `apps/api` (NestJS + Drizzle, schema-per-tenant Postgres, BullMQ worker), `apps/web` (React + react-router micro-frontend modules), `apps/mobile` (React Native), `packages/contracts` (shared types/keys) and `packages/ui-common` (shared UI, incl. `AdvancedDataTable`). Architecture doc: `docs/multi-tenant-modular-boilerplate-architecture.md`.

## Generator-first (read `skills/code-generation/SKILL.md` before scaffolding anything)

Never hand-write code a generator produces. For any new model, module, page, cron job, k6 test, or Grafana dashboard: pick a template with the user, show the proposed spec (model, fields, template, exact command), get confirmation, then run the script. Don't read generated files back afterwards; only open a file when customizing it.

- `pnpm generate:crud --model=x --fields=a:string,b:email` — API + web CRUD (types: string, text, email, phone, number, boolean, date)
- `pnpm generate:module` / `generate:entity` / `generate:frontend-module` / `generate:cron-job`
- `pnpm generate:k6-scenario --model=x --fields=...` — k6 CRUD scenario, auto-wired into `tests/k6/main.js`
- `pnpm generate:grafana-dashboard --module=x` — provisioned module dashboard (Prometheus + Loki)

UI page layouts come from the `skills/page-view-*` skills — the user picks one or explicitly chooses custom. Custom always means: generate the closest base, then edit.

## Commands

- Dev: `pnpm dev:api`, `pnpm dev:worker`, `pnpm dev:web`; full stack: `pnpm docker:up`
- DB: `pnpm migrate:core`, `pnpm migrate:tenants`, `pnpm migrate:module <module>`, `pnpm db:fresh`
- Quality gate: `pnpm lint && pnpm build && pnpm --filter api test`
- Load tests: `k6 run tests/k6/main.js` (see `skills/k6-testing`)

## Conventions

- Backend modules live in `apps/api/src/modules/<feature>/` (module, controller, service, `dto/`, `entities/`, `migrations/`, `jobs/`, `cron/`); registered in `app.module.ts` below the marker comment. Cross-cutting code lives in `apps/api/src/core/`.
- Frontend modules live in `apps/<web|mobile>/src/modules/<feature>/` with `module.config.ts`; lazy-loaded by `core/module-loader.ts` gated on tenant feature keys.
- Shared role keys, module config types, and API list envelopes come from `@boilerplate/contracts` — never redeclare them locally.
- List endpoints use `ListQueryDto` + `listAndCount()` (`apps/api/src/core/common/query/`) returning `{ rows, total, limit, offset }`; tables render with `AdvancedDataTable`, server-side search/filter/pagination only (no client-side filtering of fetched arrays).
- Bulk CSV import/export runs in the BullMQ worker (`worker.module.ts`), never in the API process. Reference module for everything: `employees`.
- Don't catch Postgres 23505 in services — the global `PostgresExceptionFilter` maps it to 409. Use `assertFound(row, 'Entity')` for not-found.
- UI: all strings through `useTranslation()`; `lucide-react` icons (no emojis); components ≤150 lines.
- Extract error messages from response bodies in HTTP clients; keep page files thin (data hook, columns builder, modal components).

## Security (non-negotiable)

- Tenant isolation: all tenant data access goes through `withTenantDb()` (`apps/api/src/core/database/tenant-db.service.ts`) inside the owning module's service. Never join across tenant schemas or accept a tenant id from the body over the authenticated context.
- Input validation: every write endpoint has a class-validator DTO; the global `ValidationPipe({ whitelist: true })` strips unknown keys. Rate limiting via `ThrottlerModule` and per-route `rateLimit` config stays on.
- AuthZ: routes stay behind the auth guard, RBAC (`core/rbac`), and the module's feature key. New public/unauthenticated routes require explicit user sign-off.
- SQL: Drizzle query builders only — no string-interpolated SQL. jsonb custom-field values must be sanitized against their definitions (see employees service).
- Secrets only via `.env`/config service — never in code, seeds, k6 scripts, dashboard JSON, or logs. Never log tokens or PII.
- Dependency/CVE work follows `skills/security/SKILL.md`; SOC 2 work follows `skills/soc2-compliance-audit/SKILL.md`. Run `pnpm audit` when touching dependencies.

## Token discipline

Keep LLM calls cheap: prefer running scripts over emitting code; read only the files you're changing; trust generator/console output instead of re-reading results; keep answers and specs compact.
