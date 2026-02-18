# Notion Markdown Formatting

## Overview

The `post-to-notion.sh` script has been enhanced to properly convert markdown syntax into Notion's rich text format, ensuring that links are clickable and formatting is preserved.

## Supported Markdown Features

### 1. Links
Markdown links are converted to clickable links in Notion:

```markdown
[Link text](https://example.com)
```

**Notion output:** Clickable link with "Link text" that opens https://example.com

### 2. Bold Text
Bold text is preserved:

```markdown
**bold text**
```

**Notion output:** **bold text**

### 3. Inline Code
Inline code is preserved:

```markdown
`code text`
```

**Notion output:** `code text` (with code formatting)

### 4. Headings
All heading levels are supported:

```markdown
# Heading 1
## Heading 2
### Heading 3
```

### 5. Lists
Both bullet points and numbered lists:

```markdown
- Bullet item
* Another bullet
1. Numbered item
2. Another numbered item
```

### 6. Horizontal Rules
Markdown horizontal rules become Notion dividers:

```markdown
---
```

### 7. Code Blocks
Multi-line code blocks with syntax highlighting:

````markdown
```python
def hello():
    print("Hello, World!")
```
````

## How It Works

The script uses a Python-based parser within the `parse_rich_text()` function to:

1. Identify markdown patterns (links, bold, code) using regex
2. Split text into segments with appropriate formatting
3. Convert to Notion's rich_text JSON format with proper annotations

### Example Conversion

**Input markdown:**
```markdown
- **[PR #3171](https://github.com/repo/pull/3171)** – Issue: [#3156](https://github.com/repo/issues/3156) – Description
```

**Output in Notion:**
- Bold and clickable link: "PR #3171" → https://github.com/repo/pull/3171
- Plain text: " – Issue: "
- Clickable link: "#3156" → https://github.com/repo/issues/3156
- Plain text: " – Description"

## Testing

Run the test script to verify formatting:

```bash
./scripts/test-notion.sh
```

The test creates a sample page in your Notion database with:
- Multiple heading levels
- Bold text
- Inline code
- Clickable GitHub issue and PR links
- Bullet points with nested content
- Horizontal divider

## Fallback Behavior

If the Python parser fails for any reason, the script falls back to treating the content as plain text to ensure the operation completes successfully.

## Related Files

- `/scripts/post-to-notion.sh` - Main script with markdown parsing
- `/scripts/test-notion.sh` - Test script with sample markdown
- `/.github/workflows/weekly-notion-release-notes.yml` - Workflow that uses this script
