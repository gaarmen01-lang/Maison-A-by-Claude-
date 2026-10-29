// Espace administrateur : agenda, saisie de rendez-vous et chiffre d'affaires.
(function () {
  'use strict';

  const { t } = I18n;
  const $ = id => document.getElementById(id);

  let salon = null;
  let today = null;
  let agendaDate = null;
  let activeTab = 'agenda';

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  function addDays(date, n) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  async function api(path, options) {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/login') showLogin();
    if (!res.ok) throw Object.assign(new Error(body.error || 'generic'), { code: body.error, fields: body.fields });
    return body;
  }

  function errorText(err) {
    const key = 'err.' + (err.code || 'generic');
    return t(key) === key ? t('err.generic') : t(key);
  }

  // ---------- connexion ----------

  function showLogin() {
    $('login-view').hidden = false;
    $('dashboard').hidden = true;
    $('logout').hidden = true;
  }

  function showDashboard() {
    $('login-view').hidden = true;
    $('dashboard').hidden = false;
    $('logout').hidden = false;
    refresh();
  }

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-error').hidden = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: { password: e.target.password.value } });
      e.target.reset();
      showDashboard();
    } catch (err) {
      $('login-error').textContent = errorText(err);
      $('login-error').hidden = false;
    }
  });

  $('logout').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // ---------- onglets ----------

  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === tab)));
      document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== activeTab; });
      refresh();
    });
  });

  function refresh() {
    if ($('dashboard').hidden || !salon) return;
    if (activeTab === 'agenda') loadAgenda();
    if (activeTab === 'revenue') loadRevenue();
  }

  // ---------- agenda ----------

  function setAgendaDate(date) {
    agendaDate = date;
    $('agenda-date').value = date;
    loadAgenda();
  }

  $('agenda-date').addEventListener('change', e => e.target.value && setAgendaDate(e.target.value));
  $('day-prev').addEventListener('click', () => setAgendaDate(addDays(agendaDate, -1)));
  $('day-next').addEventListener('click', () => setAgendaDate(addDays(agendaDate, 1)));
  $('day-today').addEventListener('click', () => setAgendaDate(today));

  function actionButton(label, cls, handler) {
    const b = el('button', { type: 'button', class: 'link-btn ' + cls, text: label });
    b.addEventListener('click', handler);
    return b;
  }

  async function changeStatus(a, status) {
    if (status === 'cancelled' && !confirm(t('admin.confirmCancel'))) return;
    try {
      await api('/api/admin/appointments/' + a.id, { method: 'PATCH', body: { status } });
    } catch (err) {
      if (err.code === 'slot_taken' && confirm(t('admin.forceFull'))) {
        await api('/api/admin/appointments/' + a.id, { method: 'PATCH', body: { status, force: true } });
      } else if (err.code !== 'slot_taken') {
        alert(errorText(err));
      }
    }
    loadAgenda();
  }

  async function removeAppointment(a) {
    if (!confirm(t('admin.confirmDelete'))) return;
    await api('/api/admin/appointments/' + a.id, { method: 'DELETE' }).catch(err => alert(errorText(err)));
    loadAgenda();
  }

  async function loadAgenda() {
    $('agenda-title').textContent = I18n.formatDate(agendaDate);
    const { appointments } = await api(`/api/admin/appointments?from=${agendaDate}&to=${agendaDate}`);
    const confirmed = appointments.filter(a => a.status === 'confirmed');
    $('kpi-day-revenue').textContent = I18n.formatPrice(confirmed.reduce((s, a) => s + a.price, 0));
    $('kpi-day-count').textContent = confirmed.length;
    $('kpi-day-cancelled').textContent = appointments.length - confirmed.length;

    const body = $('agenda-body');
    if (!appointments.length) {
      body.replaceChildren(el('tr', {}, [el('td', { colspan: '7', class: 'empty', text: t('admin.noAppointments') })]));
      return;
    }
    body.replaceChildren(...appointments.map(a => {
      const cancelled = a.status === 'cancelled';
      const contact = el('td', { class: 'contact' }, [
        el('a', { href: 'tel:' + a.phone.replace(/[^+0-9]/g, ''), text: a.phone })
      ]);
      if (a.email) contact.append(el('br'), el('a', { href: 'mailto:' + a.email, text: a.email }));

      const client = el('td', {}, [
        el('strong', { text: `${a.firstName} ${a.lastName}` }),
        el('span', { class: 'tag', text: t('admin.source.' + a.source) })
      ]);
      if (a.notes) client.append(el('small', { class: 'notes', text: a.notes }));

      const end = (() => {
        const [h, m] = a.time.split(':').map(Number);
        const total = h * 60 + m + a.duration;
        return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
      })();

      return el('tr', { class: cancelled ? 'is-cancelled' : '' }, [
        el('td', { class: 'time' }, [el('strong', { text: a.time }), el('small', { text: '→ ' + end })]),
        client,
        el('td', { text: a.serviceName[I18n.lang] }),
        contact,
        el('td', { class: 'num', text: I18n.formatPrice(a.price) }),
        el('td', {}, [el('span', { class: 'status status-' + a.status, text: t('admin.status.' + a.status) })]),
        el('td', { class: 'actions' }, [
          cancelled
            ? actionButton(t('admin.restore'), '', () => changeStatus(a, 'confirmed'))
            : actionButton(t('admin.cancel'), '', () => changeStatus(a, 'cancelled')),
          actionButton(t('admin.delete'), 'danger', () => removeAppointment(a))
        ])
      ]);
    }));
  }

  // ---------- nouveau rendez-vous ----------

  function renderServiceOptions() {
    const select = $('admin-service');
    const current = select.value;
    select.replaceChildren(...salon.services.map(s => el('option', {
      value: s.id, text: `${s.name[I18n.lang]} — ${I18n.formatPrice(s.price)} · ${s.duration} ${t('min')}`
    })));
    if (current) select.value = current;
  }

  async function submitAdminForm(force) {
    const form = $('admin-form');
    const data = Object.fromEntries(new FormData(form));
    data.lang = I18n.lang;
    data.force = force;
    form.querySelectorAll('.invalid').forEach(n => n.classList.remove('invalid'));
    $('admin-error').hidden = true;
    $('admin-ok').hidden = true;
    try {
      const created = await api('/api/admin/appointments', { method: 'POST', body: data });
      form.reset();
      form.date.value = created.date;
      $('admin-ok').textContent = `${t('admin.created')} ${I18n.formatDate(created.date)} · ${created.time} — ${created.firstName} ${created.lastName}`;
      $('admin-ok').hidden = false;
      agendaDate = created.date;
      $('agenda-date').value = created.date;
    } catch (err) {
      if (err.code === 'slot_taken' && !force && confirm(t('admin.forceFull'))) return submitAdminForm(true);
      (err.fields || []).forEach(name => form.elements[name] && form.elements[name].classList.add('invalid'));
      $('admin-error').textContent = errorText(err);
      $('admin-error').hidden = false;
    }
  }

  $('admin-form').addEventListener('submit', e => {
    e.preventDefault();
    submitAdminForm(false);
  });

  // ---------- chiffre d'affaires ----------

  function setRange(from, to) {
    $('rev-from').value = from;
    $('rev-to').value = to;
    loadRevenue();
  }

  document.querySelectorAll('[data-range]').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.dataset.range === 'week') setRange(addDays(today, -6), today);
      if (chip.dataset.range === 'month') {
        const first = today.slice(0, 8) + '01';
        const d = new Date(today + 'T12:00:00');
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
        setRange(first, last.toISOString().slice(0, 10));
      }
      if (chip.dataset.range === 'next') setRange(today, addDays(today, 29));
    });
  });
  $('rev-from').addEventListener('change', loadRevenue);
  $('rev-to').addEventListener('change', loadRevenue);

  function renderChart(days) {
    const max = Math.max(...days.map(d => d.revenue), 1);
    const chart = $('rev-chart');
    chart.style.setProperty('--bars', days.length);
    chart.replaceChildren(...days.map(d => {
      const label = I18n.formatDate(d.date, { day: 'numeric', month: 'short' });
      const bar = el('div', { class: 'bar' + (d.date === today ? ' is-today' : '') }, [
        el('span', { class: 'bar-value', text: d.revenue ? I18n.formatPrice(d.revenue) : '' }),
        el('span', { class: 'bar-track' }, [el('span', { class: 'bar-fill' })]),
        el('span', { class: 'bar-label', text: label })
      ]);
      bar.querySelector('.bar-fill').style.height = (d.revenue / max) * 100 + '%';
      bar.title = `${I18n.formatDate(d.date)} — ${I18n.formatPrice(d.revenue)} (${d.appointments})`;
      return bar;
    }));
    chart.classList.toggle('dense', days.length > 14);
  }

  async function loadRevenue() {
    const from = $('rev-from').value;
    const to = $('rev-to').value;
    if (!from || !to || from > to) return;
    const data = await api(`/api/admin/revenue?from=${from}&to=${to}`).catch(err => {
      alert(errorText(err));
      return null;
    });
    if (!data) return;

    $('rev-total').textContent = I18n.formatPrice(data.total);
    $('rev-count').textContent = data.appointments;
    $('rev-avg').textContent = I18n.formatPrice(data.averageTicket);
    const best = data.days.reduce((b, d) => (d.revenue > (b ? b.revenue : 0) ? d : b), null);
    $('rev-best').textContent = best
      ? `${I18n.formatDate(best.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${I18n.formatPrice(best.revenue)}`
      : '—';

    renderChart(data.days);

    $('rev-body').replaceChildren(...data.days.map(d => {
      const link = el('a', { href: '#', text: I18n.formatDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' }) });
      link.addEventListener('click', e => {
        e.preventDefault();
        agendaDate = d.date;
        $('agenda-date').value = d.date;
        document.querySelector('[data-tab="agenda"]').click();
      });
      return el('tr', { class: d.revenue ? '' : 'is-empty' }, [
        el('td', {}, [link]),
        el('td', { class: 'num', text: String(d.appointments) }),
        el('td', { class: 'num', text: String(d.cancelled) }),
        el('td', { class: 'num strong', text: I18n.formatPrice(d.revenue) })
      ]);
    }));
    $('rev-foot-count').textContent = data.appointments;
    $('rev-foot-cancelled').textContent = data.days.reduce((s, d) => s + d.cancelled, 0);
    $('rev-foot-total').textContent = I18n.formatPrice(data.total);
  }

  // ---------- démarrage ----------

  I18n.onChange(() => {
    if (!salon) return;
    renderServiceOptions();
    refresh();
  });

  (async function init() {
    I18n.apply();
    salon = await api('/api/salon');
    today = salon.today;
    agendaDate = today;
    $('agenda-date').value = today;
    $('rev-from').value = addDays(today, -6);
    $('rev-to').value = today;
    $('admin-form').date.value = today;
    renderServiceOptions();
    const { authenticated } = await api('/api/admin/session');
    if (authenticated) showDashboard();
    else showLogin();
  })();
})();
