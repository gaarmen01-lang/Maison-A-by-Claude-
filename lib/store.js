'use strict';

// Stockage des rendez-vous dans un fichier JSON (écriture atomique).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
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

  list({ from, to, status } = {}) {
    return this.data.appointments
      .filter(a => (!from || a.date >= from) && (!to || a.date <= to) && (!status || a.status === status))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  get(id) {
    return this.data.appointments.find(a => a.id === id) || null;
  }

  create(fields) {
    const appointment = {
      id: crypto.randomUUID(),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      ...fields
    };
    this.data.appointments.push(appointment);
    this.save();
    return appointment;
  }

  update(id, fields) {
    const appointment = this.get(id);
    if (!appointment) return null;
    Object.assign(appointment, fields, { updatedAt: new Date().toISOString() });
    this.save();
    return appointment;
  }

  remove(id) {
    const before = this.data.appointments.length;
    this.data.appointments = this.data.appointments.filter(a => a.id !== id);
    if (this.data.appointments.length === before) return false;
    this.save();
    return true;
  }
}

module.exports = Store;
