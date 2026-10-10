/* حملات واتساب: عامل الإشعارات (بيصحى لما يوصل إشعار، وبيسحب آخر إشعار من البرنامج) */
const BASE = self.registration.scope;
// نسخة التطبيق على GitHub بتعطي عنوان n8n بالرابط (?api=)، ونسخة n8n نفسها بدونه
const API = new URL(self.location.href).searchParams.get('api') || BASE;
const PAGE = API === BASE ? BASE + 'wac' : BASE;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
const cfg = async (k, v) => {
  try {
    const c = await caches.open('wac-cfg');
    if (v === undefined) { const r = await c.match(BASE + '__' + k); return r ? (await r.text()).trim() : ''; }
    await c.put(BASE + '__' + k, new Response(String(v)));
  } catch (e) { return ''; }
};
self.addEventListener('push', e => e.waitUntil((async () => {
  let title = 'حملات واتساب', body = 'في إشي جديد. افتح البرنامج تشوف.', link = '', tag = 'wac';
  try {
    const pin = await cfg('pin');
    if (pin) {
      const r = await fetch(API + 'wac-chats', { headers: { 'x-pin': pin }, cache: 'no-store' });
      const j = await r.json();
      const notes = (j && j.notes) || [];
      const seen = Number(await cfg('seen')) || 0;
      const fresh = notes.filter(n => n.id > seen);
      const n = fresh[0] || notes[0];
      if (n) {
        title = n.title; body = n.body || ''; link = n.link || '';
        if (fresh.length > 1) body = (body ? body + '\n' : '') + '+ ' + (fresh.length - 1) + ' إشعارات ثانية';
        tag = ['msg', 'lead', 'stop'].includes(n.kind) ? 'wac-chat' : 'wac-' + n.kind;
        await cfg('seen', Math.max.apply(null, notes.map(x => x.id)));
      }
      if (j && self.navigator.setAppBadge) self.navigator.setAppBadge(j.unread_total || 0).catch(() => {});
    }
  } catch (err) {}
  await self.registration.showNotification(title, { body, tag, renotify: true, dir: 'rtl', lang: 'ar',
    icon: API + 'wac-file?f=icon192', badge: API + 'wac-file?f=badge', data: { link } });
})()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = (e.notification.data || {}).link || '';
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(PAGE)) { try { await c.focus(); } catch (err) {} c.postMessage({ wacLink: link }); return; }
    }
    await self.clients.openWindow(PAGE + (link ? '#' + link : ''));
  })());
});
self.addEventListener('pushsubscriptionchange', e => e.waitUntil((async () => {
  try {
    const pin = await cfg('pin'); if (!pin) return;
    const key = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
    const sub = e.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
    if (!sub) return;
    await fetch(API + 'wac-action', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ pin, action: 'push_sub', endpoint: sub.endpoint, device: 'نفس الجهاز (تجدد لحاله)' }) });
  } catch (err) {}
})()));
