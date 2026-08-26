# Plugin Patches

Applied on top of npm-installed pi plugins. Reapply after every plugin update.

| Patch | Package | Version | What it does |
|---|---|---|---|
| `pi-cache-optimizer-nvidia-cachekey.patch` | `pi-cache-optimizer` | 2.8.6 | Stops injecting `prompt_cache_key` for NVIDIA NIM endpoints (integrate.api.nvidia.com rejects it with HTTP 400) |
| `pi-subagents-retries-per-model.patch` | `pi-subagents` | 0.56.0 | Adds `PI_SUBAGENT_RETRIES_PER_MODEL` env var — retries each model N times before falling back to the next (clamped 1-5, default 1=off) |

## Apply

```powershell
# from repo root
$env:PI_NPM = "$HOME\.pi\agent\npm\node_modules"

git apply -p0 "patches/pi-cache-optimizer-nvidia-cachekey.patch" --directory="$env:PI_NPM/pi-cache-optimizer"
git apply -p0 "patches/pi-subagents-retries-per-model.patch" --directory="$env:PI_NPM/pi-subagents"
```

Verify: `git apply --check` first if unsure. If a patch fails after a plugin update, regenerate it — see git history of this folder for what changed.
