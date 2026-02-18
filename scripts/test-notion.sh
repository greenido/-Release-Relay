#!/bin/bash

# Test script for Notion integration
# This script tests posting to Notion with mock data

set -e

echo "🧪 Testing Notion Integration"
echo "=============================="

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check required environment variables
if [ -z "$NOTION_API_KEY" ] || [ -z "$NOTION_DATABASE_ID" ]; then
  echo "❌ Error: NOTION_API_KEY and NOTION_DATABASE_ID must be set in .env"
  exit 1
fi

echo "✓ Environment variables loaded"

# Create a test markdown file
TEST_DIR="release-notes"
TEST_FILE="$TEST_DIR/test-$(date +%Y-%m-%d-%H%M%S).md"

mkdir -p "$TEST_DIR"

cat > "$TEST_FILE" << 'EOF'
# Release Notes Test

### 🚀 Features

- **[PR #3171](https://github.com/YOUR_ORG/admin-dashboard/pull/3171)** – 3156 - Disk Encryption add support for new api

  - Author: @guy-espresso

  - Merged: 2026-02-15

  - Issue: [#3156](https://github.com/YOUR_ORG/admin-dashboard/issues/3156) – Integrate Device Encryption tab with new endpoint /devices/:deviceId/disk-encryption-config

    - Labels: priority-P0, X-SMALL

    - Type: Other

  - Files changed: 15 (+941 / -244)

### 📦 Other Changes

- **[PR #3181](https://github.com/YOUR_ORG/admin-dashboard/pull/3181)** – #2964 Improve global error handling 2

  - Author: @nnoumegni-els

  - Merged: 2026-02-16

  - Issue: [#2964](https://github.com/YOUR_ORG/admin-dashboard/issues/2964) – admin portal is full of console errors

    - Labels: bug

    - Type: Bug

  - Files changed: 5 (+439 / -49)

---

## Summary

This test includes **bold text**, [clickable links](https://github.com), and `code formatting`.
EOF

echo "✓ Created test markdown file: $TEST_FILE"

# Test parameters
TITLE="TEST - Release Notes - Week 07, 2026"
DATE_RANGE="2026-02-10 to 2026-02-17"
REPO_NAME="YOUR_ORG/test-repo"

echo ""
echo "Test Parameters:"
echo "  Title: $TITLE"
echo "  Date Range: $DATE_RANGE"
echo "  Repo: $REPO_NAME"
echo ""

# Run the post-to-notion script
echo "📤 Posting to Notion..."
./scripts/post-to-notion.sh "$TEST_FILE" "$TITLE" "$DATE_RANGE" "$REPO_NAME"

# Cleanup
rm "$TEST_FILE"
echo ""
echo "✅ Test completed successfully!"
echo ""
echo "⚠️  Please check your Notion database to verify the test entry was created."
echo "   You may want to delete the test entry manually."
