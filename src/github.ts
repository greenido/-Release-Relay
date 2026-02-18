/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file github.ts
 * @description GitHub API integration module. Handles fetching merged PRs, handling pagination, rate limits, and extracting issue details.
 * ---------------------------------------------------------------------------------------------
 */

import { Octokit } from "@octokit/rest";
import logger from "./logger.js";
import type { LinkedIssue, PullRequestData } from "./types.js";

const PER_PAGE = 100;

/**
 * Create an authenticated Octokit instance.
 * @param token GitHub personal access token.
 * @returns Octokit instance.
 */
export function createOctokit(token?: string): Octokit {
  return new Octokit({ auth: token });
}

/**
 * Fetch all merged PRs for `owner/repo` whose `merged_at` falls within [from, to].
 *
 * Strategy:
 *  1. Paginate through closed PRs sorted by updated (descending).
 *  2. Filter for `merged_at` in the requested window.
 *  3. Stop early once we pass the window (PRs sorted by update time).
 * 
 * @param octokit Octokit instance.
 * @param owner Repository owner.
 * @param repo Repository name.
 * @param from Start date (YYYY-MM-DD).
 * @param to End date (YYYY-MM-DD).
 * @param includeLabels Optional list of labels to include.
 * @param excludeLabels Optional list of labels to exclude.
 * @returns Promise resolving to an array of PullRequestData.
 */
export async function fetchMergedPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  from: string,
  to: string,
  includeLabels?: string[],
  excludeLabels?: string[],
): Promise<PullRequestData[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  logger.info(
    { owner, repo, from, to },
    "Fetching merged PRs from GitHub API",
  );

  const merged: PullRequestData[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    logger.debug({ page }, "Fetching PR page");

    const { data: pulls } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: PER_PAGE,
      page,
    });

    if (pulls.length === 0) {
      hasMore = false;
      break;
    }

    for (const pr of pulls) {
      if (!pr.merged_at) continue;

      const mergedAt = new Date(pr.merged_at);

      if (mergedAt > toDate) continue;

      // Because we sort by *updated* (not merged), a PR may have been
      // updated recently but merged long ago. We cannot safely stop early
      // so we continue paginating until an empty page.
      if (mergedAt < fromDate) continue;

      const labels = pr.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? "",
      );

      if (
        includeLabels &&
        includeLabels.length > 0 &&
        !labels.some((l) => includeLabels.includes(l))
      ) {
        continue;
      }

      if (
        excludeLabels &&
        excludeLabels.length > 0 &&
        labels.some((l) => excludeLabels.includes(l))
      ) {
        continue;
      }

      // Fetch detailed PR data for additions / deletions / changed_files
      const detail = await fetchPRDetail(octokit, owner, repo, pr.number);

      // Extract and fetch linked issue from PR title
      const issueNumber = extractIssueNumber(pr.title);
      let linkedIssue: LinkedIssue | null = null;
      if (issueNumber) {
        linkedIssue = await fetchIssueDetails(octokit, owner, repo, issueNumber);
      }

      merged.push({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? "unknown",
        labels,
        mergedAt: pr.merged_at,
        additions: detail.additions,
        deletions: detail.deletions,
        changedFiles: detail.changedFiles,
        milestone: pr.milestone?.title ?? null,
        body: pr.body ?? null,
        htmlUrl: pr.html_url,
        linkedIssue,
      });

      logger.debug(
        { pr: pr.number, title: pr.title },
        "Collected merged PR",
      );
    }

    // Stop paginating if we received fewer than a full page – no more data.
    if (pulls.length < PER_PAGE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  logger.info({ count: merged.length }, "Finished fetching merged PRs");
  return merged;
}

/**
 * Fetch detailed PR metadata (additions, deletions, changed files).
 * @param octokit Octokit instance.
 * @param owner Repository owner.
 * @param repo Repository name.
 * @param pullNumber PR number.
 * @returns Object containing stats.
 */
async function fetchPRDetail(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ additions: number; deletions: number; changedFiles: number }> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
  };
}

/**
 * Extract issue number from PR title.
 * Supports patterns like:
 *   - "fix(634): eula in installers" (conventional commit with issue in parens)
 *   - "feat(#123): add feature" (conventional commit with # prefix in parens)
 *   - "3156 - Feature description" (number with dash separator)
 *   - "3156: Feature description" (number with colon separator)
 *   - "#2964 Improve global error handling" (number with # prefix)
 *   - "3178 edr virus scan event type handle" (number followed by space and text)
 * @param title PR title string.
 * @returns Issue number or null if not found.
 */
export function extractIssueNumber(title: string): number | null {
  // Pattern 1: Conventional commit with issue number in parentheses (e.g., "fix(634): description")
  const conventionalMatch = title.match(/^[a-z]+\(#?(\d+)\):/);
  if (conventionalMatch) {
    return parseInt(conventionalMatch[1], 10);
  }

  // Pattern 2: Issue number with # prefix at the start (e.g., "#2964 Description")
  const hashMatch = title.match(/^#(\d+)\s+/);
  if (hashMatch) {
    return parseInt(hashMatch[1], 10);
  }

  // Pattern 3: Issue number at start followed by separator (- or :)
  const separatorMatch = title.match(/^(\d+)\s*[-:]\s*/);
  if (separatorMatch) {
    return parseInt(separatorMatch[1], 10);
  }

  // Pattern 4: Issue number at start followed by space and text (no separator)
  // Must have at least one letter after the space to avoid matching version numbers etc.
  const spaceMatch = title.match(/^(\d+)\s+[a-zA-Z]/);
  if (spaceMatch) {
    return parseInt(spaceMatch[1], 10);
  }

  return null;
}

/**
 * Infer issue type from labels.
 * Common patterns: bug, feature, enhancement, documentation, etc.
 * @param labels Array of label strings.
 * @returns Infers type as string (e.g., "Bug", "Feature", "Other").
 */
function inferIssueType(labels: string[]): string {
  const lowerLabels = labels.map((l) => l.toLowerCase());
  
  if (lowerLabels.some((l) => l.includes("bug") || l.includes("fix"))) {
    return "Bug";
  }
  if (lowerLabels.some((l) => l.includes("feature") || l.includes("enhancement"))) {
    return "Feature";
  }
  if (lowerLabels.some((l) => l.includes("documentation") || l.includes("docs"))) {
    return "Documentation";
  }
  if (lowerLabels.some((l) => l.includes("security"))) {
    return "Security";
  }
  if (lowerLabels.some((l) => l.includes("refactor") || l.includes("maintenance") || l.includes("chore"))) {
    return "Maintenance";
  }
  if (lowerLabels.some((l) => l.includes("improvement"))) {
    return "Improvement";
  }
  
  return "Other";
}

/**
 * Fetch issue details from GitHub.
 * Returns null if issue doesn't exist or can't be fetched.
 * @param octokit Octokit instance.
 * @param owner Repository owner.
 * @param repo Repository name.
 * @param issueNumber Issue number.
 * @returns LinkedIssue object or null.
 */
async function fetchIssueDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<LinkedIssue | null> {
  try {
    const { data } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const labels = data.labels.map((l) =>
      typeof l === "string" ? l : l.name ?? "",
    ).filter((l) => l.length > 0);

    return {
      number: data.number,
      title: data.title,
      url: data.html_url,
      labels,
      type: inferIssueType(labels),
    };
  } catch (error) {
    logger.debug(
      { issueNumber, error },
      "Could not fetch issue details (may not exist)",
    );
    return null;
  }
}
