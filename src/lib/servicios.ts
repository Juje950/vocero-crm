import { z } from "zod";

/**
 * 031 — Módulo de Servicios: la forma de un servicio y sus reglas.
 *
 * Vive en `lib/` (sin BD) porque lo usan los dos lados: la ruta valida con
 * estos esquemas y la pantalla muestra los mismos mensajes. Todo el dinero en
 * centavos enteros (ver `lib/money.ts`).
 */

/** Tope para que un dedazo no guarde un servicio de mil millones. */
export const MAX_PRICE_CENTS = 100_000_000_00;
/** Una jornada larga; más que esto no es un servicio, es un proyecto. */
export const MAX_DURATION_MINUTES = 24 * 60;

const nombre = z.string().trim().min(1, "El nombre es obligatorio").max(120);
const descripcion = z.string().trim().max(1000);
const precio = z
  .number()
  .int("El precio va en centavos enteros")
  .min(0, "El precio no puede ser negativo")
  .max(MAX_PRICE_CENTS);
const duracion = z.number().int().min(1).max(MAX_DURATION_MINUTES);
const sena = z.number().int().min(0).max(MAX_PRICE_CENTS);

export const SENA_SUPERA_PRECIO = "La seña no puede ser mayor que el precio";

export const createServiceSchema = z
  .object({
    name: nombre,
    description: descripcion.nullish(),
    priceCents: precio,
    durationMinutes: duracion.nullish(),
    depositCents: sena.nullish(),
    active: z.boolean().optional(),
  })
  .refine((s) => s.depositCents == null || s.depositCents <= s.priceCents, {
    message: SENA_SUPERA_PRECIO,
    path: ["depositCents"],
  });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Edición parcial. La regla seña ≤ precio no se puede validar aquí cuando
 * solo llega uno de los dos: la valida `checkDeposit` contra la fila guardada,
 * y el CHECK de la tabla es la última línea.
 */
export const patchServiceSchema = z
  .object({
    name: nombre.optional(),
    description: descripcion.nullish(),
    priceCents: precio.optional(),
    durationMinutes: duracion.nullish(),
    depositCents: sena.nullish(),
    active: z.boolean().optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: "Nada que cambiar" });

export type PatchServiceInput = z.infer<typeof patchServiceSchema>;

/** ¿La combinación final (lo guardado + el cambio) respeta seña ≤ precio? */
export function checkDeposit(
  current: { priceCents: number; depositCents: number | null },
  patch: { priceCents?: number; depositCents?: number | null }
): boolean {
  const price = patch.priceCents ?? current.priceCents;
  const deposit =
    patch.depositCents === undefined ? current.depositCents : patch.depositCents;
  return deposit === null || deposit <= price;
}

/** Lo que viaja a la pantalla (fechas como texto ISO). */
export type ServiceDto = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number | null;
  depositCents: number | null;
  active: boolean;
  position: number;
};

/** "1 h 30 min", "45 min", "2 h". Nulo si no tiene duración. */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
