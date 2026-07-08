---
name: grafana-dashboards
description: Add or edit provisioned Grafana dashboards (Prometheus metrics + Loki logs) for API modules. Use when asked for a dashboard, observability, metrics UI, or monitoring for a module.
---

# Skill: Grafana Dashboards

Grafana runs from `infra/docker/docker-compose.yml` with everything provisioned from files — never build dashboards by hand in JSON or in the Grafana UI when the generator covers it.

## Generate a module dashboard

```bash
pnpm generate:grafana-dashboard --module=employees
pnpm generate:grafana-dashboard --module=sales-orders --title="Sales Orders" --route-regex=".*/sales-orders.*"
```

Writes `infra/docker/grafana/provisioning/dashboards/json/<module>.json` (uid `mod-<module>`) with: request-rate/error-rate/p95 stats, per-route timeseries, per-tenant request rate, and a Loki logs panel — all filtered to the module's routes. Follow `skills/code-generation` first: confirm module + title with the user, run the script, don't read the JSON back.

Apply it: `docker compose -f infra/docker/docker-compose.yml --env-file .env restart grafana` (dashboards render at container start via `provisioning/render-dashboard.sh`, which loops over all JSON files and substitutes `__GRAFANA_DASHBOARD_TIME_FROM__`).

## Provisioning layout

- `provisioning/datasources/datasources.yml` — Prometheus (`uid: prometheus`, default) and Loki (`uid: loki`), both `editable: false`. Reference datasources by these uids only.
- `provisioning/dashboards/json/*.json` — source dashboards (placeholder form, committed).
- `provisioning/dashboards/dashboards.yml` — file provider watching `/var/lib/grafana/dashboards` (rendered output; never edit there).
- `api-overview.json` is the reference dashboard for panel shapes, templating variables, and PromQL conventions.

## Available metrics/labels

- `http_requests_total{route, status_code, tenant_slug}` and `http_request_duration_seconds_bucket{route, le, ...}` from the API (`apps/api/src/core/metrics`).
- Node process metrics: `process_*`, `nodejs_*` with `job="api"`.
- Loki logs: `{app="api", env, level}` — pipe through `| json` then filter on `req_method`, `req_url`, `res_statusCode`.

## Hand-edits (custom panels)

Only when the generated dashboard doesn't cover the ask. Keep: `schemaVersion: 39`, `"time": {"from": "__GRAFANA_DASHBOARD_TIME_FROM__", "to": "now"}`, unique panel `id`s, datasource refs by uid, and a `$tenant` templating variable on every Prometheus query so per-tenant filtering keeps working.

## Security

- Grafana admin credentials come from `GF_SECURITY_ADMIN_PASSWORD` in `.env` (reset on boot by `render-dashboard.sh`). Never hardcode credentials in provisioning files or dashboard JSON.
- Never enable anonymous auth or public dashboards; Grafana is an internal tool behind the docker network.
- Dashboards must not embed secrets, connection strings, or raw PII in queries or panel titles; tenant data is only ever aggregated by `tenant_slug`.
- Datasources stay `editable: false` so the UI can't be used to point Grafana at arbitrary hosts.
