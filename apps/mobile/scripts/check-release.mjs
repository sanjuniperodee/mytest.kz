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
const navigation = await readFile(new URL("components/dashboard/nav-config.ts", root), "utf8")
const webLegal = await readFile(new URL("../web/lib/legal-content.ts", root), "utf8")
const mobileLegal = await readFile(new URL("lib/legal/content.ts", root), "utf8")
const login = await readFile(new URL("app/(auth)/login.tsx", root), "utf8")
const google = await readFile(new URL("components/auth/GoogleSignInButton.tsx", root), "utf8")
const profile = await readFile(new URL("components/profile/ProfileView.tsx", root), "utf8")
const conversation = await readFile(new URL("components/community/Conversation.tsx", root), "utf8")
const posts = await readFile(new URL("components/community/PostList.tsx", root), "utf8")
const gate = await readFile(new URL("components/community/CommunityGate.tsx", root), "utf8")
const client = await readFile(new URL("lib/api/client.ts", root), "utf8")
const mistakes = await readFile(new URL("components/dashboard/mistakes/MistakesView.tsx", root), "utf8")
const subjectMistakes = await readFile(new URL("components/dashboard/mistakes/SubjectMistakesView.tsx", root), "utf8")
const themeLesson = await readFile(new URL("components/dashboard/mistakes/ThemeLessonView.tsx", root), "utf8")
const studyThemes = await readFile(new URL("components/dashboard/mistakes/StudyThemes.tsx", root), "utf8")
const practiceSheet = await readFile(new URL("components/dashboard/mistakes/PracticeSheet.tsx", root), "utf8")

assert.equal(app.ios.bundleIdentifier, "com.sanjuniperodee.mobile")
assert.equal(app.android.package, app.ios.bundleIdentifier)
assert.match(app.version, /^\d+\.\d+\.\d+$/)
assert.ok(Number(app.ios.buildNumber) >= 3)
assert.ok(app.extra?.eas?.projectId)
assert.ok(app.plugins.some((plugin) => plugin === "react-native-iap"))
const imagePicker = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker")
assert.equal(imagePicker?.[1]?.microphonePermission, false)
// Voice messages are the only reason to touch the microphone: the purpose string must say so.
const audio = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-audio")
assert.match(audio?.[1]?.microphonePermission ?? "", /голосов/i)
assert.match(audio?.[1]?.microphonePermission ?? "", /voice messages/i)
assert.match(imagePicker?.[1]?.photosPermission ?? "", /Photos/)
// Location was only used to pick a login form; it is no longer requested at all.
assert.ok(!app.plugins.some((plugin) => plugin === "expo-location" || (Array.isArray(plugin) && plugin[0] === "expo-location")))
assert.ok(!(app.android.permissions ?? []).some((permission) => /LOCATION/.test(permission)))
assert.equal(app.ios.infoPlist.NSLocationWhenInUseUsageDescription, undefined)
assert.equal(pkg.dependencies["expo-location"], undefined)
assert.equal(eas.build.production.android.buildType, "app-bundle")
assert.equal(eas.build.production.env.EXPO_PUBLIC_API_ORIGIN, "https://my-test.kz")
assert.equal(pkg.scripts["eas-build-post-install"], "npm --prefix ../../packages/shared run build")

for (const plan of ["starter", "basic", "pro", "premium"]) {
  assert.match(products, new RegExp(`${plan}:\\s*\"com\\.sanjuniperodee\\.mobile\\.`))
}
for (const productId of products.match(/com\.sanjuniperodee\.mobile\.[a-z.]+/g) ?? []) {
  assert.match(apiBilling, new RegExp(productId.replaceAll(".", "\\.")))
}
for (const route of ["/dashboard", "/dashboard/exams", "/dashboard/mistakes", "/dashboard/community", "/dashboard/community/people", "/dashboard/messages", "/dashboard/global-chat", "/dashboard/admission", "/dashboard/leaderboard", "/dashboard/stats", "/dashboard/history", "/dashboard/billing", "/dashboard/profile"]) {
  assert.ok(navigation.includes(`\"${route}\"`), `missing mobile dashboard route: ${route}`)
}
assert.match(billing, /const canUseKaspi = false/)
assert.doesNotMatch(billing, /mayAccessKaspiCommerce/)
assert.match(metro, /moduleName === "react"/)
assert.match(metro, /require\.resolve\(moduleName, \{ paths: \[projectRoot\] \}\)/)
assert.match(mistakes, /\/dashboard\/mistakes\/subjects\//)
assert.match(studyThemes, /\/dashboard\/mistakes\/themes\//)
assert.match(studyThemes, /study-map\/prepare/, "AI themes must be prepared only on request")
assert.match(subjectMistakes, /\/ai\/mistakes\/analyze/)
assert.match(themeLesson, /\/ai\/mistakes\/theme-lesson/)
assert.match(practiceSheet, /\/tests\/mistakes\/practice/)
assert.match(themeLesson, /\/ai\/mistakes\/themes\//)

// One profile page for everyone, community rules before any user content, moderation tools in reach.
for (const screen of ["profile/index.tsx", "profile/[id].tsx", "community/index.tsx", "community/post/[id].tsx", "community/people.tsx", "community/invite/[token].tsx", "messages/index.tsx", "messages/[id].tsx", "global-chat.tsx"]) {
  await readFile(new URL(`app/(app)/dashboard/${screen}`, root), "utf8")
}
assert.match(gate, /mytest-community-rules/)
assert.match(profile, /\/users\/me", \{ method: "DELETE" \}/, "account deletion must stay reachable in the app")
assert.match(profile, /setBlocked/)
assert.match(posts, /\/report`/)
assert.match(conversation, /messages\/\$\{reporting\.id\}\/report/)
assert.match(conversation, /setBlocked/)
// Sign in with Apple is required if a third-party login is offered on iOS, so Google is Android-only.
assert.match(google, /Platform\.OS === "android"/)
assert.doesNotMatch(login, /isInKZ|expo-location/)
assert.match(client, /Accept-Language/)
// Legal texts are shared with the website; a stale copy would publish the wrong privacy policy.
assert.equal(mobileLegal, webLegal, "apps/mobile/lib/legal/content.ts must be identical to apps/web/lib/legal-content.ts")

console.log("MOBILE_RELEASE_CONTRACT_OK")
