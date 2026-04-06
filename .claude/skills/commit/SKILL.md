---
name: commit
description: Create git commits with user approval. Use when the user wants to commit changes, save work to git, or finalize their modifications. Triggers on keywords like "commit", "save changes", "create commit".
argument-hint: [optional commit message]
---

# Commit Changes

You are tasked with creating git commits for the changes made during this session.

## User-Provided Context

If the user provided a commit message or description: **$ARGUMENTS**

Use this as guidance for the commit message if provided, but still follow the full process below.

## Process

1. **Think about what changed:**
   - Review the conversation history and understand what was accomplished
   - Run `git status` to see current changes
   - Run `git diff` to understand the modifications
   - Consider whether changes should be one commit or multiple logical commits

2. **Plan your commit(s):**
   - Identify which files belong together
   - Draft clear, descriptive commit messages
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what
   - If `$ARGUMENTS` was provided, incorporate it into your commit message

3. **Present your plan to the user:**
   - List the files you plan to add for each commit
   - Show the commit message(s) you'll use
   - Ask: "I plan to create [N] commit(s) with these changes. Shall I proceed?"

4. **Execute upon confirmation:**
   - **ONLY commit files that are already staged** (shown in "Changes to be committed")
   - Do NOT add unstaged changes or untracked files unless explicitly requested
   - Use `git commit` directly for staged files
   - If you need to add specific files, use `git add` with explicit file paths (never use `-A` or `.`)
   - Create commits with your planned messages
   - Show the result with `git log --oneline -n [number]`

## Important

- **NEVER add co-author information or Claude attribution**
- Commits should be authored solely by the user
- Do not include any "Generated with Claude" messages
- Do not add "Co-Authored-By" lines
- Write commit messages as if the user wrote them

## Remember

- You have the full context of what was done in this session
- Group related changes together
- Keep commits focused and atomic when possible
- The user trusts your judgment - they asked you to commit
