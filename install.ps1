# Agent Stack bootstrap — run from repo root on a new machine
$ErrorActionPreference = "Stop"

Write-Host "== agent-stack setup ==" -ForegroundColor Cyan

function Copy-Tree($src, $dst) {
    if (-not (Test-Path $src)) { Write-Warning "missing: $src"; return }
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item -Recurse -Force -Path "$src\*" -Destination $dst
    Write-Host "  copied -> $dst"
}

# 1. pi config
Copy-Tree "$PSScriptRoot\config\pi" "$HOME\.pi\agent"
# agents dir lives one level up from agent/
New-Item -ItemType Directory -Force -Path "$HOME\.pi\agents" | Out-Null
Copy-Item -Force "$PSScriptRoot\config\pi\agents\*" "$HOME\.pi\agents\" -ErrorAction SilentlyContinue

# 2. opencode config
Copy-Tree "$PSScriptRoot\config\opencode" "$HOME\.config\opencode"

# 3. skills (skip existing so local edits survive)
New-Item -ItemType Directory -Force -Path "$HOME\.agents\skills" | Out-Null
Get-ChildItem "$PSScriptRoot\skills" -Directory | ForEach-Object {
    $dst = Join-Path "$HOME\.agents\skills" $_.Name
    if (-not (Test-Path $dst)) {
        Copy-Item -Recurse -Force $_.FullName $dst
        Write-Host "  skill installed: $($_.Name)"
    } else {
        Write-Host "  skill exists, skipped: $($_.Name)" -ForegroundColor DarkGray
    }
}
# opencode-only skills
$ocSkills = "$HOME\.config\opencode\skills"
New-Item -ItemType Directory -Force -Path $ocSkills | Out-Null
Get-ChildItem "$PSScriptRoot\config\opencode-skills" -Directory | ForEach-Object {
    $dst = Join-Path $ocSkills $_.Name
    if (-not (Test-Path $dst)) {
        Copy-Item -Recurse -Force $_.FullName $dst
        Write-Host "  oc-skill installed: $($_.Name)"
    }
}

# 4. pi packages
Push-Location "$HOME\.pi\agent\npm"
if (-not (Test-Path package.json)) { Write-Error "~/.pi/agent/npm/package.json missing — copy step failed"; exit 1 }
npm install --legacy-peer-deps --no-audit --no-fund
Pop-Location

# 5. patches
$nm = "$HOME\.pi\agent\npm\node_modules"
git apply --check -p0 "$PSScriptRoot\patches\pi-cache-optimizer-nvidia-cachekey.patch" --directory="$nm/pi-cache-optimizer"
git apply -p0 "$PSScriptRoot\patches\pi-cache-optimizer-nvidia-cachekey.patch" --directory="$nm/pi-cache-optimizer"
Write-Host "  patched: pi-cache-optimizer (nvidia cache-key)"
git apply --check -p0 "$PSScriptRoot\patches\pi-subagents-retries-per-model.patch" --directory="$nm/pi-subagents"
git apply -p0 "$PSScriptRoot\patches\pi-subagents-retries-per-model.patch" --directory="$nm/pi-subagents"
Write-Host "  patched: pi-subagents (retries per model)"

# 6. retries env var
[Environment]::SetEnvironmentVariable("PI_SUBAGENT_RETRIES_PER_MODEL", "3", "User")
Write-Host "  env: PI_SUBAGENT_RETRIES_PER_MODEL=3"

Write-Host ""
Write-Host "Done. Launch pi once to rebuild model registry + authenticate providers." -ForegroundColor Green
