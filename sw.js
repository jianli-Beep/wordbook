const CACHE = "wordbook-v1";
const ASSETS = ["./", "./index.html", "./dict.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // 分享直达：POST → 读表单 → 重定向回 ?text=...，由页面读取
  if (e.request.method === "POST" && url.pathname.endsWith("/share/")) {
    e.respondWith((async () => {
      let text = "", title = "";
      try {
        const fd = await e.request.formData();
        text = fd.get("text") || "";
        title = fd.get("title") || "";
      } catch (err) {}
      const target = new URL("./", url.href);
      if (text) target.searchParams.set("text", text);
      if (title) target.searchParams.set("title", title);
      return Response.redirect(target.href, 303);
    })());
    return;
  }

  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
