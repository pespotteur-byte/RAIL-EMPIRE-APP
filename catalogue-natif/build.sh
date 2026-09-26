#!/usr/bin/env bash
# Compile l'application native Rail Empire Catalogue (WinForms, .NET Framework 4.0, x86)
# et assemble le paquet de distribution séparé du ZIP du jeu.
#   ./catalogue-natif/build.sh            -> catalogue-natif/dist/RailEmpireCatalogue-Win7-x86/
#   ./catalogue-natif/build.sh --zip      -> + catalogue-natif/dist/RailEmpireCatalogue-Win7-x86.zip
# Prérequis : mono-mcs (Linux) ou csc.exe du .NET Framework (Windows) ; node pour l'export du catalogue.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$HERE/dist/RailEmpireCatalogue-Win7-x86"
rm -rf "$OUT"; mkdir -p "$OUT/data"

node "$ROOT/scripts/export-native-catalog.mjs" --out="$HERE/data/catalog.native.json"

CSC=""
if command -v mcs >/dev/null 2>&1; then CSC="mcs -sdk:4"; elif command -v csc >/dev/null 2>&1; then CSC="csc"; else echo "Compilateur C# introuvable (mcs ou csc)" >&2; exit 1; fi

# shellcheck disable=SC2086
$CSC -target:winexe -platform:x86 -optimize+ -nologo -warn:3 \
  -r:System.dll -r:System.Core.dll -r:System.Windows.Forms.dll -r:System.Drawing.dll \
  -win32icon:"$HERE/app.ico" \
  -out:"$OUT/RailEmpireCatalogue.exe" \
  "$HERE/src/Program.cs" "$HERE/src/MainForm.cs" "$HERE/src/Model.cs" "$HERE/src/MiniJson.cs"

cat > "$OUT/RailEmpireCatalogue.exe.config" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <startup useLegacyV2RuntimeActivationPolicy="true">
    <supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.0"/>
    <supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.5"/>
  </startup>
  <runtime>
    <gcAllowVeryLargeObjects enabled="false"/>
  </runtime>
</configuration>
EOF

cp "$HERE/data/catalog.native.json" "$OUT/data/"
cp "$HERE/LIRE_MOI.txt" "$OUT/"
if [[ "${1:-}" == "--with-images" || "${2:-}" == "--with-images" ]]; then
  mkdir -p "$OUT/img"; cp -r "$ROOT/img/catalog" "$OUT/img/"
fi

echo "--- vérification architecture"
file "$OUT/RailEmpireCatalogue.exe"
if [[ "${1:-}" == "--zip" || "${2:-}" == "--zip" ]]; then
  (cd "$HERE/dist" && rm -f RailEmpireCatalogue-Win7-x86.zip && zip -qr RailEmpireCatalogue-Win7-x86.zip RailEmpireCatalogue-Win7-x86)
  ls -la "$HERE/dist/RailEmpireCatalogue-Win7-x86.zip"
fi
