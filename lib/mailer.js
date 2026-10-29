'use strict';

// E-mails de confirmation de rendez-vous, envoyés via l'API Resend (https://resend.com).
// Sans RESEND_API_KEY, rien n'est envoyé : le site fonctionne normalement sans e-mails.

const S = require('./schedule');

const RESEND_URL = 'https://api.resend.com/emails';

const TEXT = {
  fr: {
    subject: 'Votre rendez-vous chez {salon} — {date} à {time}',
    title: 'Votre rendez-vous est confirmé',
    hello: 'Bonjour {firstName},',
    intro: 'Merci pour votre confiance. Nous avons le plaisir de confirmer votre rendez-vous :',
    service: 'Prestation',
    date: 'Date',
    time: 'Heure',
    stylist: 'Coiffeuse',
    price: 'Tarif indicatif',
    notes: 'Votre remarque',
    address: 'Adresse',
    calendar: 'Le fichier joint vous permet d’ajouter ce rendez-vous à votre agenda.',
    change: 'Un empêchement ? Merci de nous prévenir au moins 24 heures à l’avance en appelant le {phone} ou en répondant à cet e-mail.',
    closing: 'À très bientôt,',
    team: 'L’équipe {salon}',
    ics: 'Rendez-vous {service} — {salon}',
    salonSubject: 'Nouveau rendez-vous en ligne — {date} à {time} — {client}'
  },
  nl: {
    subject: 'Uw afspraak bij {salon} — {date} om {time}',
    title: 'Uw afspraak is bevestigd',
    hello: 'Beste {firstName},',
    intro: 'Bedankt voor uw vertrouwen. Graag bevestigen we uw afspraak:',
    service: 'Behandeling',
    date: 'Datum',
    time: 'Uur',
    stylist: 'Kapster',
    price: 'Indicatieve prijs',
    notes: 'Uw opmerking',
    address: 'Adres',
    calendar: 'Met het bijgevoegde bestand kunt u deze afspraak aan uw agenda toevoegen.',
    change: 'Verhinderd? Laat het ons minstens 24 uur vooraf weten door te bellen naar {phone} of door op deze e-mail te antwoorden.',
    closing: 'Tot binnenkort,',
    team: 'Het team van {salon}',
    ics: 'Afspraak {service} — {salon}',
    salonSubject: 'Nieuwe online afspraak — {date} om {time} — {client}'
  }
};

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function locale(lang) {
  return lang === 'nl' ? 'nl-BE' : 'fr-BE';
}

function formatDate(date, lang) {
  const [y, m, d] = date.split('-').map(Number);
  const text = new Intl.DateTimeFormat(locale(lang), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPrice(value, lang) {
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency', currency: 'EUR', maximumFractionDigits: value % 1 ? 2 : 0
  }).format(value);
}

function endTime(a) {
  return S.toTime(S.toMinutes(a.time) + a.duration);
}

// Heure locale du salon (date + HH:MM) -> instant UTC, en tenant compte de l'heure d'été.
function zonedToUtc(date, time, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wanted = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const local = S.localNow(new Date(guess), timeZone);
    const [ly, lm, ld] = local.date.split('-').map(Number);
    const asUtc = Date.UTC(ly, lm - 1, ld, 0, local.minutes);
    guess += wanted - asUtc;
  }
  return new Date(guess);
}

function icsStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function buildIcs(a, config) {
  const lang = a.lang === 'nl' ? 'nl' : 'fr';
  const start = zonedToUtc(a.date, a.time, config.timeZone);
  const end = new Date(start.getTime() + a.duration * 60000);
  const stylist = config.staff.find(s => s.id === a.stylist);
  const summary = fill(TEXT[lang].ics, { service: a.serviceName[lang], salon: config.salonName });
  const description = [a.serviceName[lang], stylist ? stylist.name[lang] : '', config.contact.phone]
    .filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maison A//Rendez-vous//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.id}@${new URL(config.contact.website).hostname}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(config.contact.address[lang])}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

// Contenu de l'e-mail envoyé à la cliente.
function buildConfirmation(a, config) {
  const lang = a.lang === 'nl' ? 'nl' : 'fr';
  const t = TEXT[lang];
  const stylist = config.staff.find(s => s.id === a.stylist);
  const vars = {
    salon: config.salonName,
    firstName: a.firstName,
    date: formatDate(a.date, lang),
    time: a.time,
    phone: config.contact.phone
  };
  const rows = [
    [t.service, a.serviceName[lang]],
    [t.date, vars.date],
    [t.time, `${a.time} – ${endTime(a)}`],
    [t.stylist, stylist ? stylist.name[lang] : ''],
    [t.price, formatPrice(a.price, lang)],
    [t.address, config.contact.address[lang]]
  ];
  if (a.notes) rows.push([t.notes, a.notes]);

  const subject = fill(t.subject, vars);
  const text = [
    fill(t.hello, vars),
    '',
    t.intro,
    '',
    ...rows.map(([k, v]) => `${k} : ${v}`),
    '',
    t.calendar,
    fill(t.change, vars),
    '',
    t.closing,
    fill(t.team, vars),
    config.contact.website
  ].join('\n');

  const gold = '#a9844f';
  const html = `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f2eb;font-family:Helvetica,Arial,sans-serif;color:#1d1a17;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2eb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #e2d8cb;">
        <tr><td style="background:#1d1a17;padding:28px 32px;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:2px;color:#f7f2eb;">Maison <span style="color:${gold};font-style:italic;">A</span></div>
        </td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${gold};">${escapeHtml(config.salonName)}</p>
          <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.25;">${escapeHtml(t.title)}</h1>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">${escapeHtml(fill(t.hello, vars))}</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4a433c;">${escapeHtml(t.intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2d8cb;">
            ${rows.map(([k, v]) => `<tr>
              <td style="padding:12px 0;border-bottom:1px solid #e2d8cb;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8b8076;vertical-align:top;width:40%;">${escapeHtml(k)}</td>
              <td style="padding:12px 0;border-bottom:1px solid #e2d8cb;font-size:15px;line-height:1.5;">${escapeHtml(v)}</td>
            </tr>`).join('')}
          </table>
          <p style="margin:24px 0 8px;font-size:14px;line-height:1.6;color:#4a433c;">${escapeHtml(t.calendar)}</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a433c;">${escapeHtml(fill(t.change, vars))}</p>
          <p style="margin:0;font-size:16px;line-height:1.6;">${escapeHtml(t.closing)}<br><span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;">${escapeHtml(fill(t.team, vars))}</span></p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;font-size:12px;line-height:1.6;color:#8b8076;">
          ${escapeHtml(config.contact.address[lang])} · ${escapeHtml(config.contact.phone)}<br>
          <a href="${escapeHtml(config.contact.website)}" style="color:${gold};text-decoration:none;">${escapeHtml(new URL(config.contact.website).hostname)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html, ics: buildIcs(a, config) };
}

// Court e-mail d'information pour le salon, à chaque réservation en ligne.
function buildSalonNotice(a, config) {
  const t = TEXT.fr;
  const stylist = config.staff.find(s => s.id === a.stylist);
  const client = `${a.firstName} ${a.lastName}`;
  const subject = fill(t.salonSubject, { date: formatDate(a.date, 'fr'), time: a.time, client });
  const text = [
    `${client} — ${a.phone}${a.email ? ' — ' + a.email : ''}`,
    `${a.serviceName.fr} (${a.duration} min, ${formatPrice(a.price, 'fr')})`,
    `${formatDate(a.date, 'fr')}, ${a.time} – ${endTime(a)}`,
    `Coiffeuse : ${stylist ? stylist.name.fr : a.stylist}${a.stylistRequested ? ' (demandée par la cliente)' : ''}`,
    a.notes ? `Remarque : ${a.notes}` : '',
    `Langue : ${a.lang === 'nl' ? 'néerlandais' : 'français'}`
  ].filter(Boolean).join('\n');
  return { subject, text };
}

function createMailer({ apiKey, from, replyTo, salonEmail, config, fetchImpl = fetch } = {}) {
  async function post(payload, idempotencyKey) {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }

  return {
    enabled: Boolean(apiKey && from),

    // Renvoie true si l'e-mail est parti, false sinon (jamais d'exception : la réservation reste valable).
    async sendConfirmation(a) {
      if (!apiKey || !from || !a.email) return false;
      try {
        const mail = buildConfirmation(a, config);
        await post({
          from,
          to: [a.email],
          reply_to: replyTo || undefined,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: [{ filename: 'maison-a-rendez-vous.ics', content: Buffer.from(mail.ics).toString('base64') }]
        }, `confirmation-${a.id}`);
        return true;
      } catch (err) {
        console.error('E-mail de confirmation non envoyé :', err.message);
        return false;
      }
    },

    async notifySalon(a) {
      if (!apiKey || !from || !salonEmail) return false;
      try {
        const mail = buildSalonNotice(a, config);
        await post({ from, to: [salonEmail], reply_to: a.email || undefined, subject: mail.subject, text: mail.text },
          `salon-${a.id}`);
        return true;
      } catch (err) {
        console.error('E-mail au salon non envoyé :', err.message);
        return false;
      }
    }
  };
}

// Configuration par variables d'environnement (Vercel ou local).
function mailerFromEnv(env, config) {
  return createMailer({
    apiKey: env.RESEND_API_KEY,
    from: env.MAIL_FROM || `${config.salonName} <${config.contact.email}>`,
    replyTo: env.MAIL_REPLY_TO,
    salonEmail: env.SALON_EMAIL,
    config
  });
}

module.exports = { createMailer, mailerFromEnv, buildConfirmation, buildSalonNotice, buildIcs, zonedToUtc };
