'use strict';

// Stockage des rendez-vous dans un fichier JSON (développement local et tests).
// Même interface et même règle anti-chevauchement que lib/pg-store.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { toMinutes } = require('./schedule');

class ConflictError extends Error {
  constructor() {
    super('conflict');
    this.code = 'conflict';
  }
}

function overlapsExisting(appointments, a) {
  if (a.status !== 'confirmed') return false;
  const start = toMinutes(a.time);
  return appointments.some(b =>
    b.id !== a.id && b.status === 'confirmed' && b.stylist === a.stylist && b.date === a.date &&
    start < toMinutes(b.time) + b.duration && toMinutes(b.time) < start + a.duration);
}

class FileStore {
  constructor(file) {
    this.file = file;
    this.data = { appointments: [] };
    if (fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      this.save();
    }
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  async list({ from, to, status } = {}) {
    return this.data.appointments
      .filter(a => (!from || a.date >= from) && (!to || a.date <= to) && (!status || a.status === status))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(a => ({ ...a }));
  }

  async get(id) {
    const a = this.data.appointments.find(x => x.id === id);
    return a ? { ...a } : null;
  }

  async create(fields) {
    const appointment = {
      id: crypto.randomUUID(),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      ...fields
    };
    if (overlapsExisting(this.data.appointments, appointment)) throw new ConflictError();
    this.data.appointments.push(appointment);
    this.save();
    return { ...appointment };
  }

  async update(id, fields) {
    const appointment = this.data.appointments.find(a => a.id === id);
    if (!appointment) return null;
    const next = { ...appointment, ...fields, updatedAt: new Date().toISOString() };
    if (overlapsExisting(this.data.appointments, next)) throw new ConflictError();
    Object.assign(appointment, next);
    this.save();
    return { ...appointment };
  }

  async remove(id) {
    const before = this.data.appointments.length;
    this.data.appointments = this.data.appointments.filter(a => a.id !== id);
    if (this.data.appointments.length === before) return false;
    this.save();
    return true;
  }
}

module.exports = { FileStore, ConflictError };
