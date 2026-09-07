import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, estimateMessages, messagesFromPeople, freeAllowance, distributeTemplates, scenarios, SCENARIOS } from "../public/calc.js";
import { DATA } from "../public/data.js";

const USD = DATA.rates.USD;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("rate card oficial: servicio = utilidad = autenticación por mercado", () => {
  for (const [m, r] of Object.entries(USD)) {
    assert.equal(r.service, r.utility, m);
    assert.equal(r.service, r.authentication, m);
  }
  assert.equal(USD.Mexico.service, 0.0085);
  assert.equal(USD.Brazil.service, 0.0068);
  assert.equal(USD.Colombia.service, 0.0008);
  assert.equal(USD.Peru.service, 0.03);
  assert.equal(USD["North America"].service, 0.0034);
  assert.equal(USD.Mexico.marketing, 0.0397); // subió el 1 oct (antes 0.0305)
  assert.equal(Object.keys(USD).length, 47);
});

test("todos los países mapean a un mercado con tarifa en las 16 monedas", () => {
  assert.equal(Object.keys(DATA.rates).length, 16);
  for (const c of DATA.countries) {
    for (const cur of Object.keys(DATA.rates)) {
      assert.ok(DATA.rates[cur][c.market], `${c.iso} -> ${c.market} (${cur})`);
    }
    if (c.cur) assert.ok(DATA.rates[c.cur], c.iso);
  }
});

test("por debajo de 1,000 mensajes con 1 número: $0", () => {
  const r = calculate({ rows: [{ market: "Mexico", service: 1000 }], numbers: 1, rates: USD });
  assert.equal(r.billableService, 0);
  assert.equal(r.newMonthly, 0);
  assert.equal(r.freeUsed, 1000);
  assert.equal(r.freeLeft, 0);
});

test("ejemplo SendPulse: 3,000 mensajes a Brasil → 2,000 cobrables × 0.0068 = 13.60", () => {
  const r = calculate({ rows: [{ market: "Brazil", service: 3000 }], numbers: 1, rates: USD });
  assert.equal(r.billableService, 2000);
  close(r.serviceCost, 13.6);
  close(r.newYearly, 13.6 * 12);
});

test("el nivel gratis es por número: 3 números = 3,000 gratis", () => {
  assert.equal(freeAllowance(3), 3000);
  const r = calculate({ rows: [{ market: "Mexico", service: 3000 }], numbers: 3, rates: USD });
  assert.equal(r.billableService, 0);
  const r2 = calculate({ rows: [{ market: "Mexico", service: 5000 }], numbers: 3, rates: USD });
  assert.equal(r2.billableService, 2000);
  close(r2.serviceCost, 2000 * 0.0085);
});

test("varios países: los gratis se reparten proporcionalmente", () => {
  const r = calculate({
    rows: [{ market: "Mexico", service: 3000 }, { market: "Colombia", service: 500 }],
    numbers: 1,
    rates: USD,
  });
  assert.equal(r.totalService, 3500);
  assert.equal(r.billableService, 2500);
  close(r.perRow[0].serviceBillable, 3000 * 2500 / 3500);
  close(r.serviceCost, (3000 * 2500 / 3500) * 0.0085 + (500 * 2500 / 3500) * 0.0008);
  close(r.newMonthly, 18.5, 0.005);
});

test("la tarifa es la del país del CLIENTE (Brasil), no la del negocio", () => {
  const r = calculate({ rows: [{ market: "Brazil", service: 11000 }], numbers: 1, rates: USD });
  close(r.serviceCost, 10000 * USD.Brazil.service);
  assert.notEqual(r.serviceCost, 10000 * USD.Mexico.service);
});

test("plantillas de utilidad en ventana: se cobran completas (sin nivel gratis)", () => {
  const r = calculate({ rows: [{ market: "Mexico", service: 0, utility: 500 }], numbers: 1, rates: USD });
  close(r.utilityCost, 500 * 0.0085);
  close(r.newMonthly, 500 * 0.0085);
  assert.equal(r.serviceCost, 0);
});

test("marketing no cuenta como costo NUEVO pero sí en el total", () => {
  const r = calculate({ rows: [{ market: "Mexico", service: 0, marketing: 100 }], numbers: 1, rates: USD });
  assert.equal(r.newMonthly, 0);
  close(r.marketingCost, 100 * 0.0397);
  close(r.totalMonthly, 100 * 0.0397);
});

test("distributeTemplates reparte por proporción de servicio (o partes iguales)", () => {
  const rows = distributeTemplates([{ market: "Mexico", service: 3000 }, { market: "Colombia", service: 1000 }], 400, 40);
  close(rows[0].utility, 300); close(rows[1].utility, 100);
  close(rows[0].marketing, 30); close(rows[1].marketing, 10);
  const eq = distributeTemplates([{ market: "Mexico", service: 0 }, { market: "Colombia", service: 0 }], 100, 0);
  close(eq[0].utility, 50); close(eq[1].utility, 50);
});

test("escenarios: optimista 0.7×, conservador 1×, pesimista 1.5× sobre los mensajes de servicio", () => {
  assert.deepEqual(SCENARIOS.map((s) => s.factor), [0.7, 1, 1.5]);
  const s = scenarios({ rows: [{ market: "Mexico", service: 2000 }], numbers: 1, rates: USD });
  assert.equal(s[0].result.totalService, 1400);
  assert.equal(s[1].result.totalService, 2000);
  assert.equal(s[2].result.totalService, 3000);
  close(s[0].result.serviceCost, 400 * 0.0085);
  close(s[1].result.serviceCost, 1000 * 0.0085);
  close(s[2].result.serviceCost, 2000 * 0.0085);
  // el factor no toca plantillas
  const t = calculate({ rows: [{ market: "Mexico", service: 0, utility: 100 }], numbers: 1, rates: USD, factor: 1.5 });
  close(t.utilityCost, 100 * 0.0085);
});

test("estimación por personas × respuestas", () => {
  assert.equal(messagesFromPeople(500, 6), 3000);
  assert.equal(estimateMessages(400, 6), 2400);
  assert.equal(messagesFromPeople(-5, 3), 0);
});

test("entradas basura no rompen", () => {
  const r = calculate({ rows: [{ market: "Mexico", service: "abc" }, { market: "Narnia", service: 99 }], numbers: "x", rates: USD, factor: "zzz" });
  assert.equal(r.numbers, 1);
  assert.equal(r.factor, 1);
  assert.equal(r.totalService, 0);
  assert.equal(r.perRow.length, 1);
});

test("moneda local usa el rate card local de Meta (MXN)", () => {
  const MXN = DATA.rates.MXN;
  const r = calculate({ rows: [{ market: "Mexico", service: 2000 }], numbers: 1, rates: MXN });
  close(r.serviceCost, 1000 * MXN.Mexico.service);
  assert.ok(MXN.Mexico.service > USD.Mexico.service);
});
