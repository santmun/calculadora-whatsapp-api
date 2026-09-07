import { DATA } from "./data.js";
import { calculate, scenarios, distributeTemplates, messagesFromPeople, freeAllowance, FREE_SERVICE_PER_NUMBER } from "./calc.js";

const $ = (sel, root = document) => root.querySelector(sel);
const byIso = Object.fromEntries(DATA.countries.map((c) => [c.iso, c]));
const sorted = [...DATA.countries].sort((a, b) => a.name.localeCompare(b.name, "es"));
// Los más comunes para la comunidad, en este orden
const TOP = ["MX", "CO", "AR", "CL", "PE", "ES", "US", "BR", "EC", "GT", "DO", "VE", "UY", "PY", "BO"];
const REPLY_PRESETS = [
  { v: 3, label: "Pocas", hint: "3 por conversación" },
  { v: 6, label: "Normal", hint: "6 por conversación" },
  { v: 12, label: "Muchas", hint: "12 por conversación" },
];
const PEOPLE_MAX = 3000;

const state = {
  step: 1,
  biz: "MX",
  numbers: 1,
  replies: 6,
  countries: [{ iso: "MX", mode: "people", people: 300, exact: 0 }],
  utility: 0,
  marketing: 0,
  picker: null, // "biz" | "client" cuando el selector de "otro país" está abierto
};

// ---------- utilidades ----------
const fmtInt = (v) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(v);
function money(v, cur, maxFrac = 2) {
  const s = new Intl.NumberFormat("es-MX", { style: "currency", currency: cur, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: maxFrac }).format(v);
  return `${s} ${cur}`;
}
const rate = (v, cur) => money(v, cur, v >= 10 ? 2 : 4);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const GLOBE = `<span class="globe"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"></path></svg></span>`;
function flag(iso, cls = "") {
  if (iso === "XX") return GLOBE;
  return `<img class="flag ${cls}" src="./flags/${iso.toLowerCase()}.svg" alt="" loading="lazy" width="40" height="40" />`;
}
const ICON = {
  arrow: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>`,
  minus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"></path></svg>`,
  x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>`,
  pdf: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"></path><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path></svg>`,
};

const msgsOf = (c) => (c.mode === "people" ? messagesFromPeople(c.people, state.replies) : Math.round(c.exact || 0));
const totalMsgs = () => state.countries.reduce((a, c) => a + msgsOf(c), 0);

// ---------- URL <-> estado ----------
function readUrl() {
  const q = new URLSearchParams(location.search);
  if (Object.hasOwn(byIso, q.get("biz") ?? "")) state.biz = q.get("biz");
  if (q.get("n")) state.numbers = Math.min(50, Math.max(1, parseInt(q.get("n"), 10) || 1));
  if (q.get("rep")) state.replies = Math.max(1, parseInt(q.get("rep"), 10) || 6);
  if (q.get("c")) {
    const list = q.get("c").split(",").map((s) => {
      const m = /^([A-Z]{2}):([pe])(\d+)$/.exec(s);
      if (!m || !Object.hasOwn(byIso, m[1])) return null;
      return { iso: m[1], mode: m[2] === "p" ? "people" : "exact", people: m[2] === "p" ? +m[3] : 0, exact: m[2] === "e" ? +m[3] : 0 };
    }).filter(Boolean);
    if (list.length) state.countries = list;
  }
  if (q.get("u")) state.utility = Math.max(0, parseInt(q.get("u"), 10) || 0);
  if (q.get("m")) state.marketing = Math.max(0, parseInt(q.get("m"), 10) || 0);
  if (q.get("s")) state.step = Math.min(4, Math.max(1, parseInt(q.get("s"), 10) || 1));
}
function writeUrl() {
  const q = new URLSearchParams();
  q.set("biz", state.biz); q.set("n", state.numbers); q.set("rep", state.replies);
  q.set("c", state.countries.map((c) => `${c.iso}:${c.mode === "people" ? "p" + (c.people || 0) : "e" + (c.exact || 0)}`).join(","));
  if (state.utility) q.set("u", state.utility);
  if (state.marketing) q.set("m", state.marketing);
  q.set("s", state.step);
  history.replaceState(null, "", `?${q}`);
}

// ---------- render ----------
function tiles({ selected, multi }) {
  const extra = selected.filter((iso) => !TOP.includes(iso));
  const list = [...extra, ...TOP];
  const t = list.map((iso) => `<button type="button" class="ftile ${selected.includes(iso) ? "on" : ""}" data-act="pick" data-iso="${iso}" aria-pressed="${selected.includes(iso)}">${flag(iso)}<span>${esc(byIso[iso].name)}</span></button>`).join("");
  const other = `<button type="button" class="ftile dashed ${state.picker ? "on" : ""}" data-act="other">${GLOBE}<span>Otro país</span></button>`;
  const picker = state.picker
    ? `<div class="picker"><label class="sr" for="pick-select">País</label><select id="pick-select" data-act="pick-select"><option value="">Elige un país…</option>${sorted.map((c) => `<option value="${c.iso}">${esc(c.name)}</option>`).join("")}</select><span class="meta">${multi ? "Se agrega a tu lista al elegirlo." : "Se selecciona al elegirlo."}</span></div>`
    : "";
  return `<div class="tiles">${t}${other}</div>${picker}`;
}

function stepsHeader() {
  const biz = byIso[state.biz];
  const n = state.countries.length;
  const def = [
    { i: 1, label: "Negocio", done: `Negocio · ${state.biz === "XX" ? "" : flag(state.biz, "sm")} ${esc(biz.name)}` },
    { i: 2, label: "Números", done: `Números · ${state.numbers}` },
    { i: 3, label: "Clientes", done: `Clientes · ${n} ${n === 1 ? "país" : "países"}` },
    { i: 4, label: "Resultado", done: "Resultado" },
  ];
  const chips = def.map((d) => {
    if (d.i === state.step) return `<button type="button" class="chip now" disabled>${d.i} · ${d.label}</button>`;
    if (d.i < state.step) return `<button type="button" class="chip done" data-act="goto" data-step="${d.i}">${ICON.check} ${d.done}</button>`;
    return `<button type="button" class="chip dim" disabled>${d.i} · ${d.label}</button>`;
  }).join("");
  return `<div class="steps">${chips}</div><div class="progress"><div style="width:${(state.step / 4) * 100}%"></div></div>`;
}

function step1() {
  return `<h3>¿Dónde está tu negocio?</h3>
  <p class="help">Esto <strong>no cambia lo que pagas</strong>: Meta cobra según el país de tu cliente. Solo lo usamos para mostrarte el resultado también en tu moneda.</p>
  ${tiles({ selected: [state.biz], multi: false })}
  <div class="actions"><span></span><button type="button" class="btn" data-act="goto" data-step="2">Siguiente ${ICON.arrow}</button></div>`;
}

function step2() {
  const free = freeAllowance(state.numbers);
  return `<h3>¿Cuántos números de WhatsApp Business usas?</h3>
  <p class="help">Cada número (línea) conectado a la API tiene <strong>1,000 respuestas gratis al mes</strong>. Dos números son 2,000. Los que no uses en un mes se pierden.</p>
  <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
    <div class="stepper"><button type="button" data-act="num" data-d="-1" aria-label="Menos">${ICON.minus}</button><span class="val">${state.numbers}</span><button type="button" data-act="num" data-d="1" aria-label="Más">${ICON.plus}</button></div>
    <span style="font-size:17px">= <strong class="mono">${fmtInt(free)}</strong> respuestas gratis al mes</span>
  </div>
  <div class="actions"><button type="button" class="btn ghost" data-act="goto" data-step="1">${ICON.back} Atrás</button><button type="button" class="btn" data-act="goto" data-step="3">Siguiente ${ICON.arrow}</button></div>`;
}

function countryCard(c) {
  const info = byIso[c.iso];
  const msgs = msgsOf(c);
  const marketNote = DATA.marketNames[info.market] !== info.name ? `<span class="meta">tarifa de "${esc(DATA.marketNames[info.market])}"</span>` : "";
  const body = c.mode === "people"
    ? `<label class="meta" for="people-${c.iso}">¿Con cuántas personas distintas hablas al mes en ${esc(info.name)}?</label>
       <input type="range" id="people-${c.iso}" min="0" max="${PEOPLE_MAX}" step="10" value="${Math.min(c.people, PEOPLE_MAX)}" data-k="people" />
       <div class="lab"><span>0</span><span>${fmtInt(PEOPLE_MAX / 2)}</span><span>${fmtInt(PEOPLE_MAX)}+</span></div>
       <div class="row">
         <input type="number" min="0" step="1" value="${c.people || ""}" placeholder="personas" data-k="people" aria-label="Personas al mes" />
         <span class="meta">personas × ${state.replies} respuestas ≈ <strong class="mono" style="color:var(--ink)">${fmtInt(msgs)}</strong> mensajes</span>
         <button type="button" class="linkbtn" data-act="mode" data-mode="exact">Sé mi número exacto de mensajes</button>
       </div>`
    : `<label class="meta" for="exact-${c.iso}">Mensajes de servicio que envías al mes a clientes en ${esc(info.name)}</label>
       <div class="row">
         <input type="number" id="exact-${c.iso}" min="0" step="1" value="${c.exact || ""}" placeholder="ej. 3000" data-k="exact" />
         <span class="meta">Lo ves en la analítica de precios de Meta o en el panel de tu proveedor, categoría SERVICE.</span>
         <button type="button" class="linkbtn" data-act="mode" data-mode="people">Mejor estímalo por personas</button>
       </div>`;
  return `<div class="ccard" data-iso="${c.iso}">
    <div class="head">
      <span class="name">${flag(c.iso, "md")} ${esc(info.name)} ${marketNote} <button type="button" class="xbtn" data-act="remove" aria-label="Quitar ${esc(info.name)}">${ICON.x}</button></span>
      <span class="val"><b>${fmtInt(msgs)}</b><span>respuestas / mes</span></span>
    </div>
    ${body}
  </div>`;
}

function step3() {
  const sel = state.countries.map((c) => c.iso);
  const custom = !REPLY_PRESETS.some((p) => p.v === state.replies);
  const chips = REPLY_PRESETS.map((p) => `<button type="button" class="chip ${state.replies === p.v ? "on" : ""}" data-act="replies" data-v="${p.v}">${p.label} · ${p.v}</button>`).join("")
    + `<input type="number" min="1" step="1" value="${custom ? state.replies : ""}" placeholder="otro" data-k="replies" style="height:40px;width:100px" aria-label="Respuestas por conversación" />`;
  return `<h3>¿Dónde están tus clientes?</h3>
  <p class="help">Toca los países donde están. Luego dinos, más o menos, con cuántas personas hablas al mes en cada uno. Nosotros lo convertimos a mensajes.</p>
  ${tiles({ selected: sel, multi: true })}
  <div class="field">
    <label>¿Cuántas respuestas mandas por conversación, más o menos?</label>
    <p class="hint">Cuenta cada mensaje que sale de tu lado. Un "hola, claro que sí", el precio, la foto del producto y el "¿te lo aparto?" son cuatro. Si usas chatbot o IA, cada burbuja cuenta.</p>
    <div class="chips">${chips}</div>
  </div>
  <div class="field">
    ${state.countries.length ? state.countries.map(countryCard).join("") : `<p class="muted">Toca al menos un país arriba.</p>`}
  </div>
  <details class="adv" ${state.utility || state.marketing ? "open" : ""}>
    <summary>Opciones avanzadas: plantillas de utilidad y marketing</summary>
    <div class="advgrid">
      <div><label class="meta" for="util">Plantillas de utilidad que mandas <strong>dentro</strong> de la ventana de 24 h, al mes (confirmaciones, avisos de pedido). Antes gratis; ahora se cobran.</label><br /><input type="number" id="util" min="0" step="1" value="${state.utility || ""}" placeholder="0" data-k="utility" /></div>
      <div><label class="meta" for="mkt">Plantillas de marketing al mes. Ya las pagas hoy; solo para ver tu factura total.</label><br /><input type="number" id="mkt" min="0" step="1" value="${state.marketing || ""}" placeholder="0" data-k="marketing" /></div>
    </div>
    <p class="note">Se reparten entre tus países en la misma proporción que tus respuestas.</p>
  </details>
  <div class="actions"><button type="button" class="btn ghost" data-act="goto" data-step="2">${ICON.back} Atrás</button><button type="button" class="btn" data-act="goto" data-step="4" ${state.countries.length ? "" : "disabled"}>Ver mi costo ${ICON.arrow}</button></div>`;
}

function step4() {
  const biz = byIso[state.biz];
  const localCur = biz.cur && biz.cur !== "USD" ? biz.cur : null;
  const rows = distributeTemplates(state.countries.map((c) => ({ market: byIso[c.iso].market, service: msgsOf(c) })), state.utility, state.marketing);
  const sc = scenarios({ rows, numbers: state.numbers, rates: DATA.rates.USD });
  const scLocal = localCur ? scenarios({ rows, numbers: state.numbers, rates: DATA.rates[localCur] }) : null;
  const cons = sc[1].result;
  const consLocal = scLocal ? scLocal[1].result : null;
  const free = cons.freeAllowance;
  const total = cons.totalService;

  // Medidor: nada (≤ gratis) · poco (≤ 2× gratis) · bastante
  const pos = Math.min(total / (free * 3), 1) * 100;
  const level = total <= free ? "nada" : total <= free * 2 ? "poco" : "bastante";
  const levelText = {
    nada: `<strong>Ninguno</strong>: envías ${fmtInt(total)} respuestas al mes y tienes ${fmtInt(free)} gratis. Sigues pagando $0. Te sobran ${fmtInt(cons.freeLeft)} de margen.`,
    poco: `<strong>Bajo</strong>: envías ${fmtInt(total)} respuestas, ${fmtInt(free)} son gratis y pagas solo ${fmtInt(cons.billableService)}. Si bajaras de ${fmtInt(free)}, volverías a $0.`,
    bastante: `<strong>Considerable</strong>: envías ${fmtInt(total)} respuestas y solo ${fmtInt(free)} son gratis. Pagas ${fmtInt(cons.billableService)}, más del doble de tu nivel gratis. Vale la pena revisar cuántos mensajes manda tu equipo o tu bot por conversación.`,
  }[level];

  const head = cons.newMonthly === 0
    ? `<div class="amount"><b>$0.00</b><span>USD al mes</span></div>
       <p class="sub">Con tus números, en octubre sigues sin pagar por responder.</p>`
    : `<div class="amount"><b>${money(cons.newMonthly, "USD").replace(" USD", "")}</b><span>USD al mes</span></div>
       <p class="sub">${consLocal ? `≈ ${money(consLocal.newMonthly, localCur)} · ` : ""}${money(cons.newYearly, "USD")} al año · escenario conservador</p>`;

  // Barra de los 1,000 gratis
  const span = Math.max(total, free);
  const wUsed = (cons.freeUsed / span) * 100, wPaid = (cons.billableService / span) * 100, wLeft = (cons.freeLeft / span) * 100;
  const freebox = `<div class="freebox">
    <h4>Los ${fmtInt(FREE_SERVICE_PER_NUMBER)} gratis, con tus números</h4>
    <div class="stack" aria-hidden="true"><span class="free" style="width:${wUsed}%"></span><span class="paid" style="width:${wPaid}%"></span><span class="left" style="width:${wLeft}%"></span></div>
    <div class="legend"><span><i style="background:#A8A8A8"></i>${fmtInt(cons.freeUsed)} gratis usadas</span>${cons.billableService ? `<span><i style="background:#141414"></i>${fmtInt(cons.billableService)} se cobran</span>` : ""}${cons.freeLeft ? `<span><i style="background:#D6D6D6"></i>${fmtInt(cons.freeLeft)} gratis sin usar</span>` : ""}</div>
    <ul>
      <li>Tienes <strong>${fmtInt(free)} respuestas gratis al mes</strong>${state.numbers === 1 ? ", porque usas un solo número" : ` (${fmtInt(FREE_SERVICE_PER_NUMBER)} por cada uno de tus ${state.numbers} números)`}. Meta cobra a partir de la ${fmtInt(free + 1)}.</li>
      <li>Envías unas <strong>${fmtInt(total)}</strong> al mes. ${cons.billableService ? `Las primeras ${fmtInt(free)} no cuestan; pagas las <strong>${fmtInt(cons.billableService)}</strong> que sobran, cada una a la tarifa del país del cliente.` : `Todas caben en el nivel gratis: <strong>pagas $0</strong>.`}</li>
      <li>El contador se reinicia el día 1 de cada mes. Lo que no uses <strong>no se acumula</strong> para el siguiente.</li>
      <li>Solo cuenta para <strong>mensajes de servicio</strong> (tus respuestas libres dentro de las 24 h). Las plantillas de utilidad, marketing y autenticación se cobran desde el primer mensaje.</li>
      ${state.numbers > 1 ? `<li>Ojo: el nivel es por número. Si casi todas tus respuestas salen por un solo número, en la práctica solo aplican ${fmtInt(FREE_SERVICE_PER_NUMBER)}.</li>` : ""}
    </ul>
  </div>`;

  const scen = `<div class="section-head" style="margin:32px 0 0"><p class="eyebrow">Tres escenarios</p><h3 style="font-size:24px;margin-top:8px">Porque casi nadie sabe su número exacto</h3></div>
  <div class="scen">${sc.map((s, i) => {
    const r = s.result, l = scLocal ? scLocal[i].result : null;
    return `<div class="sc ${s.id === "conservador" ? "main" : ""}">
      <div class="tag"><span>${s.label}</span><span class="mono" style="letter-spacing:0;text-transform:none">×${s.factor}</span></div>
      <div class="n">${money(r.newMonthly, "USD").replace(" USD", "")} <span>USD / mes</span></div>
      ${l ? `<div class="loc">≈ ${money(l.newMonthly, localCur)}</div>` : ""}
      <dl><dt>Respuestas / mes</dt><dd>${fmtInt(r.totalService)}</dd><dt>Gratis</dt><dd>${fmtInt(r.freeUsed)}</dd><dt>Se cobran</dt><dd>${fmtInt(r.billableService)}</dd><dt>Al año</dt><dd>${money(r.newYearly, "USD").replace(" USD", "")}</dd></dl>
      <p>${s.desc}</p>
    </div>`;
  }).join("")}</div>`;

  const showUtil = cons.utilityCost > 0, showMkt = cons.marketingCost > 0;
  const table = `<div class="table-wrap" style="margin-top:28px"><table>
    <thead><tr><th>Clientes en</th><th class="num">Tarifa / mensaje</th><th class="num">Respuestas</th><th class="num">Se cobran</th><th class="num">Costo / mes</th>${showUtil ? `<th class="num">Utilidad</th>` : ""}${showMkt ? `<th class="num">Marketing</th>` : ""}</tr></thead>
    <tbody>${cons.perRow.map((r, i) => {
      const c = byIso[state.countries[i].iso];
      return `<tr><td><span style="display:inline-flex;align-items:center;gap:8px">${flag(c.iso, "sm")} ${esc(c.name)}</span>${DATA.marketNames[r.market] !== c.name ? `<div class="meta">${esc(DATA.marketNames[r.market])}</div>` : ""}</td>
        <td class="num">${rate(r.serviceRate, "USD")}${consLocal ? `<div class="meta">${rate(consLocal.perRow[i].serviceRate, localCur)}</div>` : ""}</td>
        <td class="num">${fmtInt(r.service)}</td><td class="num">${fmtInt(Math.round(r.serviceBillable))}</td><td class="num">${money(r.serviceCost, "USD")}</td>
        ${showUtil ? `<td class="num">${money(r.utilityCost, "USD")}<div class="meta">${fmtInt(Math.round(r.utility))} msgs</div></td>` : ""}
        ${showMkt ? `<td class="num">${money(r.marketingCost, "USD")}<div class="meta">${fmtInt(Math.round(r.marketing))} msgs</div></td>` : ""}
      </tr>`;
    }).join("")}</tbody></table></div>`;

  const notes = [];
  if (showUtil) notes.push(`Plantillas de utilidad dentro de la ventana: <strong>${money(cons.utilityCost, "USD")}</strong> al mes. Hoy son gratis; desde el 1 de octubre se cobran completas (no entran en los ${fmtInt(FREE_SERVICE_PER_NUMBER)} gratis). Ya está sumado en tu total.`);
  if (showMkt) notes.push(`Marketing: <strong>${money(cons.marketingCost, "USD")}</strong> al mes. Esto ya lo pagas hoy; no es costo nuevo. Tu factura total de mensajes sería <strong>${money(cons.totalMonthly, "USD")}</strong> al mes.`);
  if (cons.perRow.length > 1 && cons.billableService) notes.push(`Como atiendes varios países, los ${fmtInt(cons.freeUsed)} gratis se reparten en proporción a lo que envías a cada uno. Meta no publica en qué orden los descuenta.`);
  if (biz.market !== byIso[state.countries[0]?.iso ?? state.biz].market) notes.push(`Tu negocio está en ${esc(biz.name)}, pero la tarifa que pagas es la del país de cada cliente. Tu ubicación no cambia el precio.`);
  if (localCur) notes.push(`Los montos en ${localCur} salen del rate card oficial de Meta en ${localCur} y aplican si tu cuenta de WhatsApp Business factura en esa moneda. Si pagas a través de un proveedor, revisa su lista de precios.`);

  const today = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date());
  return `<div class="result">
    <div class="print-only">
      <strong>Estimación del nuevo costo de WhatsApp Business API · vigente desde el 1 de octubre de 2026</strong>
      <div>Negocio en ${esc(biz.name)} · ${state.numbers} ${state.numbers === 1 ? "número" : "números"} de WhatsApp Business · ${state.replies} respuestas por conversación · generado el ${today}</div>
      <div>${esc(location.href)}</div>
    </div>
    <div class="top"><span class="eyebrow">Tu resultado</span><span class="mono meta">hoy pagas $0 por esto</span></div>
    ${head}
    <div class="meter"><div class="labels"><span>Nada</span><span>Poco</span><span>Bastante</span></div><div class="bar"><span class="knob" style="left:${pos}%"></span></div><p>Impacto ${levelText}</p></div>
    ${freebox}
    ${scen}
    ${table}
    ${notes.length ? `<p class="note">${notes.join(" ")}</p>` : ""}
    <div class="actions">
      <button type="button" class="btn ghost" data-act="goto" data-step="3">${ICON.back} Cambiar mis datos</button>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn sm ghost" data-act="pdf">${ICON.pdf} Descargar PDF</button>
        <button type="button" class="btn sm" data-act="share">${ICON.link} Copiar link con mi escenario</button>
      </div>
    </div>
    <p class="meta" id="share-msg" style="margin-top:8px"></p>
    <p class="print-only note">Tarifas del rate card oficial de Meta vigente a partir del 1 de octubre de 2026 (developers.facebook.com/documentation/business-messaging/whatsapp/pricing). Estimación: tu proveedor puede agregar su margen. Los 1,000 mensajes gratis por número se reparten en proporción entre países.</p>
  </div>`;
}

function render() {
  const card = [step1, step2, step3, step4][state.step - 1]();
  $("#calc").innerHTML = `${stepsHeader()}<div class="card">${card}</div>`;
  writeUrl();
  document.dispatchEvent(new Event("calc-rendered")); // scroll.js recalcula las posiciones de las secciones
}

// ---------- eventos ----------
function bind() {
  const root = $("#calc");
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act;
    if (act === "goto") { state.step = +btn.dataset.step; state.picker = null; render(); root.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (act === "num") { state.numbers = Math.min(50, Math.max(1, state.numbers + (+btn.dataset.d))); render(); return; }
    if (act === "other") { state.picker = state.picker ? null : state.step === 1 ? "biz" : "client"; render(); if (state.picker) $("#pick-select")?.focus(); return; }
    if (act === "pick") {
      const iso = btn.dataset.iso;
      if (state.step === 1) { state.biz = iso; state.picker = null; }
      else {
        const i = state.countries.findIndex((c) => c.iso === iso);
        if (i >= 0) state.countries.splice(i, 1);
        else state.countries.push({ iso, mode: "people", people: 100, exact: 0 });
      }
      render(); return;
    }
    if (act === "replies") { state.replies = +btn.dataset.v; render(); return; }
    if (act === "mode") { const c = state.countries.find((c) => c.iso === btn.closest(".ccard").dataset.iso); c.mode = btn.dataset.mode; if (c.mode === "exact" && !c.exact) c.exact = msgsOf({ ...c, mode: "people" }); render(); return; }
    if (act === "remove") { const iso = btn.closest(".ccard").dataset.iso; state.countries = state.countries.filter((c) => c.iso !== iso); render(); return; }
    if (act === "pdf") { window.print(); return; }
    if (act === "share") {
      writeUrl();
      try { await navigator.clipboard.writeText(location.href); $("#share-msg").textContent = "Link copiado. Quien lo abra verá exactamente este escenario."; }
      catch { $("#share-msg").textContent = location.href; }
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.dataset.act === "pick-select" && e.target.value) {
      const iso = e.target.value;
      if (state.step === 1) state.biz = iso;
      else if (!state.countries.some((c) => c.iso === iso)) state.countries.push({ iso, mode: "people", people: 100, exact: 0 });
      state.picker = null; render();
    }
  });
  root.addEventListener("input", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
    if (k === "replies") { if (v >= 1) { state.replies = v; refreshCounts(); } return; }
    if (k === "utility") { state.utility = v; return; }
    if (k === "marketing") { state.marketing = v; return; }
    const c = state.countries.find((c) => c.iso === e.target.closest(".ccard").dataset.iso); if (!c) return;
    c[k] = v;
    // sincroniza slider <-> número sin re-renderizar todo (para no perder el foco)
    const card = e.target.closest(".ccard");
    card.querySelectorAll(`[data-k="${k}"]`).forEach((el) => { if (el !== e.target) el.value = k === "people" && el.type === "range" ? Math.min(v, PEOPLE_MAX) : v; });
    refreshCounts();
  });
}
function refreshCounts() {
  document.querySelectorAll("#calc .ccard").forEach((card) => {
    const c = state.countries.find((x) => x.iso === card.dataset.iso); if (!c) return;
    const m = msgsOf(c);
    const b = card.querySelector(".val b"); if (b) b.textContent = fmtInt(m);
    const est = card.querySelector(".row .meta strong"); if (est) est.textContent = fmtInt(m);
    const lbl = card.querySelector(".row .meta"); if (lbl && c.mode === "people") lbl.innerHTML = `personas × ${state.replies} respuestas ≈ <strong class="mono" style="color:var(--ink)">${fmtInt(m)}</strong> mensajes`;
  });
  document.querySelectorAll("#calc .chips .chip").forEach((ch) => ch.classList.toggle("on", +ch.dataset.v === state.replies));
  writeUrl();
}

// ---------- secciones estáticas alimentadas por datos ----------
function renderRatesTable() {
  const usd = DATA.rates.USD;
  const head = `<thead><tr><th>Mercado</th><th class="num">Servicio · utilidad · autenticación</th><th class="num">Marketing</th></tr></thead>`;
  const row = (m, r, iso) => `<tr><td><span style="display:inline-flex;align-items:center;gap:8px">${iso ? flag(iso, "sm") : ""}${esc(DATA.marketNames[m])}</span></td><td class="num">${rate(r.service, "USD")}</td><td class="num">${rate(r.marketing, "USD")}</td></tr>`;
  const top = [["Colombia", "CO"], ["North America", "US"], ["Brazil", "BR"], ["Mexico", "MX"], ["Rest of Latin America", null], ["Spain", "ES"], ["Chile", "CL"], ["Argentina", "AR"], ["Peru", "PE"]];
  $("#rates-top").innerHTML = head + `<tbody>${top.map(([m, iso]) => row(m, usd[m], iso)).join("")}</tbody>`;
  const all = Object.entries(usd).sort((a, b) => a[1].service - b[1].service || a[0].localeCompare(b[0]));
  $("#rates-table").innerHTML = head + `<tbody>${all.map(([m, r]) => row(m, r, null)).join("")}</tbody>`;
}

const FAQ = [
  ["¿Qué cambia exactamente el 1 de octubre de 2026?", "Meta empieza a cobrar por cada mensaje de servicio: las respuestas libres (texto, audio, imagen, botones) que tu negocio envía dentro de la ventana de 24 horas después de que un cliente te escribe. Eran gratis desde noviembre de 2024. También vuelven a cobrarse las plantillas de utilidad enviadas dentro de esa ventana, gratis desde julio de 2025."],
  ["¿Qué es un mensaje de servicio?", "Cualquier mensaje que no es plantilla y que mandas como respuesta dentro de la ventana de 24 horas. Lo puede escribir una persona, tu chatbot o una IA de terceros. Meta solo cobra los que se entregan al cliente. Los que el cliente te manda a ti nunca se cobran."],
  ["¿Cómo funcionan los 1,000 mensajes gratis?", "Cada número de teléfono de WhatsApp Business recibe 1,000 mensajes de servicio gratis por mes calendario. Meta cobra a partir del mensaje 1,001 entregado. Los que no uses no pasan al mes siguiente. Es por número, no por cuenta: dos números tienen 2,000. No aplica a plantillas de utilidad, marketing ni autenticación."],
  ["¿Sigue existiendo la ventana de 24 horas?", "Sí, exactamente igual. Se abre cuando el cliente te escribe y se reinicia con cada mensaje suyo. Dentro de ella puedes responder con mensajes libres; fuera de ella solo con plantillas. Lo único que cambia es que esas respuestas libres ahora se cobran."],
  ["¿Por qué pago la tarifa del país de mi cliente y no la del mío?", "Porque Meta fija el precio según el código de país del número de WhatsApp que recibe el mensaje. Un negocio en México que responde a un cliente en Brasil paga la tarifa de Brasil ($0.0068 USD), no la de México ($0.0085 USD). Tu ubicación solo define en qué moneda te factura Meta."],
  ["¿Cuánto cuesta cada respuesta?", "Depende del país del cliente. Ejemplos en USD: Colombia $0.0008, Estados Unidos $0.0034, Brasil $0.0068, México $0.0085, España $0.02, Argentina $0.026, Perú $0.03. En cada país la tarifa de servicio es la misma que la de utilidad y autenticación. No hay descuentos por volumen para mensajes de servicio."],
  ["¿Me cobran los mensajes que recibo?", "No. Meta cobra únicamente mensajes de la empresa hacia el usuario, y solo cuando se entregan. Lo que el cliente te escribe es gratis siempre."],
  ["¿Qué pasa si no registro un método de pago antes del 30 de septiembre?", "Meta dejará de entregar tus mensajes de servicio a partir del 1 de octubre, aunque estés por debajo de los 1,000 gratis. Si trabajas con un proveedor, confirma con ellos que la cuenta tenga método de pago."],
  ["¿Aplica si uso un proveedor como Wati, YCloud, Twilio o 360dialog?", "Sí. El cobro es de Meta y aplica a todas las cuentas de WhatsApp Business API, sin importar el proveedor. El proveedor puede además agregar su propio margen o cuota mensual, así que revisa su lista de precios."],
  ["¿Los anuncios de clic a WhatsApp siguen dando mensajes gratis?", "Sí. Si el cliente te escribe desde un anuncio de clic a WhatsApp o un botón de llamada a la acción de Facebook, y le respondes dentro de 24 horas, se abre una ventana de 72 horas en la que todos tus mensajes son gratis. Esto no cambia."],
  ["¿Estas tarifas son oficiales?", "Sí. Salen del rate card que Meta publicó el 1 de septiembre de 2026 para las tarifas vigentes a partir del 1 de octubre de 2026, en USD y en 15 monedas locales. Los enlaces están en la sección de fuentes. Meta puede actualizar tarifas cada trimestre (1 de enero, abril, julio y octubre)."],
];
function renderFaq() {
  $("#faq").innerHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  $("#faq-jsonld").textContent = JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });
}
function countdown() {
  const days = Math.ceil((new Date("2026-10-01T00:00:00") - Date.now()) / 86400000);
  $("#countdown").textContent = days > 0 ? `Faltan ${days} días` : days === 0 ? "Hoy entra en vigor" : "Ya está en vigor";
}

const cameWithScenario = new URLSearchParams(location.search).has("s");
readUrl();
bind();
render();
renderRatesTable();
renderFaq();
countdown();
// Un link compartido abre directo en la calculadora; la portada limpia arranca arriba.
if (cameWithScenario) requestAnimationFrame(() => $("#calc").scrollIntoView({ block: "start" }));
