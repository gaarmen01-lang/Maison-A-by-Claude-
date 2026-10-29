'use strict';

// Stockage des rendez-vous dans PostgreSQL (Supabase en production).
// La contrainte `no_double_booking` de la table garantit qu'une coiffeuse n'a jamais
// deux rendez-vous confirmés qui se chevauchent, même en cas de réservations simultanées.

const { Pool } = require('pg');
const supabaseCa = require('./supabase-ca');
const { ConflictError } = require('./store');

const COLUMNS = `
  id, status, to_char(date, 'YYYY-MM-DD') as date, to_char(time, 'HH24:MI') as time, duration,
  stylist, stylist_requested, service, service_name, price, last_name, first_name, email, phone,
  notes, lang, source, created_at, updated_at`;

// Champs de l'application -> colonnes de la table.
const FIELDS = {
  status: 'status', date: 'date', time: 'time', duration: 'duration', stylist: 'stylist',
  stylistRequested: 'stylist_requested', service: 'service', serviceName: 'service_name',
  price: 'price', lastName: 'last_name', firstName: 'first_name', email: 'email', phone: 'phone',
  notes: 'notes', lang: 'lang', source: 'source'
};

function toAppointment(row) {
  return {
    id: row.id,
    status: row.status,
    date: row.date,
    time: row.time,
    duration: row.duration,
    stylist: row.stylist,
    stylistRequested: row.stylist_requested,
    service: row.service,
    serviceName: row.service_name,
    price: Number(row.price),
    lastName: row.last_name,
    firstName: row.first_name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    lang: row.lang,
    source: row.source,
    createdAt: row.created_at && row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined
  };
}

function columnsFor(fields) {
  return Object.keys(FIELDS).filter(k => fields[k] !== undefined);
}

class PgStore {
  constructor(connectionString) {
    const host = new URL(connectionString).hostname;
    this.pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10000,
      ssl: host.endsWith('supabase.com') ? { ca: supabaseCa } : undefined
    });
  }

  async query(sql, params) {
    try {
      return await this.pool.query(sql, params);
    } catch (err) {
      if (err.code === '23P01') throw new ConflictError(); // exclusion_violation
      throw err;
    }
  }

  async list({ from, to, status } = {}) {
    const where = [];
    const params = [];
    if (from) where.push(`date >= $${params.push(from)}`);
    if (to) where.push(`date <= $${params.push(to)}`);
    if (status) where.push(`status = $${params.push(status)}`);
    const { rows } = await this.query(
      `select ${COLUMNS} from appointments ${where.length ? 'where ' + where.join(' and ') : ''}
       order by date, time, created_at`, params);
    return rows.map(toAppointment);
  }

  async get(id) {
    const { rows } = await this.query(`select ${COLUMNS} from appointments where id = $1`, [id]);
    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async create(fields) {
    const keys = columnsFor(fields);
    const params = keys.map(k => (k === 'serviceName' ? JSON.stringify(fields[k]) : fields[k]));
    const { rows } = await this.query(
      `insert into appointments (${keys.map(k => FIELDS[k]).join(', ')})
       values (${keys.map((_, i) => '$' + (i + 1)).join(', ')})
       returning ${COLUMNS}`, params);
    return toAppointment(rows[0]);
  }

  async update(id, fields) {
    const keys = columnsFor(fields);
    const params = keys.map(k => (k === 'serviceName' ? JSON.stringify(fields[k]) : fields[k]));
    const sets = keys.map((k, i) => `${FIELDS[k]} = $${i + 1}`);
    sets.push('updated_at = now()');
    const { rows } = await this.query(
      `update appointments set ${sets.join(', ')} where id = $${params.length + 1} returning ${COLUMNS}`,
      [...params, id]);
    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async remove(id) {
    const { rowCount } = await this.query('delete from appointments where id = $1', [id]);
    return rowCount > 0;
  }

  close() {
    return this.pool.end();
  }
}

module.exports = PgStore;
