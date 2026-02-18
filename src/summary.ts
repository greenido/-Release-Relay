/**
 * Compute the Executive Summary statistics from categorised PRs.
 */
import type {
  CategorizedPRs,
  ContributorEntry,
  PullRequestData,
  SummaryStats,
} from "./types.js";

/**
 * Gather aggregate statistics used by the executive summary.
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
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Produce the textual executive summary paragraph.
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
