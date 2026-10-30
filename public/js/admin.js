// Espace administrateur : agenda, saisie de rendez-vous et chiffre d'affaires.
(function () {
  'use strict';

  const { t } = I18n;
  const $ = id => document.getElementById(id);

  let salon = null;
  let today = null;
  let agendaDate = null;
  let activeTab = 'agenda';
  let agendaView = 'calendar';
  let miniMonth = null; // mois affiché dans le mini-calendrier (YYYY-MM)

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
      window.scrollTo(0, 0);
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
    miniMonth = date.slice(0, 7);
    $('agenda-date').value = date;
    loadAgenda();
  }

  $('agenda-date').addEventListener('change', e => e.target.value && setAgendaDate(e.target.value));
  // En vue semaine, les flèches avancent d'une semaine.
  $('day-prev').addEventListener('click', () => setAgendaDate(addDays(agendaDate, agendaView === 'week' ? -7 : -1)));
  $('day-next').addEventListener('click', () => setAgendaDate(addDays(agendaDate, agendaView === 'week' ? 7 : 1)));

  function actionButton(label, cls, handler) {
    const b = el('button', { type: 'button', class: 'link-btn ' + cls, text: label });
    b.addEventListener('click', handler);
    return b;
  }

  async function changeStatus(a, status) {
    if (status === 'cancelled' && !confirm(t('admin.confirmCancel'))) return;
    try {
      await api('/api/admin/appointments/' + a.id, { method: 'PATCH', body: { status } });
      closeDialog();
    } catch (err) {
      alert(errorText(err));
    }
    loadAgenda();
  }

  async function removeAppointment(a) {
    if (!confirm(t('admin.confirmDelete'))) return;
    await api('/api/admin/appointments/' + a.id, { method: 'DELETE' })
      .then(closeDialog)
      .catch(err => alert(errorText(err)));
    loadAgenda();
  }

  // ---------- calendrier (vue planning) ----------

  // Couleur douce par prestation, dans la palette du salon.
  const SERVICE_COLORS = ['#c98f86', '#d9b48f', '#9fb3a2', '#8e9aaf', '#b98b6e', '#c4a5b8', '#a7a37e'];

  function serviceColor(id) {
    const index = salon.services.findIndex(s => s.id === id);
    return SERVICE_COLORS[(index < 0 ? 0 : index) % SERVICE_COLORS.length];
  }

  function toMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function toTime(minutes) {
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  }

  function weekdayOf(date) {
    return new Date(date + 'T12:00:00').getDay();
  }

  function nowMinutes() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const get = type => Number(parts.find(p => p.type === type).value);
    return get('hour') * 60 + get('minute');
  }

  function renderPlanner(appointments, filter) {
    const hours = salon.openingHours[weekdayOf(agendaDate)];
    const planner = $('planner');
    const staff = filter ? salon.staff.filter(s => s.id === filter) : salon.staff;
    // Plage affichée : heures d'ouverture arrondies à l'heure (ou 9h-19h si fermé), élargie si un rendez-vous déborde.
    let start = hours ? Math.floor(toMinutes(hours[0]) / 60) * 60 : 9 * 60;
    let end = hours ? Math.ceil(toMinutes(hours[1]) / 60) * 60 : 19 * 60;
    appointments.forEach(a => {
      start = Math.min(start, Math.floor(toMinutes(a.time) / 60) * 60);
      end = Math.max(end, Math.ceil((toMinutes(a.time) + a.duration) / 60) * 60);
    });
    const ppm = window.matchMedia('(max-width: 720px)').matches ? 1.3 : 1.6; // pixels par minute
    const height = (end - start) * ppm;
    planner.style.setProperty('--cols', staff.length);
    planner.style.setProperty('--hour-h', 60 * ppm + 'px');

    const head = el('div', { class: 'planner-head' }, [
      el('div', { class: 'planner-corner' }),
      ...staff.map(s => {
        const own = appointments.filter(a => a.stylist === s.id);
        return el('div', { class: 'planner-staff' }, [
          el('span', { class: 'staff-avatar', 'aria-hidden': 'true', text: s.name[I18n.lang].trim().charAt(0) }),
          el('span', { class: 'staff-text' }, [
            el('strong', { text: s.name[I18n.lang] }),
            el('small', { text: `${own.length} · ${I18n.formatPrice(own.reduce((sum, a) => sum + a.price, 0))}` })
          ])
        ]);
      })
    ]);

    const axis = el('div', { class: 'planner-axis' });
    axis.style.height = height + 'px';
    for (let m = start; m < end; m += 60) {
      const label = el('span', { text: toTime(m) });
      label.style.top = (m - start) * ppm + 'px';
      axis.append(label);
    }

    const columns = staff.map(s => {
      const col = el('div', { class: 'planner-col', 'data-stylist': s.id });
      col.style.height = height + 'px';
      // Zones fermées (avant l'ouverture / après la fermeture) grisées.
      if (!hours) {
        col.classList.add('is-closed');
      } else {
        const before = toMinutes(hours[0]) - start;
        const after = end - toMinutes(hours[1]);
        const off = (edge, minutes) => {
          const zone = el('div', { class: 'planner-off' });
          zone.style[edge] = '0';
          zone.style.height = minutes * ppm + 'px';
          col.append(zone);
        };
        if (before > 0) off('top', before);
        if (after > 0) off('bottom', after);
      }

      const ghost = el('div', { class: 'planner-ghost', 'aria-hidden': 'true' });
      col.append(ghost);
      const slotAt = e => {
        const y = e.clientY - col.getBoundingClientRect().top;
        return Math.min(end - 15, start + Math.floor(y / ppm / 15) * 15);
      };
      col.addEventListener('mousemove', e => {
        if (e.target.closest('.planner-appt')) { ghost.hidden = true; return; }
        const m = slotAt(e);
        ghost.hidden = false;
        ghost.style.top = (m - start) * ppm + 'px';
        ghost.style.height = 30 * ppm + 'px';
        ghost.textContent = '+ ' + toTime(m);
      });
      col.addEventListener('mouseleave', () => { ghost.hidden = true; });
      col.addEventListener('click', e => {
        if (e.target.closest('.planner-appt')) return;
        openNewAppointment(s.id, toTime(slotAt(e)));
      });

      appointments.filter(a => a.stylist === s.id).forEach(a => {
        const top = (toMinutes(a.time) - start) * ppm;
        const block = el('button', { type: 'button', class: 'planner-appt' }, [
          el('span', { class: 'appt-time', text: `${a.time} – ${toTime(toMinutes(a.time) + a.duration)}` }),
          el('strong', { class: 'appt-client', text: `${a.firstName} ${a.lastName}` }),
          el('span', { class: 'appt-service', text: a.serviceName[I18n.lang] })
        ]);
        if (a.notes) block.append(el('span', { class: 'appt-note', text: a.notes }));
        block.style.top = top + 'px';
        block.style.height = Math.max(a.duration * ppm - 2, 22) + 'px';
        block.style.setProperty('--appt', serviceColor(a.service));
        if (a.duration * ppm < 56) block.classList.add('is-short');
        block.addEventListener('click', () => openAppointment(a));
        col.append(block);
      });
      return col;
    });

    const body = el('div', { class: 'planner-body' }, [axis, ...columns]);
    if (agendaDate === today && hours) {
      const m = nowMinutes();
      if (m >= start && m <= end) {
        const line = el('div', { class: 'planner-now', 'aria-hidden': 'true' });
        line.style.top = (m - start) * ppm + 'px';
        body.append(line);
      }
    }
    planner.replaceChildren(...(hours ? [] : [el('p', { class: 'planner-closed', text: t('admin.closedDay') })]), head, body);
  }

  // Ouvre le formulaire « Nouveau rendez-vous » prérempli depuis un créneau libre.
  function openNewAppointment(stylist, time) {
    document.querySelector('[data-tab="new"]').click();
    const form = $('admin-form');
    form.date.value = agendaDate;
    form.time.value = time;
    form.stylist.value = stylist;
    $('admin-ok').hidden = true;
    $('admin-error').hidden = true;
    form.lastName.focus();
  }

  // ---------- fiche rendez-vous ----------

  function closeDialog() {
    if ($('appt-dialog').open) $('appt-dialog').close();
  }

  function openAppointment(a) {
    const end = toTime(toMinutes(a.time) + a.duration);
    $('appt-swatch').style.background = serviceColor(a.service);
    $('appt-time').textContent = `${I18n.formatDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${a.time} – ${end}`;
    $('appt-client').textContent = `${a.firstName} ${a.lastName}`;
    const rows = [
      [t('admin.col.service'), a.serviceName[I18n.lang]],
      [t('admin.col.stylist'), stylistName(a.stylist) + (a.source === 'online' && a.stylistRequested ? ` (${t('admin.requested')})` : '')],
      [t('admin.col.price'), I18n.formatPrice(a.price)],
      [t('admin.col.status'), `${t('admin.status.' + a.status)} · ${t('admin.source.' + a.source)}`]
    ];
    if (a.notes) rows.push([t('book.notes'), a.notes]);
    $('appt-details').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

    const contact = [el('a', { class: 'btn btn-small', href: 'tel:' + a.phone.replace(/[^+0-9]/g, ''), text: `${t('admin.call')} · ${a.phone}` })];
    if (a.email) contact.push(el('a', { class: 'btn btn-small btn-ghost', href: 'mailto:' + a.email, text: a.email }));
    $('appt-contact').replaceChildren(...contact);

    $('appt-actions').replaceChildren(
      a.status === 'cancelled'
        ? actionButton(t('admin.restore'), '', () => changeStatus(a, 'confirmed'))
        : actionButton(t('admin.cancel'), '', () => changeStatus(a, 'cancelled')),
      actionButton(t('admin.delete'), 'danger', () => removeAppointment(a))
    );
    $('appt-dialog').showModal();
  }

  $('appt-close').addEventListener('click', closeDialog);
  // Clic sur le fond assombri : fermeture.
  $('appt-dialog').addEventListener('click', e => { if (e.target === $('appt-dialog')) closeDialog(); });

  // ---------- mini-calendrier mensuel ----------

  async function renderMiniCal() {
    const box = $('mini-cal');
    if (getComputedStyle(box).display === 'none') return;
    const month = miniMonth || agendaDate.slice(0, 7);
    miniMonth = month;
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const last = `${month}-${String(daysInMonth).padStart(2, '0')}`;
    const { appointments } = await api(`/api/admin/appointments?from=${first}&to=${last}`).catch(() => ({ appointments: [] }));
    const busy = new Set(appointments.filter(a => a.status === 'confirmed').map(a => a.date));

    const shift = month => {
      const d = new Date(y, m - 1 + month, 1, 12);
      miniMonth = d.toISOString().slice(0, 7);
      renderMiniCal();
    };
    const prev = el('button', { type: 'button', class: 'mini-nav', 'aria-label': t('admin.prev'), text: '«' });
    const next = el('button', { type: 'button', class: 'mini-nav', 'aria-label': t('admin.next'), text: '»' });
    prev.addEventListener('click', () => shift(-1));
    next.addEventListener('click', () => shift(1));
    const title = new Intl.DateTimeFormat(I18n.locale(), { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));

    // En-têtes lundi → dimanche.
    const names = [1, 2, 3, 4, 5, 6, 0].map(d =>
      el('span', { class: 'mini-dow', text: I18n.formatDate(`2026-11-0${d === 0 ? 8 : d + 1}`, { weekday: 'narrow' }) }));
    const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const cells = Array.from({ length: offset }, () => el('span'));
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const cls = ['mini-day'];
      if (date === agendaDate) cls.push('is-selected');
      if (agendaView === 'week' && date >= mondayOf(agendaDate) && date <= addDays(mondayOf(agendaDate), 6)) cls.push('is-in-week');
      if (date === today) cls.push('is-today');
      if (!salon.openingHours[weekdayOf(date)]) cls.push('is-closed');
      if (busy.has(date)) cls.push('has-appts');
      const btn = el('button', { type: 'button', class: cls.join(' '), text: String(d) });
      btn.addEventListener('click', () => setAgendaDate(date));
      cells.push(btn);
    }
    box.replaceChildren(
      el('div', { class: 'mini-head' }, [prev, el('strong', { text: title }), next]),
      el('div', { class: 'mini-grid' }, [...names, ...cells])
    );
  }

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      agendaView = btn.dataset.view;
      document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      loadAgenda();
    });
  });

  function stylistName(id) {
    const s = salon.staff.find(x => x.id === id);
    return s ? s.name[I18n.lang] : '—';
  }

  function renderStylistOptions() {
    const filter = $('agenda-stylist');
    const currentFilter = filter.value;
    filter.replaceChildren(
      el('option', { value: '', text: t('admin.allStylists') }),
      ...salon.staff.map(s => el('option', { value: s.id, text: s.name[I18n.lang] }))
    );
    filter.value = currentFilter;

    const select = $('admin-stylist');
    const current = select.value;
    select.replaceChildren(
      el('option', { value: 'any', text: t('admin.autoStylist') }),
      ...salon.staff.map(s => el('option', { value: s.id, text: s.name[I18n.lang] }))
    );
    if (current) select.value = current;
  }

  $('agenda-stylist').addEventListener('change', () => loadAgenda());

  // Lundi de la semaine contenant `date`.
  function mondayOf(date) {
    return addDays(date, -((weekdayOf(date) + 6) % 7));
  }

  async function loadAgenda() {
    const week = agendaView === 'week';
    const from = week ? mondayOf(agendaDate) : agendaDate;
    const to = week ? addDays(from, 6) : agendaDate;
    $('agenda-title').textContent = week
      ? t('admin.weekTitle', {
        from: I18n.formatDate(from, { day: 'numeric', month: 'long' }),
        to: I18n.formatDate(to, { day: 'numeric', month: 'long', year: 'numeric' })
      })
      : I18n.formatDate(agendaDate);
    const filter = $('agenda-stylist').value;
    const { appointments: all } = await api(`/api/admin/appointments?from=${from}&to=${to}`);
    const appointments = filter ? all.filter(a => a.stylist === filter) : all;
    const confirmed = appointments.filter(a => a.status === 'confirmed');
    $('kpi-day-revenue').previousElementSibling.textContent = t(week ? 'admin.weekRevenue' : 'admin.dayRevenue');
    $('kpi-day-revenue').textContent = I18n.formatPrice(confirmed.reduce((s, a) => s + a.price, 0));
    $('kpi-day-count').textContent = confirmed.length;
    $('kpi-day-cancelled').textContent = appointments.length - confirmed.length;

    const calendar = agendaView !== 'list';
    $('planner').hidden = !calendar;
    $('agenda-list').hidden = calendar;
    const cancelled = appointments.length - confirmed.length;
    $('planner-note').hidden = !calendar || !cancelled;
    $('planner-note').textContent = t('admin.cancelledHidden', { n: cancelled });
    if (agendaView === 'calendar') renderPlanner(confirmed, filter);
    else if (week) renderWeek(confirmed, filter, from);
    else renderList(appointments);
    renderMiniCal();
  }

  // Vue semaine : une colonne par jour ; sans filtre, chaque jour est partagé en une bande par coiffeuse.
  function renderWeek(appointments, filter, monday) {
    const planner = $('planner');
    const staff = filter ? salon.staff.filter(s => s.id === filter) : salon.staff;
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    let start = 24 * 60;
    let end = 0;
    days.forEach(d => {
      const h = salon.openingHours[weekdayOf(d)];
      if (h) {
        start = Math.min(start, Math.floor(toMinutes(h[0]) / 60) * 60);
        end = Math.max(end, Math.ceil(toMinutes(h[1]) / 60) * 60);
      }
    });
    if (start >= end) { start = 9 * 60; end = 19 * 60; }
    appointments.forEach(a => {
      start = Math.min(start, Math.floor(toMinutes(a.time) / 60) * 60);
      end = Math.max(end, Math.ceil((toMinutes(a.time) + a.duration) / 60) * 60);
    });
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    const ppm = mobile ? 1 : 1.2;
    const height = (end - start) * ppm;
    planner.style.setProperty('--cols', 7);
    planner.style.setProperty('--hour-h', 60 * ppm + 'px');

    const head = el('div', { class: 'planner-head is-week' }, [
      el('div', { class: 'planner-corner' }),
      ...days.map(d => {
        const own = appointments.filter(a => a.date === d);
        const btn = el('button', { type: 'button', class: 'week-day' + (d === today ? ' is-today' : '') }, [
          el('span', { class: 'week-dow', text: I18n.formatDate(d, { weekday: 'short' }).replace('.', '') }),
          el('strong', { class: 'week-num', text: String(Number(d.slice(8))) }),
          el('small', { text: own.length ? `${own.length} · ${I18n.formatPrice(own.reduce((s, a) => s + a.price, 0))}` : '—' })
        ]);
        // Clic sur l'en-tête : ouvre ce jour en vue « Jour ».
        btn.addEventListener('click', () => {
          agendaView = 'calendar';
          document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'calendar')));
          setAgendaDate(d);
        });
        return btn;
      })
    ]);

    const axis = el('div', { class: 'planner-axis' });
    axis.style.height = height + 'px';
    for (let m = start; m < end; m += 60) {
      const label = el('span', { text: toTime(m) });
      label.style.top = (m - start) * ppm + 'px';
      axis.append(label);
    }

    const columns = days.map(d => {
      const hours = salon.openingHours[weekdayOf(d)];
      const col = el('div', { class: 'planner-col week-col' + (hours ? '' : ' is-closed') + (d === today ? ' is-today' : '') });
      col.style.height = height + 'px';
      if (hours) {
        const off = (edge, minutes) => {
          const zone = el('div', { class: 'planner-off' });
          zone.style[edge] = '0';
          zone.style.height = minutes * ppm + 'px';
          col.append(zone);
        };
        if (toMinutes(hours[0]) > start) off('top', toMinutes(hours[0]) - start);
        if (end > toMinutes(hours[1])) off('bottom', end - toMinutes(hours[1]));
      }
      const laneWidth = 100 / staff.length;
      col.addEventListener('click', e => {
        if (e.target.closest('.planner-appt')) return;
        const rect = col.getBoundingClientRect();
        const minutes = Math.min(end - 15, start + Math.floor((e.clientY - rect.top) / ppm / 15) * 15);
        const lane = Math.min(staff.length - 1, Math.floor((e.clientX - rect.left) / rect.width * staff.length));
        agendaDate = d;
        openNewAppointment(staff[lane].id, toTime(minutes));
      });
      appointments.filter(a => a.date === d).forEach(a => {
        const lane = Math.max(0, staff.findIndex(s => s.id === a.stylist));
        const block = el('button', { type: 'button', class: 'planner-appt is-compact' }, [
          el('span', { class: 'appt-time', text: a.time }),
          el('strong', { class: 'appt-client', text: mobile ? a.firstName : `${a.firstName} ${a.lastName}` }),
          el('span', { class: 'appt-service', text: a.serviceName[I18n.lang] })
        ]);
        block.style.top = (toMinutes(a.time) - start) * ppm + 'px';
        block.style.height = Math.max(a.duration * ppm - 2, 18) + 'px';
        block.style.left = `calc(${lane * laneWidth}% + 2px)`;
        block.style.width = `calc(${laneWidth}% - 4px)`;
        block.style.right = 'auto';
        block.style.setProperty('--appt', serviceColor(a.service));
        block.title = `${a.time} – ${toTime(toMinutes(a.time) + a.duration)} · ${a.firstName} ${a.lastName} · ${a.serviceName[I18n.lang]} · ${stylistName(a.stylist)}`;
        block.addEventListener('click', () => openAppointment(a));
        col.append(block);
      });
      return col;
    });

    const body = el('div', { class: 'planner-body' }, [axis, ...columns]);
    planner.replaceChildren(head, body);
    // Légende des bandes (une par coiffeuse) quand les deux sont affichées.
    if (staff.length > 1) {
      planner.append(el('p', { class: 'week-legend' }, staff.map((s, i) =>
        el('span', { text: `${i === 0 ? '◧' : '◨'} ${s.name[I18n.lang]}` }))));
    }
  }

  function renderList(appointments) {
    const body = $('agenda-body');
    if (!appointments.length) {
      body.replaceChildren(el('tr', {}, [el('td', { colspan: '8', class: 'empty', text: t('admin.noAppointments') })]));
      return;
    }
    body.replaceChildren(...appointments.map(a => {
      const cancelled = a.status === 'cancelled';
      const contact = el('td', { class: 'contact' }, [
        el('a', { class: 'phone', href: 'tel:' + a.phone.replace(/[^+0-9]/g, ''), text: a.phone })
      ]);
      if (a.email) contact.append(el('br'), el('a', { href: 'mailto:' + a.email, text: a.email }));

      const client = el('td', { class: 'client' }, [
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
        el('td', { class: 'appt-service', text: a.serviceName[I18n.lang] }),
        el('td', { class: 'stylist' }, [
          stylistName(a.stylist),
          ...(a.source === 'online' && a.stylistRequested ? [el('span', { class: 'tag', text: t('admin.requested') })] : [])
        ]),
        contact,
        el('td', { class: 'num appt-price', text: I18n.formatPrice(a.price) }),
        el('td', { class: 'status-cell' }, [el('span', { class: 'status status-' + a.status, text: t('admin.status.' + a.status) })]),
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

  async function submitAdminForm() {
    const form = $('admin-form');
    const data = Object.fromEntries(new FormData(form));
    data.lang = I18n.lang;
    form.querySelectorAll('.invalid').forEach(n => n.classList.remove('invalid'));
    $('admin-error').hidden = true;
    $('admin-ok').hidden = true;
    try {
      const created = await api('/api/admin/appointments', { method: 'POST', body: data });
      form.reset();
      form.date.value = created.date;
      $('admin-ok').textContent = `${t('admin.created')} ${I18n.formatDate(created.date)} · ${created.time} — ${created.firstName} ${created.lastName} · ${stylistName(created.stylist)}` +
        (created.emailSent ? ` ${t('admin.emailSent')}` : '');
      $('admin-ok').hidden = false;
      agendaDate = created.date;
      $('agenda-date').value = created.date;
    } catch (err) {
      (err.fields || []).forEach(name => form.elements[name] && form.elements[name].classList.add('invalid'));
      $('admin-error').textContent = errorText(err);
      $('admin-error').hidden = false;
    }
  }

  $('admin-form').addEventListener('submit', e => {
    e.preventDefault();
    submitAdminForm();
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

    $('rev-staff').replaceChildren(...data.byStylist.map(s => el('div', { class: 'kpi' }, [
      el('span', { class: 'kpi-label', text: stylistName(s.id) }),
      el('span', { class: 'kpi-value', text: I18n.formatPrice(s.revenue) }),
      el('small', { class: 'kpi-sub', text: `${s.appointments} ${t('admin.rev.count').toLowerCase()}` })
    ])));

    // Une colonne de CA par coiffeuse, avant le total.
    document.querySelectorAll('.col-stylist').forEach(n => n.remove());
    salon.staff.forEach(s => {
      $('rev-head-total').before(el('th', { class: 'num col-stylist', text: s.name[I18n.lang] }));
      const own = data.byStylist.find(x => x.id === s.id);
      $('rev-foot-total').before(el('th', { class: 'num col-stylist', text: I18n.formatPrice(own ? own.revenue : 0) }));
    });

    renderChart(data.days);

    $('rev-body').replaceChildren(...data.days.map(d => {
      const link = el('a', { href: '#' }, [
        el('span', { class: 'date-long', text: I18n.formatDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' }) }),
        el('span', { class: 'date-short', text: I18n.formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }) })
      ]);
      link.addEventListener('click', e => {
        e.preventDefault();
        agendaDate = d.date;
        $('agenda-date').value = d.date;
        document.querySelector('[data-tab="agenda"]').click();
      });
      return el('tr', { class: d.revenue ? '' : 'is-empty' }, [
        el('td', {}, [link]),
        el('td', { class: 'num col-count', text: String(d.appointments) }),
        el('td', { class: 'num col-cancelled', text: String(d.cancelled) }),
        ...salon.staff.map(s => el('td', { class: 'num col-stylist', text: I18n.formatPrice(d.byStylist[s.id] || 0) })),
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
    renderStylistOptions();
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
    renderStylistOptions();
    const { authenticated } = await api('/api/admin/session');
    if (authenticated) showDashboard();
    else showLogin();
  })();
})();
