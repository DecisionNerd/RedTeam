# Agent instructions

This repository is **RedTeam** — applied critical thinking skills for AI agents.

## Architecture

- `skills/redteam/` — source skill (SKILL.md + reference/ + scripts/ + templates/), installed verbatim by `npx skills add`
- `scripts/build.mjs` — copies skill to provider directories
- `scripts/test-skill-source.mjs` — offline guard (`npm test`)
- `.redteam/` — project decision context and review artifacts (analogous to `.impeccable/`)
- `plugin/` — Claude Code plugin bundle
- `chatgpt/` — Custom GPT instructions

## Build

```bash
npm run build        # copy to .cursor, .claude, .agents, plugin, dist
npm run build:dist   # dist/ only
npm run sync         # propagate package.json version/owner, then build
npm test             # offline guard: source skill, provider copies, init scaffold, metadata drift
```

## Key files

| File | Purpose |
|------|---------|
| `skills/redteam/SKILL.md` | Main skill router |
| `skills/redteam/reference/*.md` | Per-command flows |
| `skills/redteam/reference/ttp-catalog.md` | Source handbook technique catalog (civilian labels) |
| `skills/redteam/scripts/context.mjs` | Loads CONTEXT.md |
| `skills/redteam/scripts/init.mjs` | Creates `.redteam/` scaffold |
| `.redteam/config.json` | Project config |

## Conventions

- Decision context lives in `CONTEXT.md` (root or `.redteam/`)
- Reviews persist to `.redteam/reviews/<slug>-<command>.md`
- Commands are invoked as `/redteam <command> [target]` (29 commands)
- `package.json` is the single source of truth for version and repository owner; run `npm run sync` after changing either (`npm version` does it automatically); `npm test` fails on drift
- Install: `npx skills add DecisionNerd/RedTeam`; the source skill must stay install-ready (no `{{…}}` placeholders)
- Red teaming = applied critical thinking, NOT cybersecurity

## Do not

- Add penetration testing or exploit content
- Copy the full UFMCS v9 handbook verbatim into the repo
- Block scoped reviews when CONTEXT.md is missing
- Hand-edit version or GitHub owner strings — change `package.json` and run `npm run sync`
- Commit `.claude/plans/` or `.claude/agent-memory/` (gitignored)
- Reintroduce templating in `skills/redteam/` — the skills CLI installs it verbatim
