'use strict';

// Configuration du salon : horaires, prestations et tarifs.
// Modifiez ce fichier pour adapter le site à votre salon.

module.exports = {
  salonName: 'Maison A',
  currency: 'EUR',

  // Coordonnées reprises dans les e-mails de confirmation (à compléter avec les vraies informations).
  contact: {
    website: 'https://maisona-studio.be',
    phone: '+32 2 000 00 00',
    email: 'maisona@maisona-studio.be',
    address: { fr: 'Graaf van Egmontstraat 12, 2800 Malines (Mechelen)', nl: 'Graaf van Egmontstraat 12, 2800 Mechelen' }
  },

  // Fuseau horaire du salon (heures d'ouverture, « aujourd'hui », délai minimum).
  timeZone: 'Europe/Brussels',

  // Intervalle entre deux créneaux proposés aux clientes (minutes).
  slotMinutes: 30,

  // Coiffeuses du salon. Chacune ne peut avoir qu'un rendez-vous à la fois.
  // Remplacez les noms par les vrais prénoms (ex. name: { fr: 'Sarah', nl: 'Sarah' }).
  // L'identifiant (id) ne doit plus changer une fois des rendez-vous enregistrés.
  staff: [
    {
      id: 'employee-1',
      name: { fr: 'Employée 1', nl: 'Medewerkster 1' },
      title: { fr: 'Coiffeuse coloriste', nl: 'Kapster & kleurspecialiste' }
    },
    {
      id: 'employee-2',
      name: { fr: 'Employée 2', nl: 'Medewerkster 2' },
      title: { fr: 'Coiffeuse styliste', nl: 'Kapster & styliste' }
    }
  ],

  // Réservation en ligne possible jusqu'à N jours à l'avance.
  maxDaysAhead: 90,

  // Délai minimum avant un rendez-vous pris en ligne (minutes).
  minNoticeMinutes: 120,

  // Horaires d'ouverture par jour de la semaine (0 = dimanche). null = fermé.
  openingHours: {
    0: null,
    1: ['09:00', '18:00'],
    2: ['09:00', '18:00'],
    3: ['09:00', '18:00'],
    4: ['09:00', '18:00'],
    5: ['09:00', '19:00'],
    6: ['08:00', '16:00']
  },

  services: [
    {
      id: 'brushing',
      duration: 45,
      price: 48,
      name: { fr: 'Brushing signature', nl: 'Signature brushing' },
      description: {
        fr: 'Shampoing soin, massage crânien et mise en forme sur-mesure.',
        nl: 'Verzorgende shampoo, hoofdhuidmassage en styling op maat.'
      }
    },
    {
      id: 'coupe-brushing',
      duration: 75,
      price: 85,
      name: { fr: 'Coupe & brushing', nl: 'Knippen & brushing' },
      description: {
        fr: 'Diagnostic, coupe architecturée et brushing signature.',
        nl: 'Diagnose, gestructureerde snit en signature brushing.'
      }
    },
    {
      id: 'coloration',
      duration: 105,
      price: 110,
      name: { fr: 'Coloration & brushing', nl: 'Kleuring & brushing' },
      description: {
        fr: 'Couleur racines ou globale, soin protecteur et brushing.',
        nl: 'Uitgroei- of volledige kleuring, beschermende verzorging en brushing.'
      }
    },
    {
      id: 'balayage',
      duration: 180,
      price: 210,
      name: { fr: 'Balayage sur-mesure', nl: 'Balayage op maat' },
      description: {
        fr: 'Éclaircissement à main levée, patine et brushing lumière.',
        nl: 'Handmatige highlights, toning en stralende brushing.'
      }
    },
    {
      id: 'rituel-soin',
      duration: 60,
      price: 65,
      name: { fr: 'Rituel soin profond', nl: 'Intensief verzorgingsritueel' },
      description: {
        fr: 'Soin réparateur haute couture, massage et brushing.',
        nl: 'Herstellende haute-couture verzorging, massage en brushing.'
      }
    },
    {
      id: 'chignon',
      duration: 75,
      price: 95,
      name: { fr: 'Chignon & coiffure d’événement', nl: 'Opsteekkapsel & gelegenheidskapsel' },
      description: {
        fr: 'Pour un mariage, un gala ou une soirée d’exception.',
        nl: 'Voor een huwelijk, gala of uitzonderlijke avond.'
      }
    },
    {
      id: 'lissage',
      duration: 180,
      price: 260,
      name: { fr: 'Lissage brésilien', nl: 'Braziliaanse keratinebehandeling' },
      description: {
        fr: 'Cheveux disciplinés, brillants et soyeux durant plusieurs mois.',
        nl: 'Soepel, glanzend en zijdezacht haar gedurende maanden.'
      }
    }
  ]
};
