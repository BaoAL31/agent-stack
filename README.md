# Agent Stack

Cross-machine setup for my AI coding-agent harnesses: **pi** (primary) and **opencode** (secondary). Skills, agent configs, plugin patches, and a one-shot bootstrap.

## Layout

```
skills/                 shared skills library (installed to ~/.agents/skills)
config/
  pi/                   pi coding-agent config      -> ~/.pi/agent/
  opencode/             opencode config             -> ~/.config/opencode/
  opencode-skills/      opencode-only skills        -> ~/.config/opencode/skills/
patches/                npm plugin patches (reapply after updates)
ralph-loop-loop/, rll/  legacy skill packs
```

## One-shot setup (new machine)

```powershell
# 1. Prerequisites
winget install GitHub.cli Git.Git Node.js
gh auth login

# 2. Clone + bootstrap
git clone https://github.com/BaoAL31/agent-stack.git
cd agent-stack
./install.ps1
```

`install.ps1` does:
1. Copies `config/pi/*` -> `~/.pi/agent/`
2. Copies `config/opencode/*` -> `~/.config/opencode/`
3. Copies `skills/*` -> `~/.agents/skills/` (skips existing)
4. Copies `config/opencode-skills/*` -> `~/.config/opencode/skills/`
5. Installs pi packages from the settings.json `packages` list (`npm i --legacy-peer-deps`)
6. Applies both plugin patches
7. Sets `PI_SUBAGENT_RETRIES_PER_MODEL=3` (user env var)

Then launch `pi` once — it auto-installs anything missing, rebuilds the model registry cache, and you log in per-provider on first use.

## Manual auth (per machine, never committed)

| What | Where |
|---|---|
| GitHub | `gh auth login` |
| pi providers (NVIDIA/OpenCode/OpenRouter keys) | first pi launch prompts, stored in `~/.pi/agent/auth.json` |
| CS2Archive `.env` | manual copy (FACEIT/YOUTUBE keys) |

## Subagent model routing (pi)

Configured in `config/pi/settings.json` under `subagents.agentOverrides`. All free tiers:

| Agent | Primary | Fallback order |
|---|---|---|
| delegate / scout | NVIDIA Nemotron Lightning | openrouter lightning:free → opencode lightning-free → mimo-free → hy3-free |
| oracle / worker | Ox Alpha (opencode-go) | openrouter ox-alpha → nvidia minimax-m3 → **nvidia ultra → openrouter ultra → opencode ultra** → nvidia super |
| reviewer | NVIDIA Ultra | same ultra trio in provider order → ox-alpha → minimax-m3 |
| researcher | NVIDIA Ultra | ultra trio → ox-alpha → muse-spark-free |

Rule: when a model exists on multiple providers, always order **NVIDIA → OpenRouter → OpenCode** (highest limits first).

Retries: each model gets up to 3 attempts on retryable failures (429/quota/timeout/overload) before moving down the chain — via the patched `pi-subagents` + env var above.

## Patches

See [patches/README.md](patches/README.md). Two patches, both required:

1. **pi-cache-optimizer**: don't send `prompt_cache_key` to NVIDIA NIM (400s otherwise)
2. **pi-subagents**: `PI_SUBAGENT_RETRIES_PER_MODEL` same-model retries

Re-apply after any plugin update. If a patch rejects, regenerate from diff against the new published version.

## Notes

- `auth.json`, `.env`, `node_modules/`, sessions are never committed
- `models-store.json` is a per-machine registry cache — rebuilt automatically
- WSL note: keep WSL healthy or uninstall it — a broken `System32\bash.exe` hijacks POSIX spawns from Node tools (cost me a day)
