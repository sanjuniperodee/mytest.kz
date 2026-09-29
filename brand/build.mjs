// Regenerates every logo/icon asset from brand/mark.mjs. Run: node brand/build.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { COLORS, WAYS, markSvg, tileMark } from "./mark.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const { chromium } = createRequire(join(root, "package.json"))("playwright")
const fonts = join(root, "node_modules/@expo-google-fonts/manrope")
const out = (...p) => join(root, ...p)
const write = async (path, data) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
  console.log("wrote", path.replace(root + "/", ""))
}

// about:blank can't load file:// fonts, so inline them.
const face = async (weight, dir) =>
  `@font-face{font-family:Manrope;font-weight:${weight};src:url(data:font/ttf;base64,${(
    await readFile(`${fonts}/${dir}/Manrope_${dir}.ttf`)
  ).toString("base64")})}`
const fontCss = (await Promise.all([face(400, "400Regular"), face(600, "600SemiBold"), face(700, "700Bold")])).join("\n")

const browser = await chromium.launch()
const page = await browser.newPage()

/** Renders html into a w×h box and returns PNG bytes (transparent unless the html paints a background). */
async function png(html, w, h) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(
    `<html><head><style>
      ${fontCss}
      html,body{margin:0;background:transparent}
    </style></head><body><div id="b" style="width:${w}px;height:${h}px;overflow:hidden">${html}</div></body></html>`,
  )
  await page.evaluate(() => document.fonts.ready)
  return page.locator("#b").screenshot({ omitBackground: true })
}
const square = (svg, px) => png(svg.replace(/width="64" height="64"/, `width="${px}" height="${px}"`), px, px)

// ---------- SVG sources ----------
const tileInk = tileMark("onInk")
await write(out("apps/web/public/icon.svg"), tileInk)
await write(out("apps/web/public/favicon.svg"), tileMark("onInk", { radius: 14, scale: 1.08 }))
await write(out("apps/admin/public/favicon.svg"), tileMark("onInk", { radius: 14, scale: 1.08 }))
await write(out("brand/mark-on-ink.svg"), tileInk)
await write(out("brand/mark-on-paper.svg"), tileMark("onPaper"))
await write(out("brand/mark-bare-ink.svg"), markSvg({ glyph: COLORS.ink, badge: COLORS.coralDeep, check: COLORS.paper }))
await write(out("brand/mark-bare-paper.svg"), markSvg({ glyph: COLORS.paper, badge: COLORS.coral, check: COLORS.ink }))

// ---------- Web ----------
const fav = (radius) => tileMark("onInk", { radius, scale: 1.08 })
for (const [name, px, r] of [
  ["favicon.png", 512, 14],
  ["icon-512x512.png", 512, 14],
  ["icon-192x192.png", 192, 14],
  ["icon-light-32x32.png", 32, 12],
]) await write(out("apps/web/public", name), await square(fav(r), px))
await write(out("apps/web/public/icon-dark-32x32.png"), await square(tileMark("onPaper", { radius: 12, scale: 1.08 }), 32))
// Apple applies its own mask: full-bleed square, no rounded corners.
await write(out("apps/web/public/apple-icon.png"), await square(tileMark("onInk", { radius: 0, scale: 1.02 }), 180))
// Maskable: glyph inside the central 80 % safe zone.
await write(out("apps/web/public/icon-maskable-512x512.png"), await square(tileMark("onInk", { radius: 0, scale: 0.86 }), 512))
await write(out("apps/admin/public/favicon.png"), await square(fav(14), 64))

// ---------- Mobile ----------
// iOS icon: opaque, full-bleed 1024 (iOS rounds it). No alpha channel is allowed by App Store Connect.
await write(out("apps/mobile/assets/images/icon.png"), await square(tileMark("onInk", { radius: 0, scale: 0.98 }), 1024))
// Android adaptive icon foreground: transparent, glyph inside the 66 % safe circle. Background colour comes from app.json.
await write(
  out("apps/mobile/assets/images/adaptive-icon.png"),
  await square(markSvg({ glyph: COLORS.paper, badge: COLORS.coral, check: COLORS.ink, scale: 0.7 }), 1024),
)
// Splash: bare glyph on the app's ink background.
await write(
  out("apps/mobile/assets/images/splash-icon.png"),
  await square(markSvg({ glyph: COLORS.paper, badge: COLORS.coral, check: COLORS.ink, scale: 0.62 }), 1024),
)
await write(out("apps/mobile/assets/images/favicon.png"), await square(fav(14), 48))
// In-app brand mark (theme aware): 3× of a 32 dp tile.
await write(out("apps/mobile/assets/images/logo-mark-light.png"), await square(tileMark("onInk", { radius: 15, scale: 1.08 }), 192))
await write(out("apps/mobile/assets/images/logo-mark-dark.png"), await square(tileMark("onPaper", { radius: 15, scale: 1.08 }), 192))

// ---------- Store listings ----------
await write(out("apps/mobile/store-assets/app-store-icon-1024.png"), await square(tileMark("onInk", { radius: 0, scale: 0.98 }), 1024))
await write(out("apps/mobile/store-assets/play-icon-512.png"), await square(tileMark("onInk", { radius: 0, scale: 0.98 }), 512))

const wordmark = (color, size) =>
  `<span style="font:700 ${size}px/1 Manrope,sans-serif;letter-spacing:-.03em;color:${color}">mytest</span>`
const feature = `
  <div style="width:1024px;height:500px;background:${COLORS.ink};position:relative;font-family:Manrope,sans-serif">
    <div style="position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:22px">
      <div style="display:flex;align-items:center;gap:22px">${tileMark("onPaper", { radius: 15, scale: 1.08, size: 110, id: "f" })}${wordmark(COLORS.paper, 92)}</div>
      <div style="font:600 34px/1.25 Manrope;color:${COLORS.paper};opacity:.92">Пробный ЕНТ<br>с разбором ошибок</div>
      <div style="font:400 22px Manrope;color:${COLORS.coral}">my-test.kz</div>
    </div>
    <div style="position:absolute;right:-70px;top:50%;transform:translateY(-50%);opacity:.14">${markSvg({ glyph: COLORS.paper, badge: COLORS.coral, check: COLORS.ink, size: 560, id: "g" })}</div>
  </div>`
await write(out("apps/mobile/store-assets/play-feature-graphic-1024x500.png"), await png(feature, 1024, 500))

// ---------- Social preview (Open Graph) ----------
const og = `
  <div style="width:1200px;height:630px;background:${COLORS.paper};position:relative;font-family:Manrope,sans-serif">
    <div style="position:absolute;inset:0;background:radial-gradient(900px 500px at 88% 8%, ${COLORS.coralDeep}22, transparent 60%)"></div>
    <div style="position:absolute;left:84px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:34px">
      <div style="display:flex;align-items:center;gap:30px">${tileMark("onInk", { radius: 15, scale: 1.08, size: 150, id: "o" })}${wordmark(COLORS.ink, 128)}</div>
      <div style="font:700 60px/1.12 Manrope;color:${COLORS.ink};letter-spacing:-.02em;max-width:900px">Пробные ЕНТ с&nbsp;разбором<br>каждой ошибки</div>
      <div style="display:flex;gap:14px">${["140 вопросов", "реальный таймер", "результат сразу"]
        .map((t) => `<span style="font:600 26px Manrope;color:${COLORS.ink};background:#fff;border:2px solid #DBD6CF;border-radius:999px;padding:12px 24px">${t}</span>`)
        .join("")}</div>
    </div>
    <div style="position:absolute;right:84px;bottom:64px;font:600 30px Manrope;color:${COLORS.coralDeep}">my-test.kz</div>
  </div>`
await write(out("apps/web/public/og-image.png"), await png(og, 1200, 630))

await browser.close()
