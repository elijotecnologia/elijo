/* ============================================================
   elijo-config.js — Configuración Central de Negocio
   Edita ESTE archivo para cambiar parámetros globales de la marca.
   ============================================================ */

'use strict';

const ELIJO_CONFIG = {
  brand: {
    name: 'Elijo',
    tagline: 'Tecnología',
    slogan: 'Elige con inteligencia.',
    advisorName: 'Asistente Elijo',
    // Filosofía: no vendemos, ayudamos a elegir
    philosophy: 'No venimos a venderte. Venimos a ayudarte a elegir.',
  },

  // WhatsApp (fuente de verdad — sobreescribe sheets-config.js si está definido)
  whatsapp: '51918394348',

  // Subtítulos rotativos del hero — transmiten la filosofía Elijo
  heroSubtitles: [
    'Descubre cuál es la mejor opción para ti.',
    'Compara, elige y decide con confianza.',
    'Asesoría real, sin presión de venta.',
    'Tu próxima decisión tecnológica, simplificada.',
    'Encuentra exactamente lo que necesitas.',
  ],

  // Rotación del subtitle (en ms)
  heroRotationInterval: 3500,

  // Perfiles de usuario para la guía de elección
  userProfiles: {
    trabajo: {
      id: 'trabajo',
      label: 'Trabajo',
      icon: '💼',
      description: 'Oficina, reuniones, productividad',
      priorityCategories: ['laptops', 'pcs', 'periféricos', 'accesorios'],
      suggestedBudget: { min: 1200, max: 4000 },
      message: 'Para trabajo, priorizamos rendimiento, durabilidad y conectividad.',
      highlights: ['SSD rápido', 'RAM suficiente', 'Pantalla cómoda', 'Batería duradera'],
    },
    gaming: {
      id: 'gaming',
      label: 'Gaming',
      icon: '🎮',
      description: 'Videojuegos, streaming, entretenimiento',
      priorityCategories: ['laptops', 'pcs', 'periféricos', 'componentes'],
      suggestedBudget: { min: 2500, max: 10000 },
      message: 'Para gaming, rendimiento gráfico y velocidad son todo.',
      highlights: ['GPU dedicada', 'Alta frecuencia de actualización', 'RAM DDR5', 'Refrigeración'],
    },
    estudios: {
      id: 'estudios',
      label: 'Estudios',
      icon: '📚',
      description: 'Universidad, tareas, investigación',
      priorityCategories: ['laptops', 'tabletas', 'accesorios', 'software'],
      suggestedBudget: { min: 800, max: 2500 },
      message: 'Para estudios, buscamos el mejor equilibrio precio-rendimiento.',
      highlights: ['Ligero y portátil', 'Buena batería', 'Office incluido', 'Precio justo'],
    },
    diseno: {
      id: 'diseno',
      label: 'Diseño',
      icon: '🎨',
      description: 'Edición, creatividad, medios',
      priorityCategories: ['laptops', 'pcs', 'periféricos', 'componentes'],
      suggestedBudget: { min: 3000, max: 12000 },
      message: 'Para diseño, pantalla y capacidad de procesamiento son prioritarios.',
      highlights: ['Pantalla color preciso', 'GPU potente', 'RAM amplia', 'Almacenamiento rápido'],
    },
    casa: {
      id: 'casa',
      label: 'Casa',
      icon: '🏠',
      description: 'Uso familiar, navegar, streaming',
      priorityCategories: ['pcs', 'tabletas', 'celulares', 'impresoras'],
      suggestedBudget: { min: 500, max: 2000 },
      message: 'Para uso en casa, lo más importante es facilidad de uso y precio.',
      highlights: ['Fácil de usar', 'Confiable', 'Garantía', 'Precio accesible'],
    },
    avanzado: {
      id: 'avanzado',
      label: 'Avanzado',
      icon: '🚀',
      description: 'Profesional, servidores, alto rendimiento',
      priorityCategories: ['componentes', 'pcs', 'redes', 'software'],
      suggestedBudget: { min: 4000, max: 20000 },
      message: 'Para usuarios avanzados, sin compromisos en rendimiento.',
      highlights: ['Máximo rendimiento', 'Expansibilidad', 'Soporte profesional', 'Garantía extendida'],
    },
  },
};
