# Calculadora del nuevo costo de WhatsApp Business API (1 de octubre de 2026)

Landing page + calculadora, en español, para estimar cuánto costará responder a clientes por la
API de WhatsApp Business a partir del **1 de octubre de 2026**, cuando Meta empieza a cobrar los
mensajes de servicio (respuestas libres dentro de la ventana de 24 h).

- Sin frameworks: HTML + CSS + JavaScript, sin paso de build.
- Se despliega en **Cloudflare Workers** (plan gratis) con tres comandos.
- Tarifas tomadas del **rate card oficial de Meta** vigente el 1 de octubre de 2026, en USD y 15 monedas locales.
- Cálculo de tres escenarios (optimista, conservador, pesimista), explicación de los 1,000 mensajes
  gratis, tabla de tarifas por país, preguntas frecuentes y enlaces a la documentación oficial.

## Despliega tu copia en 3 comandos

Necesitas [Node.js](https://nodejs.org) 18+ y una cuenta gratuita de [Cloudflare](https://dash.cloudflare.com/sign-up).

```bash
npm install
npx wrangler login      # abre el navegador para autorizar tu cuenta de Cloudflare
npm run deploy
```

Al terminar, wrangler te imprime la URL: `https://calculadora-whatsapp.<tu-subdominio>.workers.dev`.
Para probar en tu máquina: `npm run dev` → http://localhost:8787.

### Dominio propio (opcional)

1. El dominio debe estar en tu cuenta de Cloudflare (DNS gestionado por Cloudflare).
2. En `wrangler.jsonc` descomenta `routes` con tu dominio y pon el host en `vars.CANONICAL_HOST`.
3. En `public/index.html` agrega `<link rel="canonical">` y `<meta property="og:url">` con tu URL.
4. `npm run deploy`. Cloudflare emite el certificado solo; `www` y `workers.dev` redirigen a tu dominio.

## Qué reglas aplica (fuente: Meta for Developers, Pricing)

- Se cobra por mensaje **entregado** que envía la empresa. Los mensajes recibidos no se cobran.
- La tarifa es la del **país del cliente** (código de país de su número), no la del negocio.
- **1,000 mensajes de servicio gratis al mes por número** de WhatsApp Business. No se acumulan.
- La tarifa de servicio de cada mercado = tarifa de utilidad/autenticación de ese mercado. Sin niveles de volumen.
- Plantillas de utilidad dentro de la ventana de 24 h: dejan de ser gratis.
- Ventana de 72 h por anuncios "clic a WhatsApp" / botones de Facebook: sigue gratis.
- Cuando hay varios países, los 1,000 gratis se reparten en proporción (Meta no publica el orden).

Fuentes: [Precios en la plataforma de WhatsApp Business](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
y [Próximas actualizaciones de precios](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages).

## Estructura

```
public/
  index.html      landing (5 secciones con efecto "story scroll")
  styles.css      estilos (blanco/negro, Space Grotesk + DM Mono)
  app.js          calculadora: wizard de 4 pasos, escenarios, resultados, FAQ, link compartible
  calc.js         lógica pura del cálculo (sin DOM; es lo que prueban los tests)
  scroll.js       efecto de scroll con GSAP ScrollTrigger (se apaga con prefers-reduced-motion)
  data.js         GENERADO: tarifas (16 monedas × 47 mercados) + lista de países
  flags/          banderas SVG (flag-icons, MIT)
  vendor/         gsap.min.js + ScrollTrigger.min.js
  _headers        cabeceras de seguridad de respaldo
src/worker.js     Worker: HTTPS, dominio canónico opcional, cabeceras de seguridad (CSP con nonce)
data/rates_oct2026.json   tarifas parseadas de los PDFs oficiales de Meta
scripts/build-data.py     regenera public/data.js a partir del JSON
scripts/cf-harden.sh      blinda tu zona de Cloudflare vía API (ver abajo)
test/calc.test.js         tests de la lógica (node:test)
```

## Comandos

```bash
npm test                        # tests de la lógica
npm run dev                     # servidor local
npm run deploy                  # publicar en Cloudflare
python3 scripts/build-data.py   # regenerar public/data.js si cambian las tarifas
```

## Personalizar

- **Textos**: todo está en `public/index.html` (secciones) y en `public/app.js` (pasos de la
  calculadora, FAQ en la constante `FAQ`, escenarios en `SCENARIOS` dentro de `calc.js`).
- **Países destacados**: la constante `TOP` en `public/app.js`.
- **Escenarios**: multiplicadores en `SCENARIOS` (`public/calc.js`): 0.7 / 1 / 1.5.
- **Colores y tipografía**: variables al inicio de `public/styles.css`.

## Actualizar tarifas

Meta puede cambiar tarifas el 1 de enero, abril, julio y octubre. En la página de Pricing de Meta
descarga los PDF "Tarifas y niveles de volumen en <MONEDA>" (la página se renderiza con
JavaScript; los enlaces están en `a[href]` vía `l.facebook.com/l.php?u=`), conviértelos a texto con
`pdftotext -layout`, actualiza `data/rates_oct2026.json` y corre `python3 scripts/build-data.py`.
Los tests comprueban que servicio = utilidad = autenticación en los 47 mercados.

## Seguridad

El Worker ya fuerza HTTPS y manda cabeceras de seguridad (HSTS, CSP estricta con nonce, sin
iframes, nosniff). Si usas dominio propio, `scripts/cf-harden.sh` prende en tu zona, vía API:
Always Use HTTPS, TLS mínimo 1.2, Bot Fight Mode, el WAF gratuito de Cloudflare, una regla de
Rate Limiting, DNSSEC, y registros SPF/DMARC/CAA para que nadie suplante correos de tu dominio.

```bash
# Token en dash.cloudflare.com/profile/api-tokens con permisos para tu zona:
# Zone Settings: Edit · Zone WAF: Edit · DNS: Edit · Zone: Read · Bot Management: Edit
export CF_ZONE_TOKEN="..."
./scripts/cf-harden.sh tudominio.com --check   # solo muestra el estado
./scripts/cf-harden.sh tudominio.com           # aplica
```

Sin dominio propio (solo `workers.dev`) no hace falta: Cloudflare ya protege el Worker.

## Compartir escenarios

El estado vive en la URL: `?biz=MX&n=1&rep=6&c=MX:p300,CO:e3000&u=0&m=0&s=4`
(`c` = país:`p`personas o `e`mensajes exactos por renglón; `rep` = respuestas por conversación;
`u`/`m` = plantillas de utilidad/marketing al mes; `s` = paso).

## Aviso

Esta calculadora es una estimación hecha con datos públicos de Meta. No es asesoría de Meta ni de
ningún proveedor; tu proveedor (BSP) puede agregar su margen. WhatsApp y su logo son marcas de Meta
Platforms, Inc.; este proyecto no está afiliado a Meta. Licencia MIT.
