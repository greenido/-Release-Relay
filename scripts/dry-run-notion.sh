#!/bin/bash
# ---------------------------------------------------------------------------------------------
# Copyright (c) 2026. All rights reserved.
# Licensed under the MIT License. See LICENSE file in the project root for full license information.
#
# @file dry-run-notion.sh
# @description Dry-run script to validate the Notion JSON payload without actually posting to the API.
#              Useful for debugging payload structure and content formatting.
# ---------------------------------------------------------------------------------------------

# Usage: ./scripts/dry-run-notion.sh <markdown-file> <title> <date-range> <repo-name>

set -e

# --- Argument Parsing & Defaults ---
MARKDOWN_FILE="${1:-release-notes/test.md}"
TITLE="${2:-TEST - Release Notes - Week 07, 2026}"
DATE_RANGE="${3:-2026-02-10 to 2026-02-17}"
REPO_NAME="${4:-YOUR_ORG/test-repo}"

echo "🔍 Notion Payload Dry Run"
echo "========================"
echo ""
echo "Parameters:"
echo "  File:       $MARKDOWN_FILE"
echo "  Title:      $TITLE"
echo "  Date Range: $DATE_RANGE"
echo "  Repo:       $REPO_NAME"
echo ""

# --- Dependency Check ---
if ! command -v jq &> /dev/null; then
  echo "❌ Error: jq is not installed. Please install it first."
  echo "   macOS: brew install jq"
  echo "   Ubuntu: sudo apt-get install jq"
  exit 1
fi

# --- Payload Construction ---

# Get current week number for the Notion 'Week' property
WEEK_NUM=$(date -u +%V)

# Construct the JSON payload using jq to ensure proper escaping and structure.
# This mimics the structure used in the actual post-to-notion.sh script.
JSON_PAYLOAD=$(jq -n \
  --arg db_id "YOUR_DATABASE_ID_HERE" \
  --arg title "$TITLE" \
  --arg date_range "$DATE_RANGE" \
  --argjson week "$WEEK_NUM" \
  --arg heading "Release Notes: $DATE_RANGE" \
  --arg repo "Repository: $REPO_NAME" \
  '{
    "parent": {
      "database_id": $db_id
    },
    "properties": {
      "Name": {
        "title": [
          {
            "text": {
              "content": $title
            }
          }
        ]
      },
      "Date Range": {
        "rich_text": [
          {
            "text": {
              "content": $date_range
            }
          }
        ]
      },
      "Week": {
        "number": $week
      },
      "Status": {
        "select": {
          "name": "Published"
        }
      }
    },
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [
            {
              "type": "text",
              "text": {
                "content": $heading
              }
            }
          ]
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [
            {
              "type": "text",
              "text": {
                "content": $repo
              }
            }
          ]
        }
      },
      {
        "object": "block",
        "type": "divider",
        "divider": {}
      }
    ]
  }')

# --- Output & Validation ---

echo "✅ JSON Payload (valid):"
echo ""
echo "$JSON_PAYLOAD" | jq .
echo ""
echo "📊 Payload size: $(echo "$JSON_PAYLOAD" | wc -c | tr -d ' ') bytes"
echo ""
echo "✅ Validation complete!"
echo ""
echo "💡 To actually post to Notion, use: npm run test:notion"
