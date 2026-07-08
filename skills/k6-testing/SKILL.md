---
name: k6-testing
description: Generates k6 end-to-end performance and functional tests. Use this skill when asked to add tests for any module using k6, or when building load tests.
---

# k6 Testing Guidelines

When the user requests to create or add k6 tests for modules, follow these instructions to maintain consistency across the test suite.

## Generate first — don't hand-write scenarios

Standard CRUD scenarios are generated, not written. Follow `skills/code-generation`: confirm the model, route base path, and fields with the user, then run:

```bash
pnpm generate:k6-scenario --model=employee --fields=name:string,phone:phone,email:email
pnpm generate:k6-scenario --model="sales order" --module=sales-orders --base-path=/sales-orders --fields=number:string,total:number
```

`--fields` uses the same syntax as `generate:crud`, so reuse the exact arguments from the CRUD generation. The script writes `tests/k6/scenarios/<model>.js` (create/list/update/delete with `check()`s) and wires the import + call block into `tests/k6/main.js` at the `generated scenario` marker comments. Don't read the generated files back.

Hand-write scenario code only for flows the generator can't express (multi-step workflows, file uploads, websocket, custom auth) — and even then, generate the CRUD base first and extend it, following the rules below.

## Directory Structure
All k6 testing assets are located in `tests/k6`. 
- `tests/k6/utils/`: Shared utilities like `api.js` (for HTTP wrappers), `config.js` (for environment configurations), and `auth.js` (for login/impersonation logic).
- `tests/k6/scenarios/`: Modular scenario scripts where each file corresponds to a module (e.g. `tenant.js`, `department.js`, `employee.js`).
- `tests/k6/main.js`: The central orchestrator script that ties scenarios together and specifies VU/iteration profiles.

## Writing Scenarios
When adding tests for a new module, create a new file in `tests/k6/scenarios/<module>.js`.
1. Use `import { check } from 'k6';`
2. Use `import { makeRequest } from '../utils/api.js';`
3. Write functions for each CRUD operation.
4. Each function must validate the HTTP response using `check()`.
5. Return the parsed JSON response body when needed for downstream operations (e.g., returning an `id` to use in an update/delete call).

Example:
```javascript
import { check } from 'k6';
import { makeRequest } from '../utils/api.js';

export function createItem(token, tenantId, payload) {
  const res = makeRequest('POST', '/items', payload, {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId,
  });
  
  check(res, {
    'item created': (r) => r.status === 201,
  });
  
  return res.json();
}
```

## Adding to Main
1. Import your scenario functions into `tests/k6/main.js`.
2. In the `default(data)` function, invoke your CRUD functions sequentially, passing the necessary authentication tokens and tenant IDs.
3. Manage inter-dependencies (e.g., waiting for an item to be created before updating it).

## Reporting
The `handleSummary` function in `main.js` automatically hooks into the `benc-uk/k6-reporter` to generate a `summary.html` report. Do not modify this unless instructed by the user to change reporting tools.
