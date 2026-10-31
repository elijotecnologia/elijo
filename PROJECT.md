# Elijo Tecnología — Documentación del proyecto

## Descripción
Sitio web estático (HTML/CSS/JS) de la tienda Elijo Tecnología. Catálogo de productos sincronizado desde Google Sheets (CSV público), buscador y filtros, cotizador con generación de PDF (proforma) y asistente virtual de búsqueda.

## Archivos principales
- `index.html` — estructura de la página, navbar, hero, categorías, catálogo, modal, cotizador, footer.
- `app.js` — catálogo, filtros, búsqueda, ofertas, modal, cotizador, generación de PDF, banners, deep links.
- `assistant.js` — asistente virtual (NLP en español) y tarjetas de producto.
- `style.css` — design system y responsive.
- `sheets-config.js` — URL del CSV de Google Sheets, WhatsApp, auto-refresh, fallback.
- `demo-products.js` — productos de ejemplo (fallback).
- `banner-config.js` — configuración de banners (campos de campaña; se usan los JPEG de `/banners/`).
- `elijo-config.js` — configuración general (actualmente no consumida por el runtime).
- `scripts/validate-catalog.mjs` — validador local del CSV.

## Datos
- Google Sheets publicado como CSV (`SHEETS_CSV_URL` en `sheets-config.js`).
- Encabezado esperado (12 columnas): `ID, name, brand, category, price, oldPrice, badge, image (Columna 8), description, specs, tags, featured`.
- Badges reales: `Nuevo`, `Reacondicionado`.
- No existe columna `has3D` en la hoja; el código no auto-asigna 3D.
- Auto-refresh cada 10 minutos (`AUTO_REFRESH_MINUTES`).

## Funcionalidades
- Catálogo con búsqueda (acentos), filtros por categoría/marca/precio, ordenamiento.
- Ofertas: subconjunto con descuento ≥ 15 %.
- Modal de detalle de producto.
- Cotizador con cantidades, totales (IGV 18 %) y PDF (html2pdf bajo demanda).
- Asistente virtual de búsqueda.
- Banners rotativos (JPEG en `/banners/`).
- Deep links `#producto-<id>`.
- WhatsApp de contacto.

## Assets
- `image/` — 671 imágenes WebP de productos.
- `banners/` — banners JPEG/SVG.
- `models/`, `intro_elijo.mp4` — no usados (respaldados fuera del proyecto).

## Control de versiones
Repositorio Git local. Ver commits por etapa (Etapa 0–5).

## Notas
- `elijo-config.js` y `banner-config.js` (campos de campaña) no están cableados al runtime.
- Métricas de visitas/valoraciones fueron eliminadas (sin backend real).
- SEO/legal/cotizador avanzado implementados en Etapa 5.
