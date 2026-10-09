const CACHE_NAME = 'pawsitivecare-supabase-images-v1';

function isSupabaseImage(request) {
  if (request.method !== 'GET' || request.destination !== 'image') return false;

  try {
    const url = new URL(request.url);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/');
  } catch {
    return false;
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('pawsitivecare-supabase-images-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (!isSupabaseImage(event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    }),
  );
});
