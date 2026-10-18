/**
 * 031 — Catálogo de módulos opcionales de la instancia.
 *
 * Cada módulo es una bandera de despliegue (ADR-001/002): apagado por defecto,
 * su superficie responde 404 y su migración se aplica igual. Este catálogo no
 * decide nada —lo deciden las banderas, leídas en el servidor—; solo le da a
 * cada una un nombre, una explicación y la variable que la enciende, para que
 * Ajustes → Módulos pueda decirle al dueño qué tiene y qué podría tener.
 *
 * Agregar un módulo es agregar un renglón aquí, su `flag.ts` y su lectura en
 * `src/server/modules.ts`. Los canales (`CHANNELS`) no van aquí: un canal es
 * por dónde entran los mensajes, no algo que el negocio gestiona.
 */

export type ModuleId = "servicios" | "agenda" | "atribucion";

export type ModuleInfo = {
  id: ModuleId;
  nombre: string;
  descripcion: string;
  /** La variable de entorno que lo enciende, con el valor de ejemplo. */
  variable: string;
  /** A dónde lleva cuando está encendido. */
  href: string;
};

export const MODULES: readonly ModuleInfo[] = [
  {
    id: "servicios",
    nombre: "Servicios",
    descripcion:
      "Catálogo de lo que vendés, con precio, duración y seña. El agente lo usa para responder precios sin inventar.",
    variable: "SERVICIOS=on",
    href: "/services",
  },
  {
    id: "agenda",
    nombre: "Agenda",
    descripcion:
      "Turnos con horarios reales: el agente ofrece huecos libres y reserva el que elige el cliente.",
    variable: "AGENDA=on",
    href: "/bookings",
  },
  {
    id: "atribucion",
    nombre: "Atribución de anuncios",
    descripcion:
      "Registra de qué anuncio vino cada venta y se lo reporta a Meta para optimizar campañas.",
    variable: "ATRIBUCION=on",
    href: "/settings/ads",
  },
];

export type ModuleStatus = ModuleInfo & { enabled: boolean };

export function moduleStatuses(enabled: Record<ModuleId, boolean>): ModuleStatus[] {
  return MODULES.map((m) => ({ ...m, enabled: enabled[m.id] }));
}
