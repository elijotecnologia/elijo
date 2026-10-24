/* ============================================================
   ELIJO TECNOLOGÍA — Asistente Inteligente de Búsqueda
   Procesamiento de lenguaje natural en español
   Integración con catálogo de productos
   ============================================================ */

'use strict';

// ─── Configuración ────────────────────────────────────────────
const ASSISTANT_CONFIG = {
  name: 'Eli',
  avatar: '🤖',
  typingDelay: 600,    // ms antes de mostrar respuesta
  charDelay:   18,     // ms por carácter (efecto typewriter)
  maxHistory:  40,     // máx mensajes en el historial
};

// ─── Base de conocimiento del asistente ───────────────────────
const KNOWLEDGE = {
  // Mapeo de intenciones a categorías
  categoryMap: {
    laptops:     ['laptop', 'laptops', 'portatil', 'portátil', 'portatiles', 'portátiles', 'notebook', 'notebooks', 'computadora portatil', 'computadora portátil'],
    pcs:         ['pc', 'pcs', 'computadora', 'computadoras', 'desktop', 'escritorio', 'torre', 'computer', 'equipo de escritorio'],
    celulares:   ['celular', 'celulares', 'telefono', 'teléfono', 'telefonos', 'teléfonos', 'smartphone', 'smartphones', 'movil', 'móvil', 'iphone', 'android'],
    tablets:     ['tablet', 'tablets', 'tableta', 'tabletas', 'ipad'],
    perifericos: ['periferico', 'periférico', 'perifericos', 'periféricos', 'monitor', 'monitores', 'teclado', 'teclados', 'mouse', 'mice', 'pantalla', 'pantallas'],
    impresoras:  ['impresora', 'impresoras', 'printer', 'imprimir', 'scanner', 'escaner', 'escáner'],
    componentes: ['componente', 'componentes', 'ram', 'memoria', 'memorias', 'ssd', 'disco', 'discos', 'procesador', 'procesadores', 'cpu', 'gpu', 'tarjeta grafica', 'tarjeta gráfica', 'placa', 'motherboard'],
    accesorios:  ['accesorio', 'accesorios', 'headset', 'audifonos', 'audífonos', 'auriculares', 'cable', 'cables', 'cargador', 'cargadores', 'webcam', 'camara web'],
    redes:       ['red', 'redes', 'router', 'routers', 'wifi', 'wi-fi', 'internet', 'switch', 'switches', 'ethernet', 'lan'],
    software:    ['software', 'programa', 'programas', 'licencia', 'licencias', 'office', 'windows', 'antivirus'],
  },

  // Mapeo de intenciones de precio
  priceIntents: [
    { pattern: /menos de (\d+)/i,          min: 0,    maxFn: m => +m[1] },
    { pattern: /hasta (\d+)/i,             min: 0,    maxFn: m => +m[1] },
    { pattern: /menos de s\/\s*(\d+)/i,    min: 0,    maxFn: m => +m[1] },
    { pattern: /máximo (\d+)/i,            min: 0,    maxFn: m => +m[1] },
    { pattern: /maximo (\d+)/i,            min: 0,    maxFn: m => +m[1] },
    { pattern: /entre (\d+) y (\d+)/i,     minFn: m => +m[1], maxFn: m => +m[2] },
    { pattern: /de (\d+) a (\d+)/i,        minFn: m => +m[1], maxFn: m => +m[2] },
    { pattern: /más de (\d+)/i,            minFn: m => +m[1], max: Infinity },
    { pattern: /mas de (\d+)/i,            minFn: m => +m[1], max: Infinity },
    { pattern: /economico|barato|económico|precio bajo/i, min: 0, max: 800 },
    { pattern: /gama media/i,              min: 800, max: 2500 },
    { pattern: /gama alta|premium|high.end/i, min: 2500, max: Infinity },
  ],

  // Intenciones especiales
  intents: {
    greeting:   ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'buenas', 'saludos', 'que tal'],
    help:       ['ayuda', 'ayudame', 'ayúdame', 'como funciona', 'que puedes hacer', 'qué puedes hacer', 'no sé', 'no se', 'help'],
    offer:      ['oferta', 'ofertas', 'descuento', 'descuentos', 'promocion', 'promoción', 'rebajas', 'sale', 'precio especial'],
    popular:    ['popular', 'populares', 'recomendado', 'recomendados', 'mas vendido', 'más vendido', 'mejor', 'mejores', 'top'],
    new:        ['nuevo', 'nuevos', 'nueva', 'nuevas', 'reciente', 'recientes', 'ultimo', 'últimos', 'novedad'],
    thanks:     ['gracias', 'muchas gracias', 'thank you', 'thanks', 'perfecto', 'excelente', 'genial'],
    bye:        ['adios', 'adiós', 'hasta luego', 'chau', 'bye', 'hasta pronto', 'nos vemos'],
    brand:      ['marca', 'marcas', 'hp', 'lenovo', 'samsung', 'asus', 'xiaomi', 'epson', 'corsair', 'kingston', 'logitech', 'tp-link', 'microsoft'],
    gaming:     ['gaming', 'gamer', 'juegos', 'jugar', 'game', 'games'],
    work:       ['trabajo', 'oficina', 'trabajar', 'empresarial', 'profesional', 'negocio'],
    student:    ['estudiante', 'estudiar', 'colegio', 'universidad', 'escolar'],
  },

  // Respuestas predefinidas
  responses: {
    greeting: [
      '¡Hola! Soy **Eli**, tu asistente de Elijo Tecnología 🙋‍♀️\n\n¿En qué te puedo ayudar hoy? Puedo:\n• 🔍 Buscar productos específicos\n• 📂 Explorar categorías\n• 💰 Filtrar por presupuesto\n• 🔥 Mostrarte ofertas y novedades',
      '¡Bienvenido/a! Soy **Eli** y estoy aquí para ayudarte a encontrar la mejor tecnología 🤖✨\n\nCuéntame, ¿qué estás buscando hoy?',
    ],
    help: '¡Claro que sí! Así es como puedo ayudarte:\n\n💬 **Búsqueda natural**: "Busco una laptop para estudiar"\n💰 **Por precio**: "Celulares menos de S/ 1000"\n📂 **Por categoría**: "Muéstrame impresoras"\n🏷️ **Por marca**: "Laptops Lenovo"\n🔥 **Ofertas**: "¿Qué está en oferta?"\n\n¡Solo escríbeme con tus palabras!',
    thanks: ['¡De nada! 😊 ¿Hay algo más en lo que te pueda ayudar?', '¡Con gusto! Para eso estoy 🤖 ¿Buscas algo más?', '¡Encantada de ayudar! ¿Necesitas ver más opciones?'],
    bye: '¡Hasta pronto! 👋 Si necesitas ayuda para elegir tu próximo producto tech, aquí estaré 🤖',
    notUnderstood: [
      'Hmm, no entendí muy bien 🤔 ¿Puedes decirme qué producto o categoría buscas? Por ejemplo: "laptop para gaming" o "celular menos de S/ 1000"',
      '¡Cuéntame más! ¿Qué tipo de producto buscas? Puedo ayudarte con laptops, celulares, PCs, impresoras y mucho más 💡',
      'No estoy segura de entender. ¿Buscas alguna categoría en particular? Prueba decirme: "Busco una impresora económica" o "quiero ver monitores"',
    ],
  },
};

// ─── NLP Engine ───────────────────────────────────────────────
class NLPEngine {
  normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // quitar tildes
      .replace(/[^a-z0-9\s\/]/g, ' ')   // quitar puntuación (mantener /)
      .replace(/\s+/g, ' ')
      .trim();
  }

  detectIntent(text) {
    const norm = this.normalize(text);
    const words = norm.split(' ');
    const result = {
      categories: [],
      price: null,
      brands: [],
      intents: [],
      keywords: [],
    };

    // Detectar intenciones especiales
    for (const [intent, patterns] of Object.entries(KNOWLEDGE.intents)) {
      if (patterns.some(p => norm.includes(this.normalize(p)))) {
        result.intents.push(intent);
      }
    }

    // Detectar categorías
    for (const [cat, patterns] of Object.entries(KNOWLEDGE.categoryMap)) {
      if (patterns.some(p => norm.includes(this.normalize(p)))) {
        result.categories.push(cat);
      }
    }

    // Detectar marcas específicas
    const brandList = ['hp', 'lenovo', 'samsung', 'asus', 'xiaomi', 'epson', 'corsair', 'kingston', 'logitech', 'tp-link', 'microsoft', 'belkin', 'hyperx'];
    for (const brand of brandList) {
      if (norm.includes(brand)) {
        result.brands.push(brand.charAt(0).toUpperCase() + brand.slice(1));
      }
    }
    // Fix brand capitalization
    const brandFixes = { 'Tp-link': 'TP-Link', 'Hyperx': 'HyperX' };
    result.brands = result.brands.map(b => brandFixes[b] || b);

    // Detectar intención de precio
    for (const pi of KNOWLEDGE.priceIntents) {
      const match = norm.match(pi.pattern);
      if (match) {
        result.price = {
          min: pi.minFn ? pi.minFn(match) : (pi.min ?? 0),
          max: pi.maxFn ? pi.maxFn(match) : (pi.max ?? Infinity),
        };
        break;
      }
    }

    // Keywords residuales
    const stopWords = new Set(['para', 'una', 'un', 'el', 'la', 'los', 'las', 'de', 'en', 'que', 'con', 'me', 'mi', 'por', 'a', 'al', 'del', 'se', 'es', 'si', 'no', 'mas', 'y', 'o', 'quiero', 'busco', 'necesito', 'ver', 'mostrar', 'dame', 'tienes', 'hay', 'como', 'cual', 'cuales', 'cuanto', 'donde']);
    result.keywords = words.filter(w => w.length > 2 && !stopWords.has(w));

    return result;
  }
}

// ─── Chat Assistant ───────────────────────────────────────────
class ChatAssistant {
  constructor() {
    this.nlp = new NLPEngine();
    this.history = [];
    this.isOpen = false;
    this.isTyping = false;
    this.sessionGreeted = false;
    this.init();
  }

  // ─── DOM Init ──────────────────────────────────────────────
  init() {
    this.injectHTML();
    this.injectStyles();
    this.bindEvents();
    // Saludo automático al abrir
    setTimeout(() => this.showOpenHint(), 3000);
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ─── Assistant Widget ────────────────────────────────── */
      #eli-trigger {
        position: fixed;
        bottom: 28px;
        left: 28px;
        z-index: 160;
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #1a73e8, #4285f4);
        color: white;
        border: none;
        border-radius: 100px;
        padding: 14px 20px;
        font-family: 'Inter', sans-serif;
        font-size: .9rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 24px rgba(26,115,232,.45), 0 2px 8px rgba(0,0,0,.15);
        transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      #eli-trigger:hover {
        transform: translateY(-4px) scale(1.04);
        box-shadow: 0 12px 32px rgba(26,115,232,.55);
      }
      #eli-trigger.hidden { transform: scale(0); opacity: 0; pointer-events: none; }

      #eli-trigger-icon {
        width: 26px; height: 26px;
        font-size: 1.3rem;
        line-height: 1;
        flex-shrink: 0;
      }

      /* Hint badge */
      #eli-hint {
        position: fixed;
        bottom: 88px;
        left: 28px;
        z-index: 159;
        background: white;
        border: 1px solid #e8eaed;
        border-radius: 12px;
        padding: 10px 14px;
        font-family: 'Inter', sans-serif;
        font-size: .82rem;
        color: #5f6368;
        box-shadow: 0 4px 16px rgba(0,0,0,.12);
        max-width: 220px;
        opacity: 0;
        transform: translateY(10px);
        transition: all 300ms ease;
        pointer-events: none;
      }
      #eli-hint.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
      #eli-hint::after {
        content: '';
        position: absolute;
        bottom: -6px; left: 20px;
        width: 12px; height: 12px;
        background: white;
        border-right: 1px solid #e8eaed;
        border-bottom: 1px solid #e8eaed;
        transform: rotate(45deg);
      }

      /* ─── Chat Panel ──────────────────────────────────────── */
      #eli-panel {
        position: fixed;
        bottom: 28px;
        left: 28px;
        z-index: 161;
        width: 380px;
        max-width: calc(100vw - 32px);
        height: 580px;
        max-height: calc(100vh - 56px);
        background: #fff;
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(0,0,0,.2), 0 4px 16px rgba(0,0,0,.08);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.8) translateY(40px);
        transform-origin: bottom left;
        opacity: 0;
        pointer-events: none;
        transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 1px solid rgba(26,115,232,.15);
      }
      #eli-panel.open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      /* Panel Header */
      #eli-header {
        background: linear-gradient(135deg, #1a73e8, #4285f4);
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }

      #eli-avatar {
        width: 42px; height: 42px;
        background: rgba(255,255,255,.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        flex-shrink: 0;
        border: 2px solid rgba(255,255,255,.4);
        animation: eli-float 3s ease-in-out infinite;
      }

      @keyframes eli-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }

      #eli-header-info { flex: 1; }
      #eli-header-name {
        font-size: 1rem;
        font-weight: 700;
        color: white;
        line-height: 1.2;
      }
      #eli-header-status {
        font-size: .72rem;
        color: rgba(255,255,255,.85);
        display: flex;
        align-items: center;
        gap: 5px;
      }
      #eli-status-dot {
        width: 7px; height: 7px;
        background: #69ff91;
        border-radius: 50%;
        box-shadow: 0 0 6px #69ff91;
        animation: pulse-dot 2s infinite;
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }

      #eli-close-btn {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: rgba(255,255,255,.2);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .2s;
        flex-shrink: 0;
      }
      #eli-close-btn:hover { background: rgba(255,255,255,.35); }

      /* Quick chips */
      #eli-chips {
        padding: 10px 14px;
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
        background: #f8f9fa;
        border-bottom: 1px solid #e8eaed;
        flex-shrink: 0;
      }
      #eli-chips::-webkit-scrollbar { display: none; }

      .eli-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 12px;
        background: white;
        border: 1.5px solid #dadce0;
        border-radius: 100px;
        font-size: .75rem;
        font-weight: 600;
        color: #5f6368;
        cursor: pointer;
        white-space: nowrap;
        transition: all .2s;
        font-family: 'Inter', sans-serif;
      }
      .eli-chip:hover {
        border-color: #1a73e8;
        color: #1a73e8;
        background: #e8f0fe;
      }

      /* Messages */
      #eli-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scroll-behavior: smooth;
      }
      #eli-messages::-webkit-scrollbar { width: 4px; }
      #eli-messages::-webkit-scrollbar-thumb { background: #dadce0; border-radius: 2px; }

      /* Message bubble */
      .eli-msg {
        display: flex;
        gap: 8px;
        animation: eli-msg-in 250ms ease both;
      }
      @keyframes eli-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .eli-msg.user { flex-direction: row-reverse; }

      .eli-msg-avatar {
        width: 30px; height: 30px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e8f0fe, #c5d9ff);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: .85rem;
        flex-shrink: 0;
        align-self: flex-end;
      }

      .eli-bubble {
        max-width: 82%;
        padding: 10px 14px;
        border-radius: 18px;
        font-size: .875rem;
        line-height: 1.55;
        color: #202124;
        background: #f1f3f4;
        font-family: 'Inter', sans-serif;
      }
      .eli-msg.user .eli-bubble {
        background: linear-gradient(135deg, #1a73e8, #4285f4);
        color: white;
        border-bottom-right-radius: 4px;
      }
      .eli-msg.bot .eli-bubble { border-bottom-left-radius: 4px; }

      /* Bold in bubbles */
      .eli-bubble strong { font-weight: 700; }
      .eli-bubble ul { padding-left: 16px; margin-top: 4px; }
      .eli-bubble li { margin-bottom: 2px; }

      /* Typing indicator */
      #eli-typing {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 0 4px;
      }
      #eli-typing.show { display: flex; }
      .typing-dots {
        display: flex;
        gap: 4px;
        background: #f1f3f4;
        padding: 10px 14px;
        border-radius: 18px;
        border-bottom-left-radius: 4px;
      }
      .typing-dot {
        width: 7px; height: 7px;
        background: #9aa0a6;
        border-radius: 50%;
        animation: typing-bounce .8s ease infinite;
      }
      .typing-dot:nth-child(2) { animation-delay: .15s; }
      .typing-dot:nth-child(3) { animation-delay: .3s; }
      @keyframes typing-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }

      /* Product cards in chat */
      .eli-products-row {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 4px 0;
        scrollbar-width: none;
        max-width: 100%;
      }
      .eli-products-row::-webkit-scrollbar { display: none; }

      .eli-prod-card {
        flex-shrink: 0;
        width: 140px;
        background: white;
        border: 1.5px solid #e8eaed;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: all .2s;
        font-family: 'Inter', sans-serif;
      }
      .eli-prod-card:hover {
        border-color: #1a73e8;
        box-shadow: 0 4px 16px rgba(26,115,232,.2);
        transform: translateY(-2px);
      }
      .eli-prod-img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        background: #f8f9fa;
      }
      .eli-prod-body { padding: 8px; }
      .eli-prod-brand {
        font-size: .65rem;
        font-weight: 700;
        color: #1a73e8;
        text-transform: uppercase;
        letter-spacing: .5px;
      }
      .eli-prod-name {
        font-size: .75rem;
        font-weight: 600;
        color: #202124;
        line-height: 1.3;
        margin: 2px 0 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .eli-prod-price {
        font-size: .85rem;
        font-weight: 800;
        color: #202124;
      }

      /* Input area */
      #eli-input-area {
        padding: 12px 14px;
        border-top: 1px solid #e8eaed;
        display: flex;
        gap: 8px;
        align-items: flex-end;
        background: white;
        flex-shrink: 0;
      }

      #eli-input {
        flex: 1;
        resize: none;
        border: 1.5px solid #dadce0;
        border-radius: 20px;
        padding: 10px 16px;
        font-family: 'Inter', sans-serif;
        font-size: .875rem;
        color: #202124;
        outline: none;
        max-height: 100px;
        min-height: 42px;
        line-height: 1.4;
        transition: border-color .2s;
        background: #f8f9fa;
        overflow-y: auto;
      }
      #eli-input:focus {
        border-color: #1a73e8;
        background: white;
        box-shadow: 0 0 0 3px rgba(26,115,232,.1);
      }
      #eli-input::placeholder { color: #9aa0a6; }

      #eli-send-btn {
        width: 42px; height: 42px;
        border-radius: 50%;
        background: #1a73e8;
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all .2s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 2px 8px rgba(26,115,232,.35);
      }
      #eli-send-btn:hover {
        background: #1557b0;
        transform: scale(1.1);
      }
      #eli-send-btn:active { transform: scale(.95); }
      #eli-send-btn svg { width: 18px; height: 18px; }

      /* Filter applied banner */
      .eli-filter-banner {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #e8f0fe;
        border: 1px solid #c5d9ff;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: .75rem;
        font-weight: 600;
        color: #1a73e8;
        margin-top: 6px;
        cursor: pointer;
        transition: background .2s;
      }
      .eli-filter-banner:hover { background: #c5d9ff; }

      /* Responsive */
      @media (max-width: 480px) {
        #eli-panel { width: calc(100vw - 32px); left: 16px; bottom: 16px; }
        #eli-trigger { left: 16px; bottom: 16px; }
        #eli-hint { left: 16px; bottom: 88px; }
      }
    `;
    document.head.appendChild(style);
  }

  injectHTML() {
    const wrap = document.createElement('div');
    wrap.id = 'eli-assistant';
    wrap.innerHTML = `
      <!-- Hint balloon -->
      <div id="eli-hint" role="tooltip">
        💡 ¿Necesitas ayuda para elegir? ¡Pregúntame!
      </div>

      <!-- Trigger button -->
      <button id="eli-trigger" aria-label="Abrir asistente Eli" aria-expanded="false">
        <span id="eli-trigger-icon">🤖</span>
        <span id="eli-trigger-label">¡Pregúntame!</span>
      </button>

      <!-- Chat Panel -->
      <div id="eli-panel" role="dialog" aria-label="Asistente Eli" aria-modal="false">

        <!-- Header -->
        <div id="eli-header">
          <div id="eli-avatar">🤖</div>
          <div id="eli-header-info">
            <div id="eli-header-name">Eli — Asistente Elijo Tech</div>
            <div id="eli-header-status">
              <span id="eli-status-dot"></span>
              En línea · Responde al instante
            </div>
          </div>
          <button id="eli-close-btn" aria-label="Cerrar asistente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Quick chips -->
        <div id="eli-chips" role="group" aria-label="Búsquedas rápidas">
          <button class="eli-chip" data-query="ofertas del día">🔥 Ofertas</button>
          <button class="eli-chip" data-query="laptops para trabajar">💻 Laptops</button>
          <button class="eli-chip" data-query="celulares baratos">📱 Celulares</button>
          <button class="eli-chip" data-query="computadoras gaming">🖥️ PCs Gaming</button>
          <button class="eli-chip" data-query="impresoras económicas">🖨️ Impresoras</button>
          <button class="eli-chip" data-query="accesorios para pc">⌨️ Accesorios</button>
        </div>

        <!-- Messages -->
        <div id="eli-messages" role="log" aria-live="polite" aria-label="Conversación con Eli">
          <!-- Typing indicator (always at bottom) -->
          <div id="eli-typing" role="status" aria-label="Eli está escribiendo">
            <div class="eli-msg-avatar">🤖</div>
            <div class="typing-dots">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div id="eli-input-area">
          <textarea
            id="eli-input"
            rows="1"
            placeholder="Escribe aquí... ej: 'laptop menos de S/ 3000'"
            aria-label="Mensaje para Eli"
            maxlength="300"
          ></textarea>
          <button id="eli-send-btn" aria-label="Enviar mensaje">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    this.panel    = document.getElementById('eli-panel');
    this.trigger  = document.getElementById('eli-trigger');
    this.hint     = document.getElementById('eli-hint');
    this.messages = document.getElementById('eli-messages');
    this.typingEl = document.getElementById('eli-typing');
    this.input    = document.getElementById('eli-input');
    this.sendBtn  = document.getElementById('eli-send-btn');
  }

  bindEvents() {
    this.trigger.addEventListener('click', () => this.open());
    document.getElementById('eli-close-btn').addEventListener('click', () => this.close());

    // Send
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 100) + 'px';
    });

    // Quick chips
    document.querySelectorAll('.eli-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.query;
        this.input.value = q;
        this.handleSend();
      });
    });

    // Dismiss hint on click
    this.hint.addEventListener('click', () => {
      this.hint.classList.remove('show');
      this.open();
    });
  }

  open() {
    this.isOpen = true;
    this.panel.classList.add('open');
    this.trigger.classList.add('hidden');
    this.hint.classList.remove('show');
    this.trigger.setAttribute('aria-expanded', 'true');
    this.input.focus();

    if (!this.sessionGreeted) {
      this.sessionGreeted = true;
      const greetings = KNOWLEDGE.responses.greeting;
      const msg = greetings[Math.floor(Math.random() * greetings.length)];
      setTimeout(() => this.addBotMessage(msg), 400);
    }
  }

  close() {
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.trigger.classList.remove('hidden');
    this.trigger.setAttribute('aria-expanded', 'false');
  }

  showOpenHint() {
    if (!this.isOpen) {
      this.hint.classList.add('show');
      setTimeout(() => this.hint.classList.remove('show'), 5000);
    }
  }

  // ─── Message handling ──────────────────────────────────────
  handleSend() {
    const text = this.input.value.trim();
    if (!text || this.isTyping) return;

    this.addUserMessage(text);
    this.input.value = '';
    this.input.style.height = 'auto';
    this.processQuery(text);
  }

  addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'eli-msg user';
    div.innerHTML = `
      <div class="eli-bubble">${this.escapeHtml(text)}</div>
      <div class="eli-msg-avatar" aria-hidden="true">👤</div>
    `;
    this.messages.insertBefore(div, this.typingEl);
    this.scrollToBottom();
    this.history.push({ role: 'user', text });
  }

  addBotMessage(text, extras = null) {
    this.showTyping();
    const delay = ASSISTANT_CONFIG.typingDelay + Math.min(text.length * 4, 800);

    setTimeout(() => {
      this.hideTyping();

      const div = document.createElement('div');
      div.className = 'eli-msg bot';
      div.innerHTML = `
        <div class="eli-msg-avatar" aria-hidden="true">🤖</div>
        <div class="eli-bubble">${this.formatMarkdown(text)}</div>
      `;

      if (extras) {
        div.querySelector('.eli-bubble').appendChild(extras);
      }

      this.messages.insertBefore(div, this.typingEl);
      this.scrollToBottom();
      this.history.push({ role: 'bot', text });

      // Trim history
      if (this.history.length > ASSISTANT_CONFIG.maxHistory) {
        this.history = this.history.slice(-ASSISTANT_CONFIG.maxHistory);
      }

      this.isTyping = false;
    }, delay);
  }

  showTyping() {
    this.isTyping = true;
    this.typingEl.classList.add('show');
    this.scrollToBottom();
  }

  hideTyping() {
    this.typingEl.classList.remove('show');
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messages.scrollTop = this.messages.scrollHeight;
    }, 50);
  }

  formatMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/•\s/g, '• ')
      .replace(/\n/g, '<br/>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Query processing ──────────────────────────────────────
  async processQuery(text) {
    const intent = this.nlp.detectIntent(text);

    // 1. Saludo
    if (intent.intents.includes('greeting') && intent.categories.length === 0) {
      const greetings = KNOWLEDGE.responses.greeting;
      this.addBotMessage(greetings[Math.floor(Math.random() * greetings.length)]);
      return;
    }

    // 2. Ayuda
    if (intent.intents.includes('help')) {
      this.addBotMessage(KNOWLEDGE.responses.help);
      return;
    }

    // 3. Gracias
    if (intent.intents.includes('thanks')) {
      const thanks = KNOWLEDGE.responses.thanks;
      this.addBotMessage(thanks[Math.floor(Math.random() * thanks.length)]);
      return;
    }

    // 4. Despedida
    if (intent.intents.includes('bye')) {
      this.addBotMessage(KNOWLEDGE.responses.bye);
      return;
    }

    // 5. Ofertas
    if (intent.intents.includes('offer') && intent.categories.length === 0) {
      this.showOffers();
      return;
    }

    // 6. Populares / recomendados
    if (intent.intents.includes('popular') && intent.categories.length === 0) {
      this.showFeatured();
      return;
    }

    // 7. Novedad
    if (intent.intents.includes('new') && intent.categories.length === 0) {
      this.showNew();
      return;
    }

    // 8. Categoría detectada (con o sin precio/marca)
    if (intent.categories.length > 0) {
      this.handleCategorySearch(intent);
      return;
    }

    // 9. Solo precio (sin categoría)
    if (intent.price) {
      this.handlePriceSearch(intent);
      return;
    }

    // 10. Solo marca
    if (intent.brands.length > 0) {
      this.handleBrandSearch(intent);
      return;
    }

    // 11. Gaming intent
    if (intent.intents.includes('gaming')) {
      this.handleGamingSearch();
      return;
    }

    // 12. Trabajo/Oficina
    if (intent.intents.includes('work')) {
      this.handleWorkSearch();
      return;
    }

    // 13. Estudiante
    if (intent.intents.includes('student')) {
      this.handleStudentSearch();
      return;
    }

    // 14. No entendido
    const noUnderstand = KNOWLEDGE.responses.notUnderstood;
    this.addBotMessage(noUnderstand[Math.floor(Math.random() * noUnderstand.length)]);
  }

  // ─── Response builders ────────────────────────────────────
  handleCategorySearch(intent) {
    const cat = intent.categories[0]; // Prioridad a primera categoría detectada
    const catNames = {
      laptops: 'Laptops',
      pcs: 'PCs de Escritorio',
      celulares: 'Celulares',
      tablets: 'Tablets',
      perifericos: 'Periféricos',
      impresoras: 'Impresoras',
      componentes: 'Componentes',
      accesorios: 'Accesorios',
      redes: 'Redes',
      software: 'Software',
    };

    let products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.category === cat)
      : [];

    // Filtrar por precio si se detectó
    if (intent.price) {
      products = products.filter(p =>
        p.price >= intent.price.min && p.price <= intent.price.max
      );
    }

    // Filtrar por marca si se detectó
    if (intent.brands.length > 0) {
      const brandsLow = intent.brands.map(b => b.toLowerCase());
      products = products.filter(p => brandsLow.includes(p.brand.toLowerCase()));
    }

    if (products.length === 0) {
      let msg = `Mmm, no encontré ${catNames[cat] || cat}`;
      if (intent.price) msg += ` en ese rango de precio`;
      if (intent.brands.length > 0) msg += ` de ${intent.brands.join(', ')}`;
      msg += `. ¿Te muestro todas las opciones disponibles?`;
      this.addBotMessage(msg);
      return;
    }

    let intro = `¡Encontré **${products.length} ${catNames[cat] || cat}**`;
    if (intent.price) {
      const maxLabel = intent.price.max === Infinity ? 'adelante' : `S/ ${intent.price.max}`;
      intro += ` desde S/ ${intent.price.min} hasta ${maxLabel}`;
    }
    if (intent.brands.length > 0) {
      intro += ` de ${intent.brands.join(', ')}`;
    }
    intro += `! 🎯 Aquí te muestro las mejores opciones:`;

    const extras = this.buildProductCards(products.slice(0, 4));

    // Agregar banner para filtrar el catálogo
    const banner = document.createElement('div');
    banner.className = 'eli-filter-banner';
    banner.innerHTML = `🔍 Ver los ${products.length} resultados en el catálogo`;
    banner.addEventListener('click', () => {
      this.applyToMainCatalog(cat, intent.price, intent.brands);
    });

    const container = document.createElement('div');
    container.appendChild(extras);
    container.appendChild(banner);

    this.addBotMessage(intro, container);
  }

  handlePriceSearch(intent) {
    let products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.price >= intent.price.min && p.price <= intent.price.max)
      : [];

    if (products.length === 0) {
      this.addBotMessage(`No encontré productos en ese rango de precio 😔 ¿Quieres que amplíe la búsqueda?`);
      return;
    }

    const maxLabel = intent.price.max === Infinity
      ? `más de S/ ${intent.price.min}`
      : `entre S/ ${intent.price.min} y S/ ${intent.price.max}`;

    const extras = this.buildProductCards(products.slice(0, 4));
    const banner = document.createElement('div');
    banner.className = 'eli-filter-banner';
    banner.innerHTML = `🔍 Ver los ${products.length} resultados en el catálogo`;
    banner.addEventListener('click', () => this.applyToMainCatalog(null, intent.price, []));

    const container = document.createElement('div');
    container.appendChild(extras);
    container.appendChild(banner);

    this.addBotMessage(`Encontré **${products.length} productos** ${maxLabel}: 💰`, container);
  }

  handleBrandSearch(intent) {
    const brandsLow = intent.brands.map(b => b.toLowerCase());
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => brandsLow.includes(p.brand.toLowerCase()))
      : [];

    if (products.length === 0) {
      this.addBotMessage(`No tenemos productos de **${intent.brands.join(', ')}** en este momento. ¿Buscas otra marca?`);
      return;
    }

    const extras = this.buildProductCards(products.slice(0, 4));
    const banner = document.createElement('div');
    banner.className = 'eli-filter-banner';
    banner.innerHTML = `🔍 Ver todos de ${intent.brands.join(', ')} en el catálogo`;
    banner.addEventListener('click', () => this.applyToMainCatalog(null, null, intent.brands));

    const container = document.createElement('div');
    container.appendChild(extras);
    container.appendChild(banner);

    this.addBotMessage(`¡Tenemos **${products.length} productos** de ${intent.brands.join(' y ')} 🏷️`, container);
  }

  handleGamingSearch() {
    const gamingTags = ['gaming', 'Gaming', 'RGB', 'RTX', 'Gamer'];
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.tags.some(t => gamingTags.includes(t)) || p.name.toLowerCase().includes('gaming') || p.name.toLowerCase().includes('gamer') || p.name.toLowerCase().includes('rog'))
      : [];

    if (products.length === 0) {
      this.addBotMessage('¡Tenemos excelentes opciones gaming! Dime tu presupuesto y te busco lo mejor 🎮');
      return;
    }

    const extras = this.buildProductCards(products.slice(0, 4));
    this.addBotMessage(`¡Setup gaming incoming! 🎮🔥 Aquí tienes nuestros mejores equipos:`, extras);
  }

  handleWorkSearch() {
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => ['laptops', 'pcs', 'software', 'impresoras'].includes(p.category) && !p.tags.some(t => ['Gaming', 'RGB'].includes(t)))
      : [];

    const extras = this.buildProductCards(products.slice(0, 4));
    this.addBotMessage(`¡Para el trabajo te recomiendo estas opciones! 💼 Perfectas para productividad:`, extras);
  }

  handleStudentSearch() {
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.category === 'laptops' || p.category === 'tablets')
             .sort((a, b) => a.price - b.price)
             .slice(0, 4)
      : [];

    const extras = this.buildProductCards(products);
    this.addBotMessage(`¡Aquí tienes lo mejor para estudiar! 📚 Laptops y tablets ideales para el colegio o universidad:`, extras);
  }

  showOffers() {
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.badge === 'sale' || p.badge === 'hot').slice(0, 4)
      : [];

    if (products.length === 0) {
      this.addBotMessage('Estamos preparando nuevas ofertas 🔄 ¡Pronto tendremos descuentos especiales!');
      return;
    }

    const extras = this.buildProductCards(products);
    const banner = document.createElement('div');
    banner.className = 'eli-filter-banner';
    banner.innerHTML = `🔥 Ver todas las ofertas en el catálogo`;
    banner.addEventListener('click', () => this.applyToMainCatalog(null, null, [], 'sale'));

    const container = document.createElement('div');
    container.appendChild(extras);
    container.appendChild(banner);

    this.addBotMessage(`🔥 ¡Estas son nuestras mejores ofertas del momento!`, container);
  }

  showFeatured() {
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.featured).slice(0, 4)
      : [];
    const extras = this.buildProductCards(products);
    this.addBotMessage(`⭐ Nuestros productos más recomendados por los clientes:`, extras);
  }

  showNew() {
    const products = typeof PRODUCTS !== 'undefined'
      ? PRODUCTS.filter(p => p.badge === 'new').slice(0, 4)
      : [];
    const extras = this.buildProductCards(products);
    this.addBotMessage(`✨ ¡Mira lo que acaba de llegar! Productos nuevos en stock:`, extras);
  }

  // ─── Build product cards ───────────────────────────────────
  buildProductCards(products) {
    const row = document.createElement('div');
    row.className = 'eli-products-row';

    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'eli-prod-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Ver ${p.name}`);
      card.innerHTML = `
        <img class="eli-prod-img" src="${p.image}" alt="${p.name}" loading="lazy" />
        <div class="eli-prod-body">
          <p class="eli-prod-brand">${p.brand}</p>
          <p class="eli-prod-name">${p.name}</p>
          <p class="eli-prod-price">S/ ${p.price.toLocaleString('es-PE')}</p>
        </div>
      `;
      card.addEventListener('click', () => {
        // Abrir modal del producto principal
        if (typeof openModal === 'function') openModal(p.id);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter') if (typeof openModal === 'function') openModal(p.id);
      });
      row.appendChild(card);
    });

    return row;
  }

  // ─── Apply filters to main catalog ───────────────────────
  applyToMainCatalog(category, price, brands, badgeFilter = null) {
    // Update main app state
    if (typeof state !== 'undefined') {
      if (category) state.category = category;
      if (price) {
        state.priceMin = price.min;
        state.priceMax = price.max;
        const minEl = document.getElementById('price-min');
        const maxEl = document.getElementById('price-max');
        if (minEl && price.min > 0) minEl.value = price.min;
        if (maxEl && price.max < Infinity) maxEl.value = price.max;
      }
      if (brands.length > 0) {
        brands.forEach(b => state.brands.add(b));
      }
    }

    // Re-render
    if (typeof renderCategoryPills === 'function') renderCategoryPills();
    if (typeof renderBrandFilters === 'function') renderBrandFilters();
    if (typeof renderProducts === 'function') renderProducts();

    // Scroll to catalog
    const catalog = document.getElementById('catalogo');
    if (catalog) catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Confirm message in chat
    this.addBotMessage(`✅ ¡Listo! Apliqué los filtros al catálogo. ¿Necesitas ajustar algo más?`);

    // Close after short delay
    setTimeout(() => this.close(), 1800);
  }
}

// ─── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.eliAssistant = new ChatAssistant();
});
