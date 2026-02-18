/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file categorizer.ts
 * @description Categorizes Pull Requests into semantic buckets (Features, Bug Fixes, Security, etc.) based on labels and title keywords.
 * ---------------------------------------------------------------------------------------------
 */

import type { CategorizedPRs, PullRequestData } from "./types.js";

const FEATURE_LABELS = ["feature", "enhancement"];
const BUG_LABELS = ["bug", "fix", "bugfix", "hotfix"];
const SECURITY_LABELS = ["security", "vulnerability", "cve"];
const REFACTOR_LABELS = ["refactor", "chore", "maintenance", "infra", "ci", "docs"];

const FEATURE_KEYWORDS = ["feat", "feature", "add", "new"];
const BUG_KEYWORDS = ["fix", "bug", "patch", "hotfix"];
const SECURITY_KEYWORDS = ["security", "cve", "vulnerability"];
const REFACTOR_KEYWORDS = ["refactor", "chore", "cleanup", "clean up", "infra", "ci", "docs"];

/**
 * Convert all labels to lowercase for case-insensitive matching.
 * @param labels Array of label strings.
 * @returns Array of lowercase label strings.
 */
function lowered(labels: string[]): string[] {
  return labels.map((l) => l.toLowerCase());
}

/**
 * Check if any value in the values array exists in the targets array.
 * @param values Array of strings to check.
 * @param targets Array of target strings to match against.
 * @returns True if at least one match is found.
 */
function matchesAny(values: string[], targets: string[]): boolean {
  return values.some((v) => targets.includes(v));
}

/**
 * Check if the title contains any of the keywords.
 * @param title The PR title.
 * @param keywords Array of keywords to search for.
 * @returns True if any keyword is found in the title (case-insensitive).
 */
function titleContains(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Determine the category for a single PR.
 * Priority: Features > Bug Fixes > Security > Refactoring.
 * Matches labels first, then falls back to title keywords.
 * @param pr The Pull Request data.
 * @returns The category key.
 */
export function categorizePR(
  pr: PullRequestData,
): keyof CategorizedPRs {
  const labels = lowered(pr.labels);

  if (matchesAny(labels, FEATURE_LABELS)) return "features";
  if (matchesAny(labels, BUG_LABELS)) return "bugFixes";
  if (matchesAny(labels, SECURITY_LABELS)) return "security";
  if (matchesAny(labels, REFACTOR_LABELS)) return "refactoring";

  // Fallback: title keyword detection (security before bug to avoid
  // "patch" in security titles triggering the bug-fix bucket)
  if (titleContains(pr.title, SECURITY_KEYWORDS)) return "security";
  if (titleContains(pr.title, FEATURE_KEYWORDS)) return "features";
  if (titleContains(pr.title, BUG_KEYWORDS)) return "bugFixes";
  if (titleContains(pr.title, REFACTOR_KEYWORDS)) return "refactoring";

  return "other";
}

/**
 * Categorise an array of PRs into buckets.
 * @param prs Array of Pull Request data.
 * @returns Object containing arrays of PRs for each category.
 */
export function categorizePRs(prs: PullRequestData[]): CategorizedPRs {
  const result: CategorizedPRs = {
    features: [],
    bugFixes: [],
    security: [],
    refactoring: [],
    other: [],
  };

  for (const pr of prs) {
    const category = categorizePR(pr);
    result[category].push(pr);
  }

  return result;
}
