'use strict';

// Point d'entrée Vercel : toutes les requêtes /api/* passent par ici.
// Les pages et fichiers de public/ sont servis directement par Vercel (voir vercel.json).

const { createApp } = require('../server');
const PgStore = require('../lib/pg-store');

let app;

module.exports = (req, res) => {
  if (!app) {
    const { DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET } = process.env;
    if (!DATABASE_URL || !ADMIN_PASSWORD || !SESSION_SECRET) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'server_not_configured' }));
    }
    app = createApp({
      store: new PgStore(DATABASE_URL),
      adminPassword: ADMIN_PASSWORD,
      sessionSecret: SESSION_SECRET
    });
  }
  return app.handler(req, res);
};
