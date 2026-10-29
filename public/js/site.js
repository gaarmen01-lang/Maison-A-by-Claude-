// Site public : carte des prestations, horaires et formulaire de réservation.
(function () {
  'use strict';

  const { t } = I18n;
  const form = document.getElementById('booking-form');
  const serviceSelect = document.getElementById('service');
  const daysBox = document.getElementById('days');
  const staffBox = document.getElementById('staff');
  const slotsBox = document.getElementById('slots');
  const summary = document.getElementById('summary');
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const success = document.getElementById('booking-success');

  let salon = null;
  let selectedStylist = 'any';
  let selectedDate = null;
  let selectedTime = null;
  let slotsRequest = 0;

  document.getElementById('year').textContent = new Date().getFullYear();

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }

  function serviceById(id) {
    return salon && salon.services.find(s => s.id === id);
  }

  function renderServices() {
    const list = document.getElementById('service-list');
    list.replaceChildren(...salon.services.map(s => {
      const book = el('button', { type: 'button', class: 'link-btn', text: t('services.book') });
      book.addEventListener('click', () => {
        serviceSelect.value = s.id;
        onSelectionChange();
        document.getElementById('reserver').scrollIntoView({ behavior: 'smooth' });
      });
      return el('li', { class: 'service' }, [
        el('div', { class: 'service-main' }, [
          el('h3', { text: s.name[I18n.lang] }),
          el('p', { text: s.description[I18n.lang] })
        ]),
        el('div', { class: 'service-meta' }, [
          el('span', { class: 'price', text: I18n.formatPrice(s.price) }),
          el('span', { class: 'duration', text: s.duration + ' ' + t('min') }),
          book
        ])
      ]);
    }));

    const current = serviceSelect.value;
    serviceSelect.replaceChildren(
      el('option', { value: '', text: t('book.choose') }),
      ...salon.services.map(s => el('option', {
        value: s.id,
        text: `${s.name[I18n.lang]} — ${I18n.formatPrice(s.price)} · ${s.duration} ${t('min')}`
      }))
    );
    serviceSelect.value = current;
  }

  function renderHours() {
    const order = [1, 2, 3, 4, 5, 6, 0];
    document.getElementById('hours-list').replaceChildren(...order.flatMap(day => {
      const h = salon.openingHours[day];
      return [
        el('dt', { text: t('day.' + day) }),
        el('dd', { class: h ? '' : 'closed', text: h ? `${h[0]} – ${h[1]}` : t('hours.closed') })
      ];
    }));
  }

  function stylistById(id) {
    return salon && salon.staff.find(s => s.id === id);
  }

  // Choix de la coiffeuse : « Sans préférence » ou l'une des employées.
  function renderStaff() {
    const options = [
      { id: 'any', initial: '✦', name: t('book.anyStylist'), title: t('book.anyStylistDesc') },
      ...salon.staff.map(s => ({
        id: s.id, initial: s.name[I18n.lang].trim().charAt(0), name: s.name[I18n.lang], title: s.title[I18n.lang]
      }))
    ];
    staffBox.replaceChildren(...options.map(o => {
      const btn = el('button', {
        type: 'button', class: 'stylist-card', role: 'radio', 'aria-checked': String(o.id === selectedStylist)
      }, [
        el('span', { class: 'stylist-avatar', 'aria-hidden': 'true', text: o.initial }),
        el('span', { class: 'stylist-text' }, [
          el('span', { class: 'stylist-name', text: o.name }),
          el('span', { class: 'stylist-title', text: o.title })
        ])
      ]);
      btn.addEventListener('click', () => {
        staffBox.querySelectorAll('.stylist-card').forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        selectedStylist = o.id;
        onSelectionChange();
      });
      return btn;
    }));
  }

  function renderSummary() {
    const s = serviceById(serviceSelect.value);
    if (!s || !selectedDate || !selectedTime) {
      summary.hidden = true;
      return;
    }
    summary.hidden = false;
    summary.replaceChildren(
      el('p', { class: 'label', text: t('book.summary') }),
      el('p', { class: 'summary-main', text: `${s.name[I18n.lang]} — ${I18n.formatPrice(s.price)}` }),
      el('p', { text: `${I18n.formatDate(selectedDate)} · ${selectedTime} (${s.duration} ${t('min')})` }),
      el('p', { text: stylistById(selectedStylist)
        ? t('book.with', { name: stylistById(selectedStylist).name[I18n.lang] })
        : t('book.anyStylist') })
    );
  }

  function addDays(date, n) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Bandeau de jours à faire défiler au doigt (plus pratique que le calendrier natif sur mobile).
  function renderDays() {
    const days = [];
    for (let i = 0; i <= salon.maxDaysAhead; i++) days.push(addDays(salon.today, i));
    daysBox.replaceChildren(...days.map((date, i) => {
      const day = new Date(date + 'T12:00:00');
      const closed = !salon.openingHours[day.getDay()];
      const btn = el('button', {
        type: 'button', class: 'day', role: 'radio',
        'aria-checked': String(date === selectedDate),
        'aria-label': I18n.formatDate(date) + (closed ? ' — ' + t('hours.closed') : '')
      }, [
        el('span', { class: 'day-name', text: I18n.formatDate(date, { weekday: 'short' }).replace('.', '') }),
        el('span', { class: 'day-num', text: String(day.getDate()) }),
        el('span', { class: 'day-month', text: I18n.formatDate(date, { month: 'short' }).replace('.', '') })
      ]);
      if (closed) btn.disabled = true;
      btn.addEventListener('click', () => {
        daysBox.querySelectorAll('.day').forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        selectedDate = date;
        onSelectionChange();
      });
      return btn;
    }));
  }

  function slotMessage(key) {
    slotsBox.replaceChildren(el('p', { class: 'muted', text: t(key) }));
  }

  async function loadSlots() {
    selectedTime = null;
    renderSummary();
    const service = serviceSelect.value;
    const date = selectedDate;
    if (!service || !date) return slotMessage('book.pickDateFirst');

    const day = new Date(date + 'T12:00:00').getDay();
    if (!salon.openingHours[day]) return slotMessage('book.closedDay');

    slotMessage('book.loading');
    const request = ++slotsRequest;
    try {
      const res = await fetch(`/api/slots?date=${encodeURIComponent(date)}&service=${encodeURIComponent(service)}` +
        `&stylist=${encodeURIComponent(selectedStylist)}`);
      const data = await res.json();
      if (request !== slotsRequest) return;
      const free = (data.slots || []).filter(s => s.available);
      if (!free.length) return slotMessage('book.noSlots');
      slotsBox.replaceChildren(...data.slots.map(slot => {
        const btn = el('button', {
          type: 'button', class: 'slot', role: 'radio', 'aria-checked': 'false', text: slot.time
        });
        if (!slot.available) btn.disabled = true;
        btn.addEventListener('click', () => {
          slotsBox.querySelectorAll('.slot').forEach(b => b.setAttribute('aria-checked', 'false'));
          btn.setAttribute('aria-checked', 'true');
          selectedTime = slot.time;
          renderSummary();
          // Sur téléphone, on amène directement la cliente à l'étape suivante.
          if (window.matchMedia('(max-width: 720px)').matches) {
            document.getElementById('step-contact').scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        return btn;
      }));
    } catch (e) {
      if (request === slotsRequest) slotMessage('err.generic');
    }
  }

  function onSelectionChange() {
    errorBox.hidden = true;
    loadSlots();
  }

  function showError(key, fields) {
    errorBox.textContent = t('err.' + key) !== 'err.' + key ? t('err.' + key) : t('err.generic');
    errorBox.hidden = false;
    form.querySelectorAll('.invalid').forEach(n => n.classList.remove('invalid'));
    (fields || []).forEach(name => {
      const input = form.elements[name];
      if (input && input.classList) input.classList.add('invalid');
      if (name === 'date') daysBox.classList.add('invalid');
      if (name === 'time') slotsBox.classList.add('invalid');
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorBox.hidden = true;
    slotsBox.classList.remove('invalid');
    daysBox.classList.remove('invalid');
    const data = Object.fromEntries(new FormData(form));
    data.stylist = selectedStylist;
    data.date = selectedDate || '';
    data.time = selectedTime || '';
    data.lang = I18n.lang;

    const missing = ['service', 'date', 'time', 'lastName', 'firstName', 'email', 'phone']
      .filter(k => !String(data[k] || '').trim());
    if (missing.length) return showError('invalid_fields', missing);

    submitBtn.disabled = true;
    submitBtn.textContent = t('book.sending');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();
      if (!res.ok) {
        showError(body.error, body.fields);
        if (['slot_taken', 'stylist_busy', 'too_soon'].includes(body.error)) loadSlots();
        return;
      }
      document.getElementById('success-text').textContent = t('book.success.text', {
        date: I18n.formatDate(body.date),
        time: body.time,
        stylist: body.stylistName ? body.stylistName[I18n.lang] : '',
        service: body.serviceName[I18n.lang]
      });
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      showError('generic');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t('book.submit');
    }
  });

  document.getElementById('book-again').addEventListener('click', () => {
    form.reset();
    selectedDate = null;
    selectedStylist = 'any';
    renderStaff();
    renderDays();
    form.hidden = false;
    success.hidden = true;
    loadSlots();
  });

  serviceSelect.addEventListener('change', onSelectionChange);
  form.addEventListener('input', e => e.target.classList && e.target.classList.remove('invalid'));

  I18n.onChange(() => {
    if (!salon) return;
    renderServices();
    renderHours();
    renderStaff();
    renderDays();
    renderSummary();
    if (!selectedTime) loadSlots();
  });

  fetch('/api/salon')
    .then(r => r.json())
    .then(data => {
      salon = data;
      I18n.apply();
    });

  // Barre « Appeler / Réserver » en bas de l'écran sur mobile, masquée quand elle ferait doublon.
  const cta = document.getElementById('mobile-cta');
  const hidingSections = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => (e.isIntersecting ? hidingSections.add(e.target) : hidingSections.delete(e.target)));
    cta.classList.toggle('is-hidden', hidingSections.size > 0);
  });
  observer.observe(document.querySelector('.hero-actions'));
  observer.observe(document.getElementById('reserver'));

  I18n.apply();
})();
