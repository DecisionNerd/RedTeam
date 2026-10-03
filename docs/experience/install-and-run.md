# Install and run

## Observed need and evidence

Users must install the skill into their harness quickly. Install friction blocks every other experience. The skill source test (`npm test`) encodes the minimum file layout users depend on.

## Desired user and business outcome

A user runs one install command, reloads the harness, and can invoke `/redteam` commands within five minutes.

## Users and context

AI power users and contributors installing into Cursor, Claude, Codex, Agents, or via `npx skills add` from GitHub.

## Current journey

1. User runs `npx skills add DecisionNerd/RedTeam` (or copies skill / installs plugin)
2. The skills CLI detects harness directories, asks which agents to install to, then copies or symlinks `skills/redteam/` in and records the install in `skills-lock.json`
3. User reloads harness and runs `/redteam challenge`
4. When the user wants persistent context, `/redteam init` runs `scripts/init.mjs`, which creates the `.redteam/` scaffold (`reviews/`, `sessions/`, `config.json`, `CONTEXT.template.md`) if missing

## Opportunity and hypothesis

If install is one command with detected agents, adoption increases across harnesses without per-platform manuals.

## Intended behavior

The skills CLI places skill files, scripts, and templates; user can run commands after reload. `/redteam init` creates the `.redteam/` scaffold on demand.

## Given / When / Then scenarios

- **Given** a clean project directory with Node 22.12+
- **When** the user runs `npx skills add DecisionNerd/RedTeam -y --copy -a claude-code` (non-interactive flags used by `REDTEAM_E2E=1 npm test`; users run the bare `npx skills add DecisionNerd/RedTeam`)
- **Then** `.claude/skills/redteam/SKILL.md`, `reference/`, `scripts/context.mjs`, `scripts/init.mjs`, and `templates/` exist and `SKILL.md` has no `{{…}}` placeholders

- **Given** the skill is installed in a project with no `.redteam/` directory
- **When** the user runs `/redteam init` (which runs `scripts/init.mjs`), then runs it again
- **Then** the first run creates `.redteam/` (`reviews/`, `sessions/`, `config.json`, `CONTEXT.template.md`) and the second run changes nothing

- **Given** install from source
- **When** the maintainer runs `npm run build`
- **Then** skill copies to `.cursor`, `.claude`, `.agents`, `.github`, `.gemini`, and `plugin/` provider directories

- **Given** the skill is installed
- **When** the user runs `/redteam pin premortem`
- **Then** a pinned shortcut (`$premortem`) is available in the harness

## Constraints and domain language

- Skills-only package — markdown + small Node scripts; no server
- Node `>=22.12.0` for build and skill scripts

## Success signals and telemetry

- `npm test` passes in CI and locally
- Users report install-to-first-command under 5 minutes (qualitative)

## Open questions

- Resolved 2026-10-02: agent selection is delegated to the skills CLI prompts; docs show only the bare command.

## Related requirements, tests, architecture, and ADRs

- Requirements: FR-6, FR-7, FR-10, NFR-2, NFR-3
- Architecture: [Install flow](../engineering/ARCHITECTURE.md#install)
- Tests: `scripts/test-skill-source.mjs`, [`engineering/TESTING.md`](../engineering/TESTING.md)
