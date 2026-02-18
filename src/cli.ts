#!/usr/bin/env node
/**
 * CLI entry point for the Release Notes Generator.
 */
import "dotenv/config";
import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createOctokit, fetchMergedPRs } from "./github.js";
import logger from "./logger.js";
import { generateReleaseNotes } from "./releaseNotes.js";
import { ExitCode } from "./types.js";
import type { CliOptions } from "./types.js";

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
    .option("--include-labels <labels>", "Comma-separated labels to include", parseLabels);

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
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, markdown, "utf-8");
  logger.info({ file: outputFile }, "Release notes written to file");

  logger.info("Done");
}

main().catch((err: unknown) => {
  logger.error({ err }, "Unexpected error");
  process.exit(ExitCode.UNEXPECTED_ERROR);
});
