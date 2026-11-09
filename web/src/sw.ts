/// <reference lib="webworker" />
// Service worker. The app shell is precached (small, always available
// offline). Data, images and audio live in one cache, OFFLINE_CACHE, which
// the "save for offline" button fills (see offline.ts); chapters read online
// are added to it too.

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { createPartialResponse } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { OFFLINE_CACHE } from "./offlineCache";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`)));

const under = (dir: string) => ({ url }: { url: URL }) =>
  url.origin === self.location.origin && url.pathname.startsWith(`${import.meta.env.BASE_URL}${dir}/`);

// Text data: from the cache at once, refreshed in the background when online.
registerRoute(
  under("data"),
  new StaleWhileRevalidate({ cacheName: OFFLINE_CACHE, plugins: [new CacheableResponsePlugin({ statuses: [200] })] }),
);

registerRoute(
  under("images"),
  new CacheFirst({ cacheName: OFFLINE_CACHE, plugins: [new CacheableResponsePlugin({ statuses: [200] })] }),
);

// Audio: <audio> asks for byte ranges. A saved file answers them from the
// cache (Safari plays nothing offline without proper 206 responses); an
// unsaved one streams from the network and is not stored.
registerRoute(under("audio"), async ({ request }) => {
  const cache = await caches.open(OFFLINE_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (!hit) return fetch(request);
  return request.headers.has("range") ? createPartialResponse(request, hit) : hit;
});
