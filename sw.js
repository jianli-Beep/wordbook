const CORE = "wordbook-core-v4";
const DICT = "wordbook-dict-v1";
const CORE_ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CORE).then(c => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    // 把旧的 dict.js（4.9MB）搬到长期缓存，避免更新 App 时重新下载
    const dictUrl = new URL("./dict.js", self.location.href).href;
    try {
      const oldNames = await caches.keys();
      for (const name of oldNames) {
        if (name === CORE || name === DICT) continue;
        const old = await caches.open(name);
        const resp = await old.match(dictUrl);
        if (resp) {
          const d = await caches.open(DICT);
          if (!(await d.match(dictUrl))) await d.put(dictUrl, resp);
        }
      }
    } catch (err) {}
    // 清理旧版本缓存
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CORE && k !== DICT).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
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
          const cacheName = url.pathname.endsWith("/dict.js") ? DICT : CORE;
          caches.open(cacheName).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
