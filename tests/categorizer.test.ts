/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file categorizer.test.ts
 * @description Unit tests for the categorizer module. Verifies label and keyword matching logic.
 * ---------------------------------------------------------------------------------------------
 */

import { describe, it, expect } from "vitest";
import { categorizePR, categorizePRs } from "../src/categorizer.js";
import type { PullRequestData } from "../src/types.js";

function makePR(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
    number: 1,
    title: "Some change",
    author: "dev",
    labels: [],
    mergedAt: "2026-01-15T12:00:00Z",
    additions: 10,
    deletions: 5,
    changedFiles: 2,
    milestone: null,
    body: null,
    htmlUrl: "https://github.com/owner/repo/pull/1",
    linkedIssue: null,
    ...overrides,
  };
}

describe("categorizePR", () => {
  it("categorizes by 'feature' label", () => {
    const pr = makePR({ labels: ["feature"] });
    expect(categorizePR(pr)).toBe("features");
  });

  it("categorizes by 'enhancement' label", () => {
    const pr = makePR({ labels: ["enhancement"] });
    expect(categorizePR(pr)).toBe("features");
  });

  it("categorizes by 'bug' label", () => {
    const pr = makePR({ labels: ["bug"] });
    expect(categorizePR(pr)).toBe("bugFixes");
  });

  it("categorizes by 'fix' label", () => {
    const pr = makePR({ labels: ["fix"] });
    expect(categorizePR(pr)).toBe("bugFixes");
  });

  it("categorizes by 'security' label", () => {
    const pr = makePR({ labels: ["security"] });
    expect(categorizePR(pr)).toBe("security");
  });

  it("categorizes by 'refactor' label", () => {
    const pr = makePR({ labels: ["refactor"] });
    expect(categorizePR(pr)).toBe("refactoring");
  });

  it("categorizes by 'chore' label", () => {
    const pr = makePR({ labels: ["chore"] });
    expect(categorizePR(pr)).toBe("refactoring");
  });

  it("falls back to title keyword 'feat'", () => {
    const pr = makePR({ title: "feat: add login page" });
    expect(categorizePR(pr)).toBe("features");
  });

  it("falls back to title keyword 'fix'", () => {
    const pr = makePR({ title: "fix: resolve crash on startup" });
    expect(categorizePR(pr)).toBe("bugFixes");
  });

  it("falls back to title keyword 'security'", () => {
    const pr = makePR({ title: "security: patch XSS vulnerability" });
    expect(categorizePR(pr)).toBe("security");
  });

  it("falls back to title keyword 'refactor'", () => {
    const pr = makePR({ title: "refactor auth module" });
    expect(categorizePR(pr)).toBe("refactoring");
  });

  it("returns 'other' when nothing matches", () => {
    const pr = makePR({ title: "Update README" });
    expect(categorizePR(pr)).toBe("other");
  });

  it("label takes precedence over title keyword", () => {
    const pr = makePR({ title: "fix: something", labels: ["feature"] });
    expect(categorizePR(pr)).toBe("features");
  });

  it("is case-insensitive on labels", () => {
    const pr = makePR({ labels: ["Feature"] });
    expect(categorizePR(pr)).toBe("features");
  });
});

describe("categorizePRs", () => {
  it("distributes PRs into correct buckets", () => {
    const prs = [
      makePR({ number: 1, labels: ["feature"] }),
      makePR({ number: 2, labels: ["bug"] }),
      makePR({ number: 3, labels: ["security"] }),
      makePR({ number: 4, labels: ["chore"] }),
      makePR({ number: 5, title: "misc update" }),
    ];

    const result = categorizePRs(prs);

    expect(result.features).toHaveLength(1);
    expect(result.bugFixes).toHaveLength(1);
    expect(result.security).toHaveLength(1);
    expect(result.refactoring).toHaveLength(1);
    expect(result.other).toHaveLength(1);
  });

  it("handles empty PR list", () => {
    const result = categorizePRs([]);
    expect(result.features).toHaveLength(0);
    expect(result.bugFixes).toHaveLength(0);
    expect(result.security).toHaveLength(0);
    expect(result.refactoring).toHaveLength(0);
    expect(result.other).toHaveLength(0);
  });
});
