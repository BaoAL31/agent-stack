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

# 5. patches (see patches/README.md for status)
$nm = "$HOME\.pi\agent\npm\node_modules"
# pi-cache-optimizer code patch is SUPERSEDED on >=2.8.10 by
# config/pi/pi-cache-optimizer-config.json (promptCacheKey.omit, copied in step 1).
# Apply the old code patch only on <2.8.10 without the omit config.
$omitCfg = "$HOME\.pi\agent\pi-cache-optimizer-config.json"
$coVer = try { [version]((Get-Content "$nm\pi-cache-optimizer\package.json" -Raw | ConvertFrom-Json).version) } catch { $null }
if (($coVer -ne $null) -and ($coVer -lt [version]"2.8.10") -and (-not (Test-Path $omitCfg))) {
    git apply --check -p0 "$PSScriptRoot\patches\pi-cache-optimizer-nvidia-cachekey.patch" --directory="$nm/pi-cache-optimizer"
    git apply -p0 "$PSScriptRoot\patches\pi-cache-optimizer-nvidia-cachekey.patch" --directory="$nm/pi-cache-optimizer"
    Write-Host "  patched: pi-cache-optimizer (nvidia cache-key)"
} else {
    Write-Host "  skip pi-cache-optimizer code patch (native omit config covers >=2.8.10)" -ForegroundColor DarkGray
}
# pi-subagents retries patch is RETIRED: upstream 0.68.0 removed fallbackModels
# and all same-launch model switching, so there is nothing to patch against.
Write-Host "  skip pi-subagents patch (retired upstream, see patches/README.md)" -ForegroundColor DarkGray

# 6. retries env var
[Environment]::SetEnvironmentVariable("PI_SUBAGENT_RETRIES_PER_MODEL", "3", "User")
Write-Host "  env: PI_SUBAGENT_RETRIES_PER_MODEL=3"

Write-Host ""
Write-Host "Done. Launch pi once to rebuild model registry + authenticate providers." -ForegroundColor Green
