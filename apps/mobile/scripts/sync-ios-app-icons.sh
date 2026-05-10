#!/usr/bin/env bash
# После `expo prebuild --clean` Expo часто оставляет только один слот 1024×1024 (universal) —
# на симуляторе/девайсе ярлык тогда пустой. Этот скрипт восстанавливает полный AppIcon.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/images/icon.png"
OUT="$ROOT/ios/mobile/Images.xcassets/AppIcon.appiconset"
mkdir -p "$OUT"

gen() { sips -z "$2" "$2" "$SRC" --out "$OUT/$1" >/dev/null; }
gen Icon-20@2x.png 40
gen Icon-20@3x.png 60
gen Icon-29@2x.png 58
gen Icon-29@3x.png 87
gen Icon-40@2x.png 80
gen Icon-40@3x.png 120
gen Icon-60@2x.png 120
gen Icon-60@3x.png 180
gen Icon-20@1x-ipad.png 20
gen Icon-29@1x-ipad.png 29
gen Icon-40@1x-ipad.png 40
gen Icon-76@1x.png 76
gen Icon-76@2x.png 152
gen Icon-83.5@2x.png 167
cp "$SRC" "$OUT/Icon-1024.png"

cat > "$OUT/Contents.json" << 'JSON'
{
  "images": [
    { "size": "20x20", "idiom": "iphone", "filename": "Icon-20@2x.png", "scale": "2x" },
    { "size": "20x20", "idiom": "iphone", "filename": "Icon-20@3x.png", "scale": "3x" },
    { "size": "29x29", "idiom": "iphone", "filename": "Icon-29@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "iphone", "filename": "Icon-29@3x.png", "scale": "3x" },
    { "size": "40x40", "idiom": "iphone", "filename": "Icon-40@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "iphone", "filename": "Icon-40@3x.png", "scale": "3x" },
    { "size": "60x60", "idiom": "iphone", "filename": "Icon-60@2x.png", "scale": "2x" },
    { "size": "60x60", "idiom": "iphone", "filename": "Icon-60@3x.png", "scale": "3x" },
    { "size": "20x20", "idiom": "ipad", "filename": "Icon-20@1x-ipad.png", "scale": "1x" },
    { "size": "20x20", "idiom": "ipad", "filename": "Icon-20@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "ipad", "filename": "Icon-29@1x-ipad.png", "scale": "1x" },
    { "size": "29x29", "idiom": "ipad", "filename": "Icon-29@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "ipad", "filename": "Icon-40@1x-ipad.png", "scale": "1x" },
    { "size": "40x40", "idiom": "ipad", "filename": "Icon-40@2x.png", "scale": "2x" },
    { "size": "76x76", "idiom": "ipad", "filename": "Icon-76@1x.png", "scale": "1x" },
    { "size": "76x76", "idiom": "ipad", "filename": "Icon-76@2x.png", "scale": "2x" },
    { "size": "83.5x83.5", "idiom": "ipad", "filename": "Icon-83.5@2x.png", "scale": "2x" },
    { "size": "1024x1024", "idiom": "ios-marketing", "filename": "Icon-1024.png", "scale": "1x" }
  ],
  "info": { "version": 1, "author": "bilimland" }
}
JSON

echo "OK: AppIcon обновлён в $OUT"
