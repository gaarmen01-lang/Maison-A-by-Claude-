'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../lib/config');
const { createMailer, buildConfirmation, zonedToUtc } = require('../lib/mailer');
const { createApp } = require('../server');
const { FileStore } = require('../lib/store');

const appointment = {
  id: '11111111-2222-3333-4444-555555555555',
  date: '2026-11-05', time: '10:00', duration: 75, price: 85,
  service: 'coupe-brushing', serviceName: { fr: 'Coupe & brushing', nl: 'Knippen & brushing' },
  stylist: 'employee-1', stylistRequested: true,
  firstName: 'Claire', lastName: 'Dupont', email: 'claire@example.com', phone: '+32 470 12 34 56',
  notes: '<script>alert(1)</script> cheveux longs', lang: 'fr'
};

test('heure de Bruxelles convertie en UTC (hiver et été)', () => {
  assert.strictEqual(zonedToUtc('2026-11-05', '10:00', 'Europe/Brussels').toISOString(), '2026-11-05T09:00:00.000Z');
  assert.strictEqual(zonedToUtc('2026-07-04', '10:00', 'Europe/Brussels').toISOString(), '2026-07-04T08:00:00.000Z');
});

test('e-mail de confirmation en français', () => {
  const mail = buildConfirmation(appointment, config);
  assert.strictEqual(mail.subject, 'Votre rendez-vous chez Maison A — Jeudi 5 novembre 2026 à 10:00');
  assert.match(mail.text, /Bonjour Claire,/);
  assert.match(mail.text, /Heure : 10:00 – 11:15/);
  assert.match(mail.text, /Coiffeuse : Employée 1/);
  assert.match(mail.html, /Coupe &amp; brushing/);
  assert.ok(!mail.html.includes('<script>'), 'le contenu saisi par la cliente est échappé');
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.ics, /DTSTART:20261105T090000Z/);
  assert.match(mail.ics, /DTEND:20261105T101500Z/);
  assert.match(mail.ics, /UID:11111111-2222-3333-4444-555555555555@maisona-studio\.be/);
});

test('e-mail de confirmation en néerlandais', () => {
  const mail = buildConfirmation({ ...appointment, lang: 'nl', notes: '' }, config);
  assert.strictEqual(mail.subject, 'Uw afspraak bij Maison A — Donderdag 5 november 2026 om 10:00');
  assert.match(mail.text, /Beste Claire,/);
  assert.match(mail.text, /Kapster : Medewerkster 1/);
  assert.match(mail.html, /lang="nl"/);
});

test('envoi via Resend', async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, text: async () => '{}' };
  };
  const mailer = createMailer({
    apiKey: 're_test', from: 'Maison A <rendez-vous@maisona-studio.be>', replyTo: 'bonjour@maisona-studio.be',
    salonEmail: 'salon@example.com', config, fetchImpl: fakeFetch
  });
  assert.strictEqual(await mailer.sendConfirmation(appointment), true);
  assert.strictEqual(await mailer.notifySalon(appointment), true);

  const [client, salon] = calls;
  assert.strictEqual(client.url, 'https://api.resend.com/emails');
  assert.strictEqual(client.opts.headers.Authorization, 'Bearer re_test');
  assert.strictEqual(client.opts.headers['Idempotency-Key'], 'confirmation-' + appointment.id);
  assert.deepStrictEqual(client.body.to, ['claire@example.com']);
  assert.strictEqual(client.body.reply_to, 'bonjour@maisona-studio.be');
  assert.strictEqual(client.body.attachments[0].filename, 'maison-a-rendez-vous.ics');
  assert.match(Buffer.from(client.body.attachments[0].content, 'base64').toString(), /BEGIN:VCALENDAR/);
  assert.deepStrictEqual(salon.body.to, ['salon@example.com']);
  assert.match(salon.body.subject, /Claire Dupont/);
});

test('pas d’envoi sans clé, sans e-mail, et pas d’exception si Resend échoue', async () => {
  let called = 0;
  const failing = async () => { called++; return { ok: false, status: 500, text: async () => 'boom' }; };
  assert.strictEqual(await createMailer({ config, fetchImpl: failing }).sendConfirmation(appointment), false);
  const mailer = createMailer({ apiKey: 'k', from: 'a@b.be', config, fetchImpl: failing });
  assert.strictEqual(await mailer.sendConfirmation({ ...appointment, email: '' }), false);
  assert.strictEqual(called, 0);
  const original = console.error;
  console.error = () => {};
  try {
    assert.strictEqual(await mailer.sendConfirmation(appointment), false);
  } finally {
    console.error = original;
  }
  assert.strictEqual(called, 1);
});

test('la réservation déclenche l’e-mail et reste valable s’il échoue', async () => {
  const sent = [];
  let fail = false;
  const mailer = {
    async sendConfirmation(a) { sent.push(a); return !fail; },
    async notifySalon() { return true; }
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maison-a-mail-'));
  const app = createApp({
    store: new FileStore(path.join(dir, 'db.json')), adminPassword: 'x', sessionSecret: 'y', mailer,
    now: () => new Date(Date.UTC(2026, 10, 4, 9, 0))
  });
  const server = http.createServer(app.handler);
  await new Promise(r => server.listen(0, r));
  const book = time => fetch(`http://127.0.0.1:${server.address().port}/api/appointments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...appointment, service: 'brushing', time, stylist: 'any' })
  }).then(async r => ({ status: r.status, body: await r.json() }));
  try {
    const ok = await book('14:00');
    assert.deepStrictEqual([ok.status, ok.body.emailSent], [201, true]);
    assert.strictEqual(sent[0].email, 'claire@example.com');
    fail = true;
    const ko = await book('15:00');
    assert.deepStrictEqual([ko.status, ko.body.emailSent], [201, false]);
  } finally {
    server.close();
  }
});
