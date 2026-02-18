#!/bin/bash
# ---------------------------------------------------------------------------------------------
# Copyright (c) 2026. All rights reserved.
# Licensed under the MIT License. See LICENSE file in the project root for full license information.
#
# @file post-to-notion.sh
# @description Script to post generated markdown release notes to a Notion database.
#              Parses markdown content, converts it to Notion blocks, and sends via API.
# ---------------------------------------------------------------------------------------------

# Usage: ./scripts/post-to-notion.sh <markdown-file> <title> <date-range> <repo-name>

set -e

# --- Environment Validation ---
if [ -z "$NOTION_API_KEY" ] || [ -z "$NOTION_DATABASE_ID" ]; then
  echo "Error: NOTION_API_KEY and NOTION_DATABASE_ID must be set in the environment."
  exit 1
fi

# --- Argument Parsing ---
MARKDOWN_FILE="${1}"
TITLE="${2}"
DATE_RANGE="${3}"
REPO_NAME="${4}"

if [ -z "$MARKDOWN_FILE" ] || [ ! -f "$MARKDOWN_FILE" ]; then
  echo "Error: Markdown file not found: $MARKDOWN_FILE"
  exit 1
fi

# Get current week number for the Notion 'Week' property
WEEK_NUM=$(date -u +%V)

# Read the entire markdown content into a variable
CONTENT=$(cat "$MARKDOWN_FILE")

# --- Helper Functions ---

# Function: parse_rich_text
# Description: Parses markdown text with links, bold, and code formatting into Notion rich_text objects.
# Arguments:
#   $1 - The text string to parse.
# Returns: JSON array of Notion rich_text objects.
parse_rich_text() {
  local text="$1"
  local result="[]"
  
  # Handle empty input gracefully
  if [ -z "$text" ]; then
    echo '[{"type": "text", "text": {"content": ""}}]'
    return
  fi
  
  # Use Python for robust regex parsing of markdown syntax
  result=$(python3 -c "
import json
import re
import sys

text = '''$text'''

# Pattern to match bold with link inside: **[text](url)**
bold_link_pattern = r'\*\*\[([^\]]+)\]\(([^\)]+)\)\*\*'
# Pattern to match markdown links: [text](url)
link_pattern = r'\[([^\]]+)\]\(([^\)]+)\)'
# Pattern to match bold: **text**
bold_pattern = r'\*\*([^\*]+)\*\*'
# Pattern to match code: \`text\`
code_pattern = r'\`([^\`]+)\`'

rich_text = []
pos = 0

# Combine all patterns - bold_link MUST come first to match before bold or link alone
combined_pattern = f'({bold_link_pattern})|({link_pattern})|({bold_pattern})|({code_pattern})'

for match in re.finditer(combined_pattern, text):
    # Add plain text occurring before the match
    if match.start() > pos:
        plain = text[pos:match.start()]
        if plain:
            rich_text.append({
                'type': 'text',
                'text': {'content': plain}
            })
    
    # Add the matched element with appropriate annotations
    if match.group(2) and match.group(3):  # Bold link: **[text](url)**
        rich_text.append({
            'type': 'text',
            'text': {
                'content': match.group(2),
                'link': {'url': match.group(3)}
            },
            'annotations': {'bold': True}
        })
    elif match.group(5) and match.group(6):  # Regular link: [text](url)
        rich_text.append({
            'type': 'text',
            'text': {
                'content': match.group(5),
                'link': {'url': match.group(6)}
            }
        })
    elif match.group(8):  # Bold: **text**
        rich_text.append({
            'type': 'text',
            'text': {'content': match.group(8)},
            'annotations': {'bold': True}
        })
    elif match.group(10):  # Code: \`text\`
        rich_text.append({
            'type': 'text',
            'text': {'content': match.group(10)},
            'annotations': {'code': True}
        })
    
    pos = match.end()

# Add any remaining plain text after the last match
if pos < len(text):
    plain = text[pos:]
    if plain:
        rich_text.append({
            'type': 'text',
            'text': {'content': plain}
        })

# Fallback: If no rich text elements were found, treat entire string as plain text
if not rich_text:
    rich_text = [{'type': 'text', 'text': {'content': text}}]

print(json.dumps(rich_text))
" 2>/dev/null)
  
  # Fallback if Python fails or is missing - use jq to create a simple text object
  if [ -z "$result" ] || ! echo "$result" | jq empty 2>/dev/null; then
    result=$(jq -n --arg content "$text" '[{"type": "text", "text": {"content": $content}}]')
  fi
  
  echo "$result"
}

# Function: convert_markdown_to_notion_blocks
# Description: Converts markdown content into a JSON array of Notion block objects.
#              Supports headings, lists, code blocks, dividers, and paragraphs.
# Arguments:
#   $1 - The full markdown content string.
# Returns: JSON array of Notion block objects.
convert_markdown_to_notion_blocks() {
  local markdown="$1"
  local blocks="[]"
  local in_code_block=false
  local code_block_content=""
  local code_block_language=""
  
  while IFS= read -r line || [ -n "$line" ]; do
    # --- Handle Code Blocks ---
    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
      if [ "$in_code_block" = false ]; then
        # Start of code block
        in_code_block=true
        code_block_language="${BASH_REMATCH[1]}"
        code_block_content=""
      else
        # End of code block - commit the accumulated content
        in_code_block=false
        if [ -n "$code_block_content" ]; then
          # Remove leading newline if present
          code_block_content="${code_block_content#$'\n'}"
          blocks=$(echo "$blocks" | jq --arg content "$code_block_content" --arg lang "$code_block_language" \
            '. += [{
              "object": "block",
              "type": "code",
              "code": {
                "rich_text": [{
                  "type": "text",
                  "text": {"content": $content}
                }],
                "language": (if $lang == "" then "plain text" else $lang end)
              }
            }]')
        fi
        code_block_content=""
        code_block_language=""
      fi
      continue
    fi
    
    # Accumulate content inside code blocks
    if [ "$in_code_block" = true ]; then
      code_block_content="$code_block_content"$'\n'"$line"
      continue
    fi
    
    # Skip empty lines outside code blocks
    if [ -z "$line" ]; then
      continue
    fi
    
    # --- Handle Headings ---
    if [[ "$line" =~ ^#\ (.+)$ ]]; then
      text="${BASH_REMATCH[1]}"
      rich_text=$(parse_rich_text "$text")
      blocks=$(echo "$blocks" | jq --argjson rich_text "$rich_text" \
        '. += [{
          "object": "block",
          "type": "heading_1",
          "heading_1": {
            "rich_text": $rich_text
          }
        }]')
    elif [[ "$line" =~ ^##\ (.+)$ ]]; then
      text="${BASH_REMATCH[1]}"
      rich_text=$(parse_rich_text "$text")
      blocks=$(echo "$blocks" | jq --argjson rich_text "$rich_text" \
        '. += [{
          "object": "block",
          "type": "heading_2",
          "heading_2": {
            "rich_text": $rich_text
          }
        }]')
    elif [[ "$line" =~ ^###\ (.+)$ ]]; then
      text="${BASH_REMATCH[1]}"
      rich_text=$(parse_rich_text "$text")
      blocks=$(echo "$blocks" | jq --argjson rich_text "$rich_text" \
        '. += [{
          "object": "block",
          "type": "heading_3",
          "heading_3": {
            "rich_text": $rich_text
          }
        }]')
    # --- Handle Lists ---
    elif [[ "$line" =~ ^[0-9]+\.\ (.+)$ ]]; then
      text="${BASH_REMATCH[1]}"
      rich_text=$(parse_rich_text "$text")
      blocks=$(echo "$blocks" | jq --argjson rich_text "$rich_text" \
        '. += [{
          "object": "block",
          "type": "numbered_list_item",
          "numbered_list_item": {
            "rich_text": $rich_text
          }
        }]')
    elif [[ "$line" =~ ^[\*\-]\ (.+)$ ]]; then
      text="${BASH_REMATCH[1]}"
      rich_text=$(parse_rich_text "$text")
      blocks=$(echo "$blocks" | jq --argjson rich_text "$rich_text" \
        '. += [{
          "object": "block",
          "type": "bulleted_list_item",
          "bulleted_list_item": {
            "rich_text": $rich_text
          }
        }]')
    # --- Handle Dividers ---
    elif [[ "$line" =~ ^---+$ ]]; then
      blocks=$(echo "$blocks" | jq \
        '. += [{
          "object": "block",
          "type": "divider",
          "divider": {}
        }]')
    # --- Handle Paragraphs ---
    else
      rich_text=$(parse_rich_text "$line")
      blocks=$(echo "$blocks" | jq --argjson rich_text "$rich_text" \
        '. += [{
          "object": "block",
          "type": "paragraph",
          "paragraph": {
            "rich_text": $rich_text
          }
        }]')
    fi
  done <<< "$markdown"
  
  echo "$blocks"
}

# --- Main Logic ---

# Convert markdown content to Notion blocks
MARKDOWN_BLOCKS=$(convert_markdown_to_notion_blocks "$CONTENT")

# Validate block count against Notion API limits (100 blocks per request)
BLOCK_COUNT=$(echo "$MARKDOWN_BLOCKS" | jq 'length')
echo "📊 Converted markdown to $BLOCK_COUNT blocks"

if [ "$BLOCK_COUNT" -gt 97 ]; then
  echo "⚠️  Warning: Generated $BLOCK_COUNT blocks. Notion API has a limit of 100 blocks per page creation."
  echo "    Limiting to first 97 blocks (3 header blocks + 97 markdown blocks = 100 total)"
  MARKDOWN_BLOCKS=$(echo "$MARKDOWN_BLOCKS" | jq '.[0:97]')
fi

# Create initial JSON structure with page properties
INITIAL_JSON=$(jq -n \
  --arg db_id "$NOTION_DATABASE_ID" \
  --arg title "$TITLE" \
  --arg date_range "$DATE_RANGE" \
  --argjson week "$WEEK_NUM" \
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
    "children": []
  }')

# Define header blocks (Title, Repo info, Divider)
HEADER_BLOCKS=$(jq -n \
  --arg heading "Release Notes: $DATE_RANGE" \
  --arg repo "Repository: $REPO_NAME" \
  '[
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
  ]')

# Combine header blocks with converted markdown blocks
ALL_BLOCKS=$(echo "$HEADER_BLOCKS" | jq --argjson markdown_blocks "$MARKDOWN_BLOCKS" '. + $markdown_blocks')

# Insert blocks into the main JSON payload
JSON_PAYLOAD=$(echo "$INITIAL_JSON" | jq --argjson children "$ALL_BLOCKS" '.children = $children')

# Debug output (optional)
if [ "${DEBUG:-false}" = "true" ]; then
  echo "=== JSON Payload ==="
  echo "$JSON_PAYLOAD" | jq .
  echo "===================="
fi

# --- API Execution ---

# Post the payload to the Notion API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST 'https://api.notion.com/v1/pages' \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Notion-Version: 2022-06-28" \
  -d "$JSON_PAYLOAD")

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✅ Successfully posted release notes to Notion"
  exit 0
else
  echo "❌ Failed to post to Notion"
  echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "$RESPONSE_BODY"
  exit 1
fi
