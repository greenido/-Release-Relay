# Release Notes Generator 📝 + 📆 = ✅

A CLI tool that generates structured, executive-ready Markdown release notes from a GitHub repository for a specified date range. It can also be used as a GitHub Action to generate release notes and post them to Notion/Slack/Discord.

## Features

- Extracts merged Pull Requests within a date range via the GitHub REST API
- Generates a structured Markdown release report with:
  - **Executive Summary** — PR count, contributors, code delta, focus areas
  - **Changes by Category** — Features, Bug Fixes, Security, Refactoring, Other
  - **Contributors** — Sorted leaderboard by PR count
- Automatic PR categorisation via labels with title-keyword fallback
- Handles pagination for large repositories (5,000+ PRs)
- Structured logging via **pino**
- Runs locally as a CLI **and** as a scheduled GitHub Action (every Thursday)

## Requirements

- Node.js 20+
- A GitHub personal access token (classic or fine-grained) with `repo` read access

## Installation

```bash
npm install
npm run build
```

## Usage

### CLI

```bash
node dist/cli.js \
  --owner <repo-owner> \
  --repo <repo-name> \
  --from 2026-01-01 \
  --to 2026-01-31 \
  --github-token <token> \
  --output release-notes/release-notes.md
```

### Example — YOUR_COMPANY_NAME Admin Dashboard

Generate release notes for [YOUR_ORG/admin-dashboard](https://github.com/YOUR_ORG/admin-dashboard/) over February 2026:

```bash
# Using the compiled CLI
node dist/cli.js \
  --owner YOUR_ORG \
  --repo admin-dashboard \
  --from 2026-02-01 \
  --to 2026-02-17 \
  --github-token $GH_TOKEN \
  --output release-notes/admin-dashboard-release-notes.md
```

Or during development (no build step required):

```bash
npm run dev -- \
  --owner YOUR_ORG \
  --repo admin-dashboard \
  --from 2026-02-01 \
  --to 2026-02-17
```

You can also filter by labels — for example, only include bug fixes and security PRs:

```bash
node dist/cli.js \
  --owner YOUR_ORG \
  --repo admin-dashboard \
  --from 2026-01-01 \
  --to 2026-02-17 \
  --github-token $GH_TOKEN \
  --include-labels "bug,security" \
  --output release-notes/admin-dashboard-bugs-security.md
```

> **Tip:** Export your token once so every command picks it up automatically:
> ```bash
> export GH_TOKEN=ghp_YourTokenHere
> ```

### Parameters

| Flag               | Required | Description                                      |
| ------------------ | -------- | ------------------------------------------------ |
| `--owner`          | Yes      | GitHub repository owner                          |
| `--repo`           | Yes      | GitHub repository name                           |
| `--from`           | Yes      | Start date (YYYY-MM-DD)                          |
| `--to`             | Yes      | End date (YYYY-MM-DD)                            |
| `--output`         | No       | Output file path (default: `release-notes/repo_from_to.md`) |
| `--github-token`   | No       | GitHub token (fallback: `GH_TOKEN` env var)  |
| `--include-labels` | No       | Comma-separated labels to include                |
| `--exclude-labels` | No       | Comma-separated labels to exclude                |

### Environment Variables

| Variable       | Description                       |
| -------------- | --------------------------------- |
| `GH_TOKEN` | Fallback GitHub authentication    |
| `LOG_LEVEL`    | Pino log level (default: `info`)  |

### Development

```bash
# Run without building (via tsx)
npm run dev -- --owner octokit --repo rest.js --from 2026-01-01 --to 2026-01-31

# Run tests
npm test

# Type-check only
npm run lint

# Test Notion integration (requires .env with NOTION_API_KEY and NOTION_DATABASE_ID)
npm run test:notion
```

### Testing Notion Integration Locally

Before deploying to GitHub Actions, you can test the Notion integration locally:

1. Create a `.env` file with your Notion credentials:
   ```bash
   NOTION_API_KEY=your_notion_integration_token
   NOTION_DATABASE_ID=your_database_id
   ```

2. Run the test script:
   ```bash
   npm run test:notion
   ```

3. This will:
   - Create a test markdown file
   - Post it to your Notion database
   - Verify the API response
   - Clean up the test file

4. Check your Notion database to verify the test entry was created (you can delete it manually)

## GitHub Action

The repository includes a workflow at `.github/workflows/release-notes.yml` that:

1. Runs every **Thursday at 09:00 UTC** (and supports manual dispatch)
2. Generates release notes for the previous 7 days
3. Commits the Markdown file to `release-notes/YYYY-MM-DD.md`

Add `GH_TOKEN` as a repository secret (Settings → Secrets and variables → Actions) with your GitHub Personal Access Token. GitHub does not allow secret names starting with `GITHUB_`, so use `GH_TOKEN`.

## Notion Integration

The repository also includes a workflow at `.github/workflows/weekly-notion-release-notes.yml` that automatically posts release notes to a Notion database every Thursday.

### How to Set Up Notion Integration

Follow these steps to configure your Notion workspace to receive automated release notes:

#### Step 1: Create a Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Fill in the details:
   - **Name:** e.g., "Release Notes Bot"
   - **Associated workspace:** Select your workspace
   - **Capabilities:** Enable "Read content", "Update content", and "Insert content"
4. Click **Submit**
5. Copy the **Internal Integration Token** (starts with `secret_...`) — you'll need this for `NOTION_API_KEY`

#### Step 2: Create a Notion Database

Create a new database in Notion with the following properties:

| Property Name | Property Type | Description |
| ------------- | ------------- | ----------- |
| `Name`        | Title         | The release notes title (auto-generated) |
| `Date Range`  | Text          | The date range covered (e.g., "2026-02-10 to 2026-02-14") |
| `Week`        | Number        | ISO week number |
| `Status`      | Select        | Add an option called "Published" |

> **Tip:** You can add additional properties like `Tags`, `Repository`, or `Created Date` for better organization.

#### Step 3: Connect the Integration to Your Database

1. Open your Notion database page
2. Click the **"..."** menu in the top-right corner
3. Scroll down and click **"+ Add connections"**
4. Search for and select your integration (e.g., "Release Notes Bot")
5. Click **Confirm**

#### Step 4: Get Your Database ID

1. Open your database in Notion (as a full page, not inline)
2. Look at the URL — it will look like:
   ```
   https://www.notion.so/yourworkspace/abc123def456...?v=...
   ```
3. The **Database ID** is the 32-character string after your workspace name and before the `?`
   - Example: `abc123def456789012345678901234567` (without dashes)
   - Or with dashes: `abc123de-f456-7890-1234-567890123456`

#### Step 5: Add Secrets to GitHub

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"** and add:

| Secret Name           | Value |
| --------------------- | ----- |
| `NOTION_API_KEY`      | Your Notion integration token (from Step 1) |
| `NOTION_DATABASE_ID`  | Your database ID (from Step 4) |

#### Step 6: Test the Workflow

1. Go to **Actions** → **"Weekly Release Notes to Notion"**
2. Click **"Run workflow"**
3. Optionally specify custom `from` and `to` dates
4. Click **"Run workflow"** to trigger manually
5. Check your Notion database — a new page should appear with the release notes!

### What Gets Posted to Notion

Each Notion page created by the workflow includes:

- **Page Properties:**
  - Title with repository name and date range
  - Date range as text
  - ISO week number
  - Status set to "Published"

- **Page Content:**
  - Header with date range and repository information
  - **Full markdown content** converted to Notion blocks including:
    - Headings (H1, H2, H3)
    - Bullet points and numbered lists
    - Paragraphs
    - Code blocks (if present in the markdown)

> **Note:** Notion has a limit of 100 blocks per page creation request. If your release notes exceed 97 blocks (accounting for 3 header blocks), the content will be automatically truncated with a warning in the workflow logs.

### Workflow Schedule

The Notion workflow runs automatically:
- **Every Thursday at 10:00 UTC**
- Covers the period from **Sunday to Thursday** of the current week

You can also trigger it manually via the GitHub Actions UI with custom date ranges.

### Troubleshooting

| Issue | Solution |
| ----- | -------- |
| "401 Unauthorized" | Check that `NOTION_API_KEY` is correct and the integration is still active |
| "404 Not Found" | Verify `NOTION_DATABASE_ID` is correct and the integration has access to the database |
| "400 Bad Request" or "invalid_json" | Ensure your database has all required properties (`Name`, `Date Range`, `Week`, `Status`) with correct types. Use `npm run test:notion` to test locally first. |
| No page created | Check the workflow logs in GitHub Actions for detailed error messages |
| Script permission denied | Run `chmod +x scripts/*.sh` to make scripts executable |

### Technical Implementation

The Notion integration uses:
- **`scripts/post-to-notion.sh`** — Main script that posts to Notion using `jq` for proper JSON escaping
- **`scripts/test-notion.sh`** — Test script to validate Notion integration locally
- **`jq`** — Command-line JSON processor (automatically installed in GitHub Actions)

The scripts ensure:
- ✅ Proper JSON escaping of special characters
- ✅ Correct handling of date ranges and metadata
- ✅ Error handling with clear HTTP status codes
- ✅ Debug mode for troubleshooting (set `DEBUG=true` environment variable)

## Exit Codes

| Code | Meaning          |
| ---- | ---------------- |
| 0    | Success          |
| 1    | Validation error |
| 2    | GitHub API error |
| 3    | Unexpected error |

## Project Structure

```
src/
  cli.ts            # CLI entry point & argument parsing
  github.ts         # GitHub REST API integration with pagination
  releaseNotes.ts   # Markdown report generator
  categorizer.ts    # PR categorisation (labels + title keywords)
  summary.ts        # Executive summary computation
  logger.ts         # Pino structured logging
  types.ts          # TypeScript type definitions
tests/
  categorizer.test.ts
  summary.test.ts
  releaseNotes.test.ts
  github.test.ts        # Integration test with nock
.github/
  workflows/
    release-notes.yml                  # Scheduled GitHub Action (commits to repo)
    weekly-notion-release-notes.yml    # Scheduled GitHub Action (posts to Notion)
```

## License

MIT
