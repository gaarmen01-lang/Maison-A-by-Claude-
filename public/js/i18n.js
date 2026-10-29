// Traductions FR / NL partagées par le site public et l'espace administrateur.
(function () {
  'use strict';

  const DICT = {
    fr: {
      'nav.about': 'La Maison',
      'nav.services': 'Prestations',
      'nav.hours': 'Horaires',
      'nav.book': 'Réserver',
      'hero.eyebrow': 'Salon de coiffure · Bruxelles',
      'hero.title': 'L’art de la coiffure, <em>en toute élégance</em>.',
      'hero.lead': 'Un lieu intime dédié à la beauté de vos cheveux. Coupes architecturées, couleurs lumineuses et soins d’exception, réalisés sur-mesure par nos coiffeuses expertes.',
      'hero.cta': 'Prendre rendez-vous',
      'hero.cta2': 'Découvrir nos prestations',
      'about.eyebrow': 'La Maison',
      'about.title': 'Une parenthèse pensée pour vous',
      'about.p1': 'Chez Maison A, chaque rendez-vous commence par un diagnostic attentif. Nous prenons le temps de comprendre votre style, votre quotidien et la nature de vos cheveux.',
      'about.p2': 'Produits professionnels haut de gamme, gestes précis et accueil confidentiel : notre exigence se lit dans chaque détail.',
      'about.f1': 'Diagnostic personnalisé',
      'about.f2': 'Soins haute couture',
      'about.f3': 'Coiffeuses expertes',
      'services.eyebrow': 'La Carte',
      'services.title': 'Nos prestations',
      'services.note': 'Tarifs indicatifs pour cheveux mi-longs. Un devis précis vous est proposé lors du diagnostic.',
      'services.book': 'Réserver',
      'hours.eyebrow': 'Nous rendre visite',
      'hours.title': 'Horaires & adresse',
      'hours.closed': 'Fermé',
      'hours.address': 'Avenue Louise 000<br>1050 Bruxelles',
      'book.eyebrow': 'Réservation',
      'book.title': 'Prendre rendez-vous',
      'book.lead': 'Choisissez votre prestation, puis le jour et l’heure qui vous conviennent. Vous recevrez la confirmation à l’écran.',
      'book.step1': 'Prestation',
      'book.step2': 'Date & heure',
      'book.step3': 'Vos coordonnées',
      'book.choose': 'Choisissez une prestation',
      'book.date': 'Date',
      'book.slots': 'Créneaux disponibles',
      'book.pickDateFirst': 'Sélectionnez une prestation et une date.',
      'book.noSlots': 'Aucun créneau disponible ce jour-là. Essayez une autre date.',
      'book.closedDay': 'Le salon est fermé ce jour-là.',
      'book.loading': 'Chargement…',
      'book.lastName': 'Nom',
      'book.firstName': 'Prénom',
      'book.email': 'E-mail',
      'book.phone': 'Téléphone',
      'book.notes': 'Remarque (facultatif)',
      'book.notesPh': 'Longueur de cheveux, allergie, demande particulière…',
      'book.summary': 'Récapitulatif',
      'book.submit': 'Confirmer le rendez-vous',
      'book.sending': 'Envoi…',
      'book.success.title': 'Merci, votre rendez-vous est confirmé',
      'book.success.text': 'Nous vous attendons le {date} à {time} pour : {service}.',
      'book.success.again': 'Prendre un autre rendez-vous',
      'book.consent': 'Vos données sont utilisées uniquement pour la gestion de votre rendez-vous.',
      'err.invalid_fields': 'Merci de vérifier les champs indiqués.',
      'err.slot_taken': 'Ce créneau vient d’être réservé. Merci d’en choisir un autre.',
      'err.too_soon': 'Ce créneau est trop proche. Merci d’en choisir un autre.',
      'err.too_far': 'Cette date est trop éloignée.',
      'err.closed': 'Le salon est fermé ce jour-là.',
      'err.outside_hours': 'Ce créneau est en dehors de nos horaires.',
      'err.generic': 'Une erreur est survenue. Merci de réessayer ou de nous appeler.',
      'err.bad_password': 'Mot de passe incorrect.',
      'err.too_many_attempts': 'Trop de tentatives. Réessayez dans quelques minutes.',
      'footer.rights': 'Tous droits réservés.',
      'footer.admin': 'Espace salon',
      'min': 'min',
      'day.0': 'Dimanche', 'day.1': 'Lundi', 'day.2': 'Mardi', 'day.3': 'Mercredi',
      'day.4': 'Jeudi', 'day.5': 'Vendredi', 'day.6': 'Samedi',

      'admin.title': 'Espace salon',
      'admin.login': 'Connexion',
      'admin.password': 'Mot de passe',
      'admin.signin': 'Se connecter',
      'admin.logout': 'Déconnexion',
      'admin.backToSite': 'Voir le site',
      'admin.tab.agenda': 'Agenda',
      'admin.tab.new': 'Nouveau rendez-vous',
      'admin.tab.revenue': 'Chiffre d’affaires',
      'admin.today': 'Aujourd’hui',
      'admin.prev': 'Jour précédent',
      'admin.next': 'Jour suivant',
      'admin.dayRevenue': 'CA du jour',
      'admin.dayCount': 'Rendez-vous',
      'admin.dayCancelled': 'Annulés',
      'admin.noAppointments': 'Aucun rendez-vous ce jour-là.',
      'admin.col.time': 'Heure',
      'admin.col.client': 'Cliente',
      'admin.col.service': 'Prestation',
      'admin.col.contact': 'Contact',
      'admin.col.price': 'Prix',
      'admin.col.status': 'Statut',
      'admin.col.actions': '',
      'admin.status.confirmed': 'Confirmé',
      'admin.status.cancelled': 'Annulé',
      'admin.source.online': 'En ligne',
      'admin.source.admin': 'Salon',
      'admin.cancel': 'Annuler',
      'admin.restore': 'Rétablir',
      'admin.delete': 'Supprimer',
      'admin.confirmCancel': 'Annuler ce rendez-vous ?',
      'admin.confirmDelete': 'Supprimer définitivement ce rendez-vous ?',
      'admin.new.lead': 'Enregistrez un rendez-vous pris par téléphone ou au salon. L’e-mail est facultatif et le prix peut être ajusté.',
      'admin.time': 'Heure',
      'admin.price': 'Prix (€)',
      'admin.pricePh': 'Tarif de la carte',
      'admin.create': 'Enregistrer le rendez-vous',
      'admin.created': 'Rendez-vous enregistré.',
      'admin.forceFull': 'Tous les fauteuils sont déjà occupés sur ce créneau. Enregistrer quand même ?',
      'admin.rev.from': 'Du',
      'admin.rev.to': 'Au',
      'admin.rev.week': '7 derniers jours',
      'admin.rev.month': 'Ce mois-ci',
      'admin.rev.next': '30 prochains jours',
      'admin.rev.total': 'CA total',
      'admin.rev.count': 'Rendez-vous',
      'admin.rev.avg': 'Panier moyen',
      'admin.rev.best': 'Meilleur jour',
      'admin.rev.date': 'Date',
      'admin.rev.revenue': 'CA',
      'admin.rev.cancelled': 'Annulés',
      'admin.rev.explain': 'Le chiffre d’affaires est calculé à partir des rendez-vous confirmés (les rendez-vous annulés ne sont pas comptés).',
      'admin.rev.chart': 'Chiffre d’affaires par jour'
    },
    nl: {
      'nav.about': 'Het Huis',
      'nav.services': 'Behandelingen',
      'nav.hours': 'Openingsuren',
      'nav.book': 'Reserveren',
      'hero.eyebrow': 'Kapsalon · Brussel',
      'hero.title': 'De kunst van haarstyling, <em>vol elegantie</em>.',
      'hero.lead': 'Een intieme plek gewijd aan de schoonheid van uw haar. Gestructureerde snitten, stralende kleuren en uitzonderlijke verzorging, op maat uitgevoerd door onze ervaren kapsters.',
      'hero.cta': 'Afspraak maken',
      'hero.cta2': 'Ontdek onze behandelingen',
      'about.eyebrow': 'Het Huis',
      'about.title': 'Een moment speciaal voor u',
      'about.p1': 'Bij Maison A begint elke afspraak met een zorgvuldige diagnose. We nemen de tijd om uw stijl, uw dagelijks leven en de aard van uw haar te begrijpen.',
      'about.p2': 'Professionele topproducten, precieze handelingen en een discreet onthaal: onze veeleisendheid zit in elk detail.',
      'about.f1': 'Persoonlijke diagnose',
      'about.f2': 'Haute-couture verzorging',
      'about.f3': 'Ervaren kapsters',
      'services.eyebrow': 'De Kaart',
      'services.title': 'Onze behandelingen',
      'services.note': 'Indicatieve prijzen voor halflang haar. Een precieze offerte krijgt u tijdens de diagnose.',
      'services.book': 'Reserveren',
      'hours.eyebrow': 'Bezoek ons',
      'hours.title': 'Openingsuren & adres',
      'hours.closed': 'Gesloten',
      'hours.address': 'Louizalaan 000<br>1050 Brussel',
      'book.eyebrow': 'Reservatie',
      'book.title': 'Afspraak maken',
      'book.lead': 'Kies uw behandeling en daarna de dag en het uur die u passen. U krijgt de bevestiging meteen op het scherm.',
      'book.step1': 'Behandeling',
      'book.step2': 'Datum & uur',
      'book.step3': 'Uw gegevens',
      'book.choose': 'Kies een behandeling',
      'book.date': 'Datum',
      'book.slots': 'Beschikbare tijdstippen',
      'book.pickDateFirst': 'Kies een behandeling en een datum.',
      'book.noSlots': 'Geen tijdstip beschikbaar op deze dag. Probeer een andere datum.',
      'book.closedDay': 'Het salon is gesloten op deze dag.',
      'book.loading': 'Laden…',
      'book.lastName': 'Naam',
      'book.firstName': 'Voornaam',
      'book.email': 'E-mail',
      'book.phone': 'Telefoon',
      'book.notes': 'Opmerking (optioneel)',
      'book.notesPh': 'Haarlengte, allergie, speciale wens…',
      'book.summary': 'Overzicht',
      'book.submit': 'Afspraak bevestigen',
      'book.sending': 'Verzenden…',
      'book.success.title': 'Dank u, uw afspraak is bevestigd',
      'book.success.text': 'We verwachten u op {date} om {time} voor: {service}.',
      'book.success.again': 'Nog een afspraak maken',
      'book.consent': 'Uw gegevens worden uitsluitend gebruikt voor het beheer van uw afspraak.',
      'err.invalid_fields': 'Gelieve de aangeduide velden te controleren.',
      'err.slot_taken': 'Dit tijdstip werd net gereserveerd. Gelieve een ander te kiezen.',
      'err.too_soon': 'Dit tijdstip is te dichtbij. Gelieve een ander te kiezen.',
      'err.too_far': 'Deze datum ligt te ver in de toekomst.',
      'err.closed': 'Het salon is gesloten op deze dag.',
      'err.outside_hours': 'Dit tijdstip valt buiten onze openingsuren.',
      'err.generic': 'Er is een fout opgetreden. Probeer opnieuw of bel ons.',
      'err.bad_password': 'Onjuist wachtwoord.',
      'err.too_many_attempts': 'Te veel pogingen. Probeer over enkele minuten opnieuw.',
      'footer.rights': 'Alle rechten voorbehouden.',
      'footer.admin': 'Salonbeheer',
      'min': 'min',
      'day.0': 'Zondag', 'day.1': 'Maandag', 'day.2': 'Dinsdag', 'day.3': 'Woensdag',
      'day.4': 'Donderdag', 'day.5': 'Vrijdag', 'day.6': 'Zaterdag',

      'admin.title': 'Salonbeheer',
      'admin.login': 'Inloggen',
      'admin.password': 'Wachtwoord',
      'admin.signin': 'Inloggen',
      'admin.logout': 'Uitloggen',
      'admin.backToSite': 'Naar de website',
      'admin.tab.agenda': 'Agenda',
      'admin.tab.new': 'Nieuwe afspraak',
      'admin.tab.revenue': 'Omzet',
      'admin.today': 'Vandaag',
      'admin.prev': 'Vorige dag',
      'admin.next': 'Volgende dag',
      'admin.dayRevenue': 'Omzet van de dag',
      'admin.dayCount': 'Afspraken',
      'admin.dayCancelled': 'Geannuleerd',
      'admin.noAppointments': 'Geen afspraken op deze dag.',
      'admin.col.time': 'Uur',
      'admin.col.client': 'Klant',
      'admin.col.service': 'Behandeling',
      'admin.col.contact': 'Contact',
      'admin.col.price': 'Prijs',
      'admin.col.status': 'Status',
      'admin.col.actions': '',
      'admin.status.confirmed': 'Bevestigd',
      'admin.status.cancelled': 'Geannuleerd',
      'admin.source.online': 'Online',
      'admin.source.admin': 'Salon',
      'admin.cancel': 'Annuleren',
      'admin.restore': 'Herstellen',
      'admin.delete': 'Verwijderen',
      'admin.confirmCancel': 'Deze afspraak annuleren?',
      'admin.confirmDelete': 'Deze afspraak definitief verwijderen?',
      'admin.new.lead': 'Registreer een afspraak die telefonisch of in het salon werd gemaakt. E-mail is optioneel en de prijs kan worden aangepast.',
      'admin.time': 'Uur',
      'admin.price': 'Prijs (€)',
      'admin.pricePh': 'Prijs volgens de kaart',
      'admin.create': 'Afspraak opslaan',
      'admin.created': 'Afspraak opgeslagen.',
      'admin.forceFull': 'Alle stoelen zijn al bezet op dit tijdstip. Toch opslaan?',
      'admin.rev.from': 'Van',
      'admin.rev.to': 'Tot',
      'admin.rev.week': 'Laatste 7 dagen',
      'admin.rev.month': 'Deze maand',
      'admin.rev.next': 'Volgende 30 dagen',
      'admin.rev.total': 'Totale omzet',
      'admin.rev.count': 'Afspraken',
      'admin.rev.avg': 'Gemiddeld bedrag',
      'admin.rev.best': 'Beste dag',
      'admin.rev.date': 'Datum',
      'admin.rev.revenue': 'Omzet',
      'admin.rev.cancelled': 'Geannuleerd',
      'admin.rev.explain': 'De omzet wordt berekend op basis van de bevestigde afspraken (geannuleerde afspraken worden niet meegeteld).',
      'admin.rev.chart': 'Omzet per dag'
    }
  };

  function initialLang() {
    try {
      const saved = localStorage.getItem('ma_lang');
      if (saved === 'fr' || saved === 'nl') return saved;
    } catch (e) { /* stockage indisponible */ }
    return (navigator.language || '').toLowerCase().startsWith('nl') ? 'nl' : 'fr';
  }

  let lang = initialLang();
  const listeners = [];

  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) || DICT.fr[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    // Clés contenant un balisage contrôlé (traductions ci-dessus uniquement).
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });
    listeners.forEach(fn => fn(lang));
  }

  function setLang(next) {
    lang = next === 'nl' ? 'nl' : 'fr';
    try { localStorage.setItem('ma_lang', lang); } catch (e) { /* ignoré */ }
    apply();
  }

  function locale() {
    return lang === 'nl' ? 'nl-BE' : 'fr-BE';
  }

  function formatPrice(value) {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }

  function formatDate(iso, opts) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(locale(), opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(y, m - 1, d));
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-lang]');
    if (btn) setLang(btn.dataset.lang);
  });

  window.I18n = {
    t, apply, setLang, formatPrice, formatDate, locale,
    get lang() { return lang; },
    onChange(fn) { listeners.push(fn); }
  };
})();
