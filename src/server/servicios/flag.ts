/**
 * 031 — Si esta instancia tiene el módulo de Servicios o no.
 *
 * Mismo trato que la agenda (ADR-002) y la atribución: el código viaja siempre
 * en `main` y lo que decide si EXISTE para el usuario es una variable de
 * despliegue. Una instancia sin `SERVICIOS` no ve el catálogo por ningún lado:
 * ni pantalla, ni rutas, ni una línea de precios en el prompt del agente.
 *
 * Servicios es el primer módulo «de negocio»: un catálogo de lo que el negocio
 * vende (nombre, precio, duración y seña). Es la base que reutilizan los
 * módulos que vienen detrás (señas y saldos en los turnos, membresías,
 * balance del mes), por eso va primero y va solo.
 *
 * La migración se aplica siempre: una tabla vacía es inerte, y a cambio todas
 * las instancias comparten la misma estructura.
 */

/** Valores que cuentan como "encendida". Cualquier otra cosa, apagada. */
const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

export function parseServiciosFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

/**
 * Se lee de `process.env` directo, no por `getEnv()`, igual que
 * `agendaEnabled()`: preguntar si una feature existe no puede depender de que
 * TODO el entorno valide. El turno del agente consulta esta bandera, y un
 * entorno a medio configurar debe degradar —no reventar— justo ahí.
 *
 * `SERVICIOS` sí está declarada en el esquema de `lib/env.ts`: ahí viven su
 * documentación y su tipo.
 */
export function serviciosEnabled(): boolean {
  return parseServiciosFlag(process.env.SERVICIOS);
}

/**
 * Respuesta para una superficie apagada. 404 y no 403 a propósito: si el
 * módulo no está encendido, ese endpoint no existe en esta instancia.
 */
export function serviciosDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}
