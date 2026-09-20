// Minimal Web Push service worker: shows a notification for every push event
// and focuses/opens the product page on click.

self.addEventListener("push", (event) => {
  let data = { title: "Price changed", body: "", url: "/" };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    // Non-JSON payload; fall back to defaults.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
