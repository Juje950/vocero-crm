import { asc, eq, max } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import {
  checkDeposit,
  type CreateServiceInput,
  type PatchServiceInput,
  type ServiceDto,
} from "@/lib/servicios";

/**
 * 031 — Lectura y escritura del catálogo de servicios. Toda consulta pasa por
 * `scoped()`: un servicio de otra organización no existe (404), no está
 * prohibido (403).
 */

type ServiceRow = typeof schema.service.$inferSelect;

export function toServiceDto(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    durationMinutes: row.durationMinutes,
    depositCents: row.depositCents,
    active: row.active,
    position: row.position,
  };
}

export async function listServices(
  organizationId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ServiceDto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.service)
    .where(
      opts.activeOnly
        ? scoped(schema.service.organizationId, organizationId, eq(schema.service.active, true))
        : scoped(schema.service.organizationId, organizationId)
    )
    .orderBy(asc(schema.service.position), asc(schema.service.createdAt));
  return rows.map(toServiceDto);
}

export async function createService(
  organizationId: string,
  input: CreateServiceInput
): Promise<ServiceDto> {
  const db = getDb();
  // Al final de la lista: lo nuevo no desordena lo que el dueño ya acomodó.
  const [last] = await db
    .select({ pos: max(schema.service.position) })
    .from(schema.service)
    .where(scoped(schema.service.organizationId, organizationId));
  const [row] = await db
    .insert(schema.service)
    .values({
      id: newId("service"),
      organizationId,
      name: input.name,
      description: input.description || null,
      priceCents: input.priceCents,
      durationMinutes: input.durationMinutes ?? null,
      depositCents: input.depositCents ?? null,
      active: input.active ?? true,
      position: (last?.pos ?? -1) + 1,
    })
    .returning();
  if (!row) throw new Error("No se pudo crear el servicio");
  return toServiceDto(row);
}

export type UpdateResult =
  | { ok: true; service: ServiceDto }
  | { ok: false; reason: "not_found" | "deposit_exceeds_price" };

export async function updateService(
  organizationId: string,
  id: string,
  patch: PatchServiceInput
): Promise<UpdateResult> {
  const db = getDb();
  const where = scoped(
    schema.service.organizationId,
    organizationId,
    eq(schema.service.id, id)
  );
  const [current] = await db.select().from(schema.service).where(where).limit(1);
  if (!current) return { ok: false, reason: "not_found" };
  if (!checkDeposit(current, patch)) return { ok: false, reason: "deposit_exceeds_price" };

  const [row] = await db
    .update(schema.service)
    .set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description || null }),
      ...(patch.priceCents !== undefined && { priceCents: patch.priceCents }),
      ...(patch.durationMinutes !== undefined && { durationMinutes: patch.durationMinutes }),
      ...(patch.depositCents !== undefined && { depositCents: patch.depositCents }),
      ...(patch.active !== undefined && { active: patch.active }),
      ...(patch.position !== undefined && { position: patch.position }),
      updatedAt: new Date(),
    })
    .where(where)
    .returning();
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, service: toServiceDto(row) };
}

export async function deleteService(organizationId: string, id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.service)
    .where(scoped(schema.service.organizationId, organizationId, eq(schema.service.id, id)))
    .returning({ id: schema.service.id });
  return deleted.length > 0;
}
