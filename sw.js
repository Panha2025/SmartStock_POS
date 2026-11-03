/* Only explicitly listed public application assets enter the offline cache. */
const CACHE='smartstock-app-v2.0.0';
const ASSETS=['./','./index.html','./styles.css','./manifest.webmanifest','./js/bootstrap.js','./js/app.js','./js/db.js','./js/schema.js','./js/utils.js','./js/i18n.js','./assets/icon-192.png','./assets/icon-512.png'];
const urls=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  // Leave updates waiting until old tabs close so their modules cannot mix versions.
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('smartstock-app-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);url.search='';url.hash='';
  const inScope=url.href.startsWith(self.registration.scope);
  if(!inScope||(!urls.has(url.href)&&event.request.mode!=='navigate'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(urls.has(url.href)?url.href:new URL('./index.html',self.registration.scope).href);
    if(cached)return cached;
    try{return await fetch(event.request);}catch{return new Response('Application cache is unavailable. Reconnect to reload SmartStock.',{status:503});}
  })());
});
