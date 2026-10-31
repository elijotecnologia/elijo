/* ============================================================
   ELIJO TECNOLOGÍA — Aplicación del Catálogo y Cotizador 3D
   Integración con Google Sheets + Búsqueda + Visualización 3D + Cotizador + Proforma PDF
   ============================================================= */

'use strict';

// ─── WhatsApp (desde la configuración) ────────────────────────────────────
const WHATSAPP_NUMBER = (typeof SHEETS_CONFIG !== 'undefined')
  ? SHEETS_CONFIG.WHATSAPP_NUMBER
  : '51918394348';

// ─── Seguridad: escape y saneamiento de datos externos ───────────────────
const HTML_ESCAPE_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#39;', '`': '&#96;'
};

/** Escapa cualquier valor para insertarlo como texto o atributo HTML. */
function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, ch => HTML_ESCAPE_MAP[ch]);
}

/** Solo permite http(s), rutas relativas y protocolo-relativas. Bloquea javascript:, data:, vbscript:, etc. */
function sanitizeUrl(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (/^(https?:)?\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;
  return raw;
}

function escapeAttr(value) { return escapeHTML(value); }

// ─── Acceso defensivo a localStorage (modo privado / storage bloqueado) ──
const memoryStorage = new Map();

function storageGet(key) {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch (err) {
    // storage bloqueado → fallback a memoria
  }
  return memoryStorage.has(key) ? memoryStorage.get(key) : null;
}

function storageSet(key, value) {
  memoryStorage.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`⚠️ Elijo Tech: no se pudo guardar "${key}" en localStorage; se usará memoria.`);
  }
}

// ─── Lista de productos reactivos ──────
let PRODUCTS = [];

// Seed aleatorio de sesión para ordenamiento "Variedad" — se genera una vez por carga de página.
// Esto garantiza que los productos se mezclen diferente en cada visita pero no se reordenen
// constantemente mientras el usuario navega.
const SESSION_SHUFFLE_SEED = Math.random();

/** Fisher-Yates shuffle determinístico usando el seed de sesión como base. */
function shuffleArrayBySeed(arr, seed) {
  const a = [...arr];
  // Generador de pseudo-aleatoriedad simple (mulberry32)
  let s = Math.floor(seed * 0xffffffff) >>> 0;
  const rand = () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Estado Global ───────────────────────────────────────────
let state = {
  search: '',
  category: 'all',
  brands: new Set(),
  conditions: new Set(),
  minDiscount: 0,
  priceMin: 0,
  priceMax: Infinity,
  sort: 'variety',
  loading: true,
  source: 'demo', // 'sheets' | 'demo'
  lastSync: null,
  only3D: false, // Filtro 🔥 Solo productos 3D
  renderLimit: 24,
  filterSignature: '',
};

// ─── Estado de Cotización ────────────────────────────────────
const QUOTATION_STORAGE_KEY = 'elijo_quotation';
const QUOTE_CLIENT_KEY = 'elijo_quote_client';
const QUOTE_COUNTER_KEY = 'elijo_quote_counter';
const QUOTE_VALIDITY_DAYS = 3;

function sanitizeQuotationItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = (item.id !== null && item.id !== undefined) ? String(item.id).trim() : '';
  if (!id) return null;
  const price = Number(item.price);
  const qty = parseInt(item.qty, 10);
  return {
    id,
    name: typeof item.name === 'string' ? item.name.slice(0, 300) : '',
    brand: typeof item.brand === 'string' ? item.brand.slice(0, 120) : '',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    image: typeof item.image === 'string' ? item.image.slice(0, 500) : '',
    category: typeof item.category === 'string' ? item.category.slice(0, 60) : '',
    qty: (Number.isFinite(qty) && qty > 0) ? Math.min(qty, 999) : 1,
  };
}

function loadQuotation() {
  try {
    const raw = storageGet(QUOTATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeQuotationItem).filter(Boolean);
  } catch (err) {
    console.warn('⚠️ Elijo Tech: cotización guardada inválida; se inicia vacía.');
    return [];
  }
}

function loadQuoteClient() {
  try {
    const raw = storageGet(QUOTE_CLIENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveQuoteClient() {
  const data = {
    name: (document.getElementById('quote-client-name')?.value || '').trim(),
    company: (document.getElementById('quote-client-company')?.value || '').trim(),
    ruc: (document.getElementById('quote-client-ruc')?.value || '').trim(),
    address: (document.getElementById('quote-client-address')?.value || '').trim(),
  };
  storageSet(QUOTE_CLIENT_KEY, JSON.stringify(data));
}

function nextQuoteNumber() {
  let n = 0;
  try { n = parseInt(storageGet(QUOTE_COUNTER_KEY) || '0', 10) || 0; } catch (_) { n = 0; }
  n += 1;
  storageSet(QUOTE_COUNTER_KEY, String(n));
  return n;
}

let quotation = loadQuotation();

// ═════════════════════════════════════════════════════════════
// INTEGRACIÓN CON GOOGLE SHEETS Y PARSER DE DATOS
// ═════════════════════════════════════════════════════════════

/**
 * Analizar una fila CSV respetando los campos entre comillas que pueden contener comas.
 */
function parseCSVRow(row) {
  const resultado = [];
  let actual = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      resultado.push(actual.trim());
      actual = '';
    } else {
      actual += ch;
    }
  }
  resultado.push(actual.trim());
  return resultado;
}

/**
 * Analizar la cadena de especificaciones: "Clave1:Valor1|Clave2:Valor2" → { Clave1: 'Valor1', ... }
 */
function parseSpecs(specsStr) {
  if (!specsStr || specsStr.trim() === '') return {};
  const specs = {};
  specsStr.split('|').forEach(pair => {
    const colonIdx = pair.indexOf(':');
    if (colonIdx > -1) {
      const key = pair.slice(0, colonIdx).trim();
      const val = pair.slice(colonIdx + 1).trim();
      if (key) specs[key] = val;
    }
  });
  return specs;
}

/**
 * Analizar la cadena de etiquetas: "Tag1,Tag2,Tag3" → ['Tag1', 'Tag2', 'Tag3']
 */
function parseTags(tagsStr) {
  if (!tagsStr || tagsStr.trim() === '') return [];
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Convertir una fila CSV en objeto de producto con soporte de ID, imagen y modelo 3D.
 */
function rowToProduct(cells, index) {
  const [
    id, name, brand, category, price, oldPrice, badge,
    image, description, specs, tags, featured, has3D
  ] = cells;

  if (!name || !price) return null; // Omite filas vacías

  const rawId = id && String(id).trim() ? String(id).trim() : `prod-${101 + index}`;
  const parsedPrice = parseFloat(String(price).replace(/[^\d.]/g, ''));
  const parsedOldPrice = oldPrice && oldPrice.trim() !== ''
    ? parseFloat(String(oldPrice).replace(/[^\d.]/g, ''))
    : null;

  // Formato de imagen: image/[id].jpg según requerimiento y Google Sheets
  let imagePath = (image || '').trim();
  if (!imagePath) {
    imagePath = `image/${rawId}.jpg`;
  } else if (!imagePath.startsWith('http') && !imagePath.startsWith('image/') && !imagePath.startsWith('images/')) {
    imagePath = `image/${imagePath}`;
  }

  // Indicador 3D: solo si la hoja lo indica explicitamente (la hoja actual no tiene columna has3D)
  const is3D = has3D !== undefined && has3D !== null && String(has3D).trim() !== ''
    ? String(has3D).trim().toUpperCase() === 'TRUE'
    : false;

  return {
    id: rawId,
    name: name.trim(),
    brand: (brand || '').trim(),
    category: (category || '').trim().toLowerCase(),
    price: isNaN(parsedPrice) ? 0 : parsedPrice,
    oldPrice: parsedOldPrice && !isNaN(parsedOldPrice) ? parsedOldPrice : null,
    badge: badge && badge.trim() !== '' ? badge.trim().toLowerCase() : null,
    image: imagePath,
    has3D: is3D,
    description: (description || '').trim(),
    specs: parseSpecs(specs),
    tags: parseTags(tags),
    featured: String(featured).trim().toUpperCase() === 'TRUE',
  };
}

/**
 * Obtener productos desde Google Sheets CSV
 */
async function fetchFromGoogleSheets(csvUrl) {
  const url = csvUrl + (csvUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'text/csv,text/plain,*/*' },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
  }

  const csvText = await response.text();
  const rows = csvText.split('\n').filter(r => r.trim() !== '');

  if (rows.length < 2) {
    throw new Error('La hoja de Google Sheets está vacía o no tiene datos de productos');
  }

  const productos = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = parseCSVRow(rows[i]);
    const producto = rowToProduct(cells, i - 1);
    if (producto) productos.push(producto);
  }

  if (productos.length === 0) {
    throw new Error('No se encontraron productos válidos en la hoja');
  }

  return productos;
}

/**
 * Cargar productos
 */
async function loadProducts() {
  showLoadingState();

  const config = typeof SHEETS_CONFIG !== 'undefined' ? SHEETS_CONFIG : {};
  const csvUrl = config.SHEETS_CSV_URL || '';

  if (csvUrl && csvUrl.startsWith('http')) {
    try {
      updateSyncBanner('syncing');
      const productos = await fetchFromGoogleSheets(csvUrl);
      PRODUCTS = productos;
      state.source = 'sheets';
      state.lastSync = new Date();
      updateSyncBanner('success', productos.length);
      console.log(`✅ Elijo Tech: ${productos.length} productos cargados desde Google Sheets`);
    } catch (err) {
      console.warn('⚠️ Elijo Tech: Error al cargar Google Sheets:', err.message);
      if (config.FALLBACK_TO_DEMO !== false) {
        PRODUCTS = (typeof PRODUCTOS_DEMO !== 'undefined') ? PRODUCTOS_DEMO : [];
        state.source = 'demo';
        updateSyncBanner('error', 0, err.message);
      } else {
        PRODUCTS = [];
        updateSyncBanner('error', 0, err.message);
      }
    }
  } else {
    PRODUCTS = (typeof PRODUCTOS_DEMO !== 'undefined') ? PRODUCTOS_DEMO : [];
    state.source = 'demo';
    updateSyncBanner('demo');
  }

  state.loading = false;
  renderCategoryPills();
  renderDropdownCategories();
  renderBrandFilters();
  renderProducts();
  renderOffers();
  updateQuotationUI();

  // Controlar hash de producto (enlace profundo compartido): siempre, sin depender de intro
  handleProductHash();

  const refreshMins = config.AUTO_REFRESH_MINUTES || 0;
  if (refreshMins > 0 && csvUrl) {
    setInterval(() => refreshProducts(csvUrl), refreshMins * 60 * 1000);
  }
}

/**
 * Recarga silenciosa en segundo plano
 */
async function refreshProducts(csvUrl) {
  try {
    const productos = await fetchFromGoogleSheets(csvUrl);
    PRODUCTS = productos;
    state.source = 'sheets';
    state.lastSync = new Date();
    updateSyncBanner('success', productos.length);
    renderCategoryPills();
    renderDropdownCategories();
    renderBrandFilters();
    renderProducts();
    renderOffers();
  } catch (err) {
    console.warn('⚠️ Elijo Tech: Error al actualizar:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// BANNER DE SINCRONIZACIÓN
// ═════════════════════════════════════════════════════════════
const SHOW_SYNC_STATUS = false;
function updateSyncBanner(status, count = 0, errorMsg = '') {
  if (!SHOW_SYNC_STATUS) return;
  const banner = document.getElementById('sheets-sync-banner');
  if (!banner) return;

  const messages = {
    syncing: 'Sincronizando con Google Sheets…',
    success: ` ✓ ${count} productos sincronizados desde Google Sheets`,
    error: `⚠ Error de sincronización — usando datos de ejemplo. (${errorMsg})`,
    demo: '📋 Modo demo · Elijo Tecnología',
  };

  banner.className = `sheets-sync-banner banner-${status}`;
  banner.innerHTML = `<span>${escapeHTML(messages[status])}</span>`;
}

// ═════════════════════════════════════════════════════════════
// CARGANDO ESQUELETO
// ═════════════════════════════════════════════════════════════
function showLoadingState() {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count');
  if (countEl) countEl.innerHTML = 'Cargando productos…';

  if (grid) {
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <div class="product-card skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton-img"></div>
        <div class="product-body">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-footer"></div>
        </div>
      </div>
    `).join('');
  }
}

// ─── Ayudas de formato ───────────────────────────────────────
function formatPrice(price) {
  return `S/ ${price.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function badgeHTML(badge) {
  if (!badge) return '';
  const key = String(badge).trim().toLowerCase();
  const labels = {
    new: 'Nuevo',
    hot: '🔥 Popular',
    sale: 'Oferta',
    stock: 'Disponible',
    agotado: 'Agotado',
    proximamente: 'Próximamente',
    nuevo: 'Nuevo',
    reacondicionado: 'Reacondicionado',
  };
  const safeKey = key.replace(/[^a-z0-9_-]/g, '');
  return `<span class="product-badge badge-${safeKey}">${escapeHTML(labels[key] || key)}</span>`;
}

function whatsappLink(product) {
  const msg = encodeURIComponent(
    `¡Hola! Estoy interesado/a en el producto:\n*${product.name}*\nPrecio: ${formatPrice(product.price)}\n¿Podría darme más información?`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

// ─── Reusable product share url function ─────────────────────────────────────
function getProductShareUrl(productId) {
  const baseUrl = window.location.href.split('#')[0];
  return `${baseUrl}#producto-${encodeURIComponent(productId)}`;
}

// ─── Custom Toast helper ─────────────────────────────────────────────────────
function showToast(message) {
  const notification = document.createElement('div');
  notification.className = 'info-toast';
  notification.innerHTML = `<span>${escapeHTML(message)}</span>`;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('active'), 10);
  setTimeout(() => {
    notification.classList.remove('active');
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

// ─── Function to copy to clipboard with a toast ──────────────────────────────
function fallbackCopyToClipboard(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => {
        showToast('🔗 Enlace del producto copiado');
      })
      .catch(err => {
        console.error('Error al copiar al portapapeles:', err);
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('🔗 Enlace del producto copiado');
      });
  } else {
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('🔗 Enlace del producto copiado');
  }
}

// ─── Global sharing function ─────────────────────────────────────────────────
async function shareProduct(productId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const p = PRODUCTS.find(x => String(x.id) === String(productId));
  if (!p) return;

  const url = getProductShareUrl(p.id);
  const title = `Elijo Tecnología — ${p.name}`;
  const text = `Mira este producto en Elijo Tecnología: ${p.name}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text,
        url: url
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al compartir con Web Share:', err);
        fallbackCopyToClipboard(url);
      }
    }
  } else {
    fallbackCopyToClipboard(url);
  }
}

// ─── Custom isotype action pill HTML rendering function ─────────────────────
function renderProductActionsPill(p, isModal = false) {
  const svgClass = isModal ? 'pill-isotype-svg modal-isotype-svg' : 'pill-isotype-svg';
  const pillClass = isModal ? 'product-actions-pill modal-actions-pill' : 'product-actions-pill';
  const id = escapeAttr(p.id);

  return `
    <div class="${pillClass}">
      <button class="pill-action pill-action-quote"
        ${isModal ? 'id="modal-add-quote-btn"' : 'data-action="add" data-id="' + id + '"'}
        aria-label="Añadir a Cotización" title="Añadir a Cotización">
        <svg class="${svgClass}" width="14" height="14" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="16" r="10" stroke="currentColor" stroke-width="7"/>
          <rect x="42" y="7" width="50" height="18" rx="9" stroke="currentColor" stroke-width="7"/>
        </svg>
        <span>Cotizar</span>
      </button>
      <div class="pill-divider"></div>
      <a href="${escapeAttr(whatsappLink(p))}" target="_blank" rel="noopener noreferrer"
        class="pill-action pill-action-whatsapp"
        ${isModal ? 'id="modal-whatsapp-btn"' : 'data-action="whatsapp"'}
        aria-label="Consultar por WhatsApp" title="Consultar por WhatsApp">
        <svg class="${svgClass}" width="14" height="14" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="16" r="10" fill="currentColor"/>
          <rect x="42" y="7" width="50" height="18" rx="9" stroke="currentColor" stroke-width="7"/>
        </svg>
        <span>Consultar</span>
      </a>
      <div class="pill-divider"></div>
      <button class="pill-action pill-action-share"
        ${isModal ? 'id="modal-share-btn"' : 'data-action="share" data-id="' + id + '"'}
        aria-label="Compartir producto" title="Compartir producto">
        <svg class="${svgClass}" width="14" height="14" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="16" r="10" stroke="currentColor" stroke-width="7"/>
          <rect x="42" y="7" width="50" height="18" rx="9" stroke="currentColor" stroke-width="7"/>
        </svg>
        <span>Compartir</span>
      </button>
    </div>
  `;
}

// ─── Control de Hash (URL Directa por Producto) ──────────────────────────────
function handleProductHash() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#producto-')) {
    let productId = hash.slice('#producto-'.length);
    try { productId = decodeURIComponent(productId); } catch (_) {}
    const p = PRODUCTS.find(x => String(x.id) === String(productId));
    if (p) {
      openModal(p.id);
    }
  }
}

// ─── Introducción de marca ─────────────────────────────────────────
function initBrandIntro() {
  const overlay = document.getElementById('brand-intro-overlay');
  if (overlay) overlay.remove();
  handleProductHash();
}

// ─── Sistema Dinámico de Banners Publicitarios (Detección Automática & Crossfade) ──────
async function initBannerSystem() {
  const container = document.getElementById('dynamic-banner');
  if (!container || typeof BANNER_CONFIG === 'undefined' || !BANNER_CONFIG.active) return;

  // ─── Lista primaria WebP (hardcoded para garantía total) ───────────────
  // Estos son los banners WebP existentes en /banners/.
  // Son la PRIMERA FUENTE. Los SVG solo son fallback si falla la imagen individual.
  const WEBP_BANNERS = [
    'banner-01.webp',
    'banner-03.webp',
    'banner-04.webp',
    'banner-05.webp',
    'banner-07.webp',
    'banner-08.webp',
    'banner-09.webp',
    'banner-10.webp',
    'banner-11.webp'
  ];

  // ─── Orden estricto de prioridad de extensiones ─────────────────────────
  const formatPriority = { '.webp': 1, '.jpeg': 2, '.jpg': 3, '.png': 4, '.svg': 5 };

  // ─── Intentar cargar banners.json para detectar banners adicionales ──────
  // (ej: si el usuario agrega banner-11.jpeg en el futuro)
  let rawFiles = [...WEBP_BANNERS]; // arrancar con los WebP hardcodeados

  try {
    const res = await fetch('banners/banners.json?v=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Combinar: los de banners.json + los hardcodeados, priorizando banners.json
        const combined = new Set([...data, ...WEBP_BANNERS]);
        rawFiles = [...combined];
      }
    }
  } catch (_) {
    // Silencioso: si banners.json no está disponible, usamos los JPEG hardcodeados
  }

  // ─── Agrupar por nombre base, respetando prioridad de formato ───────────
  const grouped = new Map();

  rawFiles.forEach(file => {
    const match = file.match(/^(.+?)(\.[a-zA-Z0-9]+)$/);
    if (!match) return;
    const base = match[1].toLowerCase();
    const ext  = match[2].toLowerCase();

    if (!(ext in formatPriority)) return;

    if (!grouped.has(base)) {
      grouped.set(base, { file, ext, priority: formatPriority[ext] });
    } else {
      const current = grouped.get(base);
      if (formatPriority[ext] < current.priority) {
        grouped.set(base, { file, ext, priority: formatPriority[ext] });
      }
    }
  });

  // ─── Ordenar numéricamente (banner-01, banner-02, ..., banner-10) ────────
  const sortedBases = [...grouped.keys()].sort((a, b) => {
    const numA = parseInt((a.match(/\d+/) || [0])[0], 10);
    const numB = parseInt((b.match(/\d+/) || [0])[0], 10);
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  let slides = sortedBases.map(base => {
    const item = grouped.get(base);
    return {
      id: base,
      image: `banners/${item.file}`,
      link: '#catalogo'
    };
  });

  // ─── Fallback final solo si no hay slides en absoluto ───────────────────
  if (slides.length === 0 && BANNER_CONFIG.slides && BANNER_CONFIG.slides.length > 0) {
    slides = BANNER_CONFIG.slides;
  }

  if (slides.length === 0) return;

  let activeSlides = [...slides];
  let currentIndex = 0;
  let timer = null;

  const renderSlider = () => {
    if (activeSlides.length === 0) {
      container.setAttribute('hidden', '');
      return;
    }

    const slidesHTML = activeSlides.map((s, idx) => `
      <div class="banner-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-slide-id="${escapeAttr(s.id)}">
        <a href="${escapeAttr(sanitizeUrl(s.link, '#catalogo'))}" class="banner-slide-link">
          <img src="${escapeAttr(sanitizeUrl(s.image))}" alt="Banner publicitario ${idx + 1}" class="banner-slide-img" loading="${idx === 0 ? 'eager' : 'lazy'}" decoding="async" onerror="handleBannerImageError(this)" />
        </a>
      </div>
    `).join('');

    const dotsHTML = activeSlides.length > 1 ? `
      <div class="banner-dots">
        ${activeSlides.map((_, idx) => `
          <button class="banner-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="Ir a banner ${idx + 1}"></button>
        `).join('')}
      </div>
    ` : '';

    container.innerHTML = `
      <div class="banner-slider-container">
        <div class="banner-slider-track">
          ${slidesHTML}
        </div>
        ${dotsHTML}
      </div>
    `;

    container.removeAttribute('hidden');
    bindEvents();
  };

  const bindEvents = () => {
    container.querySelectorAll('.banner-slide-link').forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.getAttribute('href') === '#catalogo') { e.preventDefault(); scrollToCatalog(); }
      });
    });
    const slideElements = container.querySelectorAll('.banner-slide');
    const dotElements   = container.querySelectorAll('.banner-dot');

    const goToSlide = (index) => {
      if (activeSlides.length === 0) return;
      currentIndex = index % activeSlides.length;
      slideElements.forEach((el, i) => {
        if (i === currentIndex) el.classList.add('active');
        else el.classList.remove('active');
      });
      dotElements.forEach((dot, i) => {
        if (i === currentIndex) dot.classList.add('active');
        else dot.classList.remove('active');
      });
    };

    const startTimer = () => {
      if (timer) clearInterval(timer);
      if (activeSlides.length > 1) {
        timer = setInterval(() => {
          const nextIdx = (currentIndex + 1) % activeSlides.length;
          goToSlide(nextIdx);
        }, BANNER_CONFIG.transitionInterval || 5000);
      }
    };

    dotElements.forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(dot.dataset.idx, 10);
        goToSlide(idx);
        startTimer();
      });
    });

    container.onmouseenter = () => { if (timer) clearInterval(timer); };
    container.onmouseleave = () => startTimer();

    startTimer();
  };

  // Manejo de errores si una imagen individual falla al cargar
  window.handleBannerImageError = (imgEl) => {
    console.warn(`⚠️ Error al cargar imagen de banner: ${imgEl.src}. Omitiendo slide...`);
    const slideEl = imgEl && imgEl.closest ? imgEl.closest('.banner-slide') : null;
    const slideId = slideEl ? slideEl.dataset.slideId : null;
    activeSlides = activeSlides.filter(s => s.id !== slideId);
    if (activeSlides.length === 0 && BANNER_CONFIG.slides && BANNER_CONFIG.slides !== activeSlides) {
      activeSlides = [...BANNER_CONFIG.slides];
    }
    renderSlider();
  };

  renderSlider();
}

// ═════════════════════════════════════════════════════════════
// MÉTRICAS DE ENGAGEMENT ELIMINADAS (Etapa 1)
// Se retiraron las visitas y valoraciones inventadas (sin backend real).
// Cualquier métrica futura debe provenir de datos verificados.
// ═════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════
// MOTOR DE MARKETING PSICOLÓGICO (100% client-side)
// Evalúa nombre y categoría del producto → genera badgeTexto + beneficioLlave
// ═════════════════════════════════════════════════════════════

function getMarketingLayer(product) {
  const name = (product.name || '').toLowerCase();
  const cat  = (product.category || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();

  // ── Reglas de Badge psicológico ──────────────────────────────
  let badgeTexto = '';

  if (name.includes('gamer') || name.includes('gaming') || name.includes('rog') || name.includes('rtx')) {
    badgeTexto = '⚡ Alto Rendimiento';
  } else if (name.includes('pro') || brand.includes('apple') || name.includes('ultra')) {
    badgeTexto = '✓ Versión Pro';
  } else if (name.includes('ecotank') || name.includes('láser') || name.includes('laser')) {
    badgeTexto = '💰 Ahorro Total';
  } else if (name.includes('mesh') || name.includes('wifi 6') || name.includes('wi-fi 6')) {
    badgeTexto = '📶 Cobertura Total';
  } else if (name.includes('ssd') || name.includes('nvme') || name.includes('m.2')) {
    badgeTexto = '🚀 Ultra Velocidad';
  } else if (cat === 'celulares' || cat === 'tabletas') {
    badgeTexto = '⭐ Elección Top';
  } else if (cat === 'monitores') {
    badgeTexto = '🎨 Imagen Premium';
  } else if (cat === 'componentes') {
    badgeTexto = '🔧 Upgrade Ideal';
  } else if (cat === 'perifericos') {
    badgeTexto = '🖱️ Control Total';
  } else if (cat === 'software') {
    badgeTexto = '🔒 Licencia Oficial';
  } else if (cat === 'impresoras') {
    badgeTexto = '🖨️ Lista para Usar';
  } else if (cat === 'redes') {
    badgeTexto = '📡 Siempre Conectado';
  } else {
    badgeTexto = '✓ Recomendado';
  }

  // ── Micro-frase de beneficio clave ────────────────────────────
  let beneficioLlave = '';

  if (name.includes('gamer') || name.includes('rtx') || name.includes('rog')) {
    beneficioLlave = 'Juega sin límites ni lag';
  } else if (cat === 'laptops' && (name.includes('ultrabook') || name.includes('pavilion') || name.includes('hp'))) {
    beneficioLlave = 'Ligera, lista para llevar';
  } else if (cat === 'laptops') {
    beneficioLlave = 'Trabaja y estudia sin pausas';
  } else if (cat === 'celulares' && name.includes('ultra')) {
    beneficioLlave = 'Fotografía profesional en tu bolsillo';
  } else if (cat === 'celulares') {
    beneficioLlave = 'Conectado todo el día';
  } else if (cat === 'tabletas') {
    beneficioLlave = 'Crea y consume donde quieras';
  } else if (cat === 'componentes' && (name.includes('rtx') || name.includes('gpu') || name.includes('geforce'))) {
    beneficioLlave = 'Gráficos que te dejan sin aliento';
  } else if (cat === 'componentes') {
    beneficioLlave = 'Dale vida a tu PC';
  } else if (cat === 'impresoras' && name.includes('ecotank')) {
    beneficioLlave = 'Imprime miles de páginas a bajo costo';
  } else if (cat === 'impresoras') {
    beneficioLlave = 'Lista para imprimir hoy mismo';
  } else if (cat === 'monitores' && (name.includes('165hz') || name.includes('144hz'))) {
    beneficioLlave = 'Fluidez que se nota al instante';
  } else if (cat === 'monitores') {
    beneficioLlave = 'Más espacio visual para trabajar';
  } else if (cat === 'almacenamiento' && name.includes('ssd')) {
    beneficioLlave = 'Arranca en segundos, no minutos';
  } else if (cat === 'almacenamiento') {
    beneficioLlave = 'Lleva tus archivos a cualquier lugar';
  } else if (cat === 'redes') {
    beneficioLlave = 'Sin zonas muertas en tu hogar';
  } else if (cat === 'software') {
    beneficioLlave = 'Listo para usar sin configuraciones';
  } else if (cat === 'perifericos') {
    beneficioLlave = 'Siente la diferencia al primer toque';
  } else {
    beneficioLlave = 'Elige con confianza, elige mejor';
  }

  return { badgeTexto, beneficioLlave };
}

// ─── Ayudantes calculados ─────────────────────────────────────────
function getAllBrands() {
  return [...new Set(PRODUCTS.map(p => p.brand))].filter(Boolean).sort();
}

function getFilteredProducts() {
  let list = PRODUCTS.filter(p => {
    const matchSearch = !state.search ||
      p.name.toLowerCase().includes(state.search.toLowerCase()) ||
      p.brand.toLowerCase().includes(state.search.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(state.search.toLowerCase()));

    const matchCat = state.category === 'all' || p.category === state.category;
    const matchBrand = state.brands.size === 0 || state.brands.has(p.brand);
    const matchPrice = p.price >= state.priceMin && p.price <= state.priceMax;
    const matchCond = state.conditions.size === 0 || state.conditions.has(String(p.badge).toLowerCase());
    const discount = (p.oldPrice && p.oldPrice > p.price) ? (p.oldPrice - p.price) / p.oldPrice : 0;
    const matchDiscount = discount * 100 >= state.minDiscount;
    return matchSearch && matchCat && matchBrand && matchPrice && matchCond && matchDiscount;
  });

  switch (state.sort) {
  case 'variety': {
      // Agrupar por categoría, mezclar cada bucket con el seed de sesión
      // y luego intercalar. Estable durante la navegación; varía en cada recarga.
      const categoriesMap = new Map();
      list.forEach(p => {
        const cat = p.category || 'otros';
        if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
        categoriesMap.get(cat).push(p);
      });

      // Mezclar el orden de las categorías y los productos dentro de cada una
      let catKeys = shuffleArrayBySeed([...categoriesMap.keys()], SESSION_SHUFFLE_SEED);
      const shuffledMap = new Map();
      catKeys.forEach((cat, idx) => {
        // Seed ligeramente diferente por categoría para independencia
        shuffledMap.set(cat, shuffleArrayBySeed(categoriesMap.get(cat), SESSION_SHUFFLE_SEED + idx * 0.01));
      });

      const interleaved = [];
      let added = true;
      while (added) {
        added = false;
        for (const prods of shuffledMap.values()) {
          if (prods.length > 0) {
            interleaved.push(prods.shift());
            added = true;
          }
        }
      }
      list = interleaved;
      break;
    }
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  // Empujar productos agotados al final
  list.sort((a, b) => {
    const aAgotado = a.badge === 'agotado' ? 1 : 0;
    const bAgotado = b.badge === 'agotado' ? 1 : 0;
    return aAgotado - bAgotado;
  });

  return list;
}

// ─── Renderizar cuadrícula de productos ──────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count');
  const list = getFilteredProducts();

  // Reiniciar paginacion cuando cambian los filtros
  const signature = state.search + '|' + state.category + '|' + [...state.brands].join(',') + '|' + [...state.conditions].join(',') + '|' + state.minDiscount + '|' + state.priceMin + '|' + state.priceMax + '|' + state.sort;
  if (signature !== state.filterSignature) {
    state.filterSignature = signature;
    state.renderLimit = 24;
  }

  if (countEl) {
    countEl.innerHTML = `<strong>${list.length}</strong> producto${list.length !== 1 ? 's' : ''} encontrado${list.length !== 1 ? 's' : ''}`;
  }

  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1;text-align:center;padding:48px 20px;">
        <div class="no-results-icon" style="font-size:3rem;margin-bottom:12px;">🔍</div>
        <h3 style="font-size:1.2rem;font-weight:700;">No encontramos productos</h3>
        <p style="color:var(--text-muted);">Intente cambiar los filtros o la búsqueda</p>
      </div>`;
    return;
  }

  const visible = list.slice(0, state.renderLimit);

  grid.innerHTML = visible.map((p, i) => {
    const { badgeTexto, beneficioLlave } = getMarketingLayer(p);
    const id = escapeAttr(p.id);
    const name = escapeHTML(p.name);
    const image = escapeAttr(sanitizeUrl(p.image, 'image/1000.jpg'));
    return `
    <article
      class="product-card ${p.badge === 'agotado' ? 'product-card-out-of-stock' : ''}"
      role="button"
      tabindex="0"
      aria-label="Ver detalle de ${name}"
      data-id="${id}"
      style="animation-delay: ${Math.min(i * 30, 300)}ms"
    >
      <div class="product-badges-wrap">
        ${badgeHTML(p.badge)}
        <span class="mktg-badge">${escapeHTML(badgeTexto)}</span>
      </div>
      <div class="product-img-wrap">
        <img src="${image}" alt="${name}" loading="lazy" decoding="async" width="400" height="400"
          onerror="this.src='image/1000.jpg'" />
        <div class="product-overlay">
          <button class="overlay-btn" tabindex="-1">Ver detalle</button>
        </div>
      </div>
      <div class="product-body">
        <p class="product-brand">${escapeHTML(p.brand)}</p>
        <h3 class="product-name">${name}</h3>
        <p class="product-benefit">💡 ${escapeHTML(beneficioLlave)}</p>
        <div class="product-specs">
          ${(p.tags || []).map(t => `<span class="spec-tag">${escapeHTML(t)}</span>`).join('')}
        </div>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-add-quote" data-action="add" data-id="${id}">📋 Cotizar</button>
            <a href="${escapeAttr(whatsappLink(p))}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-card" data-action="whatsapp" aria-label="Consultar por WhatsApp" title="Consultar por WhatsApp">💬 Consultar</a>
            <button class="btn-share-card" data-action="share" data-id="${id}" aria-label="Compartir producto" title="Compartir producto">🔗 Compartir</button>
          </div>
        </div>
      </div>
    </article>`;
  }).join('') + (list.length > visible.length ? `
    <div class="load-more-wrap" style="grid-column:1/-1;text-align:center;padding:24px 0;">
      <button class="btn-load-more" id="btn-load-more">Cargar más (${list.length - visible.length} restantes)</button>
    </div>` : '');

  const loadMoreBtn = document.getElementById('btn-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      state.renderLimit += 24;
      renderProducts();
    });
  }

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (actionEl && card.contains(actionEl)) {
        const action = actionEl.dataset.action;
        if (action === 'add') {
          event.preventDefault();
          event.stopPropagation();
          addToQuotation(actionEl.dataset.id);
          openQuotationDrawer();
          return;
        }
        if (action === 'share') {
          event.preventDefault();
          event.stopPropagation();
          shareProduct(actionEl.dataset.id, event);
          return;
        }
        if (action === 'whatsapp') {
          event.stopPropagation();
          return;
        }
      }
      openModal(card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(card.dataset.id); }
    });
  });

  observeScrollReveal();
}

// ─── Renderizar Ofertas Especiales (Carrusel) ──────────────────────────────
let offersAutoScrollTimer = null;

function renderOffers() {
  const section = document.getElementById('offers-section');
  const grid = document.getElementById('offers-grid');
  if (!section || !grid) return;

  // Ofertas reales: descuento >= 15% sobre oldPrice (no todo el catalogo)
  const OFFER_MIN_DISCOUNT = 0.15;
  let offers = PRODUCTS.filter(p => {
    if (p.badge === 'agotado') return false;
    if (p.badge === 'sale' || p.badge === 'hot') return true;
    if (p.oldPrice && p.oldPrice > p.price) {
      const discount = (p.oldPrice - p.price) / p.oldPrice;
      return discount >= OFFER_MIN_DISCOUNT;
    }
    return false;
  });
  if (offers.length < 4) {
    const extra = PRODUCTS.filter(p => p.featured && p.badge !== 'agotado' && !offers.some(o => o.id === p.id));
    offers = [...offers, ...extra];
  }

  if (offers.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  const offersLimit = state.offersExpanded ? offers.length : 12;
  const visibleOffers = offers.slice(0, offersLimit);

  grid.innerHTML = visibleOffers.map((p, i) => {
    const id = escapeAttr(p.id);
    const name = escapeHTML(p.name);
    const image = escapeAttr(sanitizeUrl(p.image, 'image/1000.jpg'));
    return `
    <article
      class="product-card offer-card"
      role="button"
      tabindex="0"
      aria-label="Ver oferta de ${name}"
      data-id="${id}"
    >
      <div class="product-badges-wrap">
        ${badgeHTML(p.badge || 'sale')}
      </div>
      <div class="product-img-wrap">
        <img src="${image}" alt="${name}" loading="lazy" decoding="async" width="400" height="400"
          onerror="this.src='image/1000.jpg'" />
        <div class="product-overlay">
          <button class="overlay-btn" tabindex="-1">Ver oferta</button>
        </div>
      </div>
      <div class="product-body">
        <p class="product-brand">${escapeHTML(p.brand)}</p>
        <h3 class="product-name">${name}</h3>
        <div class="product-specs">
          ${(p.tags || []).map(t => `<span class="spec-tag">${escapeHTML(t)}</span>`).join('')}
        </div>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-add-quote" data-action="add" data-id="${id}">📋 Cotizar</button>
            <a href="${escapeAttr(whatsappLink(p))}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-card" data-action="whatsapp" aria-label="Consultar por WhatsApp" title="Consultar por WhatsApp">💬 Consultar</a>
            <button class="btn-share-card" data-action="share" data-id="${id}" aria-label="Compartir producto" title="Compartir producto">🔗 Compartir</button>
          </div>
        </div>
      </div>
    </article>
  `;
  }).join('') + (offers.length > visibleOffers.length ? `
    <div class="load-more-wrap" style="grid-column:1/-1;text-align:center;padding:16px 0;">
      <button class="btn-load-more" id="offers-load-more">Ver todas las ofertas (${offers.length - visibleOffers.length} más)</button>
    </div>` : '');

  const offersMoreBtn = document.getElementById('offers-load-more');
  if (offersMoreBtn) {
    offersMoreBtn.addEventListener('click', () => {
      state.offersExpanded = true;
      renderOffers();
    });
  }

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (actionEl && card.contains(actionEl)) {
        const action = actionEl.dataset.action;
        if (action === 'add') { event.preventDefault(); event.stopPropagation(); addToQuotation(actionEl.dataset.id); openQuotationDrawer(); return; }
        if (action === 'share') { event.preventDefault(); event.stopPropagation(); shareProduct(actionEl.dataset.id, event); return; }
        if (action === 'whatsapp') { event.stopPropagation(); return; }
      }
      openModal(card.dataset.id);
    });
  });

  initOffersCarousel(grid);
}

function initOffersCarousel(grid) {
  if (!grid) return;
  const prevBtn = document.getElementById('offers-prev-btn');
  const nextBtn = document.getElementById('offers-next-btn');

  const cardWidth = 300;

  const scrollNext = () => {
    const maxScroll = grid.scrollWidth - grid.clientWidth;
    if (grid.scrollLeft >= maxScroll - 15) {
      grid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      grid.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  const scrollPrev = () => {
    if (grid.scrollLeft <= 15) {
      grid.scrollTo({ left: grid.scrollWidth - grid.clientWidth, behavior: 'smooth' });
    } else {
      grid.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  if (prevBtn) prevBtn.onclick = () => { scrollPrev(); restartTimer(); };
  if (nextBtn) nextBtn.onclick = () => { scrollNext(); restartTimer(); };

  const startTimer = () => {
    stopTimer();
    offersAutoScrollTimer = setInterval(scrollNext, 3500);
  };

  const stopTimer = () => {
    if (offersAutoScrollTimer) clearInterval(offersAutoScrollTimer);
  };

  const restartTimer = () => {
    stopTimer();
    startTimer();
  };

  grid.onmouseenter = stopTimer;
  grid.onmouseleave = startTimer;
  grid.ontouchstart = stopTimer;
  grid.ontouchend = () => setTimeout(startTimer, 2000);

  startTimer();
}

// ─── Renderizar Filtros de Marca ───────────────────────────────
function renderBrandFilters() {
  const container = document.getElementById('brand-filters');
  if (!container) return;

  const marcas = getAllBrands();
  const counts = {};
  PRODUCTS.forEach(p => { if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1; });

  container.innerHTML = marcas.map((b, index) => `
    <label class="filter-option">
      <input type="checkbox" id="brand-filter-${index}" value="${escapeAttr(b)}"
        ${state.brands.has(b) ? 'checked' : ''} />
      <span class="filter-option-label">${escapeHTML(b)}</span>
      <span class="filter-option-count">${counts[b] || 0}</span>
    </label>
  `).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.brands.add(cb.value);
      else state.brands.delete(cb.value);
      renderProducts();
    });
  });
}

// ─── Modal con Visualizador 3D <model-viewer>, Rating y Visitas ──────────────
function openModal(id) {
  const p = PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) return;

  // Obtener datos de marketing
  const { badgeTexto, beneficioLlave } = getMarketingLayer(p);

  const specsHTML = Object.entries(p.specs || {}).map(([k, v]) => `
    <div class="modal-spec-row">
      <span class="modal-spec-key">${escapeHTML(k)}</span>
      <span class="modal-spec-val">${escapeHTML(v)}</span>
    </div>
  `).join('');

  const visualHTML = `
    <div class="modal-img-wrap">
      <img src="${escapeAttr(sanitizeUrl(p.image, 'image/1000.jpg'))}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async" onerror="this.src='image/1000.jpg'" />
    </div>
  `;

  const tagsHTML = (p.tags && p.tags.length)
    ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">${p.tags.map(escapeHTML).join(' · ')}</p>`
    : '';

  const descHTML = p.description
    ? `<div style="margin-top:14px;">
        <p class="modal-specs-title">Descripción</p>
        <p class="modal-description">${escapeHTML(p.description).replace(/\n/g, '<br>')}</p>
      </div>`
    : '';

  document.getElementById('modal-content').innerHTML = `
    <header class="modal-header">
      <div>
        <span class="mktg-badge mktg-badge-modal">${escapeHTML(badgeTexto)}</span>
      </div>
      <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">&times;</button>
    </header>
    <div class="modal-body">
      ${visualHTML}
      <div class="modal-info">
        <p class="modal-brand">${escapeHTML(p.brand)}</p>
        <h2 class="modal-name">${escapeHTML(p.name)}</h2>
        ${tagsHTML}

        <div class="modal-price-block">
          <span class="modal-price">${formatPrice(p.price)}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);margin-left:6px;">(IGV Incluido)</span>
          ${p.oldPrice ? `<span class="modal-price-old">${formatPrice(p.oldPrice)}</span>` : ''}
        </div>

        <div class="modal-benefit-box">
          <span class="modal-benefit-icon">💡</span>
          <span class="modal-benefit-text">${escapeHTML(beneficioLlave)}</span>
        </div>

        ${specsHTML ? `<div style="margin-top:14px;">
          <p class="modal-specs-title">Especificaciones Técnicas</p>
          <div class="modal-specs-list">${specsHTML}</div>
        </div>` : ''}
        ${descHTML}

        ${renderProductActionsPill(p, true)}
      </div>
    </div>
  `;

  // Actualizar hash de forma silenciosa sin disparar hashchange
  history.replaceState(null, document.title, `#producto-${encodeURIComponent(p.id)}`);

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  const addQuoteBtn = document.getElementById('modal-add-quote-btn');
  if (addQuoteBtn) addQuoteBtn.addEventListener('click', () => {
    addToQuotation(p.id);
    closeModal();
    openQuotationDrawer();
  });
  const shareBtn = document.getElementById('modal-share-btn');
  if (shareBtn) shareBtn.addEventListener('click', (e) => { e.preventDefault(); shareProduct(p.id, e); });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  // Limpiar el hash de la URL si era de este producto
  if (window.location.hash.startsWith('#producto-')) {
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
}

// ─── 10 Categorías Principales ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',            label: 'Todos',          icon: '🛍️' },
  { id: 'laptops',        label: 'Laptops',         icon: '💻' },
  { id: 'celulares',      label: 'Celulares',       icon: '📱' },
  { id: 'impresoras',     label: 'Impresoras',      icon: '🖨️' },
  { id: 'componentes',    label: 'Componentes',     icon: '⚙️' },
  { id: 'almacenamiento', label: 'Almacenamiento',  icon: '💾' },
  { id: 'monitores',      label: 'Monitores',       icon: '🖥️' },
  { id: 'tabletas',       label: 'Tabletas',        icon: '📟' },
  { id: 'redes',          label: 'Redes',           icon: '📡' },
  { id: 'software',       label: 'Software',        icon: '💿' },
  { id: 'perifericos',    label: 'Periféricos',     icon: '🖱️' },
];

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(c => `
    <button class="cat-pill ${state.category === c.id ? 'active' : ''}"
      data-cat="${c.id}" aria-pressed="${state.category === c.id}">
      <span class="cat-icon">${c.icon}</span>
      ${c.label}
    </button>
  `).join('');

  container.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      state.category = pill.dataset.cat;
      renderCategoryPills();
      renderDropdownCategories();
      renderProducts();

      // Scroll automático al catálogo de productos con offset para Navbar y Categorías Sticky
      const catalogSection = document.getElementById('catalogo') ||
                             document.getElementById('products-grid');
      if (catalogSection) {
        const offset = 116; // navbar (64px) + categories-bar (52px)
        const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

function renderDropdownCategories() {
  const container = document.getElementById('logo-dropdown-categories');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(c => `
    <button type="button" class="logo-dropdown-cat-item ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">
      <span class="dropdown-cat-icon">${c.icon}</span>
      <span class="dropdown-cat-label">${c.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.logo-dropdown-cat-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.category = btn.dataset.cat;
      renderCategoryPills();
      renderDropdownCategories();
      renderProducts();

      // Cerrar menú desplegable
      const logoDropdown = document.getElementById('logo-dropdown');
      const logoWrap = document.getElementById('nav-logo-wrap');
      const logoBtn = document.getElementById('nav-logo-btn');
      if (logoDropdown) logoDropdown.classList.remove('active');
      if (logoWrap) logoWrap.classList.remove('active');
      if (logoBtn) logoBtn.setAttribute('aria-expanded', 'false');

      scrollToCatalog();
    });
  });
}

// ═════════════════════════════════════════════════════════════
// MÓDULO DE COTIZACIÓN Y EXPORTACIÓN DE PROFORMA PDF
// ═════════════════════════════════════════════════════════════

function saveQuotation() {
  storageSet(QUOTATION_STORAGE_KEY, JSON.stringify(quotation));
  updateQuotationUI();
}

function addToQuotation(productId) {
  const p = PRODUCTS.find(x => String(x.id) === String(productId));
  if (!p) return;

  const existing = quotation.find(item => String(item.id) === String(productId));
  if (existing) {
    existing.qty += 1;
  } else {
    quotation.push({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      image: p.image,
      category: p.category,
      qty: 1
    });
  }
  saveQuotation();
}

function updateQuotationQty(productId, delta) {
  const item = quotation.find(x => String(x.id) === String(productId));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    quotation = quotation.filter(x => String(x.id) !== String(productId));
  }
  saveQuotation();
}

function removeFromQuotation(productId) {
  quotation = quotation.filter(x => String(x.id) !== String(productId));
  saveQuotation();
}

function clearQuotation() {
  if (quotation.length === 0) return;
  if (!window.confirm('¿Vaciar la cotización completa?')) return;
  quotation = [];
  saveQuotation();
}

function getQuotationTotals() {
  const total = quotation.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const subtotal = total / 1.18; // Base Imponible (Op. Gravada)
  const igv = total - subtotal;   // IGV (18%)
  return { total, subtotal, igv };
}

function updateQuotationUI() {
  const count = quotation.reduce((acc, item) => acc + item.qty, 0);
  
  const badgeNav = document.getElementById('quote-badge-count');
  if (badgeNav) badgeNav.textContent = count;
  const badgeFab = document.getElementById('quote-fab-count');
  if (badgeFab) badgeFab.textContent = count;

  const bodyEl = document.getElementById('quote-drawer-body');
  if (!bodyEl) return;

  if (quotation.length === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:3rem;margin-bottom:12px;">📋</div>
        <p style="font-weight:700;font-size:1rem;margin-bottom:4px;color:var(--text-primary);">Tu cotización está vacía</p>
        <p style="font-size:0.85rem;">Explora el catálogo y añade productos para generar tu Proforma PDF.</p>
      </div>`;
  } else {
    bodyEl.innerHTML = quotation.map(item => {
      const id = escapeAttr(item.id);
      const name = escapeHTML(item.name);
      const image = escapeAttr(sanitizeUrl(item.image, 'image/1000.jpg'));
      return `
      <div class="quote-item-card">
        <img src="${image}" alt="${name}" class="quote-item-img" loading="lazy" decoding="async" onerror="this.src='image/1000.jpg'" />
        <div class="quote-item-info">
          <div class="quote-item-title">${name}</div>
          <div class="quote-item-price">S/ ${Number(item.price).toFixed(2)} c/u</div>
          <div class="quote-item-qty">
            <button class="qty-btn" data-action="qty-dec" data-id="${id}">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" data-action="qty-inc" data-id="${id}">+</button>
            <span style="margin-left:auto;font-weight:800;font-size:0.88rem;">S/ ${(Number(item.price) * Number(item.qty)).toFixed(2)}</span>
          </div>
        </div>
        <button class="quote-item-remove" data-action="remove" data-id="${id}" title="Eliminar">&times;</button>
      </div>`;
    }).join('');
    bodyEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'qty-inc') updateQuotationQty(id, 1);
        else if (btn.dataset.action === 'qty-dec') updateQuotationQty(id, -1);
        else if (btn.dataset.action === 'remove') removeFromQuotation(id);
      });
    });
  }

  const { total, subtotal, igv } = getQuotationTotals();
  const subtotalEl = document.getElementById('quote-subtotal');
  const igvEl = document.getElementById('quote-igv');
  const totalEl = document.getElementById('quote-total');

  if (subtotalEl) subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
  if (igvEl) igvEl.textContent = `S/ ${igv.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

function openQuotationDrawer() {
  document.getElementById('quote-drawer')?.classList.add('active');
  document.getElementById('quote-drawer-overlay')?.classList.add('active');
}

function closeQuotationDrawer() {
  document.getElementById('quote-drawer')?.classList.remove('active');
  document.getElementById('quote-drawer-overlay')?.classList.remove('active');
}

/**
 * Carga y comprime asíncronamente una imagen para su uso exclusivo en el PDF.
 * Reduce las dimensiones a un máximo razonable (300px) y genera un Data URL JPEG comprimido (calidad 0.75).
 * Cuenta con un timeout estricto de 1.5s y manejo de errores (fallback) para garantizar que NUNCA bloquee la cotización.
 */
function prepareOptimizedProductImage(src, maxDim = 300, quality = 0.75, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!src || typeof src !== 'string') {
      resolve(null);
      return;
    }

    let timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    const img = new Image();
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.naturalWidth || img.width || maxDim;
        let height = img.naturalHeight || img.height || maxDim;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (err) {
        console.warn('⚠️ Error al procesar imagen para PDF en canvas:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      if (!src.startsWith('http') && !src.startsWith('image/')) {
        const altSrc = `image/${src}`;
        const altImg = new Image();
        let altTimer = setTimeout(() => resolve(null), 1000);
        altImg.onload = () => {
          clearTimeout(altTimer);
          try {
            let width = altImg.naturalWidth || maxDim;
            let height = altImg.naturalHeight || maxDim;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round(height * (maxDim / width));
                width = maxDim;
              } else {
                width = Math.round(width * (maxDim / height));
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(altImg, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch {
            resolve(null);
          }
        };
        altImg.onerror = () => {
          clearTimeout(altTimer);
          resolve(null);
        };
        altImg.src = altSrc;
      } else {
        resolve(null);
      }
    };

    img.src = src;
  });
}

/**
 * Generación de Proforma PDF Empresarial vía html2pdf.js
 * Optimizado: ultrarrápido, comprimido en memoria sin modificar imágenes del servidor,
 * y con las imágenes ubicadas AL FINAL de toda la cotización (después del total neto).
 */
async function generateProformaPDF() {
  if (quotation.length === 0) {
    alert('Añade al menos un producto a la cotización antes de generar la Cotización en PDF.');
    return;
  }

  // Cargar html2pdf.js bajo demanda (solo al generar PDF)
  if (typeof html2pdf === 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar html2pdf.js'));
        document.head.appendChild(s);
      });
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar la librería de PDF. Intenta nuevamente.');
      return;
    }
  }

  const btnPdf = document.getElementById('btn-download-pdf');
  const originalBtnText = btnPdf ? btnPdf.innerHTML : '';
  if (btnPdf) {
    btnPdf.disabled = true;
    btnPdf.innerHTML = `⏳ Generando cotización...`;
  }

  // Permitir que el navegador repinte la UI para mostrar el estado "Generando cotización..."
  await new Promise(resolve => setTimeout(resolve, 60));

  const pdfContainer = document.getElementById('proforma-pdf-container');

  try {
    const clientNameRaw = (document.getElementById('quote-client-name')?.value.trim()) || 'Cliente Solicitante';
    const clientCompanyRaw = (document.getElementById('quote-client-company')?.value.trim()) || '';
    const clientRucRaw = (document.getElementById('quote-client-ruc')?.value.trim()) || '';
    const clientAddressRaw = (document.getElementById('quote-client-address')?.value.trim()) || '';

    const clientName = escapeHTML(clientNameRaw.slice(0, 120));
    const clientCompany = escapeHTML(clientCompanyRaw.slice(0, 200));
    const clientRuc = escapeHTML(clientRucRaw.slice(0, 20));
    const clientAddress = escapeHTML(clientAddressRaw.slice(0, 200));

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const seqNumber = String(nextQuoteNumber()).padStart(4, '0');
    const codeDoc = `COT-${year}${month}${day}-${seqNumber}`;
    
    const optionsDate = { day: '2-digit', month: 'long', year: 'numeric' };
    const fechaEmision = today.toLocaleDateString('es-PE', optionsDate);

    const { total, subtotal, igv } = getQuotationTotals();

    if (!pdfContainer) {
      throw new Error('Contenedor PDF no encontrado en el DOM');
    }

    // Verificar si el usuario desea incluir imágenes de productos
    const chkIncludeImages = document.getElementById('chk-include-images');
    const includeImages = chkIncludeImages ? chkIncludeImages.checked : true;

    // Pre-cargar y comprimir imágenes si la opción está activada
    let preparedImages = [];
    if (includeImages) {
      preparedImages = await Promise.all(
        quotation.map(item => prepareOptimizedProductImage(item.image))
      );
    }

    // Generar únicamente filas de texto claras sin imágenes en la celda
    const tableRowsHTML = quotation.map((item) => {
      const p = PRODUCTS.find(x => String(x.id) === String(item.id)) || {};
      const specsList = Object.entries(p.specs || {}).map(([k, v]) => `${escapeHTML(k)}: ${escapeHTML(v)}`).join(' · ');
      const itemName = escapeHTML(item.name);
      const itemId = escapeHTML(item.id);
      const itemBrand = escapeHTML(item.brand);
      const itemDesc = escapeHTML(p.description || '');

      return `
        <tr>
          <td style="text-align:center;font-weight:bold;vertical-align:top;padding-top:10px;">${Number(item.qty)}</td>
          <td style="vertical-align:top;">
            <strong style="font-size:11.5px;color:#1e3a8a;">${itemName}</strong>
            <span style="display:inline-block;background:#e2e8f0;color:#334155;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:6px;">ID: ${itemId}</span>
            ${item.brand ? `<br><small style="color:#475569;font-weight:600;">Marca: ${itemBrand}</small>` : ''}
            ${specsList ? `<br><small style="color:#64748b;font-style:italic;">Especificaciones: ${specsList}</small>` : ''}
            ${p.description ? `<br><small style="color:#64748b;display:block;margin-top:4px;line-height:1.3;">${itemDesc}</small>` : ''}
          </td>
          <td style="text-align:right;vertical-align:top;padding-top:10px;white-space:nowrap;">S/ ${Number(item.price).toFixed(2)}</td>
          <td style="text-align:right;font-weight:bold;vertical-align:top;padding-top:10px;white-space:nowrap;">S/ ${(Number(item.price) * Number(item.qty)).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    // La imagen DEBE SER SOLAMENTE LA IMAGEN, ubicada DESPUÉS del bloque del total final
    let galleryHTML = '';
    if (includeImages) {
      const itemsWithImages = quotation
        .map((item, idx) => ({ item, dataUrl: preparedImages[idx] }))
        .filter(entry => entry.dataUrl !== null);

      if (itemsWithImages.length > 0) {
        const cardsHTML = itemsWithImages.map(({ dataUrl }) => `
          <div class="pdf-standalone-image-card" style="page-break-inside:avoid!important;break-inside:avoid!important;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:center;height:180px;box-sizing:border-box;">
            <img src="${escapeAttr(dataUrl)}" alt="Imagen de producto cotizado" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto;" />
          </div>
        `).join('');

        galleryHTML = `
          <div class="pdf-gallery-section" style="margin-top:24px;padding-top:16px;border-top:2px solid #1e3a8a;page-break-inside:avoid!important;break-inside:avoid!important;">
            <div style="font-size:11px;font-weight:800;color:#1e3a8a;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;text-anchor:middle;text-align:center;">
              📷 IMÁGENES REFERENCIALES DE COTIZACIÓN
            </div>
            <div class="pdf-gallery-grid" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
              ${cardsHTML}
            </div>
          </div>
        `;
      }
    }

    pdfContainer.innerHTML = `
      <div class="proforma-pdf-page" id="proforma-pdf-content">
        <!-- Encabezado Corporativo Limpio -->
        <div class="pdf-header">
          <div class="pdf-company-info">
            <h1 style="color:#1e3a8a;font-size:22px;margin:0 0 6px 0;font-weight:800;">Elijo Tecnología</h1>
            <p style="margin:2px 0;font-size:11px;color:#334155;"><strong>Teléfono / WhatsApp:</strong> +51 918 394 348</p>
            <p style="margin:2px 0;font-size:11px;color:#334155;"><strong>Email:</strong> elijotecnologia@gmail.com</p>
            <p style="margin:2px 0;font-size:11px;color:#334155;"><strong>Web:</strong> www.elijotecnologia.com</p>
          </div>
          <div class="pdf-doc-box">
            <h2 style="font-size:18px;font-weight:800;color:#1e3a8a;margin:0 0 4px 0;">COTIZACIÓN</h2>
            <p class="pdf-doc-code" style="font-size:13px;font-weight:800;color:#1e3a8a;margin:2px 0;">N° ${codeDoc}</p>
            <p style="font-size:11px;margin:2px 0;color:#334155;"><strong>Fecha:</strong> ${fechaEmision}</p>
          </div>
        </div>

        <!-- Cliente y Condiciones -->
        <div class="pdf-client-section">
          <div class="pdf-client-col">
            <p><strong>ATENCIÓN / CLIENTE:</strong> ${clientName}</p>
            ${clientCompany ? `<p><strong>RAZÓN SOCIAL:</strong> ${clientCompany}</p>` : ''}
            ${clientRuc ? `<p><strong>RUC:</strong> ${clientRuc}</p>` : ''}
            ${clientAddress ? `<p><strong>DIRECCIÓN:</strong> ${clientAddress}</p>` : ''}
            <p><strong>FECHA EMISIÓN:</strong> ${fechaEmision}</p>
          </div>
          <div class="pdf-client-col">
            <p><strong>MONEDA:</strong> Soles (S/)</p>
            <p><strong>VALIDEZ DE OFERTA:</strong> ${QUOTE_VALIDITY_DAYS} Días Hábiles</p>
          </div>
        </div>

        <!-- Tabla de Items -->
        <table class="pdf-table">
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">CANT.</th>
              <th style="width: 56%;">PRODUCTO Y ESPECIFICACIONES</th>
              <th style="width: 18%; text-align: right;">P. UNIT. (S/)</th>
              <th style="width: 18%; text-align: right;">SUBTOTAL (S/)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>

        <!-- Resumen de Totales y Notas Comerciales -->
        <div class="pdf-footer-section">
          <table class="pdf-totals-table">
            <tr>
              <td class="tot-lbl">Subtotal:</td>
              <td class="tot-val">S/ ${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="tot-lbl">IGV (18%):</td>
              <td class="tot-val">S/ ${igv.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td class="tot-lbl-main">TOTAL FINAL:</td>
              <td class="tot-val-main">S/ ${total.toFixed(2)}</td>
            </tr>
          </table>

          <div class="pdf-footer-note">
            <p class="note-main">📌 Cotización válida por ${QUOTE_VALIDITY_DAYS} días hábiles. Precios incluyen IGV.</p>
            <p class="note-sub">Gracias por confiar en Elijo Tecnología. No venimos a venderte, venimos a ayudarte a elegir.</p>
          </div>
        </div>

        <!-- IMÁGENES AL FINAL (SOLAMENTE LA IMAGEN, POSTERIOR AL TOTAL FINAL) -->
        ${galleryHTML}
      </div>
    `;

    pdfContainer.style.display = 'block';
    const element = document.getElementById('proforma-pdf-content');

    const opt = {
      margin:       0,
      filename:     `Cotizacion_ElijoTecnologia_${codeDoc}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        scrollX: 0,
        scrollY: 0,
        letterRendering: true
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (typeof html2pdf !== 'undefined') {
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opt.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(() => alert('PDF generado correctamente'), 150);
    } else {
      alert('La librería de PDF se encuentra cargando. Intenta nuevamente.');
    }
  } catch (err) {
    console.error('Error al generar PDF:', err);
    alert('No se pudo generar la cotización. Intenta nuevamente.');
  } finally {
    if (pdfContainer) pdfContainer.style.display = 'none';
    if (btnPdf) {
      btnPdf.disabled = false;
      btnPdf.innerHTML = originalBtnText;
    }
  }
}

/**
 * Genera un catalogo PDF de todos los productos (agrupado por categoria),
 * con identidad visual de Elijo Tecnologia y datos de contacto.
 */
async function generateCatalogPDF() {
  if (typeof PRODUCTS === 'undefined' || PRODUCTS.length === 0) {
    alert('No hay productos cargados para generar el catálogo.');
    return;
  }

  // Cargar html2pdf bajo demanda
  if (typeof html2pdf === 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        sc.onload = resolve;
        sc.onerror = () => reject(new Error('No se pudo cargar html2pdf.js'));
        document.head.appendChild(sc);
      });
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar la librería de PDF.');
      return;
    }
  }

  // Agrupar por categoria
  const byCat = {};
  for (const p of PRODUCTS) {
    const c = p.category || 'otros';
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(p);
  }
  const catOrder = ['laptops', 'celulares', 'componentes', 'monitores', 'impresoras', 'perifericos', 'almacenamiento', 'tabletas', 'redes', 'software'];
  const cats = [...new Set([...catOrder.filter(c => byCat[c]), ...Object.keys(byCat).filter(c => !catOrder.includes(c))])];

  const catNames = {
    laptops: 'Laptops', celulares: 'Celulares', componentes: 'Componentes',
    monitores: 'Monitores', impresoras: 'Impresoras', perifericos: 'Periféricos',
    almacenamiento: 'Almacenamiento', tabletas: 'Tabletas', redes: 'Redes',
    software: 'Software', otros: 'Otros',
  };

  let bodyHTML = '';
  for (const cat of cats) {
    const prods = (byCat[cat] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    if (prods.length === 0) continue;
    bodyHTML += `
      <h2 style="color:#1e3a8a;font-size:12px;margin:12px 0 6px;border-bottom:2px solid #1e3a8a;padding-bottom:3px;page-break-after:avoid;">
        ${escapeHTML(catNames[cat] || cat)} (${prods.length})
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:10px;page-break-inside:auto;">
        <thead>
          <tr style="background:#1e3a8a;color:#fff;">
            <th style="padding:4px 6px;text-align:left;width:12%;">SKU</th>
            <th style="padding:4px 6px;text-align:left;width:58%;">Producto</th>
            <th style="padding:4px 6px;text-align:left;width:15%;">Marca</th>
            <th style="padding:4px 6px;text-align:right;width:15%;">Precio (S/)</th>
          </tr>
        </thead>
        <tbody>
          ${prods.map((p, i) => `
            <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'};">
              <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;">${escapeHTML(p.id)}</td>
              <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;">${escapeHTML(p.name)}</td>
              <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;">${escapeHTML(p.brand)}</td>
              <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${formatPrice(p.price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const container = document.getElementById('proforma-pdf-container');
  if (!container) { alert('Contenedor PDF no encontrado.'); return; }
  container.style.display = 'block';
  container.style.opacity = '1';

  container.innerHTML = `
    <div id="catalog-pdf-content" style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;width:210mm;padding:10mm;box-sizing:border-box;">
      <div style="text-align:center;padding:10px 0 12px;border-bottom:3px solid #1e3a8a;margin-bottom:12px;">
        <img src="image/logo-elijo.png" alt="Elijo Tecnologia" style="max-width:180px;height:auto;margin-bottom:6px;" />
        <h1 style="color:#1e3a8a;font-size:20px;margin:0 0 2px;font-weight:800;">Elijo Tecnología</h1>
        <p style="margin:0;font-size:10px;color:#334155;font-weight:600;">LISTA DE PRODUCTOS</p>
        <p style="margin:4px 0 0;font-size:9px;color:#334155;">Tel: +51 918 394 348 · Email: elijotecnologia@gmail.com · Web: elijotecnologia.com</p>
        <p style="margin:2px 0 0;font-size:8px;color:#64748b;">Generado el ${new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })} · ${PRODUCTS.length} productos · Precios en Soles (S/), incluyen IGV</p>
      </div>
      ${bodyHTML}
      <div style="margin-top:12px;padding-top:8px;border-top:2px solid #1e3a8a;font-size:8px;color:#64748b;text-align:center;">
        <p>Precios sujetos a variación sin previo aviso. Elijo Tecnología — Elige con inteligencia.</p>
      </div>
    </div>
  `;

  // Esperar a que las imagenes carguen
  const imgs = container.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img => new Promise(resolve => {
    if (img.complete) resolve();
    else { img.onload = resolve; img.onerror = resolve; }
  })));

  const element = document.getElementById('catalog-pdf-content');
  const opt = {
    margin: 0,
    filename: `Catalogo_ElijoTecnologia_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: 'jpeg', quality: 0.9 },
    html2canvas: { scale: 1.2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opt.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error al generar catálogo PDF:', err);
    alert('No se pudo generar el catálogo. Intenta nuevamente.');
  } finally {
    container.style.display = 'none';
    container.style.opacity = '';
  }
}

function scrollToCatalog() {
  const catalogSection = document.getElementById('catalogo') || document.getElementById('products-grid');
  if (catalogSection) {
    const headerEl = document.querySelector('header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 60;
    const offset = headerHeight + 12;
    const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ═════════════════════════════════════════════════════════════
// INICIALIZACIÓN Y EVENT LISTENERS
// ═════════════════════════════════════════════════════════════
function init() {
  // Buscador: ejecuta la búsqueda y el scroll únicamente al presionar Enter o pulsar la Lupa
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  const doSearch = (scroll = true) => {
    state.search = searchInput ? searchInput.value.trim() : '';
    renderProducts();
    if (scroll) {
      scrollToCatalog();
    }
  };

  if (searchInput) {
    // Si el usuario borra completamente la búsqueda, se actualiza la lista en silencio sin scroll
    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim() === '' && state.search !== '') {
        state.search = '';
        renderProducts();
      }
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch(true);
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doSearch(true);
    });
  }

  // Ordenar
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.sort = e.target.value;
      renderProducts();
    });
  }



  // Filtro de Precio
  const applyPrice = () => {
    const min = parseFloat(document.getElementById('price-min').value) || 0;
    const max = parseFloat(document.getElementById('price-max').value) || Infinity;
    state.priceMin = min;
    state.priceMax = max;
    renderProducts();
  };

  const priceMinInput = document.getElementById('price-min');
  const priceMaxInput = document.getElementById('price-max');
  if (priceMinInput) priceMinInput.addEventListener('change', applyPrice);
  if (priceMaxInput) priceMaxInput.addEventListener('change', applyPrice);

  // Filtro de condición (Nuevo / Reacondicionado)
  document.querySelectorAll('#condition-filters input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.conditions.add(cb.value);
      else state.conditions.delete(cb.value);
      renderProducts();
    });
  });

  // Filtro de descuento mínimo
  const discountSelect = document.getElementById('discount-min-select');
  if (discountSelect) {
    discountSelect.addEventListener('change', () => {
      state.minDiscount = parseInt(discountSelect.value, 10) || 0;
      renderProducts();
    });
  }

  // Limpiar Filtros
  const clearFiltersBtn = document.getElementById('btn-clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.search = '';
      state.category = 'all';
      state.brands = new Set();
      state.conditions = new Set();
      state.minDiscount = 0;
      state.priceMin = 0;
      state.priceMax = Infinity;
      if (searchInput) searchInput.value = '';
      const discountSelect = document.getElementById('discount-min-select');
      if (discountSelect) discountSelect.value = '0';
      document.querySelectorAll('#condition-filters input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      if (sortSelect) sortSelect.value = 'variety';
      state.sort = 'variety';
      renderCategoryPills();
      renderBrandFilters();
      renderProducts();
    });
  }

  // Modal Overlay
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Drawer Lateral Filtros Móvil
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const filterFab = document.getElementById('filter-fab');

  const openSidebarDrawer = () => {
    if (!sidebar || !sidebarOverlay) return;
    sidebar.classList.add('drawer-open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  if (filterFab && sidebar && sidebarOverlay) {
    filterFab.addEventListener('click', openSidebarDrawer);
  }
  const navMenuToggle = document.getElementById('nav-menu-toggle');
  if (navMenuToggle && sidebar && sidebarOverlay) {
    navMenuToggle.addEventListener('click', openSidebarDrawer);
  }

  const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('drawer-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);

  // Cotización Drawer Events
  document.getElementById('nav-quote-btn')?.addEventListener('click', openQuotationDrawer);
  document.getElementById('quote-fab')?.addEventListener('click', openQuotationDrawer);
  document.getElementById('quote-drawer-close')?.addEventListener('click', closeQuotationDrawer);
  document.getElementById('quote-drawer-overlay')?.addEventListener('click', closeQuotationDrawer);
  document.getElementById('btn-clear-quote')?.addEventListener('click', clearQuotation);
  document.getElementById('btn-download-pdf')?.addEventListener('click', generateProformaPDF);
  document.getElementById('btn-catalog-pdf')?.addEventListener('click', (e) => { e.preventDefault(); generateCatalogPDF(); });

  // Persistir datos del cliente del cotizador
  ['quote-client-name', 'quote-client-company', 'quote-client-ruc', 'quote-client-address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', saveQuoteClient);
  });

  // Logo interactivo dropdown
  const logoWrap = document.getElementById('nav-logo-wrap');
  const logoBtn = document.getElementById('nav-logo-btn');
  const logoDropdown = document.getElementById('logo-dropdown');

  if (logoBtn && logoDropdown) {
    const toggleLogoDropdown = (show) => {
      const active = show !== undefined ? show : !logoDropdown.classList.contains('active');
      logoDropdown.classList.toggle('active', active);
      if (logoWrap) logoWrap.classList.toggle('active', active);
      logoBtn.setAttribute('aria-expanded', active);
    };

    logoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLogoDropdown();
    });

    document.addEventListener('click', (e) => {
      if (logoWrap && !logoWrap.contains(e.target)) {
        toggleLogoDropdown(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleLogoDropdown(false);
    });

    document.getElementById('logo-menu-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      state.search = '';
      state.category = 'all';
      state.brands = new Set();
      state.conditions = new Set();
      state.minDiscount = 0;
      state.priceMin = 0;
      state.priceMax = Infinity;
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      renderCategoryPills();
      renderBrandFilters();
      renderProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('logo-menu-offers')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      const offersSection = document.getElementById('offers-section');
      if (offersSection) {
        offersSection.style.display = 'block';
        offersSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    document.getElementById('logo-menu-quote')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      openQuotationDrawer();
    });

    document.getElementById('logo-menu-catalog-pdf')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      generateCatalogPDF();
    });
  }

  // Manejadores de eventos para el Footer (Categorías, Marcas e Información)
  document.querySelectorAll('[data-footer-cat]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = link.dataset.footerCat;
      if (cat) {
        state.category = cat;
        renderCategoryPills();
        renderDropdownCategories();
        renderProducts();
        scrollToCatalog();
      }
    });
  });

  document.querySelectorAll('[data-footer-brand]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const brand = link.dataset.footerBrand;
      if (brand) {
        state.brands = new Set([brand]);
        renderBrandFilters();
        renderProducts();
        scrollToCatalog();
      }
    });
  });

  document.querySelectorAll('[data-footer-info]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const topic = link.dataset.footerInfo || 'Información';
      // Muestra un mensaje amigable en lugar de saltar agresivamente al top
      const notification = document.createElement('div');
      notification.className = 'info-toast';
      notification.innerHTML = `<span>ℹ️ <strong>${escapeHTML(topic)}</strong>: Sección en desarrollo. Próximamente incluirá información detallada.</span>`;
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add('active'), 10);
      setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
      }, 3500);
    });
  });

  // Inicializar Sistema de Banners Publicitarios
  initBannerSystem();

  // Cargar datos del cliente del cotizador (persistidos)
  const qClient = loadQuoteClient();
  const nameEl = document.getElementById('quote-client-name');
  const companyEl = document.getElementById('quote-client-company');
  const rucEl = document.getElementById('quote-client-ruc');
  const addrEl = document.getElementById('quote-client-address');
  if (nameEl && qClient.name) nameEl.value = qClient.name;
  if (companyEl && qClient.company) companyEl.value = qClient.company;
  if (rucEl && qClient.ruc) rucEl.value = qClient.ruc;
  if (addrEl && qClient.address) addrEl.value = qClient.address;

  // Cargar productos
  loadProducts();
}

// ─── Sistema de Efectos de Scroll Tipo Apple (IntersectionObserver) ───────
let scrollRevealObserver = null;

function observeScrollReveal() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.product-card').forEach(card => card.classList.add('reveal-visible'));
    return;
  }

  if (!scrollRevealObserver) {
    scrollRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          scrollRevealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }

  document.querySelectorAll('.product-card:not(.reveal-visible)').forEach(card => {
    scrollRevealObserver.observe(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBrandIntro();
  window.addEventListener('hashchange', handleProductHash);
  init();
});

// ─── [Partículas flotantes eliminadas — Tarea 2] ─────────────────────────────
// La animación de iconos flotantes y el canvas fueron eliminados por solicitud.


// ─── Buscador Hero Sincronizado ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const mainSearchInput = document.getElementById('search-input');
  const heroSearchInput = document.getElementById('hero-search-input');
  const heroSearchBtn = document.getElementById('hero-search-btn');

  if (mainSearchInput && heroSearchInput) {
    // Sincronizar texto en silencio sin disparar búsquedas impulsivas
    heroSearchInput.addEventListener('input', (e) => {
      mainSearchInput.value = e.target.value;
      if (e.target.value.trim() === '' && state.search !== '') {
        state.search = '';
        renderProducts();
      }
    });

    const runHeroSearch = () => {
      const query = heroSearchInput.value.trim();
      mainSearchInput.value = query;
      state.search = query;
      renderProducts();
      scrollToCatalog();
    };

    heroSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runHeroSearch();
      }
    });

    if (heroSearchBtn) {
      heroSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        runHeroSearch();
      });
    }

    mainSearchInput.addEventListener('input', (e) => {
      heroSearchInput.value = e.target.value;
    });
  }
});

// ─── Botones de Categoría del Hero — conectados al sistema de filtros real ───
document.addEventListener('DOMContentLoaded', () => {
  const heroCatRow = document.getElementById('hero-cat-row');
  if (!heroCatRow) return;

  heroCatRow.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hero-cat]');
    if (!btn) return;
    const cat = btn.dataset.heroCat;
    if (typeof state !== 'undefined') {
      state.category = cat;
      if (typeof renderCategoryPills === 'function') renderCategoryPills();
      if (typeof renderDropdownCategories === 'function') renderDropdownCategories();
      if (typeof renderProducts === 'function') renderProducts();
      if (typeof scrollToCatalog === 'function') {
        scrollToCatalog();
      } else {
        const catalogSection = document.getElementById('catalogo') || document.getElementById('products-grid');
        if (catalogSection) {
          const offset = 116;
          const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }
    }
  });
});
