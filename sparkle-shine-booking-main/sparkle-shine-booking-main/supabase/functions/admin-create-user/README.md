# admin-create-user Edge Function

This Supabase Edge Function creates a new staff user (auth user + profile + role) using the Service Role key. It avoids calling admin-only APIs from the browser.

## Environment

- `SUPABASE_URL` — your Supabase project URL (e.g. `https://xyzcompany.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY` — the Service Role key (KEEP THIS SECRET). This is required by the function to call admin APIs.

## Local development

1. Install the Supabase CLI: https://supabase.com/docs/guides/cli
2. Create a local `.env` in the project root with the two variables above:

   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ... (service role key)

3. Serve functions locally (from project root):

```bash
supabase functions serve --env-file .env
# or to serve only this function
supabase functions serve admin-create-user --env-file .env
```

4. Test the function locally:

```bash
curl -X POST "http://localhost:54321/functions/v1/admin-create-user" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@example.com","firstName":"John","surname":"Doe","phone":"+27800000000","idNumber":"0000000000000"}'
```

The function will respond with `{ "userId": "...", "assigned_slot": 1 }` or an error object.

## Deploying

1. Log in and set your project ref (if needed):

```bash
supabase login
# optionally set a project ref environment var or pass --project-ref
```

2. (Recommended) Store secrets in your Supabase project:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" --project-ref <project-ref>
supabase secrets set SUPABASE_URL="https://your-project-ref.supabase.co" --project-ref <project-ref>
```

3. Deploy the function:

```bash
supabase functions deploy admin-create-user --project-ref <project-ref>
```

After deployment the function will be available at:

```
https://<project>.supabase.co/functions/v1/admin-create-user
```

## Frontend usage

From the frontend (already implemented in `src/pages/Admin.tsx`), call:

```js
fetch('/functions/v1/admin-create-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, firstName, surname, phone, idNumber }),
});
```

Note: when deployed on Supabase platform the relative path `/functions/v1/...` will resolve to the correct project host when served from the same domain. If calling from a different origin, use the full function URL.

## Security notes

- NEVER expose the `SUPABASE_SERVICE_ROLE_KEY` in client code or public repos.
- The current function implementation does not verify that the caller is an admin — consider adding verification (e.g., require an Authorization header with an admin JWT and verify the user's role before proceeding).
- You can implement an allow-list or additional checks inside the function to limit who can create staff accounts.

## Troubleshooting

- If you see permission errors when running locally, ensure your `.env` contains a valid `SUPABASE_SERVICE_ROLE_KEY`.
- If `supabase functions serve` returns port conflicts, verify port `54321` is free or use the CLI flags to change port.

