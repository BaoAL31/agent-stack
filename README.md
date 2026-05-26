# Agent Skills

Portable skill repository for AI coding assistants (opencode, Claude Code, etc.).

## Skills Included

| Directory | For | Description |
|---|---|---|
| `skills/caveman/` | opencode/Claude | Ultra-compressed communication mode (~75% token reduction) |
| `skills/cue/` | opencode/Claude | Socratic coding tutor — hints without writing solutions |
| `skills/find-skills/` | opencode/Claude | Discover and install agent skills by capability search |
| `skills/graphify/` | opencode | Knowledge graph from any input → HTML + JSON + audit |
| `skills/graphify-windows/` | Claude Code | Same graphify skill adapted for Windows + Claude Code |
| `skills/graphify-full/` | any | Full graphify Python package + skill files for all IDEs |
| `skills/grill-me/` | opencode/Claude | Stress-test plans by relentless Socratic interview |
| `skills/grill-with-docs/` | opencode/Claude | Grill plans + update CONTEXT.md/ADRs inline |
| `skills/handoff/` | opencode/Claude | Compact conversation into handoff doc for other agents |
| `skills/hone/` | opencode/Claude | Senior PR reviewer — correctness, complexity, maintainability |
| `skills/improve-codebase-architecture/` | opencode/Claude | Find refactoring opportunities, consolidate modules |
| `skills/ktdd/` | opencode/Claude | Karpathy-style guardrails + TDD (RED→GREEN→refactor) |
| `skills/latex-compile-qa/` | opencode/Claude | Compile LaTeX + QA (missing refs, bib errors, citations) |
| `skills/latex-paper-en/` | opencode/Claude | English LaTeX paper assistant (grammar, style, figures, etc.) |
| `skills/setup-matt-pocock-skills/` | opencode/Claude | Configure AGENTS.md + docs/agents for engineering skills |
| `skills/wikify/` | opencode/Claude | Generate Karpathy-style wiki from thesis/report/paper |

## Installation Instructions (for AI agents)

### opencode

Each skill is a directory containing a `SKILL.md` file. To install for opencode:

1. Copy the skill directory into `~/.config/opencode/skills/<skill-name>/`
2. The skill will be auto-discovered by opencode on next launch

**Example (single command):**
```powershell
# Clone this repo
git clone https://github.com/BaoAL31/skills.git

# Install all skills for opencode
Copy-Item -Recurse -Path "skills/skills/graphify" -Destination "$env:USERPROFILE\.config\opencode\skills\graphify"
Copy-Item -Recurse -Path "skills/skills/caveman" -Destination "$env:USERPROFILE\.config\opencode\skills\caveman"
# ... repeat for each skill
```

Or install only specific skills by copying individual directories.

### Claude Code

For Claude Code (Windows), skills go in `~/.claude/skills/<skill-name>/`:

```powershell
# Install graphify-windows for Claude Code
Copy-Item -Recurse -Path "skills/skills/graphify-windows" -Destination "$env:USERPROFILE\.claude\skills\graphify-windows"
```

### Other AI tools (Cline, Aider, Cursor, etc.)

See `skills/graphify-full/` for skill files targeting other IDEs (`skill-aider.md`, `skill-cursor.md`, `skill-vscode.md`, etc.). Adapt the same pattern — place the skill file or directory where your tool reads custom instructions.

## For Agent Use

When asked to install skills from this repo, the agent should:

1. **Clone**: `git clone https://github.com/BaoAL31/skills.git`
2. **Identify target**: Determine which AI tool the user runs (opencode, Claude Code, Cursor, etc.)
3. **Map paths**:
   - opencode: `~/.config/opencode/skills/<name>/`
   - Claude Code: `~/.claude/skills/<name>/`
   - Other: consult the tool's documentation
4. **Copy**: Transfer the desired `skills/<name>/` directory to the correct location
5. **Verify**: Check that `SKILL.md` (or equivalent) exists at the destination
