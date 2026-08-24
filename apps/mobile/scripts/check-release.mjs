import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)
const app = JSON.parse(await readFile(new URL("app.json", root), "utf8")).expo
const eas = JSON.parse(await readFile(new URL("eas.json", root), "utf8"))
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"))
const products = await readFile(new URL("lib/billing/store-products.ts", root), "utf8")
const billing = await readFile(new URL("components/dashboard/billing/BillingView.tsx", root), "utf8")
const metro = await readFile(new URL("metro.config.js", root), "utf8")
const apiBilling = await readFile(new URL("../api/src/modules/billing/billing.service.ts", root), "utf8")
const navigation = await readFile(new URL("components/dashboard/DashboardBottomNavigation.tsx", root), "utf8")
const mistakes = await readFile(new URL("components/dashboard/mistakes/MistakesView.tsx", root), "utf8")
const subjectMistakes = await readFile(new URL("components/dashboard/mistakes/SubjectMistakesView.tsx", root), "utf8")
const themeLesson = await readFile(new URL("components/dashboard/mistakes/ThemeLessonView.tsx", root), "utf8")

assert.equal(app.ios.bundleIdentifier, "com.sanjuniperodee.mobile")
assert.equal(app.android.package, app.ios.bundleIdentifier)
assert.match(app.version, /^\d+\.\d+\.\d+$/)
assert.ok(Number(app.ios.buildNumber) >= 3)
assert.ok(app.extra?.eas?.projectId)
assert.ok(app.plugins.some((plugin) => plugin === "react-native-iap"))
const imagePicker = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker")
assert.equal(imagePicker?.[1]?.microphonePermission, false)
assert.ok(!(app.android.permissions ?? []).includes("android.permission.RECORD_AUDIO"))
assert.equal(eas.build.production.android.buildType, "app-bundle")
assert.equal(eas.build.production.env.EXPO_PUBLIC_API_ORIGIN, "https://my-test.kz")
assert.equal(pkg.scripts["eas-build-post-install"], "npm --prefix ../../packages/shared run build")

for (const plan of ["starter", "basic", "pro", "premium"]) {
  assert.match(products, new RegExp(`${plan}:\\s*\"com\\.sanjuniperodee\\.mobile\\.`))
}
for (const productId of products.match(/com\.sanjuniperodee\.mobile\.[a-z.]+/g) ?? []) {
  assert.match(apiBilling, new RegExp(productId.replaceAll(".", "\\.")))
}
for (const route of ["/dashboard", "/dashboard/exams", "/dashboard/mistakes", "/dashboard/admission", "/dashboard/leaderboard", "/dashboard/stats", "/dashboard/history", "/dashboard/billing"]) {
  assert.ok(navigation.includes(`\"${route}\"`), `missing mobile dashboard route: ${route}`)
}
assert.match(billing, /const canUseKaspi = false/)
assert.doesNotMatch(billing, /mayAccessKaspiCommerce/)
assert.match(metro, /moduleName === "react"/)
assert.match(metro, /require\.resolve\(moduleName, \{ paths: \[projectRoot\] \}\)/)
assert.match(mistakes, /\/dashboard\/mistakes\/subjects\//)
assert.match(subjectMistakes, /\/dashboard\/mistakes\/themes\//)
assert.match(subjectMistakes, /\/ai\/mistakes\/analyze/)
assert.match(themeLesson, /\/ai\/mistakes\/theme-lesson/)
assert.match(themeLesson, /\/tests\/mistakes\/practice/)

console.log("MOBILE_RELEASE_CONTRACT_OK")
