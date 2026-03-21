

## Plan: Apply pending database migrations and fix build errors

### Problem
You pushed 3 migrations from GitHub that create new tables and columns, but they haven't been applied to the actual database yet:

1. **`20260320000001`** — Adds `meeting_type` column to `meetings`, creates `afstemninger` table, creates `vedtaegt_versioner` table
2. **`20260320000002`** — Adds "Fra møder" default category, updates `insert_default_permissions`
3. **`20260320000003`** — Adds `oprettet_af` column to `vedtaegt_versioner`

The code references these tables/columns but the database doesn't have them, causing all the TypeScript errors (the auto-generated `types.ts` reflects the actual database).

### Solution

**Step 1: Execute the 3 pending migrations via the database migration tool**

Run the SQL from each migration file in order against the database. This will:
- Add `meeting_type` column to `meetings`
- Create `afstemninger` table with RLS policies
- Create `vedtaegt_versioner` table with RLS policies  
- Add "Fra møder" default category to all existing orgs
- Update `insert_default_permissions` function
- Add `oprettet_af` column to `vedtaegt_versioner`

Once applied, the `types.ts` file will auto-regenerate to include the new tables and columns, resolving all build errors.

**Step 2: Deploy and test edge functions**

After the database is updated, deploy all edge functions:
- `send-email`
- `invite-member`
- `send-approval-emails`
- `transfer-ownership`
- `send-paamindelser`
- `cvr-lookup`

Then test each one to verify they're working.

### Expected outcome
- All ~20 TypeScript build errors resolved (they all stem from missing tables/columns in the database schema)
- Edge functions deployed and accessible
- No code changes needed — only database state needs to catch up with the code

