$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'home'
$html = Get-Content -LiteralPath (Join-Path $root 'index.html') -Raw -Encoding UTF8
$h1Markup = [regex]::Match($html, '(?is)<h1[^>]*>(.*?)</h1>').Groups[1].Value
$h1 = [System.Net.WebUtility]::HtmlDecode(([regex]::Replace($h1Markup, '<[^>]+>', '') -replace '\s+', ' ').Trim())
$assets = [System.Collections.Generic.List[object]]::new()
$external = [System.Collections.Generic.List[string]]::new()
function Check-Asset([string]$value, [string]$base) {
  if ($value -match '^(https?:|//)') { $external.Add($value); return }
  if ($value -match '^(data:|#|mailto:|tel:|javascript:)' -or !$value) { return }
  $clean = [uri]::UnescapeDataString(($value -split '[?#]')[0])
  $path = if ($clean.StartsWith('/')) { Join-Path $root $clean.TrimStart('/') } else { Join-Path $base $clean }
  $path = [IO.Path]::GetFullPath($path)
  if (!$path.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Resource outside archive' }
  $exists = Test-Path -LiteralPath $path -PathType Leaf
  $assets.Add([pscustomobject]@{ reference=$value; path=$path.Substring($root.Length+1); exists=$exists; sha256=$(if($exists){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower()}) })
}
foreach ($m in [regex]::Matches($html, '(?is)<(?:img|source|script|video)\b[^>]*?\b(?:src|poster)=["'']([^"'']+)["'']')) { Check-Asset $m.Groups[1].Value $root }
foreach ($m in [regex]::Matches($html, '(?is)<link\b[^>]*>')) {
  if ($m.Value -match 'rel=["'']stylesheet["'']' -and $m.Value -match 'href=["'']([^"'']+)["'']') { Check-Asset $Matches[1] $root }
}
foreach ($css in Get-ChildItem -LiteralPath (Join-Path $root 'assets\css') -Filter '*.css') {
  if (!($assets.path -contains $css.FullName.Substring($root.Length+1))) { continue }
  foreach ($m in [regex]::Matches((Get-Content -LiteralPath $css.FullName -Raw), 'url\(\s*["'']?([^\)"'']+)["'']?\s*\)')) { Check-Asset $m.Groups[1].Value.Trim() $css.DirectoryName }
}
$result = [ordered]@{scope='Static file existence and hash only; no browser or rendering'; index_sha256=(Get-FileHash -LiteralPath (Join-Path $root 'index.html') -Algorithm SHA256).Hash.ToLower(); h1=$h1; h1_matches=($h1 -ceq 'Projeto estrutural e projetos complementares.'); assets=$assets; missing=@($assets | Where-Object { !$_.exists }); external_resources=$external; limits='srcset, CSS imports and runtime requests not exhaustively checked; loading, decoding, layout and interactions unverified'}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'static-verification.json') -Encoding UTF8
[pscustomobject]@{h1=$h1; h1_matches=$result.h1_matches; index_sha256=$result.index_sha256; references=$assets.Count; missing=$result.missing.Count; external=$external.Count} | ConvertTo-Json
