/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file summary.ts
 * @description Utilities for computing statistics and generating summaries for the release notes.
 * ---------------------------------------------------------------------------------------------
 */

import type {
  CategorizedPRs,
  ContributorEntry,
  PullRequestData,
  SummaryStats,
} from "./types.js";

/**
 * Gather aggregate statistics used by the executive summary.
 * Calculates total PRs, contributors, additions, deletions, files changed, and counts per category.
 * @param prs List of merged PRs.
 * @param categorized Categorized PRs object.
 * @returns Summary statistics object.
 */
export function computeSummary(
  prs: PullRequestData[],
  categorized: CategorizedPRs,
): SummaryStats {
  const authors = new Set(prs.map((pr) => pr.author));

  return {
    totalPRs: prs.length,
    totalContributors: authors.size,
    totalAdditions: prs.reduce((sum, pr) => sum + pr.additions, 0),
    totalDeletions: prs.reduce((sum, pr) => sum + pr.deletions, 0),
    totalFilesChanged: prs.reduce((sum, pr) => sum + pr.changedFiles, 0),
    featureCount: categorized.features.length,
    bugFixCount: categorized.bugFixes.length,
    refactorCount: categorized.refactoring.length,
    securityCount: categorized.security.length,
    otherCount: categorized.other.length,
  };
}

/**
 * Build contributor leaderboard sorted by PR count (descending).
 * @param prs List of merged PRs.
 * @returns Array of contributor entries.
 */
export function buildContributorList(
  prs: PullRequestData[],
): ContributorEntry[] {
  const counts = new Map<string, number>();

  for (const pr of prs) {
    counts.set(pr.author, (counts.get(pr.author) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([username, count]) => ({ username, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Format a number with thousands separator.
 * @param n Number to format.
 * @returns Formatted string (e.g., "1,234").
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Produce the textual executive summary paragraph.
 * Generates a human-readable summary of the release statistics.
 * @param stats Summary statistics object.
 * @returns Markdown formatted summary text.
 */
export function renderSummaryText(stats: SummaryStats): string {
  const lines: string[] = [];

  lines.push(
    `This release includes **${stats.totalPRs}** merged pull request${stats.totalPRs !== 1 ? "s" : ""} ` +
      `from **${stats.totalContributors}** contributor${stats.totalContributors !== 1 ? "s" : ""}.`,
  );

  const focusAreas: string[] = [];
  if (stats.featureCount > 0) focusAreas.push(`new features (${stats.featureCount})`);
  if (stats.bugFixCount > 0) focusAreas.push(`bug fixes (${stats.bugFixCount})`);
  if (stats.refactorCount > 0) focusAreas.push(`infrastructure / refactoring (${stats.refactorCount})`);
  if (stats.securityCount > 0) focusAreas.push(`security improvements (${stats.securityCount})`);
  if (stats.otherCount > 0) focusAreas.push(`other changes (${stats.otherCount})`);

  if (focusAreas.length > 0) {
    lines.push(`Major focus areas: ${focusAreas.join(", ")}.`);
  }

  lines.push(
    `Total code delta: **+${formatNumber(stats.totalAdditions)}** / **-${formatNumber(stats.totalDeletions)}** ` +
      `lines across **${formatNumber(stats.totalFilesChanged)}** files.`,
  );

  return lines.join("  \n");
}
