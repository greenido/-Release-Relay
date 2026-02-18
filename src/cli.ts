#!/usr/bin/env node
/**
 * CLI entry point for the Release Notes Generator.
 */
import "dotenv/config";
import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createOctokit, fetchMergedPRs } from "./github.js";
import logger from "./logger.js";
import { generateReleaseNotes } from "./releaseNotes.js";
import { ExitCode } from "./types.js";
import type { CliOptions } from "./types.js";
import { publishToDiscord, publishToSlack } from "./publishers.js";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate CLI options. Throws on invalid input.
 */
function validateOptions(opts: CliOptions): void {
  if (!ISO_DATE_REGEX.test(opts.from)) {
    throw new ValidationError(`Invalid --from date format: "${opts.from}". Expected YYYY-MM-DD.`);
  }
  if (!ISO_DATE_REGEX.test(opts.to)) {
    throw new ValidationError(`Invalid --to date format: "${opts.to}". Expected YYYY-MM-DD.`);
  }

  const from = new Date(opts.from);
  const to = new Date(opts.to);

  if (Number.isNaN(from.getTime())) {
    throw new ValidationError(`Invalid --from date: "${opts.from}".`);
  }
  if (Number.isNaN(to.getTime())) {
    throw new ValidationError(`Invalid --to date: "${opts.to}".`);
  }
  if (from > to) {
    throw new ValidationError(`--from (${opts.from}) must be before --to (${opts.to}).`);
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class GitHubApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubApiError";
  }
}

/**
 * Parse comma-separated label strings into arrays.
 */
function parseLabels(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Generate default output filename in format: release-notes/repo_from-date_to-date.md
 */
function generateDefaultOutputFilename(repo: string, from: string, to: string): string {
  return `release-notes/${repo}_${from}_${to}.md`;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("release-notes")
    .description("Generate structured release notes from GitHub PRs")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .option("--output <file>", "Output file path (default: release-notes/repo_from_to.md)")
    .option("--github-token <token>", "GitHub personal access token")
    .option("--exclude-labels <labels>", "Comma-separated labels to exclude", parseLabels)
    .option("--include-labels <labels>", "Comma-separated labels to include", parseLabels)
    .option("--publish-slack", "Publish release notes to Slack")
    .option("--publish-discord", "Publish release notes to Discord")
    .option("--publish-notion", "Publish release notes to Notion");

  program.parse(process.argv);

  const rawOpts = program.opts();
  const opts: CliOptions = {
    owner: rawOpts.owner as string,
    repo: rawOpts.repo as string,
    from: rawOpts.from as string,
    to: rawOpts.to as string,
    output: rawOpts.output as string | undefined,
    githubToken: (rawOpts.githubToken as string | undefined) ?? process.env.GH_TOKEN,
    excludeLabels: rawOpts.excludeLabels as string[] | undefined,
    includeLabels: rawOpts.includeLabels as string[] | undefined,
    publishSlack: rawOpts.publishSlack as boolean | undefined,
    publishDiscord: rawOpts.publishDiscord as boolean | undefined,
    publishNotion: rawOpts.publishNotion as boolean | undefined,
  };

  // Validate
  try {
    validateOptions(opts);
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.error({ error: err.message }, "Validation failed");
      process.exit(ExitCode.VALIDATION_ERROR);
    }
    throw err;
  }

  if (!opts.githubToken) {
    logger.error("Missing GitHub token. Provide --github-token, set GH_TOKEN env var, or add it to a .env file.");
    process.exit(ExitCode.VALIDATION_ERROR);
  }

  logger.info(
    { owner: opts.owner, repo: opts.repo, from: opts.from, to: opts.to },
    "Generating release notes",
  );

  let prs;
  try {
    const octokit = createOctokit(opts.githubToken);
    prs = await fetchMergedPRs(
      octokit,
      opts.owner,
      opts.repo,
      opts.from,
      opts.to,
      opts.includeLabels,
      opts.excludeLabels,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, "GitHub API error");
    process.exit(ExitCode.GITHUB_API_ERROR);
  }

  const markdown = generateReleaseNotes(
    opts.owner,
    opts.repo,
    opts.from,
    opts.to,
    prs,
  );

  // Use provided output path or generate default filename
  const outputFile = opts.output ?? generateDefaultOutputFilename(opts.repo, opts.from, opts.to);
  const absoluteOutputFile = resolve(outputFile);
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, markdown, "utf-8");
  logger.info({ file: outputFile }, "Release notes written to file");

  // --- Publishing ---

  if (opts.publishNotion) {
    logger.info("Publishing to Notion...");
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDbId = process.env.NOTION_DATABASE_ID;

    if (!notionApiKey || !notionDbId) {
      logger.error("Missing NOTION_API_KEY or NOTION_DATABASE_ID in environment.");
    } else {
      try {
        const title = `Release Notes: ${opts.from} to ${opts.to}`;
        const dateRange = `${opts.from} to ${opts.to}`;
        const scriptPath = resolve(__dirname, "../scripts/post-to-notion.sh");
        
        // Execute the script
        // Usage: ./scripts/post-to-notion.sh <markdown-file> <title> <date-range> <repo-name>
        const { stdout, stderr } = await execAsync(`"${scriptPath}" "${absoluteOutputFile}" "${title}" "${dateRange}" "${opts.repo}"`, {
          env: { ...process.env, NOTION_API_KEY: notionApiKey, NOTION_DATABASE_ID: notionDbId },
        });
        
        if (stdout) logger.info({ notionOutput: stdout }, "Notion script output");
        if (stderr) logger.warn({ notionError: stderr }, "Notion script stderr");
        logger.info("Successfully invoked Notion script.");
      } catch (err) {
        logger.error({ err }, "Failed to publish to Notion");
      }
    }
  }

  if (opts.publishSlack) {
    logger.info("Publishing to Slack...");
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhook) {
      logger.error("Missing SLACK_WEBHOOK_URL in environment.");
    } else {
      try {
        await publishToSlack(markdown, slackWebhook);
      } catch (err) {
        logger.error({ err }, "Failed to publish to Slack");
      }
    }
  }

  if (opts.publishDiscord) {
    logger.info("Publishing to Discord...");
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (!discordWebhook) {
      logger.error("Missing DISCORD_WEBHOOK_URL in environment.");
    } else {
      try {
        await publishToDiscord(markdown, discordWebhook);
      } catch (err) {
        logger.error({ err }, "Failed to publish to Discord");
      }
    }
  }

  logger.info("Done");
}

main().catch((err: unknown) => {
  logger.error({ err }, "Unexpected error");
  process.exit(ExitCode.UNEXPECTED_ERROR);
});
