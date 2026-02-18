# GitHub Actions Testing Checklist

Use this checklist to verify the Notion integration works in GitHub Actions.

## Pre-Deployment Checklist

- [x] Local testing passes (`npm run test:notion`)
- [x] Scripts are executable (`chmod +x scripts/*.sh`)
- [x] JSON validation passes (dry-run script)
- [x] Documentation updated
- [x] Workflow file updated to use new script
- [x] jq installation step added to workflow

## GitHub Secrets Verification

Ensure these secrets are set in your repository:

- [ ] `GH_TOKEN` - GitHub personal access token
- [ ] `NOTION_API_KEY` - Notion integration token (starts with `secret_` or `ntn_`)
- [ ] `NOTION_DATABASE_ID` - Notion database ID (32 characters)

To check: Go to Settings → Secrets and variables → Actions

## Deployment Steps

1. [ ] Commit all changes to git
   ```bash
   git add .
   git commit -m "Fix Notion integration with proper JSON escaping"
   git push
   ```

2. [ ] Navigate to Actions tab in GitHub
3. [ ] Select "Weekly Release Notes to Notion" workflow
4. [ ] Click "Run workflow" button
5. [ ] (Optional) Enter custom date range for testing
6. [ ] Click green "Run workflow" button

## Monitoring the Workflow

1. [ ] Watch the workflow run in real-time
2. [ ] Check each step completes successfully:
   - [ ] Checkout repository
   - [ ] Setup Node.js
   - [ ] Install dependencies
   - [ ] Build TypeScript
   - [ ] **Install jq for JSON processing** ← NEW STEP
   - [ ] Compute date range
   - [ ] Generate release notes
   - [ ] **Post to Notion** ← FIXED STEP
   - [ ] Upload release notes artifact

3. [ ] Verify the "Post to Notion" step shows:
   ```
   HTTP Status: 200
   ✅ Successfully posted release notes to Notion
   ```

## Verification in Notion

1. [ ] Open your Notion database
2. [ ] Check for new entries (one per repository in matrix):
   - [ ] admin-dashboard
   - [ ] express-captain
   - [ ] agent
   - [ ] chrome-extension

3. [ ] Verify each entry has:
   - [ ] Correct Title (Release Notes - Week XX, YYYY)
   - [ ] Correct Date Range
   - [ ] Correct Week Number
   - [ ] Status = "Published"
   - [ ] Heading block
   - [ ] Repository paragraph
   - [ ] Divider

## Troubleshooting

### If workflow fails at "Install jq" step
```bash
# jq might already be installed, or apt-get needs update
# Check the error message - it should still work
```

### If workflow fails at "Post to Notion" step

1. Check the error message in logs
2. Common issues:
   - **401 Unauthorized**: `NOTION_API_KEY` is incorrect or expired
   - **404 Not Found**: `NOTION_DATABASE_ID` is incorrect or integration not connected
   - **400 Bad Request**: Database properties don't match expected schema
   - **Invalid JSON**: Should not happen with jq, but check logs

3. Debug locally:
   ```bash
   DEBUG=true npm run test:notion
   ```

### If entries not appearing in Notion

1. Check the workflow logs - look for HTTP 200 response
2. Verify the integration has access to the database
3. Check database filters (Status = Published should be visible)

## Scheduled Run Verification

- [ ] Wait for Thursday at 10:00 UTC
- [ ] Check that workflow runs automatically
- [ ] Verify entries are created for all 4 repositories
- [ ] Confirm date range is Sunday to Thursday of current week

## Success Criteria

✅ All 4 repositories post successfully  
✅ HTTP 200 response from Notion API  
✅ Entries visible in Notion database with correct data  
✅ No "invalid_json" errors  
✅ Workflow completes in < 5 minutes  

## Rollback Plan

If the new workflow fails:

1. Revert to previous version:
   ```bash
   git revert HEAD
   git push
   ```

2. Re-run workflow to confirm rollback works

3. Debug locally and try again

## Notes

- The script now uses `jq` for JSON construction (guaranteed valid JSON)
- Debug mode is available but disabled by default in CI
- Each repository runs in parallel (matrix strategy)
- Artifacts are uploaded for 30 days retention
