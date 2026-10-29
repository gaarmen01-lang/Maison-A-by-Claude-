'use strict';

// Serveur HTTP de Maison A : site public, API de réservation et espace administrateur.
// En local : `node server.js` (fichier JSON, ou PostgreSQL si DATABASE_URL est défini).
// Sur Vercel : api/index.js réutilise le même gestionnaire avec PostgreSQL (Supabase).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./lib/config');
const { FileStore } = require('./lib/store');
const S = require('./lib/schedule');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY = 20 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'"
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()./-]{8,20}$/;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function createApp({ store, adminPassword, sessionSecret, now = () => new Date() }) {
  // Sessions sans état serveur (indispensable sur Vercel) : jeton signé par HMAC.
  const sessionKey = crypto.createHash('sha256').update(sessionSecret || adminPassword).digest();
  const loginFailures = new Map();
  const today = () => S.localNow(now(), config.timeZone);

  // ---------- utilitaires ----------

  function send(res, status, body, headers = {}) {
    const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      ...headers
    });
    res.end(isJson ? JSON.stringify(body) : body);
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'payload_too_large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(new HttpError(400, 'invalid_json'));
        }
      });
      req.on('error', reject);
    });
  }

  function parseCookies(req) {
    const out = {};
    for (const part of (req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function sign(payload) {
    return crypto.createHmac('sha256', sessionKey).update(payload).digest('base64url');
  }

  function createSessionToken() {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
    return payload + '.' + sign(payload);
  }

  function isAdmin(req) {
    const [payload, signature] = String(parseCookies(req).ma_session || '').split('.');
    if (!payload || !signature) return false;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
    } catch {
      return false;
    }
  }

  function requireAdmin(req) {
    if (!isAdmin(req)) throw new HttpError(401, 'unauthorized');
  }

  function findService(id) {
    return config.services.find(s => s.id === id);
  }

  function findStylist(id) {
    return config.staff.find(s => s.id === id);
  }

  function cleanText(value, max) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  }

  // Valide et normalise les champs communs d'un rendez-vous.
  function validateAppointment(body, { admin }) {
    const errors = [];
    const lastName = cleanText(body.lastName, 80);
    const firstName = cleanText(body.firstName, 80);
    const email = cleanText(body.email, 120).toLowerCase();
    const phone = cleanText(body.phone, 30);
    const date = cleanText(body.date, 10);
    const time = cleanText(body.time, 5);
    const notes = cleanText(body.notes, 500);
    const service = findService(body.service);
    const lang = body.lang === 'nl' ? 'nl' : 'fr';
    // « any » ou vide : sans préférence, une coiffeuse libre sera attribuée.
    const stylist = body.stylist && body.stylist !== 'any' ? String(body.stylist) : null;
    const stylistRequested = body.stylistRequested !== undefined
      ? Boolean(body.stylistRequested) && Boolean(stylist)
      : Boolean(stylist);

    if (!lastName) errors.push('lastName');
    if (!firstName) errors.push('firstName');
    // L'administrateur peut saisir un rendez-vous pris par téléphone sans e-mail.
    if (admin ? email && !EMAIL_RE.test(email) : !EMAIL_RE.test(email)) errors.push('email');
    if (!PHONE_RE.test(phone)) errors.push('phone');
    if (!S.isValidDate(date)) errors.push('date');
    if (!S.isValidTime(time)) errors.push('time');
    if (!service) errors.push('service');
    if (stylist && !findStylist(stylist)) errors.push('stylist');

    let price = service ? service.price : 0;
    if (admin && body.price !== undefined && body.price !== '' && body.price !== null) {
      price = Number(body.price);
      if (!Number.isFinite(price) || price < 0 || price > 100000) errors.push('price');
      else price = Math.round(price * 100) / 100;
    }

    if (errors.length) throw Object.assign(new HttpError(400, 'invalid_fields'), { fields: errors });

    return {
      lastName, firstName, email, phone, date, time, notes, lang, price,
      stylist, stylistRequested,
      service: service.id,
      serviceName: service.name,
      duration: service.duration
    };
  }

  // Vérifie les règles du créneau, choisit la coiffeuse puis enregistre via `write(stylistId)`.
  async function placeAppointment(fields, { admin, ignoreId }, write) {
    const hours = config.openingHours[S.weekday(fields.date)];
    const start = S.toMinutes(fields.time);
    const current = today();

    if (!admin) {
      if (!hours) throw new HttpError(409, 'closed');
      if (start < S.toMinutes(hours[0]) || start + fields.duration > S.toMinutes(hours[1]) ||
          (start - S.toMinutes(hours[0])) % config.slotMinutes !== 0) {
        throw new HttpError(409, 'outside_hours');
      }
      if (fields.date > S.addDays(current.date, config.maxDaysAhead)) throw new HttpError(409, 'too_far');
      if (fields.date < current.date ||
          (fields.date === current.date && start < current.minutes + config.minNoticeMinutes)) {
        throw new HttpError(409, 'too_soon');
      }
    }

    // Une coiffeuse ne peut jamais avoir deux rendez-vous qui se chevauchent, même saisis par le salon.
    // Coiffeuse demandée : elle doit être libre. Sans préférence : n'importe quelle coiffeuse libre.
    const wanted = fields.stylistRequested ? fields.stylist : null;
    const busyError = new HttpError(409, wanted ? 'stylist_busy' : 'slot_taken');
    const appointments = (await store.list({ from: fields.date, to: fields.date, status: 'confirmed' }))
      .filter(a => a.id !== ignoreId);
    const candidates = S.freeStylists(config, appointments, fields.date, start, fields.duration, wanted);
    if (!candidates.length) throw busyError;
    // On répartit la charge : la coiffeuse la moins occupée ce jour-là.
    const load = id => appointments.filter(a => a.stylist === id).reduce((sum, a) => sum + a.duration, 0);
    candidates.sort((a, b) => load(a.id) - load(b.id));
    // Si une autre réservation passe au même instant, la base refuse le doublon : on essaie la suivante.
    for (const candidate of candidates) {
      try {
        return await write(candidate.id);
      } catch (err) {
        if (err.code !== 'conflict') throw err;
      }
    }
    throw busyError;
  }

  function publicAppointment(a) {
    return {
      id: a.id, date: a.date, time: a.time, service: a.service,
      serviceName: a.serviceName, duration: a.duration, price: a.price, firstName: a.firstName,
      stylist: a.stylist, stylistName: findStylist(a.stylist) ? findStylist(a.stylist).name : null
    };
  }

  // ---------- routes ----------

  async function api(req, res, url) {
    const route = req.method + ' ' + url.pathname;

    if (route === 'GET /api/salon') {
      return send(res, 200, {
        name: config.salonName,
        currency: config.currency,
        openingHours: config.openingHours,
        maxDaysAhead: config.maxDaysAhead,
        services: config.services,
        staff: config.staff,
        today: today().date
      });
    }

    // Vérification de l'état du service (base de données joignable).
    if (route === 'GET /api/health') {
      await store.list({ from: '2000-01-01', to: '2000-01-01' });
      return send(res, 200, { ok: true }, { 'Cache-Control': 'no-store' });
    }

    if (route === 'GET /api/slots') {
      const date = url.searchParams.get('date') || '';
      const service = findService(url.searchParams.get('service'));
      const stylistParam = url.searchParams.get('stylist');
      const stylist = stylistParam && stylistParam !== 'any' ? stylistParam : null;
      if (!S.isValidDate(date) || !service || (stylist && !findStylist(stylist))) {
        throw new HttpError(400, 'invalid_query');
      }
      const slots = date > S.addDays(today().date, config.maxDaysAhead)
        ? []
        : S.slotsFor(config, await store.list({ from: date, to: date, status: 'confirmed' }), date, service, stylist, now());
      return send(res, 200, { date, service: service.id, stylist, slots });
    }

    if (route === 'POST /api/appointments') {
      const body = await readJson(req);
      // Champ piège invisible pour les robots.
      if (body.website) throw new HttpError(400, 'invalid_fields');
      const fields = validateAppointment(body, { admin: false });
      const appointment = await placeAppointment(fields, { admin: false },
        stylist => store.create({ ...fields, stylist, source: 'online' }));
      return send(res, 201, publicAppointment(appointment));
    }

    // ----- administration -----

    if (route === 'POST /api/admin/login') {
      // Sur Vercel, l'adresse de la cliente est transmise par la plateforme.
      const ip = (process.env.VERCEL && req.headers['x-real-ip']) || req.socket.remoteAddress;
      const fails = loginFailures.get(ip) || { count: 0, until: 0 };
      if (fails.until > Date.now()) throw new HttpError(429, 'too_many_attempts');

      const body = await readJson(req);
      const given = crypto.createHash('sha256').update(String(body.password || '')).digest();
      const expected = crypto.createHash('sha256').update(adminPassword).digest();
      if (!crypto.timingSafeEqual(given, expected)) {
        fails.count += 1;
        if (fails.count >= 5) Object.assign(fails, { count: 0, until: Date.now() + 5 * 60 * 1000 });
        loginFailures.set(ip, fails);
        throw new HttpError(401, 'bad_password');
      }
      loginFailures.delete(ip);
      const token = createSessionToken();
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      return send(res, 200, { ok: true }, {
        'Set-Cookie': `ma_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`
      });
    }

    if (route === 'POST /api/admin/logout') {
      return send(res, 200, { ok: true }, {
        'Set-Cookie': 'ma_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
      });
    }

    if (route === 'GET /api/admin/session') {
      return send(res, 200, { authenticated: isAdmin(req) });
    }

    if (url.pathname.startsWith('/api/admin/')) requireAdmin(req);

    if (route === 'GET /api/admin/appointments') {
      const from = url.searchParams.get('from') || undefined;
      const to = url.searchParams.get('to') || undefined;
      return send(res, 200, { appointments: await store.list({ from, to }) });
    }

    if (route === 'POST /api/admin/appointments') {
      const body = await readJson(req);
      const fields = validateAppointment(body, { admin: true });
      const appointment = await placeAppointment(fields, { admin: true },
        stylist => store.create({ ...fields, stylist, source: 'admin' }));
      return send(res, 201, appointment);
    }

    const match = url.pathname.match(/^\/api\/admin\/appointments\/([0-9a-f-]{36})$/);
    if (match) {
      const existing = await store.get(match[1]);
      if (!existing) throw new HttpError(404, 'not_found');

      if (req.method === 'PATCH') {
        const body = await readJson(req);
        if (body.status !== undefined) {
          if (!['confirmed', 'cancelled'].includes(body.status)) throw new HttpError(400, 'invalid_fields');
          if (body.status === 'confirmed' && existing.status !== 'confirmed') {
            return send(res, 200, await placeAppointment(existing, { admin: true, ignoreId: existing.id },
              stylist => store.update(existing.id, { status: 'confirmed', stylist })));
          }
          return send(res, 200, await store.update(existing.id, { status: body.status }));
        }
        const merged = { ...existing, ...body };
        // Changement de prestation sans prix saisi : on reprend le tarif de la nouvelle prestation.
        if (body.service && body.service !== existing.service && body.price === undefined) delete merged.price;
        if (body.stylist !== undefined) merged.stylistRequested = body.stylist !== 'any' && Boolean(body.stylist);
        const fields = validateAppointment(merged, { admin: true });
        if (existing.status === 'confirmed') {
          return send(res, 200, await placeAppointment(fields, { admin: true, ignoreId: existing.id },
            stylist => store.update(existing.id, { ...fields, stylist })));
        }
        return send(res, 200, await store.update(existing.id, fields));
      }

      if (req.method === 'DELETE') {
        await store.remove(existing.id);
        return send(res, 200, { ok: true });
      }
    }

    if (route === 'GET /api/admin/revenue') {
      const from = url.searchParams.get('from') || S.addDays(today().date, -6);
      const to = url.searchParams.get('to') || today().date;
      if (!S.isValidDate(from) || !S.isValidDate(to) || from > to) throw new HttpError(400, 'invalid_query');
      if (S.addDays(from, 366) < to) throw new HttpError(400, 'range_too_large');

      const byDate = new Map();
      for (let d = from; d <= to; d = S.addDays(d, 1)) {
        byDate.set(d, { date: d, revenue: 0, appointments: 0, cancelled: 0, byService: {}, byStylist: {} });
      }
      const list = await store.list({ from, to });
      for (const a of list) {
        const day = byDate.get(a.date);
        if (a.status === 'cancelled') {
          day.cancelled += 1;
          continue;
        }
        day.revenue += a.price;
        day.appointments += 1;
        day.byService[a.service] = (day.byService[a.service] || 0) + a.price;
        day.byStylist[a.stylist] = (day.byStylist[a.stylist] || 0) + a.price;
      }
      const days = [...byDate.values()].map(d => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 }));
      const total = Math.round(days.reduce((sum, d) => sum + d.revenue, 0) * 100) / 100;
      const appointments = days.reduce((sum, d) => sum + d.appointments, 0);
      const byStylist = config.staff.map(st => {
        const own = list.filter(a => a.status === 'confirmed' && a.stylist === st.id);
        return {
          id: st.id,
          revenue: Math.round(own.reduce((sum, a) => sum + a.price, 0) * 100) / 100,
          appointments: own.length
        };
      });
      return send(res, 200, {
        from, to, currency: config.currency, days, total, appointments, byStylist,
        averageTicket: appointments ? Math.round((total / appointments) * 100) / 100 : 0
      });
    }

    throw new HttpError(404, 'not_found');
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
    const file = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');

    fs.readFile(file, (err, content) => {
      if (err) return send(res, 404, 'Page introuvable / Pagina niet gevonden');
      const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' };
      if (file.endsWith('admin.html')) headers['X-Robots-Tag'] = 'noindex';
      send(res, 200, content, headers);
    });
  }

  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      return serveStatic(req, res, url);
    } catch (err) {
      if (err instanceof HttpError) {
        return send(res, err.status, { error: err.code, fields: err.fields });
      }
      console.error(err);
      return send(res, 500, { error: 'server_error' });
    }
  }

  return { handler, store };
}

module.exports = { createApp };

if (require.main === module) {
  let adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    if (process.env.NODE_ENV === 'production') {
      console.error('ADMIN_PASSWORD doit être défini en production.');
      process.exit(1);
    }
    adminPassword = 'admin';
    console.warn('⚠  ADMIN_PASSWORD non défini : mot de passe administrateur par défaut « admin » (développement uniquement).');
  }
  const store = process.env.DATABASE_URL
    ? new (require('./lib/pg-store'))(process.env.DATABASE_URL)
    : new FileStore(process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json'));
  const app = createApp({ store, adminPassword, sessionSecret: process.env.SESSION_SECRET });
  const port = Number(process.env.PORT) || 3000;
  http.createServer(app.handler).listen(port, () => {
    console.log(`Maison A — http://localhost:${port}  (admin : http://localhost:${port}/admin)`);
  });
}
