$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outPath = Join-Path $root "InvoiceHub_Project_Presentation.pptx"
$zipPath = Join-Path $root "InvoiceHub_Project_Presentation.zip"
$tmp = Join-Path $env:TEMP ("invoicehub-pptx-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $tmp | Out-Null

function Write-Utf8($path, $content) {
  $full = Join-Path $tmp $path
  $dir = Split-Path $full -Parent
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  [System.IO.File]::WriteAllText($full, $content, [System.Text.UTF8Encoding]::new($false))
}

function XmlEscape($text) {
  [System.Security.SecurityElement]::Escape([string]$text)
}

function TextBoxXml($id, $name, $x, $y, $cx, $cy, $text, $fontSize, $color, $bold = $false) {
  $boldXml = if ($bold) { '<a:b/>' } else { '' }
  $paras = foreach ($line in @([string]$text -split "`n")) {
    '<a:p><a:r><a:rPr lang="en-US" sz="' + ([int]($fontSize * 100)) + '">' + $boldXml + '<a:solidFill><a:srgbClr val="' + $color + '"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>' + (XmlEscape $line) + '</a:t></a:r><a:endParaRPr lang="en-US" sz="' + ([int]($fontSize * 100)) + '"/></a:p>'
  }

  '<p:sp><p:nvSpPr><p:cNvPr id="' + $id + '" name="' + $name + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + $x + '" y="' + $y + '"/><a:ext cx="' + $cx + '" cy="' + $cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>' + ($paras -join '') + '</p:txBody></p:sp>'
}

function RectXml($id, $name, $x, $y, $cx, $cy, $fill, $alpha = 100000, $line = "") {
  $lineXml = if ($line) {
    '<a:ln w="12700"><a:solidFill><a:srgbClr val="' + $line + '"/></a:solidFill></a:ln>'
  } else {
    '<a:ln><a:noFill/></a:ln>'
  }

  '<p:sp><p:nvSpPr><p:cNvPr id="' + $id + '" name="' + $name + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + $x + '" y="' + $y + '"/><a:ext cx="' + $cx + '" cy="' + $cy + '"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="' + $fill + '"><a:alpha val="' + $alpha + '"/></a:srgbClr></a:solidFill>' + $lineXml + '</p:spPr></p:sp>'
}

function SlideXml($title, $subtitle, $bullets, $accent = "10B981") {
  $shapes = @()
  $shapes += RectXml 2 "Background" 0 0 12192000 6858000 "07111F" 100000
  $shapes += RectXml 3 "Accent Bar" 0 0 12192000 285750 "123B5D" 100000
  $shapes += RectXml 4 "Glow" 9144000 457200 2286000 2286000 $accent 13000
  $shapes += TextBoxXml 5 "Eyebrow" 685800 571500 3657600 365760 "InvoiceHub" 14 $accent $true
  $shapes += TextBoxXml 6 "Title" 685800 1066800 5943600 1371600 $title 36 "FFFFFF" $true
  $shapes += TextBoxXml 7 "Subtitle" 685800 2362200 5486400 731520 $subtitle 18 "C7D2FE"

  $y = 3352800
  $i = 0
  foreach ($bullet in $bullets) {
    $i++
    $shapes += RectXml (20 + $i) "Bullet Dot $i" 777240 ($y + 68580) 137160 137160 $accent 100000
    $shapes += TextBoxXml (40 + $i) "Bullet $i" 1005840 $y 9448800 457200 $bullet 18 "E5E7EB"
    $y += 640080
  }

  $shapes += TextBoxXml 90 "Footer" 685800 6400800 5029200 274320 "Invoicing - Payments - WhatsApp communication - Reporting" 10 "94A3B8"

  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + ($shapes -join "`n") + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
}

function TitleSlideXml() {
  $shapes = @()
  $shapes += RectXml 2 "Background" 0 0 12192000 6858000 "07111F" 100000
  $shapes += RectXml 3 "Panel" 6400800 914400 4572000 4572000 "123B5D" 70000 "1E3A5F"
  $shapes += RectXml 4 "Accent" 685800 685800 731520 731520 "10B981" 100000
  $shapes += TextBoxXml 5 "Brand" 1592580 731520 3657600 457200 "InvoiceHub" 26 "FFFFFF" $true
  $shapes += TextBoxXml 6 "Title" 685800 1600200 5715000 2057400 "Invoice and payment collection platform" 44 "FFFFFF" $true
  $shapes += TextBoxXml 7 "Subtitle" 685800 3802380 5486400 822960 "A modern workspace for generating invoices, collecting payments, tracking confirmations, and sending WhatsApp communication." 20 "D1D5DB"
  $shapes += TextBoxXml 8 "Panel Title" 6858000 1371600 3657600 640080 "Project Overview" 24 "FFFFFF" $true
  $shapes += TextBoxXml 9 "Panel Body" 6858000 2209800 3505200 1828800 "Built for schools and businesses that need direct payment collection, customer records, QR payment forms, recurring invoices, and operational messaging from one dashboard." 17 "E5E7EB"
  $shapes += TextBoxXml 10 "Date" 685800 6096000 3657600 365760 "Prepared July 2026" 13 "94A3B8"

  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + ($shapes -join "`n") + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
}

$slides = @(
  @{ title = "Problem and opportunity"; subtitle = "Many businesses can create invoices, but struggle to track payment readiness, follow up customers, and keep records clean."; bullets = @("Payment confirmation is scattered across gateways, messages, and manual notes.", "Customers need a simple way to open a payment page, enter details, and pay.", "Teams need visibility into unpaid invoices, expected revenue, and WhatsApp delivery status.") },
  @{ title = "What InvoiceHub provides"; subtitle = "A single workspace for invoice generation, payment collection setup, customer records, and communication."; bullets = @("Create invoices for individual customers or grouped student categories.", "Track expected revenue, collected revenue, unpaid invoices, and payment history.", "Use QR payment profiles where customers enter phone number and amount on a public form.", "Configure payment gateways from settings without changing production environment variables.") },
  @{ title = "Core dashboard modules"; subtitle = "InvoiceHub is organized around the operational workflow users repeat every day."; bullets = @("Dashboard: summary cards, expected revenue, WhatsApp connection status, and alerts.", "Invoices: regular invoices, recurring invoices, reminders, category filters, and WhatsApp sharing.", "Student/customer groups: categories, bulk invoice generation, Excel import, rename/delete categories.", "Communication: bulk WhatsApp messages by category and bridge status tools.") },
  @{ title = "Payments and gateway flow"; subtitle = "Businesses connect their own payment provider and customer payments go directly through that provider."; bullets = @("Monnify and PayAza configuration is available from business settings.", "Users can verify gateway connection after entering credentials.", "Payment history includes search, status filters, start/end date filters, and CSV export.", "InvoiceHub tracks references, confirmation status, provider, and receipt notification state.") },
  @{ title = "QR payment experience"; subtitle = "QR codes open a payment form instead of exposing a raw link to customers."; bullets = @("Customer scans QR and lands on the public payment form.", "Customer enters WhatsApp phone number and amount.", "The selected payment gateway creates checkout or virtual account details.", "Successful QR payments are recorded and can trigger WhatsApp confirmation messages.") },
  @{ title = "WhatsApp communication"; subtitle = "The platform supports automated messaging through a WhatsApp Web bridge."; bullets = @("Admin can set a global bridge URL, port, and API key for all users.", "Each dashboard shows connected or disconnected WhatsApp status.", "Users can send test messages and bulk messages to selected categories.", "If disconnected, the dashboard can display QR reconnect information.") },
  @{ title = "Admin and platform controls"; subtitle = "The admin dashboard gives oversight across business users and shared platform services."; bullets = @("Monitor total businesses, invoice health, payment readiness, and WhatsApp bridge status.", "Configure global WhatsApp bridge settings that apply to every business user.", "Review businesses, users, invoices, payments, and gateway readiness.", "Separate admin authentication uses its own JWT secret and credentials.") },
  @{ title = "Security and reliability"; subtitle = "The project includes several safeguards and known improvement areas."; bullets = @("Sensitive gateway fields are encrypted before storage when an encryption key is configured.", "Users are logged out after five minutes of dashboard inactivity.", "Dependency audit found xlsx risk; recommended mitigation is CSV-only import or replacing xlsx.", "Long-term auth hardening: move tokens from localStorage to httpOnly secure cookies.") },
  @{ title = "Deployment model"; subtitle = "InvoiceHub runs as a Next.js application, while WhatsApp bridge can run separately."; bullets = @("Main app: deploy to Vercel or another Node-compatible platform.", "Database: MongoDB connection through environment variables.", "WhatsApp bridge: host on Render/VPS or local machine; always-on requires server hosting.", "For production QR links, configure NEXT_PUBLIC_APP_URL to the public app URL.") },
  @{ title = "Next steps"; subtitle = "Recommended priorities to make InvoiceHub stronger for real business usage."; bullets = @("Replace vulnerable xlsx dependency or limit imports to CSV.", "Stabilize hosted WhatsApp bridge on a paid/always-on VPS for multi-user use.", "Move authentication to httpOnly cookies and add password reset flow.", "Add gateway webhook hardening, audit logs, and richer payment reconciliation reports.") }
)

Write-Utf8 "ppt/slides/slide1.xml" (TitleSlideXml)
for ($idx = 0; $idx -lt $slides.Count; $idx++) {
  $slide = $slides[$idx]
  Write-Utf8 ("ppt/slides/slide" + ($idx + 2) + ".xml") (SlideXml $slide.title $slide.subtitle $slide.bullets)
}

for ($i = 1; $i -le ($slides.Count + 1); $i++) {
  Write-Utf8 "ppt/slides/_rels/slide$i.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'
}

$slideOverrides = (1..($slides.Count + 1) | ForEach-Object {
  '<Override PartName="/ppt/slides/slide' + $_ + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
}) -join ""
$slideIds = (1..($slides.Count + 1) | ForEach-Object {
  '<p:sldId id="' + (255 + $_) + '" r:id="rId' + $_ + '"/>'
}) -join ""
$slideRels = (1..($slides.Count + 1) | ForEach-Object {
  '<Relationship Id="rId' + $_ + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + $_ + '.xml"/>'
}) -join ""
$masterRelId = "rId" + ($slides.Count + 2)
$themeRelId = "rId" + ($slides.Count + 3)

Write-Utf8 "[Content_Types].xml" ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' + $slideOverrides + '</Types>')
Write-Utf8 "_rels/.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
Write-Utf8 "docProps/core.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>InvoiceHub Project Presentation</dc:title><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-07-04T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-04T00:00:00Z</dcterms:modified></cp:coreProperties>'
Write-Utf8 "docProps/app.xml" ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft PowerPoint</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>' + ($slides.Count + 1) + '</Slides><Company>InvoiceHub</Company></Properties>')
Write-Utf8 "ppt/presentation.xml" ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="' + $masterRelId + '"/></p:sldMasterIdLst><p:sldIdLst>' + $slideIds + '</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>')
Write-Utf8 "ppt/_rels/presentation.xml.rels" ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + $slideRels + '<Relationship Id="' + $masterRelId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="' + $themeRelId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>')
Write-Utf8 "ppt/slideMasters/slideMaster1.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'
Write-Utf8 "ppt/slideMasters/_rels/slideMaster1.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'
Write-Utf8 "ppt/slideLayouts/slideLayout1.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
Write-Utf8 "ppt/slideLayouts/_rels/slideLayout1.xml.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'
Write-Utf8 "ppt/theme/theme1.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="InvoiceHub"><a:themeElements><a:clrScheme name="InvoiceHub"><a:dk1><a:srgbClr val="07111F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="123B5D"/></a:dk2><a:lt2><a:srgbClr val="E5E7EB"/></a:lt2><a:accent1><a:srgbClr val="10B981"/></a:accent1><a:accent2><a:srgbClr val="2563EB"/></a:accent2><a:accent3><a:srgbClr val="F97316"/></a:accent3><a:accent4><a:srgbClr val="8B5CF6"/></a:accent4><a:accent5><a:srgbClr val="0EA5E9"/></a:accent5><a:accent6><a:srgbClr val="EF4444"/></a:accent6><a:hlink><a:srgbClr val="60A5FA"/></a:hlink><a:folHlink><a:srgbClr val="A78BFA"/></a:folHlink></a:clrScheme><a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="InvoiceHub"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'

if (Test-Path $outPath) { Remove-Item -LiteralPath $outPath -Force }
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $outPath -Force
Remove-Item -LiteralPath $tmp -Recurse -Force

Write-Output $outPath
