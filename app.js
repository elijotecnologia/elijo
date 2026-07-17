/* ============================================================
   ELIJO TECNOLOGÍA — Catalog Application
   Google Sheets Integration + Search + Filter + Modal + WhatsApp
   ============================================================ */

'use strict';

// ─── WhatsApp (from config) ────────────────────────────────────
const WHATSAPP_NUMBER = (typeof SHEETS_CONFIG !== 'undefined')
  ? SHEETS_CONFIG.WHATSAPP_NUMBER
  : '51999999999';

// ─── Demo Products (fallback si Google Sheets no está configurado) ──
const DEMO_PRODUCTS = [
  {
    id: 1,
    name: 'Laptop Lenovo IdeaPad 5 15.6" FHD',
    brand: 'Lenovo',
    category: 'laptops',
    price: 2899,
    oldPrice: 3299,
    badge: 'sale',
    image: 'images/laptop.jpg',
    description: 'Portátil de alto rendimiento con procesador Intel Core i5 de 12ª generación, ideal para trabajo, estudio y entretenimiento.',
    specs: { 'Procesador': 'Intel Core i5-1235U', 'Memoria RAM': '8 GB DDR4', 'Almacenamiento': 'SSD 512 GB NVMe', 'Pantalla': '15.6" FHD IPS', 'Sistema Operativo': 'Windows 11 Home', 'Batería': 'Hasta 10 horas' },
    tags: ['Intel Core i5', 'SSD 512GB', 'Win 11'],
    featured: true,
  },
  {
    id: 2,
    name: 'Laptop HP Pavilion 14" AMD Ryzen 5',
    brand: 'HP',
    category: 'laptops',
    price: 2499,
    oldPrice: null,
    badge: 'new',
    image: 'images/laptop.jpg',
    description: 'Diseño delgado y ligero con potente procesador AMD Ryzen 5, perfecta para estudiantes y profesionales.',
    specs: { 'Procesador': 'AMD Ryzen 5 5500U', 'Memoria RAM': '8 GB DDR4', 'Almacenamiento': 'SSD 256 GB', 'Pantalla': '14" FHD', 'Sistema Operativo': 'Windows 11 Home', 'Peso': '1.5 kg' },
    tags: ['Ryzen 5', 'Ligera', '14"'],
    featured: false,
  },
  {
    id: 3,
    name: 'Laptop ASUS ROG Strix G15 Gaming',
    brand: 'ASUS',
    category: 'laptops',
    price: 5499,
    oldPrice: 5999,
    badge: 'hot',
    image: 'images/laptop.jpg',
    description: 'Laptop gaming de alto rendimiento con pantalla de 144Hz, GPU dedicada NVIDIA RTX 3060.',
    specs: { 'Procesador': 'AMD Ryzen 7 5800H', 'Memoria RAM': '16 GB DDR4', 'Almacenamiento': 'SSD 512 GB NVMe', 'GPU': 'NVIDIA RTX 3060 6GB', 'Pantalla': '15.6" FHD 144Hz', 'Sistema Operativo': 'Windows 11 Home' },
    tags: ['RTX 3060', '144Hz', 'Gaming'],
    featured: true,
  },
  {
    id: 4,
    name: 'PC Gamer Ryzen 7 + RTX 3080 RGB',
    brand: 'Armado',
    category: 'pcs',
    price: 7999,
    oldPrice: 8499,
    badge: 'hot',
    image: 'images/desktop.jpg',
    description: 'PC Gaming de alto rendimiento ensamblada con refrigeración líquida e iluminación RGB.',
    specs: { 'Procesador': 'AMD Ryzen 7 5800X', 'Memoria RAM': '32 GB DDR4 3200MHz', 'Almacenamiento': 'SSD 1TB NVMe + HDD 2TB', 'GPU': 'NVIDIA RTX 3080 10GB', 'Fuente': '850W 80+ Gold', 'Gabinete': 'NZXT H510 Elite' },
    tags: ['RTX 3080', '32GB RAM', 'RGB'],
    featured: true,
  },
  {
    id: 5,
    name: 'PC Oficina Intel Core i5 + Monitor',
    brand: 'Armado',
    category: 'pcs',
    price: 2299,
    oldPrice: null,
    badge: 'stock',
    image: 'images/desktop.jpg',
    description: 'Equipo completo de escritorio para oficina, incluye monitor de 21.5", teclado y mouse.',
    specs: { 'Procesador': 'Intel Core i5-10400', 'Memoria RAM': '8 GB DDR4', 'Almacenamiento': 'SSD 240 GB + HDD 1TB', 'Monitor': '21.5" Full HD', 'Sistema Operativo': 'Windows 11 Pro', 'Incluye': 'Teclado + Mouse' },
    tags: ['Core i5', 'Con monitor', 'Completo'],
    featured: false,
  },
  {
    id: 6,
    name: 'Samsung Galaxy A54 5G 128GB',
    brand: 'Samsung',
    category: 'celulares',
    price: 1299,
    oldPrice: 1499,
    badge: 'sale',
    image: 'images/smartphone.jpg',
    description: 'Smartphone con triple cámara de 50MP, pantalla Super AMOLED de 6.4" y batería de 5000 mAh.',
    specs: { 'Pantalla': '6.4" Super AMOLED 120Hz', 'Procesador': 'Exynos 1380', 'RAM': '8 GB', 'Almacenamiento': '128 GB', 'Cámara principal': '50 MP OIS', 'Batería': '5000 mAh' },
    tags: ['5G', 'AMOLED', '50MP'],
    featured: true,
  },
  {
    id: 7,
    name: 'Xiaomi Redmi Note 12 Pro 256GB',
    brand: 'Xiaomi',
    category: 'celulares',
    price: 999,
    oldPrice: 1150,
    badge: 'sale',
    image: 'images/smartphone.jpg',
    description: 'Celular de gama media con cámara de 200MP y carga rápida de 67W.',
    specs: { 'Pantalla': '6.67" AMOLED 120Hz', 'Procesador': 'Snapdragon 732G', 'RAM': '8 GB', 'Almacenamiento': '256 GB', 'Cámara principal': '200 MP', 'Carga': '67W Turbo' },
    tags: ['200MP', '67W', '256GB'],
    featured: false,
  },
  {
    id: 8,
    name: 'Monitor Samsung Odyssey G5 34" Curvo',
    brand: 'Samsung',
    category: 'perifericos',
    price: 1799,
    oldPrice: 1999,
    badge: 'sale',
    image: 'images/monitor.jpg',
    description: 'Monitor curvo ultra-wide QHD de 34 pulgadas con tasa de refresco de 165Hz.',
    specs: { 'Panel': 'VA 34" Curvo 1000R', 'Resolución': '3440 × 1440 QHD', 'Tasa refresco': '165 Hz', 'Tiempo respuesta': '1 ms', 'HDR': 'HDR10', 'Conectividad': 'HDMI 2.0 × 2, DisplayPort 1.4' },
    tags: ['165Hz', 'Ultra-Wide', 'QHD'],
    featured: true,
  },
  {
    id: 9,
    name: 'Teclado + Mouse Gaming RGB HyperX',
    brand: 'HyperX',
    category: 'perifericos',
    price: 389,
    oldPrice: 449,
    badge: 'sale',
    image: 'images/keyboard.jpg',
    description: 'Combo gaming con teclado mecánico y mouse gaming de 16000 DPI con iluminación RGB.',
    specs: { 'Tipo teclado': 'Mecánico Full Size', 'Switches': 'HyperX Red (lineal)', 'Mouse DPI': 'Hasta 16000 DPI', 'Iluminación': 'RGB full programmable', 'Conexión': 'USB 2.0', 'Cable': '1.8 m braided' },
    tags: ['Mecánico', 'RGB', '16000 DPI'],
    featured: false,
  },
  {
    id: 10,
    name: 'Impresora HP DeskJet 2775 Multifunción',
    brand: 'HP',
    category: 'impresoras',
    price: 349,
    oldPrice: null,
    badge: 'new',
    image: 'images/printer.jpg',
    description: 'Impresora multifunción inalámbrica con función de impresión, escaneo y copia.',
    specs: { 'Tipo': 'Inyección de tinta', 'Función': 'Imprime, escanea, copia', 'Conectividad': 'WiFi + USB', 'Velocidad B/N': '7.5 ppm', 'Velocidad Color': '5.5 ppm', 'Resolución': '4800 × 1200 dpi' },
    tags: ['WiFi', 'Multifunción', 'HP+'],
    featured: false,
  },
  {
    id: 11,
    name: 'Impresora Epson EcoTank L3250 WiFi',
    brand: 'Epson',
    category: 'impresoras',
    price: 699,
    oldPrice: 799,
    badge: 'hot',
    image: 'images/printer.jpg',
    description: 'Impresora con tanques de tinta recargables de alta capacidad, sin cartuchos.',
    specs: { 'Tipo': 'EcoTank (tanques recargables)', 'Función': 'Imprime, escanea, copia', 'Conectividad': 'WiFi + USB', 'Rendimiento negro': '4500 páginas', 'Rendimiento color': '7500 páginas', 'Velocidad': '10 ppm B/N' },
    tags: ['EcoTank', 'Sin cartuchos', 'Económico'],
    featured: true,
  },
  {
    id: 12,
    name: 'Memoria RAM Corsair Vengeance 16GB DDR4',
    brand: 'Corsair',
    category: 'componentes',
    price: 229,
    oldPrice: 269,
    badge: 'sale',
    image: 'images/desktop.jpg',
    description: 'Módulo de memoria RAM DDR4 de alta velocidad con disipador de calor de aluminio.',
    specs: { 'Capacidad': '16 GB (2 × 8 GB)', 'Tipo': 'DDR4 DIMM', 'Velocidad': '3200 MHz', 'Latencia': 'CL16', 'Voltaje': '1.35V', 'Perfil XMP': 'XMP 2.0' },
    tags: ['DDR4', '3200MHz', '16GB'],
    featured: false,
  },
  {
    id: 13,
    name: 'SSD Kingston NV2 1TB NVMe M.2',
    brand: 'Kingston',
    category: 'componentes',
    price: 299,
    oldPrice: 349,
    badge: 'sale',
    image: 'images/desktop.jpg',
    description: 'Unidad de estado sólido NVMe M.2 de 1TB con velocidades de lectura de hasta 3500 MB/s.',
    specs: { 'Capacidad': '1 TB', 'Interfaz': 'PCIe 4.0 NVMe M.2', 'Lectura seq.': 'Hasta 3500 MB/s', 'Escritura seq.': 'Hasta 2100 MB/s', 'Factor de forma': 'M.2 2280', 'Garantía': '3 años' },
    tags: ['NVMe', '1TB', 'PCIe 4.0'],
    featured: false,
  },
  {
    id: 14,
    name: 'Tablet Samsung Galaxy Tab A8 10.5"',
    brand: 'Samsung',
    category: 'tablets',
    price: 899,
    oldPrice: 999,
    badge: 'sale',
    image: 'images/smartphone.jpg',
    description: 'Tablet con pantalla LCD de 10.5", ideal para entretenimiento, estudio y productividad.',
    specs: { 'Pantalla': '10.5" TFT LCD', 'Resolución': '1920 × 1200', 'Procesador': 'UNISOC T618', 'RAM': '4 GB', 'Almacenamiento': '64 GB', 'Batería': '7040 mAh' },
    tags: ['10.5"', 'Estudio', 'Multimedia'],
    featured: false,
  },
  {
    id: 15,
    name: 'Headset Logitech G435 Inalámbrico',
    brand: 'Logitech',
    category: 'accesorios',
    price: 349,
    oldPrice: 399,
    badge: 'new',
    image: 'images/keyboard.jpg',
    description: 'Auriculares gaming inalámbricos ultraligeros de solo 165g con 18 horas de batería.',
    specs: { 'Conectividad': 'LIGHTSPEED Wireless + BT', 'Batería': '18 horas', 'Peso': '165 g', 'Micrófono': 'Doble, beamforming', 'Frecuencia': '20 Hz – 20 kHz', 'Compatibilidad': 'PC, PS4, PS5, Móvil' },
    tags: ['Inalámbrico', '18h', 'Ligero'],
    featured: false,
  },
  {
    id: 16,
    name: 'Router TP-Link Archer AX73 WiFi 6',
    brand: 'TP-Link',
    category: 'redes',
    price: 449,
    oldPrice: 519,
    badge: 'new',
    image: 'images/desktop.jpg',
    description: 'Router WiFi 6 de doble banda con velocidades de hasta 5400Mbps y tecnología OFDMA.',
    specs: { 'Estándar': 'Wi-Fi 6 (802.11ax)', 'Velocidad': '5400 Mbps total', 'Bandas': 'Dual-band 2.4/5 GHz', 'Antenas': '6 × High-Gain', 'Puertos': '4 × Gigabit LAN, 1 WAN', 'Tecnología': 'OFDMA, MU-MIMO' },
    tags: ['WiFi 6', '5400Mbps', 'OFDMA'],
    featured: false,
  },
  {
    id: 17,
    name: 'Microsoft Office 2021 Home & Business',
    brand: 'Microsoft',
    category: 'software',
    price: 699,
    oldPrice: null,
    badge: 'stock',
    image: 'images/laptop.jpg',
    description: 'Licencia original de Microsoft Office 2021 con Word, Excel, PowerPoint y Outlook.',
    specs: { 'Aplicaciones': 'Word, Excel, PowerPoint, Outlook', 'Tipo': 'Licencia perpetua', 'PCs': '1 PC', 'Sistema': 'Windows 10/11', 'Versión': 'Office 2021', 'Entrega': 'Código digital inmediato' },
    tags: ['Office 2021', 'Original', '1 PC'],
    featured: false,
  },
  {
    id: 18,
    name: 'Cable HDMI 2.1 8K Belkin 3m',
    brand: 'Belkin',
    category: 'accesorios',
    price: 89,
    oldPrice: null,
    badge: null,
    image: 'images/keyboard.jpg',
    description: 'Cable HDMI 2.1 certificado con soporte para resolución 8K a 60Hz y 4K a 120Hz.',
    specs: { 'Versión': 'HDMI 2.1 certificado', 'Resolución máx.': '8K 60Hz / 4K 120Hz', 'Longitud': '3 metros', 'Ancho de banda': '48 Gbps', 'eARC': 'Sí', 'VRR': 'Compatible' },
    tags: ['HDMI 2.1', '8K', '4K 120Hz'],
    featured: false,
  },
];

// ─── Reactive products list (filled from Sheets or demo) ──────
let PRODUCTS = [];

// ─── State ───────────────────────────────────────────────────
let state = {
  search:   '',
  category: 'all',
  brands:   new Set(),
  priceMin: 0,
  priceMax: Infinity,
  sort:     'featured',
  loading:  true,
  source:   'demo',  // 'sheets' | 'demo'
  lastSync: null,
};

// ═══════════════════════════════════════════════════════════════
// GOOGLE SHEETS INTEGRATION
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a CSV row respecting quoted fields that may contain commas
 */
function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse specs string: "Clave1:Valor1|Clave2:Valor2" → { Clave1: 'Valor1', ... }
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
 * Parse tags string: "Tag1,Tag2,Tag3" → ['Tag1', 'Tag2', 'Tag3']
 */
function parseTags(tagsStr) {
  if (!tagsStr || tagsStr.trim() === '') return [];
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Convert a CSV row array to a product object
 * Columns: id | name | brand | category | price | oldPrice | badge |
 *          image | description | specs | tags | featured
 */
function rowToProduct(cells, index) {
  const [
    id, name, brand, category, price, oldPrice, badge,
    image, description, specs, tags, featured
  ] = cells;

  if (!name || !price) return null; // skip empty rows

  const parsedPrice = parseFloat(String(price).replace(/[^\d.]/g, ''));
  const parsedOldPrice = oldPrice && oldPrice.trim() !== ''
    ? parseFloat(String(oldPrice).replace(/[^\d.]/g, ''))
    : null;

  return {
    id: id ? parseInt(id) : (index + 1),
    name: name.trim(),
    brand: (brand || '').trim(),
    category: (category || '').trim().toLowerCase(),
    price: isNaN(parsedPrice) ? 0 : parsedPrice,
    oldPrice: parsedOldPrice && !isNaN(parsedOldPrice) ? parsedOldPrice : null,
    badge: badge && badge.trim() !== '' ? badge.trim().toLowerCase() : null,
    image: (image || '').trim() || 'images/laptop.jpg',
    description: (description || '').trim(),
    specs: parseSpecs(specs),
    tags: parseTags(tags),
    featured: String(featured).trim().toUpperCase() === 'TRUE',
  };
}

/**
 * Fetch and parse CSV from Google Sheets
 */
async function fetchFromGoogleSheets(csvUrl) {
  // Add cache-busting to always get fresh data
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

  // Skip header row (row 0), parse data rows
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = parseCSVRow(rows[i]);
    const product = rowToProduct(cells, i - 1);
    if (product) products.push(product);
  }

  if (products.length === 0) {
    throw new Error('No se encontraron productos válidos en la hoja');
  }

  return products;
}

/**
 * Load products: try Sheets first, fallback to demo
 */
async function loadProducts() {
  showLoadingState();

  const config = typeof SHEETS_CONFIG !== 'undefined' ? SHEETS_CONFIG : {};
  const csvUrl = config.SHEETS_CSV_URL || '';

  if (csvUrl && csvUrl.startsWith('http')) {
    try {
      updateSyncBanner('syncing');
      const products = await fetchFromGoogleSheets(csvUrl);
      PRODUCTS = products;
      state.source = 'sheets';
      state.lastSync = new Date();
      updateSyncBanner('success', products.length);
      console.log(`✅ Elijo Tech: ${products.length} productos cargados desde Google Sheets`);
    } catch (err) {
      console.warn('⚠️ Elijo Tech: Error al cargar Google Sheets:', err.message);
      if (config.FALLBACK_TO_DEMO !== false) {
        PRODUCTS = DEMO_PRODUCTS;
        state.source = 'demo';
        updateSyncBanner('error', 0, err.message);
      } else {
        PRODUCTS = [];
        updateSyncBanner('error', 0, err.message);
      }
    }
  } else {
    // No Sheets URL configured → use demo data
    PRODUCTS = DEMO_PRODUCTS;
    state.source = 'demo';
    updateSyncBanner('demo');
  }

  state.loading = false;
  renderCategoryPills();
  renderBrandFilters();
  renderProducts();

  // Setup auto-refresh
  const refreshMins = config.AUTO_REFRESH_MINUTES || 0;
  if (refreshMins > 0 && csvUrl) {
    setInterval(() => refreshProducts(csvUrl), refreshMins * 60 * 1000);
  }
}

/**
 * Silent refresh (no loading skeleton, just updates in background)
 */
async function refreshProducts(csvUrl) {
  try {
    const products = await fetchFromGoogleSheets(csvUrl);
    PRODUCTS = products;
    state.source = 'sheets';
    state.lastSync = new Date();
    updateSyncBanner('success', products.length);
    renderCategoryPills();
    renderBrandFilters();
    renderProducts();
    console.log(`🔄 Elijo Tech: Catálogo actualizado (${products.length} productos)`);
  } catch (err) {
    console.warn('⚠️ Elijo Tech: Error al actualizar:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC BANNER — shows Sheets status
// ═══════════════════════════════════════════════════════════════
function updateSyncBanner(status, count = 0, errorMsg = '') {
  const banner = document.getElementById('sheets-sync-banner');
  if (!banner) return;

  const icons = {
    syncing: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    demo:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const messages = {
    syncing: 'Sincronizando con Google Sheets…',
    success: `✓ ${count} productos sincronizados desde Google Sheets · Última actualización: ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`,
    error:   `⚠ Error de sincronización — usando datos de ejemplo. (${errorMsg})`,
    demo:    '📋 Modo demo · Configura Google Sheets en <strong>sheets-config.js</strong> para cargar tus productos reales',
  };

  const colors = {
    syncing: 'banner-syncing',
    success: 'banner-success',
    error:   'banner-error',
    demo:    'banner-demo',
  };

  banner.className = `sheets-sync-banner ${colors[status]}`;
  banner.innerHTML = `
    <span class="banner-icon ${status === 'syncing' ? 'spinning' : ''}">${icons[status]}</span>
    <span>${messages[status]}</span>
    ${status !== 'syncing' && status !== 'demo' ? `<button class="banner-refresh-btn" id="banner-refresh-btn" title="Actualizar ahora">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
    </button>` : ''}
  `;

  // Bind refresh button
  const refreshBtn = document.getElementById('banner-refresh-btn');
  if (refreshBtn) {
    const csvUrl = (typeof SHEETS_CONFIG !== 'undefined') ? SHEETS_CONFIG.SHEETS_CSV_URL : '';
    if (csvUrl) {
      refreshBtn.addEventListener('click', () => refreshProducts(csvUrl));
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════
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

// ─── Formatting helpers ───────────────────────────────────────
function formatPrice(price) {
  return `S/ ${price.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`;
}

function badgeHTML(badge) {
  if (!badge) return '';
  const labels = { new: 'Nuevo', hot: '🔥 Popular', sale: 'Oferta', stock: 'Disponible' };
  return `<span class="product-badge badge-${badge}">${labels[badge] || badge}</span>`;
}

function whatsappLink(product) {
  const msg = encodeURIComponent(
    `¡Hola! Estoy interesado/a en el producto:\n*${product.name}*\nPrecio: ${formatPrice(product.price)}\n¿Podría darme más información?`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

// ─── Computed helpers ─────────────────────────────────────────
function getAllBrands() {
  return [...new Set(PRODUCTS.map(p => p.brand))].sort();
}

function getFilteredProducts() {
  let list = PRODUCTS.filter(p => {
    const matchSearch = !state.search ||
      p.name.toLowerCase().includes(state.search.toLowerCase()) ||
      p.brand.toLowerCase().includes(state.search.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(state.search.toLowerCase()));

    const matchCat  = state.category === 'all' || p.category === state.category;
    const matchBrand = state.brands.size === 0 || state.brands.has(p.brand);
    const matchPrice = p.price >= state.priceMin && p.price <= state.priceMax;

    return matchSearch && matchCat && matchBrand && matchPrice;
  });

  switch (state.sort) {
    case 'price-asc':  list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name':       list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default:           list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  return list;
}

// ─── Render products grid ──────────────────────────────────────
function renderProducts() {
  const grid    = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count');
  const list    = getFilteredProducts();

  if (countEl) {
    countEl.innerHTML = `<strong>${list.length}</strong> producto${list.length !== 1 ? 's' : ''} encontrado${list.length !== 1 ? 's' : ''}`;
  }

  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <h3>No encontramos productos</h3>
        <p>Intenta cambiar los filtros o la búsqueda</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((p, i) => `
    <article
      class="product-card"
      role="button"
      tabindex="0"
      aria-label="Ver detalle de ${p.name}"
      data-id="${p.id}"
      style="animation-delay: ${Math.min(i * 40, 400)}ms"
    >
      ${badgeHTML(p.badge)}
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400"
          onerror="this.src='images/laptop.jpg'" />
        <div class="product-overlay">
          <button class="overlay-btn" tabindex="-1">Ver detalle</button>
        </div>
      </div>
      <div class="product-body">
        <p class="product-brand">${p.brand}</p>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-specs">
          ${(p.tags || []).map(t => `<span class="spec-tag">${t}</span>`).join('')}
        </div>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <a href="${whatsappLink(p)}" target="_blank" rel="noopener noreferrer"
            class="btn-whatsapp-card" aria-label="Consultar por WhatsApp"
            onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Consultar
          </a>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openModal(+card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(+card.dataset.id); }
    });
  });
}

// ─── Render brand filter options ───────────────────────────────
function renderBrandFilters() {
  const container = document.getElementById('brand-filters');
  if (!container) return;

  const brands = getAllBrands();
  const counts = {};
  PRODUCTS.forEach(p => { counts[p.brand] = (counts[p.brand] || 0) + 1; });

  container.innerHTML = brands.map(b => `
    <label class="filter-option">
      <input type="checkbox" id="brand-${b.replace(/\s/g, '-')}" value="${b}"
        ${state.brands.has(b) ? 'checked' : ''} />
      <span class="filter-option-label">${b}</span>
      <span class="filter-option-count">${counts[b]}</span>
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

// ─── Modal ────────────────────────────────────────────────────
function openModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;

  const specsHTML = Object.entries(p.specs || {}).map(([k, v]) => `
    <div class="modal-spec-row">
      <span class="modal-spec-key">${k}</span>
      <span class="modal-spec-val">${v}</span>
    </div>
  `).join('');

  document.getElementById('modal-content').innerHTML = `
    <header class="modal-header">
      <div>
        <p class="modal-brand">${p.brand}</p>
        <p style="font-size:.8rem;color:var(--text-muted)">${(p.tags || []).join(' · ')}</p>
      </div>
      <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </header>
    <div class="modal-body">
      <div class="modal-img-wrap">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='images/laptop.jpg'" />
      </div>
      <div class="modal-info">
        <h2 class="modal-name">${p.name}</h2>
        <div class="modal-price-block">
          <span class="modal-price">${formatPrice(p.price)}</span>
          ${p.oldPrice ? `<span class="modal-price-old">${formatPrice(p.oldPrice)}</span>` : ''}
        </div>
        <p class="modal-description">${p.description}</p>
        ${specsHTML ? `<div>
          <p class="modal-specs-title">Especificaciones</p>
          <div class="modal-specs-list">${specsHTML}</div>
        </div>` : ''}
        <div class="modal-actions">
          <a href="${whatsappLink(p)}" target="_blank" rel="noopener noreferrer"
            class="btn-whatsapp-modal" id="modal-whatsapp-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Consultar por WhatsApp
          </a>
          <button class="btn-share-modal" id="modal-share-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Compartir producto
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-share-btn').addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({ title: p.name, text: `${p.name} — ${formatPrice(p.price)}`, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        const btn = document.getElementById('modal-share-btn');
        if (btn) btn.textContent = '✓ Enlace copiado';
      });
    }
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Category pills ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',         label: 'Todos',        icon: '🛍️' },
  { id: 'laptops',     label: 'Laptops',      icon: '💻' },
  { id: 'pcs',         label: 'PCs',          icon: '🖥️' },
  { id: 'celulares',   label: 'Celulares',    icon: '📱' },
  { id: 'tablets',     label: 'Tablets',      icon: '📟' },
  { id: 'perifericos', label: 'Periféricos',  icon: '🖱️' },
  { id: 'impresoras',  label: 'Impresoras',   icon: '🖨️' },
  { id: 'componentes', label: 'Componentes',  icon: '⚙️' },
  { id: 'accesorios',  label: 'Accesorios',   icon: '🎧' },
  { id: 'redes',       label: 'Redes',        icon: '📡' },
  { id: 'software',    label: 'Software',     icon: '💿' },
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
      renderProducts();
    });
  });
}

// ─── Initialize ────────────────────────────────────────────────
function init() {
  // Search
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  const doSearch = () => {
    state.search = searchInput.value.trim();
    renderProducts();
  };
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 250);
  });
  document.getElementById('search-btn').addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Sort
  document.getElementById('sort-select').addEventListener('change', e => {
    state.sort = e.target.value;
    renderProducts();
  });

  // Price filter
  const applyPrice = () => {
    const min = parseFloat(document.getElementById('price-min').value) || 0;
    const max = parseFloat(document.getElementById('price-max').value) || Infinity;
    state.priceMin = min;
    state.priceMax = max;
    renderProducts();
  };
  document.getElementById('price-min').addEventListener('change', applyPrice);
  document.getElementById('price-max').addEventListener('change', applyPrice);

  // Clear filters
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.search = '';
    state.category = 'all';
    state.brands = new Set();
    state.priceMin = 0;
    state.priceMax = Infinity;
    searchInput.value = '';
    document.getElementById('price-min').value = '';
    document.getElementById('price-max').value = '';
    document.getElementById('sort-select').value = 'featured';
    renderCategoryPills();
    renderBrandFilters();
    renderProducts();
  });

  // Modal
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Mobile sidebar drawer
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  document.getElementById('filter-fab').addEventListener('click', () => {
    sidebar.classList.add('drawer-open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  const closeSidebar = () => {
    sidebar.classList.remove('drawer-open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  sidebarOverlay.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);

  // WhatsApp float click
  document.getElementById('whatsapp-float').addEventListener('click', () => {
    const msg = encodeURIComponent('¡Hola! Quisiera saber más sobre sus productos de tecnología. ¿Me pueden ayudar?');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank', 'noopener,noreferrer');
  });

  // Load products (from Sheets or demo)
  loadProducts();
}

document.addEventListener('DOMContentLoaded', init);
