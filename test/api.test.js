'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

// Mercredi 4 novembre 2026, 10:00 (heure locale).
const NOW = new Date(2026, 10, 4, 10, 0);
const DAY = '2026-11-05'; // jeudi

let server, base, cookie;

function request(method, url, body, headers = {}) {
  return fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  }).then(async res => ({ status: res.status, headers: res.headers, body: await res.json().catch(() => null) }));
}

const client = (extra = {}) => ({
  lastName: 'Dupont', firstName: 'Claire', email: 'claire@example.com', phone: '+32 470 12 34 56',
  service: 'brushing', date: DAY, time: '10:00', ...extra
});

test.before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maison-a-'));
  const app = createApp({ dataFile: path.join(dir, 'db.json'), adminPassword: 'secret', now: () => NOW });
  server = http.createServer(app.handler);
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});

test.after(() => server.close());

test('les pages publiques sont servies', async () => {
  const home = await fetch(base + '/');
  assert.strictEqual(home.status, 200);
  assert.match(await home.text(), /Maison/);
  assert.strictEqual((await fetch(base + '/admin')).status, 200);
  assert.strictEqual((await fetch(base + '/../server.js')).status, 404);
});

test('une cliente réserve un créneau', async () => {
  const res = await request('POST', '/api/appointments', client());
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.price, 48);
  assert.strictEqual(res.body.email, undefined, 'les coordonnées ne sont pas renvoyées publiquement');
});

test('les champs obligatoires sont vérifiés', async () => {
  const res = await request('POST', '/api/appointments', client({ email: 'pas-un-mail', lastName: '' }));
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(res.body.fields.sort(), ['email', 'lastName']);
});

test('jour fermé, hors horaires et passé sont refusés', async () => {
  assert.strictEqual((await request('POST', '/api/appointments', client({ date: '2026-11-08' }))).body.error, 'closed');
  assert.strictEqual((await request('POST', '/api/appointments', client({ time: '08:00' }))).body.error, 'outside_hours');
  assert.strictEqual((await request('POST', '/api/appointments', client({ date: '2026-11-04', time: '11:00' }))).body.error, 'too_soon');
});

test('un créneau complet n’est plus proposé', async () => {
  // 2 fauteuils : un deuxième rendez-vous à 10:00 remplit le créneau.
  assert.strictEqual((await request('POST', '/api/appointments', client({ firstName: 'Anne' }))).status, 201);
  const third = await request('POST', '/api/appointments', client({ firstName: 'Lise' }));
  assert.strictEqual(third.body.error, 'slot_taken');

  const { body } = await request('GET', `/api/slots?date=${DAY}&service=brushing`);
  const slot = t => body.slots.find(s => s.time === t);
  assert.strictEqual(slot('10:00').available, false);
  assert.strictEqual(slot('09:30').available, false, 'un brushing de 45 min à 9:30 chevaucherait 10:00');
  assert.strictEqual(slot('11:00').available, true);
});

test('l’espace admin est protégé', async () => {
  assert.strictEqual((await request('GET', '/api/admin/appointments')).status, 401);
  assert.strictEqual((await request('POST', '/api/admin/login', { password: 'faux' })).status, 401);
  const login = await request('POST', '/api/admin/login', { password: 'secret' });
  assert.strictEqual(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
});

test('l’admin fixe un rendez-vous et le CA du jour est calculé', async () => {
  const auth = { Cookie: cookie };
  // Rendez-vous téléphonique sans e-mail, avec prix ajusté, en forçant un créneau complet.
  const full = await request('POST', '/api/admin/appointments',
    client({ email: '', service: 'balayage', price: 190 }), auth);
  assert.strictEqual(full.body.error, 'slot_taken');
  const forced = await request('POST', '/api/admin/appointments',
    client({ email: '', service: 'balayage', price: 190, force: true }), auth);
  assert.strictEqual(forced.status, 201);

  const extra = await request('POST', '/api/admin/appointments', client({ time: '14:00', service: 'coloration' }), auth);
  assert.strictEqual(extra.status, 201);

  let rev = await request('GET', `/api/admin/revenue?from=${DAY}&to=${DAY}`, null, auth);
  // 48 + 48 + 190 + 110
  assert.strictEqual(rev.body.total, 396);
  assert.strictEqual(rev.body.days[0].appointments, 4);

  // Un rendez-vous annulé ne compte plus dans le CA.
  await request('PATCH', '/api/admin/appointments/' + extra.body.id, { status: 'cancelled' }, auth);
  rev = await request('GET', `/api/admin/revenue?from=2026-11-04&to=${DAY}`, null, auth);
  assert.strictEqual(rev.body.total, 286);
  assert.strictEqual(rev.body.days.length, 2);
  assert.strictEqual(rev.body.days[0].revenue, 0);
  assert.strictEqual(rev.body.days[1].cancelled, 1);
  assert.strictEqual(rev.body.averageTicket, 95.33);

  const list = await request('GET', `/api/admin/appointments?from=${DAY}&to=${DAY}`, null, auth);
  assert.strictEqual(list.body.appointments.length, 4);
  assert.strictEqual(list.body.appointments[0].time, '10:00');
});

test('la cliente choisit sa coiffeuse', async () => {
  const day = '2026-11-06'; // vendredi
  const first = await request('POST', '/api/appointments', client({ date: day, time: '11:00', stylist: 'employee-1' }));
  assert.strictEqual(first.status, 201);
  assert.strictEqual(first.body.stylist, 'employee-1');
  assert.deepStrictEqual(first.body.stylistName, { fr: 'Employée 1', nl: 'Medewerkster 1' });

  // L'employée 1 est prise à 11:00, l'employée 2 est encore libre.
  const again = await request('POST', '/api/appointments', client({ date: day, time: '11:00', stylist: 'employee-1' }));
  assert.strictEqual(again.body.error, 'slot_taken');
  const slots1 = await request('GET', `/api/slots?date=${day}&service=brushing&stylist=employee-1`);
  const slots2 = await request('GET', `/api/slots?date=${day}&service=brushing&stylist=employee-2`);
  const slotsAny = await request('GET', `/api/slots?date=${day}&service=brushing`);
  const at = (r, time) => r.body.slots.find(s => s.time === time).available;
  assert.strictEqual(at(slots1, '11:00'), false);
  assert.strictEqual(at(slots2, '11:00'), true);
  assert.strictEqual(at(slotsAny, '11:00'), true);

  // Sans préférence : la coiffeuse encore libre est attribuée automatiquement.
  const any = await request('POST', '/api/appointments', client({ date: day, time: '11:00', stylist: 'any' }));
  assert.strictEqual(any.status, 201);
  assert.strictEqual(any.body.stylist, 'employee-2');

  // Coiffeuse inconnue refusée.
  const bad = await request('POST', '/api/appointments', client({ date: day, time: '15:00', stylist: 'inconnue' }));
  assert.deepStrictEqual(bad.body.fields, ['stylist']);
});

test('le CA est aussi ventilé par coiffeuse', async () => {
  const rev = await request('GET', '/api/admin/revenue?from=2026-11-06&to=2026-11-06', null, { Cookie: cookie });
  assert.deepStrictEqual(rev.body.byStylist, [
    { id: 'employee-1', revenue: 48, appointments: 1 },
    { id: 'employee-2', revenue: 48, appointments: 1 }
  ]);
  assert.deepStrictEqual(rev.body.days[0].byStylist, { 'employee-1': 48, 'employee-2': 48 });
});
