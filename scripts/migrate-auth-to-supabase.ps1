# Run from the TexasNomad Games repository root in PowerShell.
# Connection strings are entered as secure input and are not written to disk.

$ErrorActionPreference = 'Stop'

function Read-SecretText([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required. Install Node.js 20 or newer, then reopen PowerShell.'
}

if (-not (Test-Path 'node_modules/pg/package.json')) {
  throw 'Dependencies are missing. Run: npm ci --legacy-peer-deps'
}

try {
  $env:NEON_DATABASE_URL = Read-SecretText 'Paste the Neon PRODUCTION database URI (input is hidden)'
  $env:SUPABASE_DATABASE_URL = Read-SecretText 'Paste the Supabase SESSION POOLER URI (input is hidden)'

  node scripts/migrate-auth-to-supabase.mjs
  if ($LASTEXITCODE -ne 0) {
    throw "Migration failed with exit code $LASTEXITCODE"
  }
}
finally {
  Remove-Item Env:NEON_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_DATABASE_URL -ErrorAction SilentlyContinue
}
