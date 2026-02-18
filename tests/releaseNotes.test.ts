import { describe, it, expect } from "vitest";
import { generateReleaseNotes } from "../src/releaseNotes.js";
import type { PullRequestData } from "../src/types.js";

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
    linkedIssue: null,
    ...overrides,
  };
}

describe("generateReleaseNotes", () => {
  it("generates correct markdown structure", () => {
    const prs: PullRequestData[] = [
      makePR({
        number: 10,
        title: "Add SSO support",
        author: "alice",
        labels: ["feature", "auth"],
        additions: 345,
        deletions: 89,
        changedFiles: 12,
        htmlUrl: "https://github.com/owner/repo/pull/10",
      }),
      makePR({
        number: 11,
        title: "Fix login crash",
        author: "bob",
        labels: ["bug"],
        additions: 20,
        deletions: 5,
        changedFiles: 2,
        htmlUrl: "https://github.com/owner/repo/pull/11",
      }),
    ];

    const md = generateReleaseNotes("owner", "repo", "2026-01-01", "2026-01-31", prs);

    // Header
    expect(md).toContain("# Release Notes");
    expect(md).toContain("**Repository:** owner/repo");
    expect(md).toContain("**Period:** 2026-01-01 → 2026-01-31");
    expect(md).toContain("**Generated:**");

    // Executive Summary
    expect(md).toContain("## Executive Summary");
    expect(md).toContain("**2** merged pull requests");
    expect(md).toContain("**2** contributors");

    // Categories
    expect(md).toContain("### 🚀 Features");
    expect(md).toContain("**[PR #10](https://github.com/owner/repo/pull/10)** – Add SSO support");
    expect(md).toContain("Author: @alice");
    expect(md).toContain("Labels: feature, auth");

    expect(md).toContain("### 🐛 Bug Fixes");
    expect(md).toContain("**[PR #11](https://github.com/owner/repo/pull/11)** – Fix login crash");
    expect(md).toContain("Author: @bob");

    // Contributors
    expect(md).toContain("## Contributors");
    expect(md).toContain("@alice (1 PR)");
    expect(md).toContain("@bob (1 PR)");
  });

  it("generates report with empty PR list", () => {
    const md = generateReleaseNotes("owner", "repo", "2026-01-01", "2026-01-31", []);

    expect(md).toContain("# Release Notes");
    expect(md).toContain("## Executive Summary");
    expect(md).toContain("**0** merged pull requests");
    expect(md).toContain("_No changes in this period._");
    expect(md).toContain("_No contributors in this period._");
  });

  it("includes all PR detail fields", () => {
    const prs = [
      makePR({
        number: 42,
        changedFiles: 12,
        additions: 345,
        deletions: 89,
        htmlUrl: "https://github.com/owner/repo/pull/42",
      }),
    ];

    const md = generateReleaseNotes("owner", "repo", "2026-01-01", "2026-01-31", prs);

    expect(md).toContain("Files changed: 12 (+345 / -89)");
    expect(md).toContain("[PR #42](https://github.com/owner/repo/pull/42)");
    expect(md).toContain("Merged: 2026-01-15");
  });
});
