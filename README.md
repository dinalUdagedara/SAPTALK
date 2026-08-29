# SAPTalk

Ask questions about SAP business data in plain English. An LLM translates the
question into a **structured query intent**; deterministic code turns that intent
into a valid OData query. The generated query is always shown to the user.

## Status

**Milestone 1 — end-to-end pipe.** Button → NestJS → SAP sandbox → table. No LLM yet.

## Layout

```
apps/api        NestJS backend (port 3001)
  src/sap/
    sap.service.ts               transport: builds URLs, calls SAP, handles errors
    business-partner.service.ts  entity logic: projection + normalisation
    odata-v2.ts                  V2 dialect helpers (unwrapping, /Date()/ parsing)
apps/web        Next.js frontend (port 3000)
packages/shared Types shared by both — where the query-intent schema will live
```

The split in `apps/api/src/sap/` is deliberate: `SapService` knows nothing about
Business Partners, so the intent → OData translator can build parameter maps for
any entity set without touching the transport layer.

## Setup

1. Get a sandbox key from [api.sap.com](https://api.sap.com) → avatar → Settings → *Show API Key*.

2. Backend env:
   ```bash
   cp .env.example apps/api/.env
   # then paste your key into SAP_API_KEY
   ```

3. Frontend env (optional — defaults to `http://localhost:3001/api`):
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```

4. Install and run:
   ```bash
   pnpm install
   pnpm dev
   ```

Open http://localhost:3000 and click **Fetch business partners**.

## Endpoint

```
GET /api/sap/business-partners?top=10
```

Returns a `QueryEnvelope`: the resolved SAP URL, upstream duration, normalised
rows, and the untouched raw payload.

## Note: the sandbox is OData V2

`API_BUSINESS_PARTNER` on the Accelerator Hub is **V2**, not V4. Consequences the
query builder has to respect:

| | V2 (what we have) | V4 |
|---|---|---|
| Response shape | `{ d: { results: [] } }` | `{ value: [] }` |
| JSON | `$format=json` required | default |
| Row count | `$inlinecount=allpages` → `d.__count` | `$count=true` |
| Dates | `/Date(1700000000000)/` | ISO-8601 |
| `$filter` strings | `substringof('x', Field)` | `contains(Field, 'x')` |

That last row matters most: the natural-language "contains" case compiles to
different syntax than most OData documentation shows.

## Next

Milestone 2: the query intent schema in `packages/shared` — a Zod object the LLM
fills in (entity, select, filters, orderBy, top), validated against a field
allowlist before `SapService` ever sees it.
