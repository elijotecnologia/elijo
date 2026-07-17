/* ============================================================
   ELIJO TECNOLOGÍA — Google Sheets Configuration
   ─────────────────────────────────────────────────────────────
   INSTRUCCIONES DE CONFIGURACIÓN:
   1. Abre tu Google Sheet con el catálogo de productos
   2. Ve a Archivo → Compartir → Publicar en la web
   3. Selecciona la hoja y elige formato "Valores separados por comas (.csv)"
   4. Haz clic en "Publicar" y copia el enlace generado
   5. Pega ese enlace en SHEETS_CSV_URL abajo
   ─────────────────────────────────────────────────────────────
   ESTRUCTURA DE LA HOJA (columnas en este orden exacto):
   id | name | brand | category | price | oldPrice | badge |
   image | description | specs | tags | featured
   ─────────────────────────────────────────────────────────────
   VALORES VÁLIDOS:
   • category: laptops / pcs / celulares / tablets / perifericos /
               impresoras / componentes / accesorios / redes / software
   • badge:    new / hot / sale / stock  (dejar vacío si no aplica)
   • specs:    Clave1:Valor1|Clave2:Valor2  (separar con |)
   • tags:     Tag1,Tag2,Tag3  (separar con coma)
   • featured: TRUE o FALSE
   • image:    URL completa de imagen O nombre de archivo local (ej: images/laptop.jpg)
   ============================================================ */

const SHEETS_CONFIG = {
  // ► PEGA AQUÍ TU URL DE GOOGLE SHEETS CSV ◄
  SHEETS_CSV_URL: 'https://docs.google.com/spreadsheets/d/1NyN3ww79H0TB1Cpi8woqFgm9ZmptG6_ECO_sb27eCiw/edit?usp=sharing',   // Ejemplo: 'https://docs.google.com/spreadsheets/d/TU_ID/export?format=csv&gid=0'

  // Número de WhatsApp (con código de país, sin +)
  WHATSAPP_NUMBER: '51918394348',

  // Tiempo en minutos para recargar los productos automáticamente
  // Pon 0 para desactivar la recarga automática
  AUTO_REFRESH_MINUTES: 10,

  // Si falla la carga de Sheets, usar datos de ejemplo (true) o mostrar error (false)
  FALLBACK_TO_DEMO: true,
};
