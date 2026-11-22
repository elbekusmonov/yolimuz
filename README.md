# Yo'lim server (optional)
1. `ANTHROPIC_API_KEY=sk-... COUNSELOR_TOKEN=pick-a-secret TELEGRAM_BOT_TOKEN=123:ABC node server.js`
2. In index.html set `AI_CONFIG.endpoint` to your server address (HTTPS when hosted).
3. Edit `data.json` to publish current deadlines (month, day), tuition (USD, keyed by exact university name) and currency `rates` (units per 1 USD: UZS, EUR). Students see it on next load.
4. Sign-up asks for the region only. Local education centres are listed in `CITY_CENTERS` inside index.html (Fergana and Kokand in detail; official British Council partners in Tashkent, Andijan, Bukhara, Namangan, Samarkand, Urgench, Nukus, Termez, Jizzakh, Karshi and other cities). Centres in the student's own city come first, then the rest of the region, then free state options (IT Markaz, Barkamol avlod / Kelajak). Categories: eng, sat, dtm, math, chem, bio, phys, hist, it, design, speak, lang, media, arts, biz. When a student's achievements are not enough (no certificates, no English result, low strength or few likely universities), the Universities step shows the gaps and these centres with addresses, phones and map links.
5. Counselors open `/counselor?school=CODE&token=pick-a-secret`.
Without a server the page works fully offline with the built-in coach and typical dates.
Host the whole folder over HTTPS to make the page installable on phones (Chrome: Install; iPhone: Share, Add to Home Screen).

## Telegram reminders: how to switch the bot on (about 10 minutes)
1. In Telegram open @BotFather, send /newbot, choose a name (for example "Yo'lim Fergana") and a username ending in "bot". Copy the token it gives you.
2. Put this folder on any computer or server that stays on and has Node 18+ (a VPS, Railway, Render with an always-on plan, or your own PC):
   `TELEGRAM_BOT_TOKEN=123456:ABC... node server.js`
   or with Docker: `docker build -t yolim . && docker run -d -p 8787:8787 -v yolim-state:/app/state -e TELEGRAM_BOT_TOKEN=123456:ABC... yolim`
3. Open the site from that server (for example https://your-domain/ or http://server-ip:8787/). The server serves the site itself and fills in the bot name and server address automatically; nothing to edit in index.html.
   For phones and installing the app, put it behind HTTPS (most hosts do this for you).
4. The console prints "Telegram bot: @yourbot". Students who chose "Yes" press "Open the bot in Telegram", then Start.
What the bot does: reminders 30, 7 and 1 day before each deadline and on the day, a short weekly plan on Mondays (9:00 to 20:00 Tashkent time), commands /next and /stop. /stop wins until the student turns reminders on again on the site. Subscriptions are kept in telegram.json (STATE_DIR, /app/state in Docker).
The bot uses long polling, so it needs no webhook; do not set a webhook for this bot. Free hosting plans that put the app to sleep stop the reminders.
Optional: ANTHROPIC_API_KEY turns on the AI letter review; without it the built-in checker is used. COUNSELOR_TOKEN turns on /counselor.

## Application guide PDF
Every university has a "Download PDF" button (inside the university, and on the final page). The PDF is made in the browser, in the student's language, and includes their chance, key dates, step-by-step route for that country, documents checklist, where to do each step in their region (Fergana: Public Service Centres, notaries, IELTS venues), their gaps with local centres, scholarships and clickable official links. No server is needed. Country routes are in `GUIDE_ROUTES` in index.html.
