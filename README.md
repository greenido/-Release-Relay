# Release Notes Generator 📝 + 📆 = ✅

A CLI tool that generates structured, executive-ready Markdown release notes from a GitHub repository for a specified date range. It can also be used as a GitHub Action to generate release notes and post them to Notion, Slack, and Discord.

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
- **Multi-channel Publishing:** Automatically publish release notes to:
  - **Notion** (as a new database page)
  - **Slack** (as a formatted message)
  - **Discord** (as a formatted message, handles splitting for length)

## Requirements

- Node.js 20+
- A GitHub personal access token (classic or fine-grained) with `repo` read access
- (Optional) Notion Integration Token and Database ID
- (Optional) Slack Webhook URL
- (Optional) Discord Webhook URL

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
  --output release-notes/release-notes.md \
  --publish-slack \
  --publish-discord \
  --publish-notion
```

### Example — YOUR_COMPANY_NAME Admin Dashboard

Generate release notes for [YOUR_ORG/admin-dashboard](https://github.com/YOUR_ORG/admin-dashboard/) over February 2026 and publish to all channels:

```bash
# Using the compiled CLI
node dist/cli.js \
  --owner YOUR_ORG \
  --repo admin-dashboard \
  --from 2026-02-01 \
  --to 2026-02-17 \
  --github-token $GH_TOKEN \
  --output release-notes/admin-dashboard-release-notes.md \
  --publish-slack \
  --publish-discord
```

Or during development (no build step required):

```bash
npm run dev -- \
  --owner YOUR_ORG \
  --repo admin-dashboard \
  --from 2026-02-01 \
  --to 2026-02-17 \
  --publish-slack
```

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
| `--publish-slack`  | No       | Publish generated notes to Slack                 |
| `--publish-discord`| No       | Publish generated notes to Discord               |
| `--publish-notion` | No       | Publish generated notes to Notion                |

### Environment Variables

Create a `.env` file based on `.env.example` to store these secrets.

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `GH_TOKEN`            | Fallback GitHub authentication                   |
| `LOG_LEVEL`           | Pino log level (default: `info`)                 |
| `NOTION_API_KEY`      | Notion Integration Token (starts with `secret_`) |
| `NOTION_DATABASE_ID`  | Notion Database ID                               |
| `SLACK_WEBHOOK_URL`   | Slack Incoming Webhook URL                       |
| `DISCORD_WEBHOOK_URL` | Discord Incoming Webhook URL                     |

### Development

```bash
# Run without building (via tsx)
npm run dev -- --owner octokit --repo rest.js --from 2026-01-01 --to 2026-01-31

# Run tests
npm test

# Type-check only
npm run lint
```

## Integrations Setup

### Slack

1. Go to [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks).
2. Create a new App or select an existing one.
3. Enable Incoming Webhooks and click "Add New Webhook to Workspace".
4. Select the channel to post to.
5. Copy the Webhook URL and add it to your `.env` file as `SLACK_WEBHOOK_URL`.

### Discord

1. Open your Discord server settings > Integrations > Webhooks.
2. Click "New Webhook".
3. Copy the Webhook URL and add it to your `.env` file as `DISCORD_WEBHOOK_URL`.

### Notion

1. Go to [Notion Integrations](https://www.notion.so/my-integrations) and create a new integration.
2. Share your target database with this integration connection.
3. Get the Database ID from the URL.
4. Add `NOTION_API_KEY` and `NOTION_DATABASE_ID` to your `.env` file.
5. Ensure your database has the following properties:
   - `Name` (Title)
   - `Date Range` (Text)
   - `Week` (Number)
   - `Status` (Select, with a "Published" option)

## GitHub Action

The repository includes workflows for scheduling these tasks. You can now use the main CLI within your actions to publish to multiple destinations by setting the appropriate environment secrets in your repository settings.

## Exit Codes

| Code | Meaning          |
| ---- | ---------------- |
| 0    | Success          |
| 1    | Validation error |
| 2    | GitHub API error |
| 3    | Unexpected error |

## License

MIT
