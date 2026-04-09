# Downloads the Google Fonts used by the subtitle templates into worker/fonts/.
# Run from Windows PowerShell:
#   cd C:\allsaas\subs\worker
#   .\download_fonts.ps1
#
# If you get an execution policy error, run it once-off with:
#   powershell -ExecutionPolicy Bypass -File .\download_fonts.ps1

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$fontsDir  = Join-Path $scriptDir "fonts"

# Make sure the destination exists
New-Item -ItemType Directory -Force -Path $fontsDir | Out-Null

# Font files to fetch. Each entry: [target filename, raw URL].
# - Poppins ships as static per-weight files in the google/fonts repo.
# - Inter and Roboto ship only as variable fonts in google/fonts, but their
#   internal Family name (TTF nameID 1) is still the plain family, so libass
#   picks them up correctly.
# - Montserrat's variable font reports Family='Montserrat Thin' (the default
#   instance), which breaks libass lookups for "Montserrat". We grab static
#   per-weight files from the upstream JulietaUla/Montserrat repo instead.
$fonts = @(
    # Target filenames avoid [ ] because Invoke-WebRequest -OutFile treats
    # brackets as wildcard patterns. libass identifies fonts by their internal
    # family name, so the on-disk filename is irrelevant.
    @{ Name = "Inter-VF.ttf";             Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf" },
    @{ Name = "Roboto-VF.ttf";            Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf" },
    @{ Name = "Montserrat-Regular.ttf";   Url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf" },
    @{ Name = "Montserrat-Medium.ttf";    Url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Medium.ttf" },
    @{ Name = "Montserrat-SemiBold.ttf";  Url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-SemiBold.ttf" },
    @{ Name = "Montserrat-Bold.ttf";      Url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Bold.ttf" },
    @{ Name = "Montserrat-Black.ttf";     Url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Black.ttf" },
    @{ Name = "Poppins-Regular.ttf";      Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf" },
    @{ Name = "Poppins-Medium.ttf";       Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Medium.ttf" },
    @{ Name = "Poppins-SemiBold.ttf";     Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-SemiBold.ttf" },
    @{ Name = "Poppins-Bold.ttf";         Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf" },
    @{ Name = "Poppins-Black.ttf";        Url = "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Black.ttf" }
)

# Stale files to remove before downloading. These had wrong internal family
# metadata or were replaced by static-weight files.
$staleFiles = @(
    "Montserrat-VF.ttf"
)

Write-Host ""
Write-Host "Downloading fonts into $fontsDir" -ForegroundColor Cyan
Write-Host ""

# Force TLS 1.2 -- older PowerShell defaults can break https to raw.githubusercontent.com
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Remove any stale files left over from previous versions of this script.
foreach ($stale in $staleFiles) {
    $stalePath = Join-Path $fontsDir $stale
    if (Test-Path $stalePath) {
        Remove-Item $stalePath -Force -ErrorAction SilentlyContinue
        Write-Host "  [clean] removed stale $stale" -ForegroundColor DarkYellow
    }
}

$ok    = 0
$fail  = 0
$skip  = 0

foreach ($font in $fonts) {
    $dest = Join-Path $fontsDir $font.Name

    if (Test-Path $dest) {
        $existingSize = (Get-Item $dest).Length
        if ($existingSize -gt 0) {
            Write-Host "  [skip]  $($font.Name)  (already exists, $existingSize bytes)" -ForegroundColor DarkGray
            $skip++
            continue
        }
    }

    try {
        Invoke-WebRequest -Uri $font.Url -OutFile $dest -UseBasicParsing
        $size = (Get-Item $dest).Length
        if ($size -lt 1024) {
            throw "File is only $size bytes -- download likely failed"
        }
        Write-Host "  [ok]    $($font.Name)  ($size bytes)" -ForegroundColor Green
        $ok++
    } catch {
        Write-Host "  [fail]  $($font.Name)  -> $($_.Exception.Message)" -ForegroundColor Red
        if (Test-Path $dest) { Remove-Item $dest -Force -ErrorAction SilentlyContinue }
        $fail++
    }
}

Write-Host ""
Write-Host "Done. $ok downloaded, $skip skipped, $fail failed." -ForegroundColor Cyan

if ($fail -gt 0) {
    Write-Host "Some downloads failed. Re-run the script or download the missing files manually from https://fonts.google.com" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "The worker will pick these up automatically on the next render." -ForegroundColor Green
Write-Host "You should see this line in the worker logs:" -ForegroundColor Green
Write-Host "  [Rendering] Using bundled fonts dir: ..." -ForegroundColor DarkGray
