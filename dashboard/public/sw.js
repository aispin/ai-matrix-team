/* 本地面板：不使用 Service Worker。
 * 本文件是「退役脚本」——给曾装过旧版 SW 的浏览器自愈用：
 * 清空全部缓存 → 注销自己 → 交还控制权。之后浏览器不再有 SW。
 * 待所有用户浏览器完成一次刷新后，本文件可删（保留亦无害）。
 */
self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim()),
  );
});
