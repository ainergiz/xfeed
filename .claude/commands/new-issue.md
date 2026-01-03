---
allowed-tools: Bash(gh:*), Grep, Glob, Read, WebSearch, Task, mcp__conductor__AskUserQuestion
argument-hint: [issue description or leave blank to be prompted]
description: Create a new GitHub issue with duplicate detection, codebase analysis, and structured exploration
---

# Create New GitHub Issue

Create a well-researched GitHub issue after verifying it's not a duplicate and exploring potential solutions.

## Input

**Issue Description:** $ARGUMENTS

---

## Workflow

### Step 0: Get Issue Description

If `$ARGUMENTS` is empty or not provided, use the `mcp__conductor__AskUserQuestion` tool to ask:
> "What issue would you like to create? Describe the bug, feature, or improvement you have in mind."

Wait for the user's response before proceeding.

---

### Step 1: Check if Already Fixed/Implemented

Before creating an issue, explore the codebase to verify this isn't already solved:

1. **Search for related keywords** in the codebase:
   - Use Grep to search for terms related to the issue
   - Use Glob to find relevant files by pattern
   - Read key files to understand current implementation

2. **Check recent commits** for related changes:
   ```bash
   gh api repos/{owner}/{repo}/commits --jq '.[0:20] | .[] | "\(.sha[0:7]) \(.commit.message | split("\n")[0])"'
   ```

3. **If you find the issue is already fixed/implemented:**
   - Use `mcp__conductor__AskUserQuestion` to inform the user:
     > "It looks like this might already be addressed. I found [describe what you found]. Are you aware of this? Would you still like to create an issue, or shall we explore the existing solution?"
   - Options: "Show me the existing solution", "Create the issue anyway", "Cancel"

---

### Step 2: Check Existing GitHub Issues

Search for duplicate or related issues:

1. **Search open issues:**
   ```bash
   gh issue list --state open --limit 50 --json number,title,body,labels,url
   ```

2. **Search closed issues** (might have been fixed or rejected):
   ```bash
   gh issue list --state closed --limit 30 --json number,title,body,labels,url,closedAt
   ```

3. **Search with keywords:**
   ```bash
   gh search issues --repo {owner}/{repo} "relevant keywords" --limit 20 --json number,title,body,url,state
   ```

4. **For promising matches, fetch full details with comments:**
   ```bash
   gh issue view <number> --json number,title,body,comments,labels,state
   ```

5. **Analyze findings and decide:**

   - **EXACT DUPLICATE found:** Use `mcp__conductor__AskUserQuestion`:
     > "I found an existing issue that appears to be exactly what you're describing: #[number] - [title]. [Brief summary]. What would you like to do?"
     - Options: "Add a comment to existing issue", "View the issue details", "Create new issue anyway", "Cancel"

   - **RELATED issue found (could be improved/extended):** Use `mcp__conductor__AskUserQuestion`:
     > "I found a related issue #[number] - [title] that covers similar ground. Your issue could be added as a comment, created as a sub-issue, or kept separate. What would you prefer?"
     - Options: "Add as comment to #[number]", "Create as sub-issue (activate gh-subissues skill)", "Create separate issue"

   - **CLOSED issue found (was rejected/fixed):** Inform the user of the context and ask if they still want to proceed.

---

### Step 3: Research Potential Solutions

If you have enough context to understand a possible fix:

1. **Explore the codebase** for implementation patterns:
   - Find similar features or fixes
   - Identify the files/modules that would need changes
   - Note any constraints or architectural considerations

2. **Use web search** (via Task tool with subagents) if helpful:
   - Search for best practices related to the issue
   - Look for similar solutions in other projects
   - Research any APIs or libraries that might help

3. **Formulate 1-3 potential approaches** to solving the issue:
   - Brief description of each approach
   - Pros/cons if applicable
   - Files that would likely need changes

---

### Step 4: Draft Structured Issue Content

Prepare a well-structured issue with:

```markdown
## Summary
[1-2 sentence description of the issue]

## Context
[Background information, how you discovered this, why it matters]

## Current Behavior (for bugs)
[What currently happens]

## Expected Behavior
[What should happen]

## Potential Implementation
[Your exploration findings - optional but helpful]

### Approach 1: [Name]
- Description
- Files to modify: `path/to/file.ts`

### Approach 2: [Name] (if applicable)
- Description
- Trade-offs

## Additional Context
[Screenshots, logs, related issues, etc.]
```

---

### Step 5: Confirm with User

Use `mcp__conductor__AskUserQuestion` to present your findings and get confirmation:

> "I've analyzed the codebase and existing issues. Here's what I'm planning to create:
>
> **Title:** [proposed title]
>
> **Summary:** [1-2 sentences]
>
> **Key findings:**
> - [Finding 1]
> - [Finding 2]
>
> **Proposed implementation notes:** [Brief if you found potential solutions]
>
> Does this look good? Any changes before I create it?"

Options: "Create the issue", "Edit the title/description", "Show me more details", "Cancel"

---

### Step 6: Create the Issue

Once confirmed, create the issue:

```bash
gh issue create --title "issue title" --body "$(cat <<'EOF'
## Summary
...

## Context
...

[rest of the structured content]
EOF
)"
```

After creation, display:
- The issue URL
- Issue number
- Ask if user wants to start working on it or add labels/assignees

---

## Sub-Issue Support

If the user wants to create this as a sub-issue of an existing parent:

1. Say: "I'll activate the gh-subissues skill to help create this as a sub-issue."
2. Use the Skill tool to invoke `gh-subissues`
3. Follow the sub-issue creation workflow from that skill

---

## Notes

- Always prioritize preventing duplicate issues - it saves everyone time
- Be thorough but concise in exploration - don't overwhelm the user
- If the issue is simple and clearly new, you can streamline steps 1-3
- Use conventional commit-style titles when appropriate: `feat(area):`, `fix(area):`, `docs(area):`
