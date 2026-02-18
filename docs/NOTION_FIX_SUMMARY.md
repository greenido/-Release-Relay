# Notion Integration Fix - Summary

## Problem

The GitHub Actions workflow was failing when posting to Notion with error:
```
{"object":"error","status":400,"code":"invalid_json","message":"Error parsing JSON body."}
```

### Root Cause

The workflow was constructing JSON using bash heredoc with inline shell command substitution (`$(date -u +%V)`) and GitHub Actions variable interpolation. This caused:

1. **JSON parsing errors** due to improper escaping of special characters
2. **Unpredictable variable expansion** inside the JSON structure
3. **No proper validation** of the JSON payload before sending to Notion API

## Solution

### 1. Created Dedicated Scripts

**`scripts/post-to-notion.sh`**
- Uses `jq` (JSON processor) for proper JSON construction
- Ensures all variables are properly escaped
- Provides clear error handling with HTTP status codes
- Supports debug mode with `DEBUG=true`

**`scripts/test-notion.sh`**
- Local testing script to validate Notion integration
- Creates test markdown file and posts to Notion
- Verifies API response before deploying to GitHub Actions

**`scripts/dry-run-notion.sh`**
- Validates JSON payload structure without posting
- Useful for debugging and payload inspection
- Shows payload size and structure

### 2. Updated GitHub Workflow

**`.github/workflows/weekly-notion-release-notes.yml`**
- Added step to install `jq` in the GitHub Actions environment
- Replaced inline curl with heredoc → call to `post-to-notion.sh` script
- Proper error handling and cleaner logs

### 3. Updated Documentation

**`README.md`**
- Added testing section for local Notion integration testing
- Added troubleshooting guide with common errors
- Documented the technical implementation

**`package.json`**
- Added `test:notion` npm script for easy testing

## How to Use

### Local Testing

1. Set up `.env` file:
   ```bash
   NOTION_API_KEY=your_integration_token
   NOTION_DATABASE_ID=your_database_id
   ```

2. Run the test:
   ```bash
   npm run test:notion
   ```

3. Verify in Notion database (delete test entry after verification)

### Dry Run (No API Call)

```bash
./scripts/dry-run-notion.sh
```

This validates the JSON structure without posting.

### Debug Mode

Enable detailed logging:
```bash
DEBUG=true npm run test:notion
```

Or in GitHub Actions, add to the workflow:
```yaml
env:
  DEBUG: true
  NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
  NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
```

## Key Improvements

✅ **Proper JSON escaping** using `jq`  
✅ **Local testing capability** before deploying to GitHub Actions  
✅ **Better error messages** with HTTP status codes  
✅ **Validation tools** (dry-run script)  
✅ **Debug mode** for troubleshooting  
✅ **Comprehensive documentation**  

## Files Changed

- `.github/workflows/weekly-notion-release-notes.yml` - Updated to use script
- `scripts/post-to-notion.sh` - New script for posting to Notion
- `scripts/test-notion.sh` - New test script
- `scripts/dry-run-notion.sh` - New validation script
- `README.md` - Added testing documentation
- `package.json` - Added test:notion script

## Testing Checklist

- [x] Local test script works (`npm run test:notion`)
- [x] Dry-run validation works
- [x] JSON payload is properly formatted
- [x] HTTP 200 response from Notion API
- [ ] GitHub Actions workflow test (requires push to repository)

## Next Steps

1. Commit and push changes to repository
2. Test GitHub Actions workflow manually via "Run workflow" button
3. Verify entries appear in Notion database
4. Monitor scheduled runs on Thursdays at 10:00 UTC
