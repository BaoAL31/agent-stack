# Plugin Patches

Applied on top of npm-installed pi plugins. Reapply after every plugin update.

| Patch | Package | Version | Status | What it does |
|---|---|---|---|---|
| `pi-cache-optimizer-nvidia-cachekey.patch` | `pi-cache-optimizer` | 2.8.6 | **SUPERSEDED on >=2.8.10** | Stops injecting `prompt_cache_key` for NVIDIA NIM endpoints (integrate.api.nvidia.com rejects it with HTTP 400). Now handled natively: `config/pi/pi-cache-optimizer-config.json` (`promptCacheKey.omit`) deploys via install and needs no code patch. Per-model alternative inside pi: `/cache-optimizer fix prompt-cache-key`. |
| `pi-subagents-retries-per-model.patch` | `pi-subagents` | 0.56.0 | **RETIRED on >=0.68.0** | Added `PI_SUBAGENT_RETRIES_PER_MODEL` env var. Upstream removed `fallbackModels` and all same-launch model switching in 0.68.0 ("retry another model only with a later explicit launch"), so there is nothing to patch against. `settings.json` `agentOverrides` now carry a single `model` each. If upstream restores fallback switching, regenerate this patch — see git history of this folder for what changed. |
| `pi-nvidia-nim-glm53-catalog.patch` | `pi-nvidia-nim` (git package) | 1.1.23+ | **ACTIVE** | Adds `z-ai/glm-5.3` + `z-ai/glm-5.3-flash` to the curated catalog (thinking config, context/max-tokens, featured list). The old `z-ai/glm5` id returns HTTP 410 from NVIDIA. Applies inside `~/.pi/agent/git/github.com/xRyul/pi-nvidia-nim` (not `npm/node_modules`). Reapply after `pi update`. |

`PI_SUBAGENT_RETRIES_PER_MODEL` is still exported by the installers but inert until a fallback mechanism exists again.

> `promptCacheKey.omit` keys must be runtime `modelKey`s: pi builds them as
> `provider/id` where `id` is the registry **fullId**, which already contains
> the provider prefix — e.g. `nvidia/nvidia/nemotron-3.5-lightning-30b-a3b`.
> Extension-registered provider models that resolve as custom ids stay bare
> (e.g. `nvidia-nim/z-ai/glm-5.3`). When in doubt, run the model once and read
> the key from `/cache-optimizer` diagnostics instead of guessing.

## Apply

```powershell
# from repo root
$env:PI_NPM = "$HOME\.pi\agent\npm\node_modules"

# only if on pi-cache-optimizer <2.8.10 AND promptCacheKey.omit config is absent:
git apply -p0 "patches/pi-cache-optimizer-nvidia-cachekey.patch" --directory="$env:PI_NPM/pi-cache-optimizer"
```

Verify: `git apply --check` first if unsure. If a patch fails after a plugin update, regenerate it — see git history of this folder for what changed.
