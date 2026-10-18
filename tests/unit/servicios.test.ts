import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moduleStatuses, MODULES } from "@/lib/modules";
import {
  checkDeposit,
  createServiceSchema,
  formatDuration,
  patchServiceSchema,
  type ServiceDto,
} from "@/lib/servicios";
import { buildAgentSystemPrompt, renderServicios } from "@/server/ai/prompts";
import { parseServiciosFlag } from "@/server/servicios/flag";

/**
 * 031 — Módulo de Servicios: la bandera, las reglas del catálogo, lo que lee
 * el agente y quién puede tocar qué. Sin base de datos: el store se simula.
 */

const store = vi.hoisted(() => ({
  listServices: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
}));
vi.mock("@/server/servicios/store", () => store);

const { handleCreate, handleDelete, handleList, handlePatch } = await import(
  "@/server/servicios/http"
);

const svc = (over: Partial<ServiceDto> = {}): ServiceDto => ({
  id: "sv_1",
  name: "Limpieza facial",
  description: null,
  priceCents: 1_500_000,
  durationMinutes: 60,
  depositCents: 500_000,
  active: true,
  position: 0,
  ...over,
});

describe("parseServiciosFlag", () => {
  it("apagado por defecto y ante cualquier valor raro", () => {
    for (const v of [undefined, "", "  ", "off", "0", "no", "servicios", "onn"]) {
      expect(parseServiciosFlag(v)).toBe(false);
    }
  });

  it("se enciende con las mismas formas de decir que sí que la agenda", () => {
    for (const v of ["on", " ON ", "1", "true", "si", "sí", "yes"]) {
      expect(parseServiciosFlag(v)).toBe(true);
    }
  });
});

describe("reglas del catálogo", () => {
  it("un servicio válido con seña menor al precio", () => {
    const r = createServiceSchema.safeParse({
      name: "  Corte  ",
      priceCents: 800_000,
      durationMinutes: 45,
      depositCents: 200_000,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Corte");
  });

  it("la seña nunca supera el precio", () => {
    const r = createServiceSchema.safeParse({ name: "X", priceCents: 1000, depositCents: 1001 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["depositCents"]);
  });

  it("precio entero y no negativo; nombre obligatorio", () => {
    expect(createServiceSchema.safeParse({ name: "X", priceCents: -1 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ name: "X", priceCents: 10.5 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ name: "   ", priceCents: 100 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ name: "Gratis", priceCents: 0 }).success).toBe(true);
  });

  it("una edición vacía no es una edición", () => {
    expect(patchServiceSchema.safeParse({}).success).toBe(false);
    expect(patchServiceSchema.safeParse({ active: false }).success).toBe(true);
  });

  it("checkDeposit mira la combinación final, no solo lo que llega", () => {
    const actual = { priceCents: 10_000, depositCents: 4_000 };
    expect(checkDeposit(actual, { priceCents: 3_000 })).toBe(false); // bajar el precio por debajo de la seña
    expect(checkDeposit(actual, { priceCents: 3_000, depositCents: null })).toBe(true); // quitando la seña
    expect(checkDeposit(actual, { depositCents: 10_001 })).toBe(false);
    expect(checkDeposit(actual, { depositCents: 10_000 })).toBe(true);
    expect(checkDeposit({ priceCents: 500, depositCents: null }, { name: "x" } as never)).toBe(true);
  });

  it("formatDuration", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
  });
});

describe("lo que lee el agente", () => {
  type Profile = Parameters<typeof buildAgentSystemPrompt>[0]["profile"];
  const profile = { name: "Sofía", tone: null, instructions: null, escalationRules: null, greeting: null } as unknown as Profile;

  it("cada servicio activo con precio, duración, seña y saldo ya calculados", () => {
    const text = renderServicios([svc()], "ARS");
    expect(text).toMatch(/^- Limpieza facial: /);
    expect(text).toContain("dura 1 h");
    expect(text).toMatch(/seña para reservar .*5,000\.00.* \(saldo .*10,000\.00\)/);
  });

  it("un servicio pausado no se ofrece; sin activos no hay catálogo", () => {
    expect(renderServicios([svc({ active: false })], "ARS")).toBe("");
    const text = renderServicios([svc(), svc({ id: "sv_2", name: "Masaje", active: false })], "ARS");
    expect(text).not.toContain("Masaje");
  });

  it("el prompt incluye el catálogo solo si el módulo lo entrega", () => {
    const sin = buildAgentSystemPrompt({ profile, kb: [], stages: [{ name: "Nuevo" }] });
    expect(sin).not.toContain("CATÁLOGO DE SERVICIOS");
    const con = buildAgentSystemPrompt({
      profile,
      kb: [],
      stages: [{ name: "Nuevo" }],
      servicios: { services: [svc()], currency: "ARS" },
    });
    expect(con).toContain("CATÁLOGO DE SERVICIOS");
    expect(con).toContain("Limpieza facial");
    // Catálogo vacío = como si no existiera: ni el encabezado.
    const vacio = buildAgentSystemPrompt({
      profile,
      kb: [],
      stages: [{ name: "Nuevo" }],
      servicios: { services: [], currency: "ARS" },
    });
    expect(vacio).not.toContain("CATÁLOGO DE SERVICIOS");
  });
});

describe("catálogo de módulos", () => {
  it("cada módulo dice cómo se enciende y a dónde lleva", () => {
    for (const m of MODULES) {
      expect(m.variable).toMatch(/^[A-Z]+=on$/);
      expect(m.href.startsWith("/")).toBe(true);
    }
    expect(MODULES.map((m) => m.id)).toContain("servicios");
  });

  it("el estado sale de las banderas, no del catálogo", () => {
    const st = moduleStatuses({ servicios: true, agenda: false, atribucion: false });
    expect(st.find((m) => m.id === "servicios")?.enabled).toBe(true);
    expect(st.find((m) => m.id === "agenda")?.enabled).toBe(false);
  });
});

describe("/api/services", () => {
  const owner = { userId: "u1", organizationId: "org_1", role: "owner" };
  const member = { ...owner, role: "member" };
  const json = (body: unknown) =>
    new Request("http://x/api/services", { method: "POST", body: JSON.stringify(body) });

  beforeEach(() => {
    process.env.SERVICIOS = "on";
    Object.values(store).forEach((f) => f.mockReset());
  });
  afterEach(() => {
    delete process.env.SERVICIOS;
  });

  it("apagado, toda la superficie es 404", async () => {
    delete process.env.SERVICIOS;
    expect((await handleList(owner)).status).toBe(404);
    expect((await handleCreate(owner, json({ name: "X", priceCents: 1 }))).status).toBe(404);
    expect((await handlePatch(owner, json({ active: true }), "sv_1")).status).toBe(404);
    expect((await handleDelete(owner, "sv_1")).status).toBe(404);
    expect(store.listServices).not.toHaveBeenCalled();
  });

  it("el equipo lee el catálogo, pero solo quien configura lo cambia", async () => {
    store.listServices.mockResolvedValue([svc()]);
    const list = await handleList(member);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ services: [svc()] });
    expect(store.listServices).toHaveBeenCalledWith("org_1");

    expect((await handleCreate(member, json({ name: "X", priceCents: 1 }))).status).toBe(403);
    expect((await handlePatch(member, json({ active: false }), "sv_1")).status).toBe(403);
    expect((await handleDelete(member, "sv_1")).status).toBe(403);
    expect(store.createService).not.toHaveBeenCalled();
  });

  it("crear valida y responde 201 con el servicio", async () => {
    store.createService.mockResolvedValue(svc());
    const ok = await handleCreate(owner, json({ name: "Limpieza facial", priceCents: 1_500_000 }));
    expect(ok.status).toBe(201);
    expect(store.createService).toHaveBeenCalledWith("org_1", expect.objectContaining({ name: "Limpieza facial" }));

    const mal = await handleCreate(owner, json({ name: "X", priceCents: 100, depositCents: 200 }));
    expect(mal.status).toBe(422);
  });

  it("editar: seña mayor al precio guardado es 422; otro tenant es 404", async () => {
    store.updateService.mockResolvedValueOnce({ ok: false, reason: "deposit_exceeds_price" });
    expect((await handlePatch(owner, json({ depositCents: 99 }), "sv_1")).status).toBe(422);
    store.updateService.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await handlePatch(owner, json({ active: false }), "sv_otro")).status).toBe(404);
    store.updateService.mockResolvedValueOnce({ ok: true, service: svc({ active: false }) });
    const ok = await handlePatch(owner, json({ active: false }), "sv_1");
    expect(ok.status).toBe(200);
  });

  it("borrar algo que no existe es 404", async () => {
    store.deleteService.mockResolvedValueOnce(false);
    expect((await handleDelete(owner, "sv_x")).status).toBe(404);
    store.deleteService.mockResolvedValueOnce(true);
    expect((await handleDelete(owner, "sv_1")).status).toBe(200);
  });
});
