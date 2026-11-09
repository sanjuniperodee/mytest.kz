/* mytest service worker: shows web push reminders and opens the app on click. No caching. */

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

/** Only paths of this site are opened; the payload's origin is ignored. */
function resolveUrl(raw) {
  try {
    const parsed = new URL(raw || "/dashboard", self.location.origin)
    return new URL(parsed.pathname + parsed.search + parsed.hash, self.location.origin).href
  } catch (error) {
    return new URL("/dashboard", self.location.origin).href
  }
}

self.addEventListener("push", (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch (error) {
      data = { body: event.data.text() }
    }
  }
  const title = typeof data.title === "string" && data.title ? data.title : "mytest"
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/icon-192x192.png",
    data: { url: resolveUrl(data.url) },
  }
  if (typeof data.tag === "string" && data.tag) {
    options.tag = data.tag
    options.renotify = true
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = resolveUrl(event.notification.data && event.notification.data.url)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of windows) {
        if (client.url === url && "focus" in client) return client.focus()
      }
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin || !("navigate" in client)) continue
        try {
          const navigated = await client.navigate(url)
          if (navigated) return navigated.focus()
        } catch (error) {
          // Not controlled by this worker yet — open a new window instead.
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
