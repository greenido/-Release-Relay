#!/bin/bash

# Dry-run script to validate Notion JSON payload without posting
# Usage: ./scripts/dry-run-notion.sh <markdown-file> <title> <date-range> <repo-name>

set -e

# Parse arguments
MARKDOWN_FILE="${1:-release-notes/test.md}"
TITLE="${2:-TEST - Release Notes - Week 07, 2026}"
DATE_RANGE="${3:-2026-02-10 to 2026-02-17}"
REPO_NAME="${4:-YOUR_ORG/test-repo}"

echo "🔍 Notion Payload Dry Run"
echo "========================"
echo ""
echo "Parameters:"
echo "  File: $MARKDOWN_FILE"
echo "  Title: $TITLE"
echo "  Date Range: $DATE_RANGE"
echo "  Repo: $REPO_NAME"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ Error: jq is not installed. Please install it first."
  echo "   macOS: brew install jq"
  echo "   Ubuntu: sudo apt-get install jq"
  exit 1
fi

# Get week number
WEEK_NUM=$(date -u +%V)

# Create JSON payload using jq for proper escaping
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

echo "✅ JSON Payload (valid):"
echo ""
echo "$JSON_PAYLOAD" | jq .
echo ""
echo "📊 Payload size: $(echo "$JSON_PAYLOAD" | wc -c | tr -d ' ') bytes"
echo ""
echo "✅ Validation complete!"
echo ""
echo "💡 To actually post to Notion, use: npm run test:notion"
