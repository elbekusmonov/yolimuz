// Yo'lim server: AI letter review, live data, counselor dashboard, Telegram reminders. Node 18+, no dependencies.
// Run: ANTHROPIC_API_KEY=... COUNSELOR_TOKEN=... TELEGRAM_BOT_TOKEN=... node server.js
const http = require('http'), fs = require('fs'), path = require('path');
// The website itself is served from the same folder, so one process runs the site, the AI review, the counselor page and the Telegram bot.
const SITE = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/sw.js': ['sw.js', 'text/javascript'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
const PORT = process.env.PORT || 8787, KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const TOKEN = process.env.COUNSELOR_TOKEN || '', ORIGIN = process.env.ALLOW_ORIGIN || '*';
const STATE_DIR = process.env.STATE_DIR || __dirname; try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch (e) {}
const STUD = path.join(STATE_DIR, 'students.json'), DATA = path.join(__dirname, 'data.json');
const hits = {}; const limited = ip => { const h = (hits[ip] = (hits[ip] || []).filter(t => Date.now() - t < 36e5)); h.push(Date.now()); return h.length > 20; };
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return f === STUD ? [] : {}; } };
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
const body = req => new Promise((ok, no) => { let s = ''; req.on('data', d => { s += d; if (s.length > 30000) { req.destroy(); no(new Error('big')); } }); req.on('end', () => ok(s)); });
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// ---- Telegram reminders (optional). The student chooses on the website whether to receive them. ----
// Set TELEGRAM_BOT_TOKEN (from @BotFather) and put the bot username in TG_CONFIG.bot in index.html.
// The bot uses long polling, so no webhook or public HTTPS address is needed for it.
const TG = process.env.TELEGRAM_BOT_TOKEN || '', TGF = path.join(STATE_DIR, 'telegram.json'), TZ_OFFSET_H = 5; // Uzbekistan time, UTC+5
const tgRead = () => { try { return JSON.parse(fs.readFileSync(TGF, 'utf8')); } catch (e) { return {}; } };
const tgWrite = o => fs.writeFileSync(TGF, JSON.stringify(o));
const syncHits = {}; const syncLimited = ip => { const h = (syncHits[ip] = (syncHits[ip] || []).filter(t => Date.now() - t < 36e5)); h.push(Date.now()); return h.length > 200; };
const TGM = {
  en: { start: n => `Hello${n ? ', ' + n : ''}! Yo'lim will remind you about application and scholarship deadlines.\n\n/next shows what is coming.\n/stop turns reminders off.`, stop: 'Reminders are off. You can turn them on again in the Telegram menu on the Yo\'lim website.', off: 'You turned Telegram reminders off on the website. No more messages will be sent.', on: 'Telegram reminders are on again.', help: 'Open the Yo\'lim website, go to the Telegram menu and press "Open the bot in Telegram" to link your account.\n\nCommands: /next, /stop', next: 'Coming up:', none: 'No dates saved yet. Choose countries and universities on the website.', remind: (x, n, d) => `⏰ In ${n} ${n === 1 ? 'day' : 'days'} (${d}): ${x}`, today: (x) => `⏰ Today: ${x}`, week: 'Your week with Yo\'lim. Next dates:', weekEnd: 'One small step this week: open Yo\'lim and update your plan.', unknown: 'This link is not active. Open the Telegram menu on the website and press the button again.' },
  uz: { start: n => `Assalomu alaykum${n ? ', ' + n : ''}! Yo'lim hujjat topshirish va grant muddatlarini eslatib turadi.\n\n/next — yaqin sanalar.\n/stop — eslatmalarni o'chirish.`, stop: "Eslatmalar o'chirildi. Ularni Yo'lim saytidagi Telegram menyusida qayta yoqishingiz mumkin.", off: "Siz saytda Telegram eslatmalarini o'chirdingiz. Boshqa xabar yuborilmaydi.", on: 'Telegram eslatmalari qayta yoqildi.', help: "Yo'lim saytini oching, Telegram menyusiga o'ting va hisobingizni ulash uchun \"Botni Telegramda ochish\" tugmasini bosing.\n\nBuyruqlar: /next, /stop", next: 'Yaqin sanalar:', none: "Hali sanalar yo'q. Saytda davlat va universitetlarni tanlang.", remind: (x, n, d) => `⏰ ${n} kundan keyin (${d}): ${x}`, today: (x) => `⏰ Bugun: ${x}`, week: "Yo'lim bilan haftangiz. Yaqin sanalar:", weekEnd: "Bu haftaning kichik qadami: Yo'limni oching va rejangizni yangilang.", unknown: "Bu havola faol emas. Saytdagi Telegram menyusini oching va tugmani yana bosing." },
  ru: { start: n => `Здравствуйте${n ? ', ' + n : ''}! Yo'lim будет напоминать о сроках подачи документов и стипендий.\n\n/next — ближайшие даты.\n/stop — выключить напоминания.`, stop: 'Напоминания выключены. Включить их снова можно в меню Telegram на сайте Yo\'lim.', off: 'Вы выключили напоминания в Telegram на сайте. Сообщения больше не придут.', on: 'Напоминания в Telegram снова включены.', help: 'Откройте сайт Yo\'lim, зайдите в меню Telegram и нажмите «Открыть бота в Telegram», чтобы привязать аккаунт.\n\nКоманды: /next, /stop', next: 'Ближайшие даты:', none: 'Дат пока нет. Выберите страны и университеты на сайте.', remind: (x, n, d) => `⏰ Через ${n} дн. (${d}): ${x}`, today: (x) => `⏰ Сегодня: ${x}`, week: 'Ваша неделя с Yo\'lim. Ближайшие даты:', weekEnd: 'Маленький шаг на этой неделе: откройте Yo\'lim и обновите план.', unknown: 'Эта ссылка не активна. Откройте меню Telegram на сайте и нажмите кнопку ещё раз.' }
};
const M = s => TGM[s && TGM[s.lang] ? s.lang : 'uz'];
const tgCall = (method, params) => fetch(`https://api.telegram.org/bot${TG}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) }).then(r => r.json());
const tgSend = (chat, text) => tgCall('sendMessage', { chat_id: chat, text, disable_web_page_preview: true }).catch(() => {});
const today = () => new Date(Date.now() + TZ_OFFSET_H * 36e5).toISOString().slice(0, 10);
const daysTo = d => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 864e5);
const upcoming = (s, n) => (s.events || []).filter(e => daysTo(e.d) >= 0).slice(0, n).map(e => `• ${e.d}: ${e.x}`).join('\n');
async function tgHandle(m) {
  if (!m || !m.text || !m.chat) return;
  const chat = m.chat.id, txt = m.text.trim(), all = tgRead(), mine = Object.values(all).filter(s => s.chat === chat);
  const cmd = txt.split(/\s+/)[0].replace(/@.*$/, '').toLowerCase(), arg = txt.split(/\s+/)[1] || '';
  if (cmd === '/start' && arg) {
    const s = all[arg];
    if (!s) return tgSend(chat, TGM.uz.unknown + '\n\n' + TGM.ru.unknown);
    s.chat = chat; s.on = true; s.botStop = false; s.linkedAt = new Date().toISOString(); tgWrite(all);
    const up = upcoming(s, 3);
    return tgSend(chat, M(s).start(s.name) + (up ? '\n\n' + M(s).next + '\n' + up : ''));
  }
  if (cmd === '/stop') { mine.forEach(s => { s.on = false; s.botStop = true; }); tgWrite(all); return tgSend(chat, M(mine[0]).stop); }
  if (cmd === '/next' && mine.length) { const s = mine[0], up = upcoming(s, 5); return tgSend(chat, up ? M(s).next + '\n' + up : M(s).none); }
  return tgSend(chat, M(mine[0]).help);
}
let tgOffset = 0;
async function tgPoll() {
  try {
    const j = await tgCall('getUpdates', { offset: tgOffset, timeout: 25, allowed_updates: ['message'] });
    for (const u of (j && j.result) || []) { tgOffset = u.update_id + 1; await tgHandle(u.message).catch(() => {}); }
    if (j && j.ok === false) await new Promise(r => setTimeout(r, 10000));
  } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
  setImmediate(tgPoll);
}
async function tgRemind() {
  const all = tgRead(), day = today(), hour = new Date(Date.now() + TZ_OFFSET_H * 36e5).getUTCHours(), monday = new Date(day + 'T00:00:00Z').getUTCDay() === 1;
  if (hour < 9 || hour > 20) return; // send only in the daytime, Uzbekistan time
  for (const s of Object.values(all)) {
    if (!s.on || !s.chat) continue;
    s.sent = s.sent || {};
    if (!s.topics || s.topics.dl !== false) for (const e of s.events || []) {
      const n = daysTo(e.d), key = e.d + '|' + e.x + '|' + n;
      if ([30, 7, 1, 0].includes(n) && !s.sent[key]) { s.sent[key] = day; await tgSend(s.chat, n === 0 ? M(s).today(e.x) : M(s).remind(e.x, n, e.d)); }
    }
    if (monday && (!s.topics || s.topics.wk !== false) && s.lastWeek !== day) {
      s.lastWeek = day; const up = upcoming(s, 3);
      await tgSend(s.chat, M(s).week + '\n' + (up || M(s).none) + '\n\n' + M(s).weekEnd);
    }
    for (const k of Object.keys(s.sent)) if (daysTo(k.split('|')[0]) < -2) delete s.sent[k];
  }
  tgWrite(all);
}
let BOT_NAME = process.env.TELEGRAM_BOT_NAME || '';
async function tgStart() {
  try {
    const me = await tgCall('getMe', {});
    if (!me.ok) { console.log('Telegram: the token was rejected (' + (me.description || 'unknown error') + '). Check TELEGRAM_BOT_TOKEN.'); return; }
    BOT_NAME = me.result.username; console.log('Telegram bot: @' + BOT_NAME);
    await tgCall('deleteWebhook', { drop_pending_updates: false }); // long polling needs no webhook
    const cmds = { uz: [['next', 'Yaqin sanalar'], ['stop', "Eslatmalarni o'chirish"]], ru: [['next', 'Ближайшие даты'], ['stop', 'Выключить напоминания']], en: [['next', 'Upcoming dates'], ['stop', 'Turn reminders off']] };
    for (const l of Object.keys(cmds)) await tgCall('setMyCommands', Object.assign({ commands: cmds[l].map(c => ({ command: c[0], description: c[1] })) }, l === 'en' ? {} : { language_code: l }));
    await tgCall('setMyDescription', { description: "Yo'lim: hujjat topshirish va grant muddatlari haqida eslatmalar. Напоминания о сроках поступления и стипендий. Reminders for application and scholarship deadlines." });
  } catch (e) { console.log('Telegram: could not reach api.telegram.org (' + e.message + ')'); }
  tgPoll(); setTimeout(tgRemind, 15000); setInterval(tgRemind, 36e5);
}
if (TG) tgStart(); else console.log('Telegram reminders: off (set TELEGRAM_BOT_TOKEN to turn them on)');

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress;
  if (req.method === 'OPTIONS') return send(res, 204, '');
  try {
    if (u.pathname === '/data') return send(res, 200, read(DATA));
    if (u.pathname === '/tg/sync' && req.method === 'POST') {
      if (syncLimited(ip)) return send(res, 429, { error: 'slow down' });
      const o = JSON.parse(await body(req)), code = String(o.code || '');
      if (!/^[a-z0-9]{12,40}$/.test(code)) return send(res, 400, { error: 'bad code' });
      const all = tgRead(), old = all[code] || {};
      if (o.reenable) old.botStop = false;
      const on = !!o.on && !old.botStop; // /stop in Telegram wins until the student turns reminders on again on the site
      const prevOn = old.on;
      const events = (Array.isArray(o.events) ? o.events : []).slice(0, 40).filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.d)).map(e => ({ d: e.d, x: String(e.x || '').slice(0, 200) }));
      all[code] = Object.assign(old, { on, topics: { dl: !(o.topics && o.topics.dl === false), wk: !(o.topics && o.topics.wk === false) }, lang: ['en', 'uz', 'ru'].includes(o.lang) ? o.lang : 'uz', name: String(o.name || '').slice(0, 40), uni: String(o.uni || '').slice(0, 120), events, at: new Date().toISOString() });
      tgWrite(all);
      if (TG && old.chat && prevOn !== undefined && prevOn !== on) tgSend(old.chat, on ? M(all[code]).on : M(all[code]).off);
      return send(res, 200, { ok: true, linked: !!all[code].chat, on, bot: !!TG });
    }
    if (u.pathname === '/tg/status') {
      const s = tgRead()[String(u.searchParams.get('code') || '')];
      return send(res, 200, { linked: !!(s && s.chat), on: !!(s && s.on), bot: !!TG });
    }
    if (u.pathname === '/review' && req.method === 'POST') {
      if (!KEY) return send(res, 503, { error: 'no key' });
      if (limited(ip)) return send(res, 429, { error: 'slow down' });
      const { prompt } = JSON.parse(await body(req));
      if (typeof prompt !== 'string' || prompt.length > 20000) return send(res, 400, { error: 'bad prompt' });
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }) });
      if (!r.ok) return send(res, 502, { error: 'model error' });
      const j = await r.json(), txt = (j.content || []).map(c => c.text || '').join('');
      const m = txt.match(/\{[\s\S]*\}/);
      return send(res, 200, { text: m ? m[0] : txt });
    }
    if (u.pathname === '/share' && req.method === 'POST') {
      const o = JSON.parse(await body(req)), all = read(STUD);
      if (!o.school || !o.name) return send(res, 400, { error: 'missing' });
      all.push({ school: String(o.school).slice(0, 40), name: String(o.name).slice(0, 80), region: String(o.region || '').slice(0, 40), district: String(o.district || '').slice(0, 60), strength: +o.strength || 0, uni: String(o.uni || '').slice(0, 120), chance: o.chance == null ? null : +o.chance, letter: o.letter == null ? null : +o.letter, at: new Date().toISOString() });
      fs.writeFileSync(STUD, JSON.stringify(all.slice(-5000))); return send(res, 200, { ok: true });
    }
    if (u.pathname === '/students') {
      if (!TOKEN || u.searchParams.get('token') !== TOKEN) return send(res, 401, { error: 'token' });
      const s = u.searchParams.get('school'); return send(res, 200, read(STUD).filter(x => !s || x.school === s));
    }
    if (u.pathname === '/counselor') {
      if (!TOKEN || u.searchParams.get('token') !== TOKEN) return send(res, 401, 'Add ?school=CODE&token=YOUR_TOKEN to the address.', 'text/plain');
      const s = u.searchParams.get('school'), rows = read(STUD).filter(x => !s || x.school === s).reverse();
      return send(res, 200, `<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><title>Counselor dashboard</title><style>body{font:15px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style><h2>Students${s ? ' of ' + esc(s) : ''}: ${rows.length}</h2><table><tr><th>Name</th><th>Region</th><th>City</th><th>Strength</th><th>University</th><th>Chance</th><th>Letter</th><th>Sent</th></tr>${rows.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.region)}</td><td>${esc(x.district)}</td><td>${x.strength}</td><td>${esc(x.uni)}</td><td>${x.chance == null ? '' : x.chance + '%'}</td><td>${x.letter == null ? '' : x.letter}</td><td>${esc(x.at.slice(0, 10))}</td></tr>`).join('')}</table>`, 'text/html');
    }
    if (req.method === 'GET' && SITE[u.pathname]) {
      const [file, type] = SITE[u.pathname];
      let buf = fs.readFileSync(path.join(__dirname, file));
      if (file === 'index.html') { /* point the page at this server and this bot automatically */
        buf = buf.toString('utf8').replace('const AI_CONFIG = { endpoint: ""', 'const AI_CONFIG = { ai: ' + (KEY ? 'true' : 'false') + ', endpoint: location.origin').replace('const TG_CONFIG = { bot: "" }', 'const TG_CONFIG = { bot: ' + JSON.stringify(BOT_NAME) + ' }');
      }
      res.writeHead(200, { 'Content-Type': type + (type.startsWith('text') || type.includes('json') || type.includes('javascript') ? '; charset=utf-8' : ''), 'Cache-Control': 'no-cache' }); return res.end(buf);
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: 'server error' }); }
}).listen(PORT, () => console.log('Yolim server on ' + PORT));
