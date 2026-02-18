/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file releaseNotes.ts
 * @description Core logic for generating the Markdown release notes document, including sections for executive summary, changes by category, and contributors.
 * ---------------------------------------------------------------------------------------------
 */

import { categorizePRs } from "./categorizer.js";
import {
  buildContributorList,
  computeSummary,
  renderSummaryText,
} from "./summary.js";
import type { CategorizedPRs, ContributorEntry, PullRequestData } from "./types.js";

/**
 * Render a single PR entry in Markdown.
 * Includes PR number, link, title, author, merge date, and optional linked issue info.
 * @param pr The Pull Request data.
 * @returns Markdown string for the PR.
 */
function renderPREntry(pr: PullRequestData): string {
  const mergedDate = pr.mergedAt.slice(0, 10);

  const lines = [
    `- **[PR #${pr.number}](${pr.htmlUrl})** – ${pr.title}`,
    `  - Author: @${pr.author}`,
    `  - Merged: ${mergedDate}`,
  ];

  // Add linked issue info with nested labels and type
  if (pr.linkedIssue) {
    lines.push(`  - Issue: [#${pr.linkedIssue.number}](${pr.linkedIssue.url}) – ${pr.linkedIssue.title}`);
    const issueLabelsStr = pr.linkedIssue.labels.length > 0 
      ? pr.linkedIssue.labels.join(", ") 
      : "none";
    lines.push(`    - Labels: ${issueLabelsStr}`);
    lines.push(`    - Type: ${pr.linkedIssue.type}`);
  } else {
    lines.push(`  - Issue: _No linked issue_`);
  }

  lines.push(
    `  - Files changed: ${pr.changedFiles} (+${pr.additions} / -${pr.deletions})`,
  );

  // Only add PR Labels if there are any
  if (pr.labels.length > 0) {
    lines.push(`  - Labels: ${pr.labels.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Render a category section. Returns empty string if there are no PRs.
 * @param heading Section heading (e.g., "🚀 Features").
 * @param prs Array of PRs in this category.
 * @returns Markdown string or empty string.
 */
function renderCategorySection(
  heading: string,
  prs: PullRequestData[],
): string {
  if (prs.length === 0) return "";
  const entries = prs.map(renderPREntry).join("\n\n");
  return `### ${heading}\n\n${entries}`;
}

/**
 * Render the Contributors section.
 * @param contributors Array of contributor entries.
 * @returns Markdown string.
 */
function renderContributors(contributors: ContributorEntry[]): string {
  if (contributors.length === 0) return "_No contributors in this period._";
  return contributors
    .map((c) => `- @${c.username} (${c.count} PR${c.count !== 1 ? "s" : ""})`)
    .join("\n");
}

/**
 * Generate the complete Markdown release notes.
 * Combines header, executive summary, categorized changes, and contributor list.
 * @param owner Repository owner.
 * @param repo Repository name.
 * @param from Start date.
 * @param to End date.
 * @param prs List of merged PRs.
 * @returns Full Markdown document string.
 */
export function generateReleaseNotes(
  owner: string,
  repo: string,
  from: string,
  to: string,
  prs: PullRequestData[],
): string {
  const categorized: CategorizedPRs = categorizePRs(prs);
  const stats = computeSummary(prs, categorized);
  const summaryText = renderSummaryText(stats);
  const contributors = buildContributorList(prs);
  const generatedAt = new Date().toISOString();

  const sections: string[] = [];

  // Header
  sections.push(
    [
      "# Release Notes",
      "",
      `**Repository:** ${owner}/${repo}  `,
      `**Period:** ${from} → ${to}  `,
      `**Generated:** ${generatedAt}`,
    ].join("\n"),
  );

  // Executive Summary
  sections.push(
    ["## Executive Summary", "", summaryText].join("\n"),
  );

  // Changes by Category
  const categoryLines: string[] = ["## Changes by Category"];

  const featureSection = renderCategorySection("🚀 Features", categorized.features);
  const bugSection = renderCategorySection("🐛 Bug Fixes", categorized.bugFixes);
  const securitySection = renderCategorySection("🔐 Security", categorized.security);
  const refactorSection = renderCategorySection("🧹 Refactoring / Maintenance", categorized.refactoring);
  const otherSection = renderCategorySection("📦 Other Changes", categorized.other);

  const categorySections = [featureSection, bugSection, securitySection, refactorSection, otherSection]
    .filter((s) => s.length > 0);

  if (categorySections.length === 0) {
    categoryLines.push("", "_No changes in this period._");
  } else {
    categoryLines.push("", categorySections.join("\n\n"));
  }

  sections.push(categoryLines.join("\n"));

  // Contributors
  sections.push(
    ["## Contributors", "", renderContributors(contributors)].join("\n"),
  );

  return sections.join("\n\n---\n\n") + "\n";
}
