import { moduleStatuses, type ModuleId, type ModuleStatus } from "@/lib/modules";
import { agendaEnabled } from "@/server/agenda/flag";
import { atribucionEnabled } from "@/server/attribution/flag";
import { serviciosEnabled } from "@/server/servicios/flag";

/**
 * 031 — Qué módulos están encendidos en esta instancia, leídos con las MISMAS
 * funciones que deciden los 404: lo que muestra Ajustes → Módulos es lo que
 * hace la app.
 */
export function enabledModules(): Record<ModuleId, boolean> {
  return {
    servicios: serviciosEnabled(),
    agenda: agendaEnabled(),
    atribucion: atribucionEnabled(),
  };
}

export function currentModuleStatuses(): ModuleStatus[] {
  return moduleStatuses(enabledModules());
}
