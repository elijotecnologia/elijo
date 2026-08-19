# Memoria Técnica — Elijo Tecnología

**Elijo Tecnología** (`elijotecnologia.com`) es una plataforma web interactiva de catálogo de productos tecnológicos y generador de proformas de cotización corporativas con filosofía de asesoría real (*"No venimos a venderte, venimos a ayudarte a elegir"*).

---

## 1. Estructura Principal de Archivos

```
/
├── CNAME                  # Dominio personalizado de GitHub Pages (elijotecnologia.com)
├── index.html             # Estructura principal HTML5 semántica y layout responsive
├── style.css              # Sistema de diseño Vanilla CSS, tokens y reglas responsive
├── app.js                 # Lógica central del catálogo, buscador, cotizador y proforma PDF
├── sheets-config.js       # Configuración de sincronización con Google Sheets (CSV URL, WhatsApp, auto-refresh)
├── elijo-config.js        # Configuración central de marca, perfiles de uso y subtítulos
├── banner-config.js       # Configuración del banner dinámico de campañas
├── demo-products.js       # Fallback de datos de catálogo (PRODUCTOS_DEMO)
├── assistant.js           # Asistente virtual de recomendación
├── choice-guide.js        # Módulo de guía de elección por perfil de uso
├── comparison.js         # Módulo de comparación flotante entre productos
├── personalization.js    # Motor de personalización y recomendaciones
├── image/                 # Imágenes del catálogo de productos (formatos .jpg, .webp)
└── models/                # Modelos 3D interactivos (.glb)
```

---

## 2. Origen de Datos y Sincronización

1. **Google Sheets (Fuente Primaria)**:
   - Los datos se obtienen en vivo en formato CSV desde Google Sheets mediante `fetchFromGoogleSheets(csvUrl)` en `app.js`.
   - La URL de la hoja se define en `SHEETS_CONFIG.SHEETS_CSV_URL` en `sheets-config.js`.
   - Soporta auto-recarga programable cada N minutos (`AUTO_REFRESH_MINUTES`).
2. **Demo Fallback (Fuente Secundaria)**:
   - Si la conexión a Google Sheets falla o no hay URL configurada, el sistema utiliza `PRODUCTOS_DEMO` de `demo-products.js`.

---

## 3. Estructura de Productos

Cada objeto de producto se procesa mediante `rowToProduct(cells, index)` con los siguientes atributos:

```javascript
{
  id: "prod-101",            // String único identificador
  name: "Laptop Lenovo...",   // Nombre comercial
  brand: "Lenovo",            // Marca del fabricante
  category: "laptops",        // Categoría en minúsculas
  price: 2499.00,             // Precio actual en Soles (S/)
  oldPrice: 2899.00,          // Precio anterior (opcional)
  badge: "sale",              // new / hot / sale / stock / agotado
  image: "image/prod-101.jpg",// Ruta local o URL remota (.jpg o .webp)
  has3D: true,                // Indicador de modelo 3D disponible
  description: "...",        // Descripción detallada
  specs: { "RAM": "16GB" },   // Objeto Clave:Valor mapeado desde "Clave:Valor|..."
  tags: ["Ryzen 5", "SSD"],   // Etiquetas mapeadas desde "Tag1,Tag2"
  featured: true              // Destacado en carrusel u ordenamiento
}
```

---

## 4. Buscador y Filtros

- **Buscador & Header Persistente**:
  - Ubicado en la barra superior del navbar (`#search-input`) y en el hero (`#hero-search-input`).
  - **Navegación Fija durante Scroll**: El contenedor `<header>` cuenta con `position: sticky; top: 0; z-index: 100;`, permaneciendo visible y accesible durante **todo el recorrido de la página** (tanto en escritorio como en móvil). Permite realizar búsquedas continuas (*ej: buscar case → cotizar → scroll → buscar RAM → cotizar*) sin subir al inicio.
  - **Comportamiento UX**: La búsqueda y el scroll suave hacia `#catalogo` se activan exclusivamente al presionar la tecla **Enter** o al hacer clic en el botón de **Lupa** (`#search-btn`). El evento `input` únicamente limpia la lista si la caja de texto queda vacía.
- **Filtros**:
  - **Categorías**: Selección mediante barra de píldoras (`#category-pills`) o submenú del logo dropdown (`#logo-dropdown-categories`).
  - **Rango de Precio**: Filtro interactivo por mínimo y máximo en Soles (`#price-min`, `#price-max`).
  - **Marcas**: Selección mediante checkboxes dinámicos (`#brand-filters`).
  - **Filtro 3D**: Toggle para mostrar exclusivamente productos con modelo interactivo 3D.
  - **Ordenamiento**: Destacados, Variedad intercalada (`variety`), Precio menor/mayor, Nombre A-Z.

---

## 5. Cotización y Exportación de Proforma PDF

- **Gestión de Cotizaciones**: Persistencia en `localStorage` bajo la clave `elijo_quotation`.
- **Drawer Lateral**: Muestra items agregados, ajuste de cantidades, vaciado e información del cliente.
- **Cálculo Tributario**: Separa Base Imponible (Op. Gravada = Total / 1.18) e IGV (18%).
- **Proforma PDF Empresarial**:
  - Utiliza `html2pdf.js` sobre la plantilla `#proforma-pdf-container`.
  - Formato A4 limpio con RUC (15615011719), código correlativo de proforma y validez por 3 días hábiles.

---

## 6. Modal de Producto y Visualización 3D

- **Estructura del Modal**:
  **Imagen/Visualizador 3D → Nombre/Marca → Precio → Información Principal (Visitas & Rating) → Especificaciones Técnicas → Descripción → Añadir a Cotización / WhatsApp**.
- **Sistema 3D**:
  - Utiliza el componente `<model-viewer>` cargando el archivo `models/prod-[ID].glb`.
  - Cuenta con un manejador de evento `error` que conmuta automáticamente al elemento fallback de imagen `<img>` si el modelo `.glb` no existe.
- **Adaptabilidad de Imagen**: Contenedor con `object-fit: contain` para adaptar correctamente imágenes cuadradas, horizontales o verticales.

---

## 7. Responsive y Hosting

- **Responsive Design**:
  - Breakpoints principales a `1024px`, `768px`, `640px` y `480px`.
  - En móviles, los filtros se convierten en un drawer deslizable lateral activado por el botón flotante `#filter-fab`.
- **Hosting & Dominio**:
  - Desplegado en **GitHub Pages**.
  - Dominio personalizado definido en `CNAME`: `elijotecnologia.com`.

---

## 8. Reglas de Desarrollo Importantes (NO ROMPER)

1. **Integridad de Sheets**: No alterar el orden de columnas esperado por `parseCSVRow` y `rowToProduct`.
2. **Consolidación del Buscador**: Mantener la regla de no disparar scroll automático mientras el usuario escribe letras en el buscador.
3. **Módulo 3D**: Mantener la etiqueta `<model-viewer>` y su fallback automático a imagen en el modal de detalle.
4. **Calculo de IGV**: No cambiar la fórmula tributaria de Proforma (Subtotal = Total / 1.18, IGV = Total - Subtotal).
5. **Formato de Imagen**: Permitir rutas sin forzar extensiones `.jpg` rígidas para admitir `.webp` sin fallas.

---

## ESTADO ACTUAL Y PRÓXIMAS MEJORAS

### Estado Actual
- Plataforma 100% funcional sin errores de sintaxis en consola.
- Integración completa de Google Sheets, Cotizador PDF, Visualizador 3D y Búsqueda responsiva.
- Menú desplegable enriquecido con categorías dinámicas y footer conectado a los filtros.

### Próximas Mejoras Recomendadas
1. **Conversión a WebP**: Realizar la conversión por lotes de la carpeta `image/*.jpg` a `.webp` para reducir el peso de descarga del catálogo.
2. **Páginas de Información**: Desarrollar los módulos específicos para *Sobre nosotros*, *Garantías*, *Envíos* y *Políticas de cambio*.
3. **Modelos 3D Adicionales**: Generar/añadir archivos `.glb` para los productos que actualmente solo cuentan con imagen 2D.
