/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file github.test.ts
 * @description Unit tests for the github module. Verifies PR fetching, filtering, and issue extraction.
 * ---------------------------------------------------------------------------------------------
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { createOctokit, fetchMergedPRs, extractIssueNumber } from "../src/github.js";

const OWNER = "test-owner";
const REPO = "test-repo";

function makePRListItem(
  number: number,
  mergedAt: string | null,
  title = `PR #${number}`,
  labels: Array<{ name: string }> = [],
) {
  return {
    number,
    title,
    user: { login: `user-${number}` },
    labels,
    merged_at: mergedAt,
    milestone: null,
    body: `Body of ${title}`,
    html_url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
  };
}

function makePRDetail(number: number, additions = 100, deletions = 50, changedFiles = 5) {
  return {
    number,
    additions,
    deletions,
    changed_files: changedFiles,
  };
}

describe("fetchMergedPRs", () => {
  let octokit: ReturnType<typeof createOctokit>;

  beforeEach(() => {
    nock.disableNetConnect();
    octokit = createOctokit("fake-token");
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it("fetches and filters merged PRs within date range", async () => {
    const scope = nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls`)
      .query(true)
      .reply(200, [
        makePRListItem(1, "2026-01-10T12:00:00Z"),
        makePRListItem(2, "2026-01-20T12:00:00Z"),
        makePRListItem(3, null), // not merged
        makePRListItem(4, "2025-12-15T12:00:00Z"), // before range
        makePRListItem(5, "2026-02-05T12:00:00Z"), // after range
      ]);

    // Detail calls for PR 1 and PR 2 (the ones within range)
    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls/1`)
      .reply(200, makePRDetail(1, 200, 50, 10));

    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls/2`)
      .reply(200, makePRDetail(2, 100, 30, 5));

    const prs = await fetchMergedPRs(
      octokit,
      OWNER,
      REPO,
      "2026-01-01",
      "2026-01-31",
    );

    expect(prs).toHaveLength(2);
    expect(prs[0].number).toBe(1);
    expect(prs[0].additions).toBe(200);
    expect(prs[1].number).toBe(2);
    expect(prs[1].additions).toBe(100);

    scope.done();
  });

  it("handles pagination across multiple pages", async () => {
    // Page 1: 100 items (full page triggers next page fetch)
    const page1 = Array.from({ length: 100 }, (_, i) =>
      makePRListItem(i + 1, i < 3 ? "2026-01-15T12:00:00Z" : "2025-06-01T00:00:00Z"),
    );

    // Page 2: empty (signals end)
    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls`)
      .query((q) => q.page === "1")
      .reply(200, page1);

    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls`)
      .query((q) => q.page === "2")
      .reply(200, []);

    // Detail calls for the 3 in-range PRs
    for (let i = 1; i <= 3; i++) {
      nock("https://api.github.com")
        .get(`/repos/${OWNER}/${REPO}/pulls/${i}`)
        .reply(200, makePRDetail(i));
    }

    const prs = await fetchMergedPRs(
      octokit,
      OWNER,
      REPO,
      "2026-01-01",
      "2026-01-31",
    );

    expect(prs).toHaveLength(3);
  });

  it("respects excludeLabels filter", async () => {
    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls`)
      .query(true)
      .reply(200, [
        makePRListItem(1, "2026-01-10T12:00:00Z", "PR #1", [{ name: "skip-me" }]),
        makePRListItem(2, "2026-01-20T12:00:00Z", "PR #2", [{ name: "feature" }]),
      ]);

    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls/2`)
      .reply(200, makePRDetail(2));

    const prs = await fetchMergedPRs(
      octokit,
      OWNER,
      REPO,
      "2026-01-01",
      "2026-01-31",
      undefined,
      ["skip-me"],
    );

    expect(prs).toHaveLength(1);
    expect(prs[0].number).toBe(2);
  });

  it("respects includeLabels filter", async () => {
    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls`)
      .query(true)
      .reply(200, [
        makePRListItem(1, "2026-01-10T12:00:00Z", "PR #1", [{ name: "feature" }]),
        makePRListItem(2, "2026-01-20T12:00:00Z", "PR #2", [{ name: "chore" }]),
      ]);

    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls/1`)
      .reply(200, makePRDetail(1));

    const prs = await fetchMergedPRs(
      octokit,
      OWNER,
      REPO,
      "2026-01-01",
      "2026-01-31",
      ["feature"],
      undefined,
    );

    expect(prs).toHaveLength(1);
    expect(prs[0].number).toBe(1);
  });

  it("returns empty array when no PRs match", async () => {
    nock("https://api.github.com")
      .get(`/repos/${OWNER}/${REPO}/pulls`)
      .query(true)
      .reply(200, []);

    const prs = await fetchMergedPRs(
      octokit,
      OWNER,
      REPO,
      "2026-01-01",
      "2026-01-31",
    );

    expect(prs).toHaveLength(0);
  });
});

describe("extractIssueNumber", () => {
  it("extracts issue number from conventional commit format with parentheses", () => {
    expect(extractIssueNumber("fix(634): eula in installers")).toBe(634);
    expect(extractIssueNumber("feat(1234): add new feature")).toBe(1234);
    expect(extractIssueNumber("chore(999): update dependencies")).toBe(999);
    expect(extractIssueNumber("docs(42): update readme")).toBe(42);
  });

  it("extracts issue number from conventional commit format with # prefix in parentheses", () => {
    expect(extractIssueNumber("fix(#634): eula in installers")).toBe(634);
    expect(extractIssueNumber("feat(#1234): add new feature")).toBe(1234);
  });

  it("extracts issue number with dash separator", () => {
    expect(extractIssueNumber("3156 - Feature description")).toBe(3156);
    expect(extractIssueNumber("3156- Feature description")).toBe(3156);
    expect(extractIssueNumber("3156 -Feature description")).toBe(3156);
  });

  it("extracts issue number with colon separator", () => {
    expect(extractIssueNumber("3156: Feature description")).toBe(3156);
    expect(extractIssueNumber("3156 : Feature description")).toBe(3156);
  });

  it("extracts issue number with # prefix", () => {
    expect(extractIssueNumber("#2964 Improve global error handling")).toBe(2964);
    expect(extractIssueNumber("#2964 Improve global error handling 2")).toBe(2964);
  });

  it("extracts issue number followed by space and text (no separator)", () => {
    expect(extractIssueNumber("3178 edr virus scan event type handle")).toBe(3178);
    expect(extractIssueNumber("1234 Some feature implementation")).toBe(1234);
  });

  it("returns null for titles without issue numbers", () => {
    expect(extractIssueNumber("Feature description")).toBeNull();
    expect(extractIssueNumber("fix: resolve crash on startup")).toBeNull();
    expect(extractIssueNumber("Update README")).toBeNull();
  });

  it("returns null for issue number not at start", () => {
    expect(extractIssueNumber("Feature #1234 description")).toBeNull();
    expect(extractIssueNumber("Fix issue 1234")).toBeNull();
  });

  it("does not match standalone numbers without text", () => {
    expect(extractIssueNumber("1234")).toBeNull();
    expect(extractIssueNumber("#1234")).toBeNull();
  });

  it("does not match conventional commits without issue numbers", () => {
    expect(extractIssueNumber("fix: resolve crash on startup")).toBeNull();
    expect(extractIssueNumber("feat: add new feature")).toBeNull();
    expect(extractIssueNumber("chore(deps): update packages")).toBeNull();
  });
});
