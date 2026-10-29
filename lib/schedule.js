'use strict';

// Calcul des créneaux disponibles et validation des rendez-vous.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

function isValidDate(date) {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(date + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === date;
}

function isValidTime(time) {
  return TIME_RE.test(time);
}

function weekday(date) {
  return new Date(date + 'T00:00:00Z').getUTCDay();
}

// Date et heure locales du serveur au format YYYY-MM-DD / minutes.
function localNow(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes()
  };
}

function addDays(date, days) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function overlaps(startA, durA, startB, durB) {
  return startA < startB + durB && startB < startA + durA;
}

// Nombre de rendez-vous confirmés qui chevauchent l'intervalle demandé (au pic).
function peakOccupancy(appointments, date, start, duration, ignoreId) {
  const sameDay = appointments.filter(a =>
    a.date === date && a.status === 'confirmed' && a.id !== ignoreId &&
    overlaps(start, duration, toMinutes(a.time), a.duration));
  // L'occupation maximale est atteinte au début de l'un des rendez-vous (ou au début de l'intervalle).
  const points = [start, ...sameDay.map(a => Math.max(start, toMinutes(a.time)))];
  let peak = 0;
  for (const p of points) {
    const count = sameDay.filter(a => toMinutes(a.time) <= p && p < toMinutes(a.time) + a.duration).length;
    peak = Math.max(peak, count);
  }
  return peak;
}

function slotsFor(config, appointments, date, service, now = new Date()) {
  const hours = config.openingHours[weekday(date)];
  if (!hours) return [];
  const open = toMinutes(hours[0]);
  const close = toMinutes(hours[1]);
  const current = localNow(now);
  const slots = [];
  for (let start = open; start + service.duration <= close; start += config.slotMinutes) {
    const tooSoon = date < current.date ||
      (date === current.date && start < current.minutes + config.minNoticeMinutes);
    const full = peakOccupancy(appointments, date, start, service.duration) >= config.chairs;
    slots.push({ time: toTime(start), available: !tooSoon && !full });
  }
  return slots;
}

module.exports = {
  toMinutes, toTime, isValidDate, isValidTime, weekday, localNow, addDays,
  peakOccupancy, slotsFor
};
