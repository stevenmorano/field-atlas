# Cloud setup guide

Status: cloud/community foundation applied successfully; migration `202608120001` from the moderation hardening pass still needs to be applied to the current development database
Last reviewed: 2026-08-12

The repository contains optional account, private synchronization, and R2 transfer code. Without these environment values, Field Atlas remains a fully functional local-first application and shows setup guidance instead of cloud controls.

## 1. Create Supabase resources

1. Create a Supabase project.
2. Open its SQL editor and run [`../supabase/migrations/202608100001_cloud_map_foundation.sql`](../supabase/migrations/202608100001_cloud_map_foundation.sql).
3. Run [`../supabase/migrations/202608110001_community_publishing_foundation.sql`](../supabase/migrations/202608110001_community_publishing_foundation.sql) after the first migration. It is additive and does not delete existing private maps or revisions.
4. Run [`../supabase/migrations/202608110002_fix_publish_publication_number.sql`](../supabase/migrations/202608110002_fix_publish_publication_number.sql). It fixes the `publication_number` name collision found during the first live publication test and is safe after migration `202608110001`.
5. Run [`../supabase/migrations/202608120001_enforce_moderation_hold_on_unpublish.sql`](../supabase/migrations/202608120001_enforce_moderation_hold_on_unpublish.sql). It makes the map-level moderation hold authoritative for owner unpublishing as well as publishing and does not rewrite existing records.
6. In Authentication URL settings, set the Site URL to the deployed Field Atlas origin. Use `http://localhost:3000` only as the temporary Site URL when testing exclusively on that origin.
7. Add both `http://localhost:3000/auth/callback` and `https://YOUR-PRODUCTION-ORIGIN/auth/callback` to Redirect URLs. Do not replace the localhost entry when adding production; both may coexist.
8. Keep the Email provider enabled for email/password accounts. The current UI does not require Google OAuth.
9. Copy the base project URL (ending in `.supabase.co`, without `/rest/v1/`) and publishable key. A value ending in `/rest/v1/` is an API path, not the project base URL, and causes authentication requests to fail.

The migration creates private-by-default maps, immutable revisions, image asset records, row-level security, and narrowly granted sync functions. Authenticated clients cannot directly mark a map published.

## 2. Create private R2 storage

1. Create a private Cloudflare R2 bucket, for example `field-atlas-maps`.
2. Create an R2 API token scoped to object read/write access for that bucket.
3. Copy the account ID, access key ID, and secret access key.
4. Apply a bucket CORS policy based on [`../supabase/r2-cors.example.json`](../supabase/r2-cors.example.json).
5. Put each origin in `AllowedOrigins` as a separate, comma-delimited JSON string. Keep `http://localhost:3000` for local testing and add the exact production origin without a trailing path.

The browser receives five-minute, single-object presigned URLs. R2 credentials must never appear in a `NEXT_PUBLIC_` variable or client bundle.

## 3. Configure the application

Copy `.env.example` to `.env.local` and set:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=field-atlas-maps
REPORT_FINGERPRINT_SECRET=your-long-random-report-secret
```

Restart the development server after changing public environment variables. They are embedded at build time in production.

`.env.local` belongs in the repository root beside `package.json`. It is intentionally ignored by Git. In VS Code, make sure you opened `D:\CodexWorkspaces\maprika-clone\.env.local` rather than a similarly named unsaved tab or another workspace file. Never paste its values into issues, documentation, screenshots, or commits.

If port 3000 is already occupied, identify the owner before starting another copy:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = PROCESS_ID" | Select-Object ProcessId, CommandLine
```

Stop the old project from its terminal with `Ctrl+C`; then run `npm run dev` here so the configured localhost callback and CORS origin remain correct.

## 4. Verify the private sync flow

1. Open `/account` and create or sign in to an email/password account.
2. Open `/my-maps` and sync one small test map.
3. Confirm that the original local map still opens offline.
4. Confirm one map, revision, and ready asset record exist in Supabase.
5. Confirm the original image exists below the account UUID prefix in R2.
6. Sign in on a second browser profile, open My Maps, and download the cloud-only map to that device.
7. Confirm its anchors, metadata, viewer, GPS projection, and Compare view match the original.

Do not clear the original browser data during setup testing. Keep a verified `.fieldatlas` export until the hosted services and second-device download have both been tested.

## 5. Seed the first administrator

After signing in once, find your user UUID in Supabase Authentication > Users. Run this in the SQL editor, replacing the placeholder with that UUID:

```sql
insert into public.site_roles(user_id, role)
values ('YOUR_AUTH_USER_UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Sign out and back in, then open Account. The **Open moderation** button appears in the public-profile section. Email addresses are not stored in public profiles.

## 6. Verify community publishing

1. Keep a `.fieldatlas` backup and confirm the test map is privately synced.
2. In My Maps, choose **Share** beside that map.
3. Choose Public or Unlisted, select the sharing-rights basis, confirm the consequence statement, and publish.
4. Open the returned link in a signed-out/private browser window. The map, GPS button, offline save, uploader profile, and anonymous report control should work without an account.
5. Public maps should appear in Discover immediately. Unlisted maps should work only through their secret link and should not appear in Discover.
6. Open `/moderation` as the seeded administrator and confirm the map appears in the post-publication queue.
7. Test **Make private** and confirm it removes anonymous access without changing the local or private-cloud copy.

8. Reopen Share without changing the revision or sharing fields. Confirm it shows **Already published** and does not create another publication or R2 derivative.

## 7. Prepare a production deployment

1. Create the production project on the chosen Next.js host.
2. Add every `.env.local` key as an encrypted production environment variable; do not upload the file itself.
3. Set the Supabase Site URL to the stable production origin and retain both localhost and production callback entries.
4. Add the exact production origin to R2 CORS while retaining localhost for development.
5. Run `npm run validate`, `npm audit --omit=dev --audit-level=high`, and `npm run build` locally.
6. Deploy, then follow the release checklist in [`OPERATIONS.md`](OPERATIONS.md).

## Troubleshooting setup errors

| Symptom | Likely cause | Resolution |
| --- | --- | --- |
| `Invalid path specified in request URL` during sign-in | `NEXT_PUBLIC_SUPABASE_URL` includes `/rest/v1/` or is not the base project URL | Use exactly `https://PROJECT_REF.supabase.co`, restart the dev server, and request a fresh login. |
| Email link is expired or already used | Old one-time link | Request a new link, or use the implemented email/password flow. |
| R2 CORS editor says the policy is invalid | Missing comma/bracket or origins were pasted as adjacent strings | Start from `r2-cors.example.json`; keep valid JSON and one string per origin. |
| Publication reports ambiguous `publication_number` | Hotfix migration not applied | Run `202608110002_fix_publish_publication_number.sql`. |
| Share says the migration is missing | Community migration or grants not applied to the selected Supabase project | Verify migrations `202608100001`, `202608110001`, `202608110002`, and `202608120001` in order. |
| The app starts on port 3001 | Another process already owns 3000 | Stop the older Node process/project, then restart Field Atlas on 3000. |

## Public upload boundary

Private sync and public sharing remain separate. Publishing freezes the chosen revision, decodes and re-encodes the source as sanitized WebP derivatives, keeps the original R2 object private, and atomically activates the new publication. Public data is returned through allowlisted database functions and application APIs; anonymous users cannot select raw map revisions or private assets. A public map is visible immediately and enters post-publication review. An unlisted map requires its revocable secret link.
