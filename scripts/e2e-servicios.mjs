/**
 * 031 — Arnés del módulo de Servicios contra la app viva (guion
 * tests/e2e/us-servicios.md). Requisitos: app corriendo con SERVICIOS=on y
 * una organización sin usuarios (o pasa E2E_EMAIL/E2E_PASSWORD de una
 * existente). Uso: node --env-file=.env scripts/e2e-servicios.mjs
 *
 * Sale con 1 si algo falla. Con SHOTS_DIR guarda capturas de cada paso.
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "duenio@demo.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "clave-de-prueba-123";
const SHOTS = process.env.SHOTS_DIR;

let fallas = 0;
function check(cond, msg) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallas++;
}

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, locale: "es-AR" });
/** Espera a que una condición se cumpla (no a que pase un tiempo fijo). */
async function hasta(cond, ms = 15000) {
  const fin = Date.now() + ms;
  for (;;) {
    if (await cond().catch(() => false)) return true;
    if (Date.now() > fin) return false;
    await new Promise((r) => setTimeout(r, 300));
  }
}
const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });

try {
  // 1. Entrar: login si la cuenta ya existe; si no, el primer registro.
  const fuera = (u) => !/\/(register|login)/.test(u.pathname);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  const entro = await page.waitForURL(fuera, { timeout: 30000 }).then(() => true, () => false);
  if (!entro) {
    await page.goto(`${BASE}/register`);
    await page.fill("#name", "Dueña Demo");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(fuera, { timeout: 20000 });
  }

  const call = (path, method = "GET", body) =>
    page.evaluate(
      async ([path, method, body]) => {
        const r = await fetch(path, {
          method,
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        let json = null;
        try { json = await r.json(); } catch {}
        return { status: r.status, json };
      },
      [path, method, body]
    );
  // 2. Cargar la demo por API (misma ruta que el botón de la Bandeja).
  const seed = await page.evaluate(async () => {
    const r = await fetch("/api/seed/demo", { method: "POST" });
    return r.status;
  });
  // 409 = la organización ya tenía datos (corrida repetida): la demo sigue ahí.
  check([200, 201, 409].includes(seed), `la demo está cargada (HTTP ${seed})`);

  // 3. El menú tiene el grupo Negocio con Servicios.
  await page.goto(`${BASE}/services`);
  await page.waitForSelector('[data-testid="service-row"]', { timeout: 15000 });
  check(await page.getByRole("link", { name: "Servicios" }).first().isVisible(), "«Servicios» aparece en el menú");
  const filas = await page.locator('[data-testid="service-row"]').count();
  check(filas === 5, `la demo trae 5 servicios (hay ${filas})`);
  check(await page.getByText("Pausado").first().isVisible(), "el servicio pausado se ve como Pausado");
  check(await page.getByText(/Seña .* · saldo /).first().isVisible(), "seña y saldo calculados en pantalla");
  await shot("01-catalogo");

  // 4. Camino infeliz: seña mayor que el precio.
  await page.getByRole("button", { name: "Nuevo servicio" }).click();
  await page.fill("#sv-name", "Limpieza facial profunda");
  await page.fill("#sv-price", "15000");
  await page.fill("#sv-duration", "60");
  await page.fill("#sv-deposit", "20000");
  await page.getByRole("button", { name: "Guardar" }).click();
  const alerta = page.locator("form [role=alert]");
  await alerta.waitFor({ timeout: 5000 });
  check(/seña no puede ser mayor/i.test((await alerta.textContent()) ?? ""), "rechaza una seña mayor que el precio");
  await shot("02-error-sena");

  // 5. Corregir y guardar.
  await page.fill("#sv-deposit", "5000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Limpieza facial profunda").waitFor({ timeout: 10000 });
  check((await page.locator('[data-testid="service-row"]').count()) === 6, "el servicio nuevo se agrega al final");
  await shot("03-creado");

  // 6. La API rechaza lo mismo aunque se saltee la pantalla.
  const api = await page.evaluate(async () => {
    const r = await fetch("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Trampa", priceCents: 100, depositCents: 500 }),
    });
    return r.status;
  });
  check(api === 422, `la API también rechaza seña > precio (HTTP ${api})`);

  // 7. Editar el precio.
  await page.getByRole("button", { name: "Editar Limpieza facial profunda" }).click();
  await page.fill("#sv-price", "18000");
  await page.getByRole("button", { name: "Guardar" }).click();
  const fila = page.locator('[data-testid="service-row"]', { hasText: "Limpieza facial profunda" });
  const texto = async () => (await fila.textContent()) ?? "";
  check(await hasta(async () => /18,000\.00/.test(await texto())), "el precio editado se ve en el renglón");
  check(/saldo .*13,000\.00/.test(await texto()), "el saldo se recalcula (18.000 − 5.000)");

  // 8. Pausar y reactivar.
  await fila.getByRole("switch").click();
  check(await hasta(async () => (await fila.getByText("Pausado").count()) === 1), "pausar marca el servicio como Pausado");
  // Que el guardado llegue antes de volver a tocar (el refetch confirma).
  await hasta(async () => (await call("/api/services")).json?.services?.some((x) => x.name === "Limpieza facial profunda" && !x.active));
  await fila.getByRole("switch").click();
  check(await hasta(async () => (await fila.getByText("Pausado").count()) === 0), "reactivar lo saca de Pausado");

  // 9. Borrar con confirmación en el renglón.
  await fila.getByRole("button", { name: "Eliminar Limpieza facial profunda" }).click();
  await shot("04-confirmar-borrado");
  await fila.getByRole("button", { name: "Eliminar", exact: true }).click();
  check(await hasta(async () => (await page.locator('[data-testid="service-row"]').count()) === 5), "borrar lo quita del catálogo");

  // 10. Ajustes → Módulos dice qué está encendido.
  await page.goto(`${BASE}/settings/modules`);
  const servicios = page.locator('[data-testid="module-servicios"]');
  await servicios.waitFor();
  check(/Encendido/.test((await servicios.textContent()) ?? ""), "Módulos muestra Servicios encendido");
  const agenda = page.locator('[data-testid="module-agenda"]');
  check(/AGENDA=on/.test((await agenda.textContent()) ?? ""), "un módulo apagado dice cómo encenderse");
  await shot("05-modulos");

  // 11. El agente cotiza desde el catálogo (WhatsApp y IA simulados: requiere
  //     WA_MOCK_ENABLED, META_GRAPH_BASE_URL y OPENROUTER_BASE_URL a los mocks).
  const PN = "PN-SERVICIOS-1";
  const conn = await call("/api/settings/whatsapp", "PUT", { wabaId: "WABA-SV", phoneNumberId: PN, token: "tok-servicios" });
  check(conn.status === 200, `WhatsApp simulado conectado (HTTP ${conn.status} ${JSON.stringify(conn.json)})`);
  await call("/api/agent/profile", "PUT", { enabled: true });
  await call("/api/dev/wa-mock/outbox", "DELETE");

  const pedir = async (from, text) => {
    await call("/api/dev/wa-mock/inbound", "POST", {
      phoneNumberId: PN,
      from,
      name: "Cliente Servicios",
      text,
      waMessageId: `wamid.sv.${from}.${Date.now()}`,
    });
    const fin = Date.now() + 30000;
    while (Date.now() < fin) {
      const out = (await call("/api/dev/wa-mock/outbox")).json?.outbox ?? [];
      const mio = out.filter((m) => JSON.stringify(m).includes(from.slice(-6)));
      if (mio.length) return JSON.stringify(mio[mio.length - 1]);
      await page.waitForTimeout(500);
    }
    return "";
  };

  const cuerpo = (raw) => { try { return JSON.parse(raw).body?.text?.body ?? raw; } catch { return raw; } };
  const precio = await pedir("5215599990001", "Hola, ¿cuánto sale el duplicado de llaves?");
  check(precio.includes("Duplicado de llaves") && precio.includes("45.00"),
    `el agente responde el precio del catálogo: «${cuerpo(precio)}»`);
  const pausado = await pedir("5215599990002", "¿Cuánto sale la renta del rotomartillo?");
  check(pausado !== "" && !pausado.includes("350"),
    `un servicio pausado no se cotiza: «${cuerpo(pausado)}»`);
} catch (err) {
  console.error("✗ el arnés se cortó:", err);
  fallas++;
  await shot("99-error");
} finally {
  await browser.close();
}

console.log(fallas === 0 ? "\nTodo verde." : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
