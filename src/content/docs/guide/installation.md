---
title: "Installation"
description: "skills CLI, Claude plugin, ChatGPT, manual copy, and submodule installs."
sidebar:
  order: 4
---

## Option 1: skills CLI (recommended)

```bash
npx skills add DecisionNerd/RedTeam
```

The skills CLI finds the agents in your project (Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, and others) and asks where to install. Reload your harness, then run `/redteam tools`.

Update with `npx skills update redteam`; remove with `npx skills remove redteam`. The install does not create `.redteam/`; run `/redteam init` when you want persistent context. Chat-only commands work without it.

## Option 2: Claude Code plugin

```
/plugin marketplace add DecisionNerd/RedTeam
```

Then install from the plugin list.

## Option 3: ChatGPT Custom GPT

1. Create a Custom GPT
2. Paste `chatgpt/INSTRUCTIONS.md` from the repo into Instructions
3. Optionally upload `skills/redteam/reference/ttp-catalog.md` as knowledge

See `chatgpt/README.md` in the repository.

## Option 4: Copy from repo

```bash
# Cursor
cp -r .cursor/skills/redteam your-project/.cursor/skills/

# Claude Code
cp -r .claude/skills/redteam your-project/.claude/skills/

# Codex / Agents
cp -r .agents/skills/redteam your-project/.agents/skills/
```

Run `npm run build` in the repo first if installing from source.

## Option 5: Git submodule

```bash
git submodule add https://github.com/DecisionNerd/RedTeam .redteam-plugin
npx skills add ./.redteam-plugin
```

## Requirements

- Node.js 22.12+
- An AI harness that supports skills or slash commands (Cursor, Claude Code, Codex, etc.)

## Verify

After install, try:

```
/redteam tools
```

You should get a browseable technique catalog with recommendations.
