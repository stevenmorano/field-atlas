# Operations and release runbook

Status: small-development-beta runbook
Last reviewed: 2026-08-12

This runbook protects user work and the private/public boundary while Field Atlas moves from localhost to a hosted beta.

## Before any risky operation

1. Open My Maps and download **Back up all maps**.
2. Confirm the `.fieldatlas` preview can be opened through **Import backup** without importing it.
3. Confirm every important local map shows the expected anchor count.
4. Sync changed maps privately and verify the cloud revision status.
5. Never clear browser data, delete R2 objects, rewrite Supabase history, or remove the current origin until recovery has been verified elsewhere.

## Development verification

Run from the repository root:

```powershell
npm run validate
npm audit --omit=dev --audit-level=high
npm run build
```

Then smoke-test:

1. Local My Maps still lists the expected maps and anchor counts.
2. Anchor Lab resumes the current draft without replacing it.
3. A private sync leaves the local copy available.
4. An unchanged Share dialog says **Already published**.
5. A legitimate visibility change becomes publishable, but cancel it unless the change is intended.
6. A signed-out window can open a Public map, use the GPS control, save it offline, open the profile, and submit a test report.
7. Browser console logs contain no application errors.

## Moderation verification

Use a test or intentionally published map:

1. Submit an anonymous report and confirm it enters `/moderation`.
2. Mark the map checked and confirm the public label changes to **Admin checked**.
3. Request changes with a reason and confirm the map remains accessible.
4. Hide the map with a reason and confirm Public/Unlisted detail and asset delivery stop.
5. Confirm the owner cannot bypass the map-level hold by publishing again.
6. Restore the map and confirm it returns to the queue and public access resumes.

Do not describe **Admin checked** as proof of accuracy, ownership, legality, or safety.

## Production deployment checklist

1. Push a validated commit to GitHub.
2. Configure the hosting project with the encrypted environment values listed in [`CLOUD_SETUP.md`](CLOUD_SETUP.md).
3. Set the production Supabase Site URL and retain both localhost/production callback URLs.
4. Add the exact production origin to R2 CORS and retain localhost for development.
5. Deploy the immutable Git commit.
6. Open the production Account, Discover, My Maps, Public map, profile, and moderation routes.
7. Test authentication using a fresh session and verify the callback returns to the production origin.
8. Test private sync/download with a small nonessential map before using a high-resolution original.
9. Test Public and Unlisted access from a signed-out browser.
10. Test foreground geolocation on a physical phone over HTTPS.

Localhost IndexedDB maps do not automatically appear under the production hostname. Export/import or explicit cloud download is required because browser origins have separate storage.

## Incident response

### Incorrect or abusive public map

Hide it from `/moderation`, record a concise reason, and inspect the reports/source. Hiding is nondestructive and sets a map-level publishing hold. Restore only after the concern is resolved.

### Suspected credential exposure

1. Revoke the affected R2 token or rotate the report secret immediately.
2. Replace the hosting and local environment values.
3. Redeploy/restart the application.
4. Inspect Git history and public logs. If a secret was committed, rotation is mandatory; deleting the working-tree line is not sufficient.

### Bad deployment

Roll the hosting platform back to the last validated Git commit. Do not roll database migrations backward destructively. The migrations in this beta are additive; diagnose compatibility and deploy a forward fix.

### R2 or Supabase outage

Local creation, saved maps, backup, viewing, GPS, and Compare remain available for existing IndexedDB data. Avoid repeated destructive retries. Preserve local work, show the cloud error, and retry after service recovery.

### Lost browser library

Restore from a verified `.fieldatlas` package or sign in and explicitly download each cloud map. Cloud sync covers only revisions that were actually synced; an unfinished or unsynced local draft may exist only in its browser/backup.

## Routine maintenance

- Review the moderation/report queue regularly during the small beta.
- Monitor Supabase database size and R2 object/operation usage.
- Keep dependencies patched and run the audit before releases.
- Verify backup/import after any IndexedDB schema change.
- Add cleanup automation before scale: abandoned uploads, unreferenced public derivatives, account deletion, and expired abuse tokens.
- Keep [`CHANGELOG.md`](../CHANGELOG.md), [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md), and the current-state guides synchronized with every release increment.
