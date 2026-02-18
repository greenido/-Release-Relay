#!/bin/bash

# Script to post release notes to Notion
# Usage: ./scripts/post-to-notion.sh <markdown-file> <title> <date-range> <repo-name>

set -e

# Check required environment variables
if [ -z "$NOTION_API_KEY" ] || [ -z "$NOTION_DATABASE_ID" ]; then
  echo "Error: NOTION_API_KEY and NOTION_DATABASE_ID must be set"
  exit 1
fi

# Parse arguments
MARKDOWN_FILE="${1}"
TITLE="${2}"
DATE_RANGE="${3}"
REPO_NAME="${4}"

if [ -z "$MARKDOWN_FILE" ] || [ ! -f "$MARKDOWN_FILE" ]; then
  echo "Error: Markdown file not found: $MARKDOWN_FILE"
  exit 1
fi

# Get week number
WEEK_NUM=$(date -u +%V)

# Read markdown content
CONTENT=$(cat "$MARKDOWN_FILE")

# Function to parse markdown text with links and bold/italic formatting
# Returns a JSON array of Notion rich_text objects
parse_rich_text() {
  local text="$1"
  local result="[]"
  
  # Handle empty input
  if [ -z "$text" ]; then
    echo '[{"type": "text", "text": {"content": ""}}]'
    return
  fi
  
  # Use Python to parse markdown more reliably
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
    # Add plain text before match
    if match.start() > pos:
        plain = text[pos:match.start()]
        if plain:
            rich_text.append({
                'type': 'text',
                'text': {'content': plain}
            })
    
    # Add matched element
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

# Add remaining plain text
if pos < len(text):
    plain = text[pos:]
    if plain:
        rich_text.append({
            'type': 'text',
            'text': {'content': plain}
        })

# If no rich text elements, return plain text
if not rich_text:
    rich_text = [{'type': 'text', 'text': {'content': text}}]

print(json.dumps(rich_text))
" 2>/dev/null)
  
  # Fallback if Python fails - just return plain text
  if [ -z "$result" ] || ! echo "$result" | jq empty 2>/dev/null; then
    result=$(jq -n --arg content "$text" '[{"type": "text", "text": {"content": $content}}]')
  fi
  
  echo "$result"
}

# Function to convert markdown to Notion blocks
# This function converts markdown to a JSON array of Notion blocks
convert_markdown_to_notion_blocks() {
  local markdown="$1"
  local blocks="[]"
  local in_code_block=false
  local code_block_content=""
  local code_block_language=""
  
  while IFS= read -r line || [ -n "$line" ]; do
    # Handle code blocks
    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
      if [ "$in_code_block" = false ]; then
        # Start of code block
        in_code_block=true
        code_block_language="${BASH_REMATCH[1]}"
        code_block_content=""
      else
        # End of code block
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
    
    if [ "$in_code_block" = true ]; then
      code_block_content="$code_block_content"$'\n'"$line"
      continue
    fi
    
    # Skip empty lines
    if [ -z "$line" ]; then
      continue
    fi
    
    # Handle headings
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
    # Handle numbered lists
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
    # Handle bullet points (both * and -)
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
    # Handle horizontal rules
    elif [[ "$line" =~ ^---+$ ]]; then
      blocks=$(echo "$blocks" | jq \
        '. += [{
          "object": "block",
          "type": "divider",
          "divider": {}
        }]')
    # Handle regular paragraphs
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

# Convert markdown to Notion blocks
MARKDOWN_BLOCKS=$(convert_markdown_to_notion_blocks "$CONTENT")

# Check if we have too many blocks (Notion API limit is 100 blocks per request)
BLOCK_COUNT=$(echo "$MARKDOWN_BLOCKS" | jq 'length')
echo "📊 Converted markdown to $BLOCK_COUNT blocks"

if [ "$BLOCK_COUNT" -gt 97 ]; then
  echo "⚠️  Warning: Generated $BLOCK_COUNT blocks. Notion API has a limit of 100 blocks per page creation."
  echo "    Limiting to first 97 blocks (3 header blocks + 97 markdown blocks = 100 total)"
  MARKDOWN_BLOCKS=$(echo "$MARKDOWN_BLOCKS" | jq '.[0:97]')
fi

# Create initial JSON structure with properties
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

# Add header blocks
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

# Combine header blocks with markdown blocks
ALL_BLOCKS=$(echo "$HEADER_BLOCKS" | jq --argjson markdown_blocks "$MARKDOWN_BLOCKS" '. + $markdown_blocks')

# Create final JSON payload with all blocks
JSON_PAYLOAD=$(echo "$INITIAL_JSON" | jq --argjson children "$ALL_BLOCKS" '.children = $children')

# Debug: Print the JSON payload (comment out in production)
if [ "${DEBUG:-false}" = "true" ]; then
  echo "=== JSON Payload ==="
  echo "$JSON_PAYLOAD" | jq .
  echo "===================="
fi

# Post to Notion
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST 'https://api.notion.com/v1/pages' \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Notion-Version: 2022-06-28" \
  -d "$JSON_PAYLOAD")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
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
