/* ============================================================
   banner-config.js — Campañas Estacionales
   ============================================================
   ÚNICO archivo a editar para activar/desactivar campañas.
   El equipo de marketing puede editar esto sin tocar el catálogo.

   Tipos disponibles:
     'cyber'       → Cyber Wow, Click, Monday, etc.
     'blackfriday' → Black Friday / Week
     'navidad'     → Navidad / Año Nuevo
     'clases'      → Regreso a clases
     'nuevos'      → Nuevos ingresos
     'liquidacion' → Liquidación / Outlet
   ============================================================ */

'use strict';

const BANNER_CONFIG = {

  // ── Pon active: false para ocultar el banner sin eliminar la config
  active: false,

  campaign: {
    // Identificador único (para analytics futuros)
    id: 'ejemplo-cyber-2025',

    // Tipo — define el color/estilo visual del banner
    type: 'cyber',

    // Texto del badge pequeño (etiqueta pill)
    badge: 'Esta semana',

    // Título principal del banner
    title: '⚡ Cyber Wow — Hasta 40% OFF',

    // Subtítulo descriptivo
    subtitle: 'En laptops, celulares y componentes seleccionados',

    // Texto del botón CTA
    ctaText: 'Ver ofertas',

    // Qué acción ejecuta el botón CTA:
    // Filtra el catálogo principal. Opciones:
    //   badge: 'sale'          → productos en oferta
    //   category: 'laptops'    → una categoría específica
    //   null                   → scroll al catálogo sin filtrar
    ctaFilter: { badge: 'sale' },

    // Fechas de la campaña (formato ISO YYYY-MM-DD)
    // El banner se oculta automáticamente después de endDate
    startDate: '2025-11-27',
    endDate:   '2025-11-30',

    // Mostrar contador regresivo hasta endDate
    showCountdown: true,
  },

  /* ──────────────────────────────────────────────────────────
     PLANTILLAS DE REFERENCIA — copia y pega para activar
     ────────────────────────────────────────────────────────── */

  // BLACK FRIDAY:
  // type: 'blackfriday', badge: 'Black Friday', title: '🔥 Black Friday \u2014 Los mejores precios del año',
  // subtitle: 'Solo por tiempo limitado. ¡No te lo pierdas!',
  // ctaFilter: { badge: 'sale' }, showCountdown: true

  // NAVIDAD:
  // type: 'navidad', badge: '🎄 Navidad', title: 'Tecnología para regalar esta Navidad',
  // subtitle: 'Los mejores regalos tech de la temporada',
  // ctaFilter: null, showCountdown: false

  // REGRESO A CLASES:
  // type: 'clases', badge: 'Regreso a clases', title: '📚 Equípate para el ciclo',
  // subtitle: 'Laptops y tablets ideales para estudios universitarios',
  // ctaFilter: { category: 'laptops' }, showCountdown: false

  // NUEVOS INGRESOS:
  // type: 'nuevos', badge: '✨ Recién llegó', title: 'Nuevos equipos disponibles',
  // subtitle: 'Los últimos modelos acaban de llegar al catálogo',
  // ctaFilter: { badge: 'new' }, showCountdown: false

  // LIQUIDACIÓN:
  // type: 'liquidacion', badge: '🏷️ Liquidación', title: 'Últimas unidades \u2014 Precios de liquidación',
  // subtitle: 'Stock limitado. No se renuevan cuando se agoten.',
  // ctaFilter: { badge: 'sale' }, showCountdown: true
};
