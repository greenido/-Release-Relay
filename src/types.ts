/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file types.ts
 * @description TypeScript type definitions and interfaces used throughout the application.
 * ---------------------------------------------------------------------------------------------
 */

/** CLI options parsed from command-line arguments. */
export interface CliOptions {
  owner: string;
  repo: string;
  from: string;
  to: string;
  output?: string;
  githubToken?: string;
  excludeLabels?: string[];
  includeLabels?: string[];
  publishSlack?: boolean;
  publishDiscord?: boolean;
  publishNotion?: boolean;
  slackWebhook?: string;
  discordWebhook?: string;
}

/** Linked issue information extracted from PR title. */
export interface LinkedIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  type: string;
}

/** Metadata for a single merged Pull Request. */
export interface PullRequestData {
  number: number;
  title: string;
  author: string;
  labels: string[];
  mergedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  milestone: string | null;
  body: string | null;
  htmlUrl: string;
  linkedIssue: LinkedIssue | null;
}

/** Categorised buckets of pull requests. */
export interface CategorizedPRs {
  features: PullRequestData[];
  bugFixes: PullRequestData[];
  security: PullRequestData[];
  refactoring: PullRequestData[];
  other: PullRequestData[];
}

/** Contributor entry used in the report. */
export interface ContributorEntry {
  username: string;
  count: number;
}

/** Aggregated statistics for the executive summary. */
export interface SummaryStats {
  totalPRs: number;
  totalContributors: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  featureCount: number;
  bugFixCount: number;
  refactorCount: number;
  securityCount: number;
  otherCount: number;
}

/** Exit codes used by the CLI. */
export const ExitCode = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  GITHUB_API_ERROR: 2,
  UNEXPECTED_ERROR: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
