# AI Matrix Team · A five-seat AI delivery crew

English | [简体中文](README.md)

> **Delivery discipline for AI agents, not another flowchart for humans.** Five seats, five gates: case building → requirements & acceptance → code with quick calls → independent QA → release & rollback, plus a shared-surface gatekeeper. Every phase passes a machine gate; every handoff leaves an auditable trail.

AI Matrix Team is a virtual product-engineering task force. Requirements, product and design all the way to dev, QA and ops — each seat holds one gate. Too many agents burn tokens without moving the work; too few breed confusion and hallucinations. Five is just right.

## The crew

- **PC** (Delivery Director · Lead · Risk gatekeeper): Senior director at JD.com and the head of product-engineering. A Cantonese veteran — short hair, lean muscle, very much his own man. The gate of risk control? He holds it.
- **毛毛 Mao** (Senior Product Designer · BRD→PRD→interactive draft in one chain): Ex-JD.com. Product, interaction and visual design — three hats, one head. She has seen through it all: loves romance, wants no part in the grave of marriage.
- **Bruce** (Senior Development Engineer · Architecture quick calls): Ex-Meituan full-stack warrior from Maoming, Guangdong. Coding all day is not enough — he also hikes and plays football.
- **石头 Xue** (Senior QA Engineer · Independent audit): Senior engineer at ZTO Express, from Rongxian, Guangxi. Eyes open, a thousand bugs spotted. Want an authentic Shatian pomelo? Ask him.
- **波波 Bo** (Senior DevOps Engineer · Release & rollback): CEO of a company, and a DevOps engineer. Two decades in Xi'an, among the first batch of software engineers of the 80s generation. Code and liquor are the only two antidotes in his life.

## Install: paste the prompt to your agent

**Regular agents (Codex / Claude Code) install it as a skill; WorkBuddy installs the whole expert team.** Copy one block below and paste it into the right chat — the agent does the rest.

**Codex** (into `~/.codex/skills/` or the project's `.agents/skills/`):

```text
Install https://github.com/aispin/ai-matrix-team as a skill: clone it into ~/.codex/skills/ai-matrix-team, then read its SKILL.md and tell me how to use it
```

**Claude Code** (into `~/.claude/skills/` or the project's `.claude/skills/`):

```text
Install https://github.com/aispin/ai-matrix-team as a skill: clone it into ~/.claude/skills/ai-matrix-team, then read its SKILL.md and tell me how to use it
```

**WorkBuddy** (expert-team form, the whole crew onboards):

```text
Install the AI Matrix Team expert team: https://github.com/aispin/ai-matrix-team — follow SKILL.md to onboard this project (project profile, skill symlinks, expert packages), then run a gate check
```

You can also search "AI Matrix Team" in the WorkBuddy **Expert Center** and enable it directly.

## Usage: say what you want

Once installed, you only make two kinds of calls — **state the need, make the decisions**. The gates are machine-enforced:

```text
Onboard a new app — run the full pipeline from business case to release
```

PC opens the work order (WO) and dispatches seat by seat: Mao writes BRD→PRD→design draft, Bruce builds to spec, Xue runs independent acceptance, Bo owns the release. Every phase passes a machine gate; decisions that are yours get pinged to you, and everything lands in the handoff ledger.

Landing page (capabilities & crew, live): **https://aispin.github.io/ai-matrix-team/**

## For source readers

This repo is decoupled from specific projects: the governance engine, role sources, seat skills and the console live here; WO/DR ledgers, project profiles and surface rules live in the target project's thin `.ai-matrix-team/` layer. Onboarding details are in [`SKILL.md`](SKILL.md).

```text
├── SKILL.md            installer skill (the agent reads this to onboard/upgrade/check)
├── members/            role sources (five seats, one file each)
├── aimatrix-*/         seat skills (9: 6 roles + architect deep-read + guardian gate + guard/decision tools)
├── scripts/            CLIs: guard gates · inspect sweeps · expert-sync packaging · init · install · DR toolchain
├── docs/               governance specs 01-08 + index cards + templates
├── dashboard/          the console (Vite + React, reads the project thin layer via --project)
├── promo-page/         landing page source (published to the gh-pages branch)
└── assets/             team overview art + avatars
```

Manual onboarding (the agent does this automatically; for those who want to run it by hand):

```bash
node <repo>/scripts/aimatrix-init.mjs --project <project-root>        # 1. project profile
node <repo>/scripts/install-to-workbuddy.mjs --project <project-root> # 2. skill symlinks
node <repo>/scripts/expert-sync.mjs                                   # 3. expert packages (first time)
node <repo>/scripts/aimatrix-guard.mjs agents --project <project-root> # 4. gate check
```

Day-to-day gates:

```bash
node <repo>/scripts/aimatrix-guard.mjs --project <project-root> surface <paths...>   # classify surfaces
node <repo>/scripts/aimatrix-guard.mjs --project <project-root> check --wo <id> --paths <paths...>
node <repo>/scripts/aimatrix-guard.mjs --project <project-root> dr scan --blocking --wo <id>
```

Start from the index cards in [`docs/index/`](docs/index/); the charter is [`docs/01-charter.md`](docs/01-charter.md).
