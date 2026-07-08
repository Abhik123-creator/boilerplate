---
name: code-generation
description: Mandatory entry-point workflow whenever the user asks to add a model, table, CRUD API, UI page, module, cron job, k6 test, or Grafana dashboard. Enforces template selection and a schema confirmation step, then runs a generator script instead of writing code by hand — keeping token usage per request low.
---

# Skill: Code Generation Workflow

Every scaffolding request goes through this workflow. The goal is minimal tokens per request: generators write the code, the LLM only gathers the spec, confirms it, and runs one command.

## Hard rules

1. **Never hand-write a file a generator can produce.** No writing controllers, services, DTOs, entities, migrations, module configs, CRUD pages, k6 scenarios, or dashboard JSON in the chat when a script below covers it.
2. **Always confirm the spec before running a generator.** Present the proposed schema/spec compactly (see below) and get an explicit yes. Generators refuse to overwrite existing files, but a wrong model name or field type still wastes a generation cycle.
3. **Always make the user pick a template — or explicitly choose custom.** Never silently invent a bespoke page/module shape.
4. **Don't read generated files back** after the script succeeds. Trust the generator output and its console log. Only open a generated file when the user asks for a customization to it, and open only that file.
5. Custom = generate the closest base first, then edit. Never scaffold from scratch by hand.

## Step 1 — Choose a template

Match the request to a generator + template. If the fit is ambiguous, ask the user to choose (offer the closest 2–3 templates plus "custom"):

| Request | Generator command | Follow-on skill |
| --- | --- | --- |
| CRUD model with API + UI page | `pnpm generate:crud --model=x --fields=a:string,b:email` | `skills/crud-module` |
| Backend-only NestJS module | `pnpm generate:module --name=x` | `skills/nestjs-module` |
| Drizzle entity in an existing module | `pnpm generate:entity --module=x --name=y` | `skills/migrations` |
| Frontend module (web/mobile shell) | `pnpm generate:frontend-module --name=x` | `skills/frontend-module` |
| Cron/scheduled job | `pnpm generate:cron-job --module=x --name=y` | `skills/cron-jobs` |
| k6 load/functional test for a module | `pnpm generate:k6-scenario --model=x --fields=...` | `skills/k6-testing` |
| Grafana dashboard for a module | `pnpm generate:grafana-dashboard --module=x` | `skills/grafana-dashboards` |

For the **page layout** of any UI work, the template choices are the page-view skills — the user must pick one (or custom):
`page-view-table-list`, `page-view-cards`, `page-view-kanban`, `page-view-dashboard`, `page-view-settings`, `page-view-document-editor`.
CRUD generation defaults to `page-view-table-list`; only ask about layout when the request implies something else.

## Step 2 — Confirm the spec

Before running anything, show a compact spec and wait for confirmation. For a CRUD model:

```
Model: employee   Module/route: employees   Template: table-list
| field | type   |
| name  | string |
| email | email  |
| phone | phone  |
(id, createdAt, updatedAt are added automatically)
Command: pnpm generate:crud --model=employee --fields=name:string,email:email,phone:phone
```

Field types supported by the generators: `string, text, email, phone, number, boolean, date`. If the user asks for a type outside this list (enum, relation, jsonb…), map it to the closest supported type in the spec, flag it, and plan a manual follow-up edit after generation.

## Step 3 — Run the script, then stop

Run the confirmed command. Report the generator's own summary — do not re-list or re-open the created files. Then offer the standard follow-ups without doing them unprompted:

- `pnpm migrate:module <module>` + enable the feature key for the tenant (CRUD only).
- `pnpm generate:k6-scenario --model=<model> --fields=<same fields>` for load coverage.
- `pnpm generate:grafana-dashboard --module=<module>` for observability.

## Step 4 — Security checklist (every generated module)

Confirm these hold for any customization done after generation; the generated base already complies:

- All tenant data access stays inside `withTenantDb()` in the module's service — never query another tenant's schema or bypass the tenant context.
- Every write endpoint has a DTO with class-validator decorators; the global `ValidationPipe({ whitelist: true })` strips unknown keys — never accept raw `any` bodies.
- Endpoints stay behind the auth guard and the module's feature key; never expose an unauthenticated route without explicit user sign-off.
- Use Drizzle query builders (parameterized) — no string-interpolated SQL.
- No secrets, tokens, or credentials in generated code, seeds, k6 scripts, or dashboard JSON.
- Don't catch Postgres 23505 in services — `PostgresExceptionFilter` maps it to 409.
