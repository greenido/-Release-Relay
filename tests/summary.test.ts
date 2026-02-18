/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file summary.test.ts
 * @description Unit tests for the summary module. Verifies statistics calculation and summary text generation.
 * ---------------------------------------------------------------------------------------------
 */

import { describe, it, expect } from "vitest";
import {
  computeSummary,
  buildContributorList,
  formatNumber,
  renderSummaryText,
} from "../src/summary.js";
import type { CategorizedPRs, PullRequestData } from "../src/types.js";

function makePR(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
    number: 1,
    title: "Some change",
    author: "dev",
    labels: [],
    mergedAt: "2026-01-15T12:00:00Z",
    additions: 100,
    deletions: 50,
    changedFiles: 5,
    milestone: null,
    body: null,
    htmlUrl: "https://github.com/owner/repo/pull/1",
    ...overrides,
  };
}

function makeCategories(overrides: Partial<CategorizedPRs> = {}): CategorizedPRs {
  return {
    features: [],
    bugFixes: [],
    security: [],
    refactoring: [],
    other: [],
    ...overrides,
  };
}

describe("computeSummary", () => {
  it("computes totals correctly", () => {
    const prs = [
      makePR({ author: "alice", additions: 200, deletions: 50, changedFiles: 10 }),
      makePR({ author: "bob", additions: 100, deletions: 30, changedFiles: 5 }),
      makePR({ author: "alice", additions: 50, deletions: 20, changedFiles: 3 }),
    ];

    const categorized = makeCategories({
      features: [prs[0]],
      bugFixes: [prs[1]],
      other: [prs[2]],
    });

    const stats = computeSummary(prs, categorized);

    expect(stats.totalPRs).toBe(3);
    expect(stats.totalContributors).toBe(2);
    expect(stats.totalAdditions).toBe(350);
    expect(stats.totalDeletions).toBe(100);
    expect(stats.totalFilesChanged).toBe(18);
    expect(stats.featureCount).toBe(1);
    expect(stats.bugFixCount).toBe(1);
    expect(stats.refactorCount).toBe(0);
    expect(stats.securityCount).toBe(0);
    expect(stats.otherCount).toBe(1);
  });

  it("handles empty PR list", () => {
    const stats = computeSummary([], makeCategories());
    expect(stats.totalPRs).toBe(0);
    expect(stats.totalContributors).toBe(0);
    expect(stats.totalAdditions).toBe(0);
  });
});

describe("buildContributorList", () => {
  it("counts and sorts contributors by PR count", () => {
    const prs = [
      makePR({ author: "alice" }),
      makePR({ author: "bob" }),
      makePR({ author: "alice" }),
      makePR({ author: "alice" }),
      makePR({ author: "bob" }),
      makePR({ author: "charlie" }),
    ];

    const list = buildContributorList(prs);

    expect(list).toEqual([
      { username: "alice", count: 3 },
      { username: "bob", count: 2 },
      { username: "charlie", count: 1 },
    ]);
  });

  it("returns empty array for no PRs", () => {
    expect(buildContributorList([])).toEqual([]);
  });
});

describe("formatNumber", () => {
  it("formats thousands", () => {
    expect(formatNumber(4231)).toBe("4,231");
  });

  it("does not format small numbers", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("renderSummaryText", () => {
  it("generates correct summary text", () => {
    const text = renderSummaryText({
      totalPRs: 24,
      totalContributors: 6,
      totalAdditions: 4231,
      totalDeletions: 1203,
      totalFilesChanged: 89,
      featureCount: 5,
      bugFixCount: 12,
      refactorCount: 4,
      securityCount: 0,
      otherCount: 3,
    });

    expect(text).toContain("**24** merged pull requests");
    expect(text).toContain("**6** contributors");
    expect(text).toContain("new features (5)");
    expect(text).toContain("bug fixes (12)");
    expect(text).toContain("infrastructure / refactoring (4)");
    expect(text).toContain("+4,231");
    expect(text).toContain("-1,203");
    expect(text).toContain("89");
    expect(text).not.toContain("security");
  });

  it("handles singular PR count", () => {
    const text = renderSummaryText({
      totalPRs: 1,
      totalContributors: 1,
      totalAdditions: 10,
      totalDeletions: 5,
      totalFilesChanged: 2,
      featureCount: 1,
      bugFixCount: 0,
      refactorCount: 0,
      securityCount: 0,
      otherCount: 0,
    });

    expect(text).toContain("**1** merged pull request ");
    expect(text).toContain("**1** contributor.");
  });
});
