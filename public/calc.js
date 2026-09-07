// Lógica pura de la calculadora. Sin DOM, para poder testearla con node.
//
// Reglas (Meta, vigentes 1 oct 2026), fuente:
// https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#updates-to-rate-cards
//  - Meta cobra solo los mensajes que la EMPRESA entrega al cliente, no los que recibe.
//  - La tarifa depende del país del NÚMERO DEL CLIENTE (código de país), no del negocio.
//  - Mensajes de servicio (respuestas libres dentro de la ventana de 24 h): se cobran por
//    mensaje, a la misma tarifa que utilidad/autenticación de ese mercado. Sin descuentos por volumen.
//  - Nivel gratis: 1,000 mensajes de servicio al mes POR NÚMERO de teléfono de la empresa.
//    No se acumulan; se reinician cada mes. Solo aplica a mensajes de servicio.
//  - Plantillas de utilidad enviadas dentro de la ventana de 24 h: dejan de ser gratis, se cobran
//    a la tarifa de utilidad (tienen niveles de volumen, pero arrancan en 100k+ msgs/mes,
//    así que aquí se usa la tarifa de lista).
//  - Marketing y autenticación: ya se cobraban; no cambian de modelo (algunas tarifas sí suben).
//  - Ventana de 72 h por anuncios "clic a WhatsApp" / botones de Facebook: sigue gratis.

export const FREE_SERVICE_PER_NUMBER = 1000;

/** Escenarios: multiplican los mensajes de servicio estimados. */
export const SCENARIOS = [
  { id: "optimista", label: "Optimista", factor: 0.7, desc: "30% menos respuestas que tu estimado: clientes que resuelven rápido y un chatbot que contesta en un solo mensaje." },
  { id: "conservador", label: "Conservador", factor: 1, desc: "Tu estimado tal cual. Es el número que deberías presupuestar." },
  { id: "pesimista", label: "Pesimista", factor: 1.5, desc: "50% más respuestas: temporada alta, conversaciones largas o un bot que manda varias burbujas por respuesta." },
];

/** Mensajes de servicio/mes a partir de personas atendidas y respuestas por conversación. */
export function messagesFromPeople(peoplePerMonth, repliesPerConversation) {
  return Math.round(nonNeg(peoplePerMonth) * nonNeg(repliesPerConversation));
}

/** Alias histórico. */
export const estimateMessages = messagesFromPeople;

/** Cuántos mensajes de servicio caben gratis con N números. */
export function freeAllowance(numbers, freePerNumber = FREE_SERVICE_PER_NUMBER) {
  return Math.max(1, Math.floor(Number(numbers) || 1)) * freePerNumber;
}

/**
 * Reparte totales de plantillas (utilidad en ventana, marketing) entre países en proporción
 * a sus mensajes de servicio (o en partes iguales si no hay servicio).
 */
export function distributeTemplates(rows, utilityTotal = 0, marketingTotal = 0) {
  const u = nonNeg(utilityTotal), m = nonNeg(marketingTotal);
  const total = rows.reduce((a, r) => a + nonNeg(r.service), 0);
  const n = rows.length || 1;
  return rows.map((r) => {
    const share = total > 0 ? nonNeg(r.service) / total : 1 / n;
    return { ...r, utility: u * share, marketing: m * share };
  });
}

/**
 * @param {object} p
 * @param {Array<{market:string, service:number, utility?:number, marketing?:number}>} p.rows
 *        Una fila por país de clientes. `market` = clave del rate card (ej. "Mexico").
 *        `service` = mensajes de servicio enviados/mes a ese país.
 * @param {number} p.numbers  Cantidad de números de WhatsApp Business (líneas) del negocio.
 * @param {Record<string,{service:number,utility:number,marketing:number}>} p.rates  Rate card en UNA moneda.
 * @param {number} [p.freePerNumber]
 * @param {number} [p.factor]  Multiplica los mensajes de servicio (escenarios).
 */
export function calculate({ rows, numbers, rates, freePerNumber = FREE_SERVICE_PER_NUMBER, factor = 1 }) {
  const n = Math.max(1, Math.floor(Number(numbers) || 1));
  const f = Number.isFinite(Number(factor)) && Number(factor) > 0 ? Number(factor) : 1;
  const clean = rows
    .map((r) => ({
      market: r.market,
      service: Math.round(nonNeg(r.service) * f),
      utility: nonNeg(r.utility),
      marketing: nonNeg(r.marketing),
    }))
    .filter((r) => rates[r.market]);

  const totalService = clean.reduce((a, r) => a + r.service, 0);
  const freeAllowance = freePerNumber * n;
  const freeUsed = Math.min(totalService, freeAllowance);
  const billableService = Math.max(0, totalService - freeAllowance);
  // Los 1,000 gratis no distinguen país: se reparten proporcionalmente entre destinos.
  const billableShare = totalService > 0 ? billableService / totalService : 0;

  const perRow = clean.map((r) => {
    const rate = rates[r.market];
    const serviceBillable = r.service * billableShare;
    const serviceCost = serviceBillable * rate.service;
    const utilityCost = r.utility * rate.utility;
    const marketingCost = r.marketing * rate.marketing;
    return {
      market: r.market,
      service: r.service,
      serviceBillable,
      serviceRate: rate.service,
      serviceCost,
      utility: r.utility,
      utilityRate: rate.utility,
      utilityCost,
      marketing: r.marketing,
      marketingRate: rate.marketing,
      marketingCost,
      newCost: serviceCost + utilityCost, // lo que HOY es gratis y a partir del 1 oct se cobra
      totalCost: serviceCost + utilityCost + marketingCost,
    };
  });

  const sum = (k) => perRow.reduce((a, r) => a + r[k], 0);
  const serviceCost = sum("serviceCost");
  const utilityCost = sum("utilityCost");
  const marketingCost = sum("marketingCost");
  const newMonthly = serviceCost + utilityCost;

  return {
    numbers: n,
    factor: f,
    totalService,
    freeAllowance,
    freeUsed,
    freeLeft: Math.max(0, freeAllowance - totalService),
    billableService,
    serviceCost,
    utilityCost,
    marketingCost,
    newMonthly,
    newYearly: newMonthly * 12,
    totalMonthly: newMonthly + marketingCost,
    perRow,
  };
}

/** Corre los tres escenarios sobre los mismos datos. */
export function scenarios(params) {
  return SCENARIOS.map((s) => ({ ...s, result: calculate({ ...params, factor: s.factor }) }));
}

function nonNeg(v) {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}
