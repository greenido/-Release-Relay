/**
 * ---------------------------------------------------------------------------------------------
 * Copyright (c) 2026. All rights reserved.
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 *
 * @file publishers.ts
 * @description Handles publishing of release notes to external platforms like Slack and Discord via webhooks.
 * ---------------------------------------------------------------------------------------------
 */

import logger from "./logger.js";

/**
 * Helper to split message into chunks.
 * Ensures no chunk exceeds the maxLength. Tries to split by lines if possible.
 * @param content The text content to split.
 * @param maxLength Maximum length of each chunk.
 * @returns Array of string chunks.
 */
function splitMessage(content: string, maxLength: number): string[] {
  const chunks: string[] = [];
  if (content.length <= maxLength) {
    chunks.push(content);
    return chunks;
  }

  const lines = content.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if ((currentChunk + "\n" + line).length > maxLength) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n" + line : line;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Send content to Slack via Webhook.
 * Slack specific format: MRKDWN.
 * @param content The message content (Markdown).
 * @param webhookUrl The Slack webhook URL.
 */
export async function publishToSlack(content: string, webhookUrl: string): Promise<void> {
  if (!webhookUrl) {
    logger.warn("Slack webhook URL not provided. Skipping.");
    return;
  }

  // Basic conversion from Markdown to Slack mrkdwn
  let mrkdwn = content
    .replace(/\*\*(.*?)\*\*/g, "*$1*") // Bold
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, "<$2|$1>") // Links
    .replace(/^#+\s+(.*)$/gm, "*$1*") // Headers to bold
    .replace(/^\s*-\s/gm, "• "); // List items

  // Slack block limit is 3000 chars.
  // We split into multiple blocks.
  const chunks = splitMessage(mrkdwn, 2900); // 2900 to be safe

  // Slack allows max 50 blocks. If more, we might need multiple requests, but let's assume < 50 chunks.
  // If > 50 chunks (approx 150k chars), we truncate or send multiple messages.
  // For simplicity, we send one message with multiple blocks.

  const blocks = chunks.slice(0, 50).map((chunk) => ({
    type: "section",
    text: {
      type: "mrkdwn",
      text: chunk,
    },
  }));

  if (chunks.length > 50) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_...truncated (message too long for Slack)_",
      },
    });
  }

  const payload = {
    text: "New Release Notes", // Fallback text
    blocks: blocks,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack API error: ${response.status} ${body}`);
    }
    logger.info("Successfully published to Slack.");
  } catch (error) {
    logger.error({ error }, "Failed to publish to Slack.");
    throw error;
  }
}

/**
 * Send content to Discord via Webhook.
 * Discord supports standard Markdown.
 * Limit: 2000 chars per message. We must split if longer.
 * @param content The message content (Markdown).
 * @param webhookUrl The Discord webhook URL.
 */
export async function publishToDiscord(content: string, webhookUrl: string): Promise<void> {
  if (!webhookUrl) {
    logger.warn("Discord webhook URL not provided. Skipping.");
    return;
  }

  const MAX_LENGTH = 1900; // Leave some buffer
  const chunks = splitMessage(content, MAX_LENGTH);

  try {
    for (const [index, chunk] of chunks.entries()) {
      const payload = {
        content: chunk,
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Discord API error: ${response.status} ${body}`);
      }

      // Rate limit safety
      if (index < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    logger.info(`Successfully published to Discord (${chunks.length} messages).`);
  } catch (error) {
    logger.error({ error }, "Failed to publish to Discord.");
    throw error;
  }
}
