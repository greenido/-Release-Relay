/**
 * Categorise Pull Requests into semantic buckets.
 *
 * Priority order:
 *  1. Label-based matching
 *  2. Fallback to title keyword detection
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

function lowered(labels: string[]): string[] {
  return labels.map((l) => l.toLowerCase());
}

function matchesAny(values: string[], targets: string[]): boolean {
  return values.some((v) => targets.includes(v));
}

function titleContains(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Determine the category for a single PR.
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
