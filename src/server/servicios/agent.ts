import type { ServiceDto } from "@/lib/servicios";
import { getBranding } from "@/server/branding";
import { serviciosEnabled } from "./flag";
import { listServices } from "./store";

/**
 * 031 — Lo que el agente (y el juez del Laboratorio) saben del catálogo.
 *
 * `undefined` con el módulo apagado: el prompt no gasta ni un token en
 * servicios. Si la lectura falla, también `undefined`: un catálogo que no se
 * pudo leer degrada a «el agente no sabe precios» —que ya sabe manejar
 * escalando—, nunca a un turno caído.
 */
export async function catalogoParaAgente(
  organizationId: string
): Promise<{ services: ServiceDto[]; currency: string } | undefined> {
  if (!serviciosEnabled()) return undefined;
  try {
    const [services, branding] = await Promise.all([
      listServices(organizationId, { activeOnly: true }),
      getBranding(organizationId),
    ]);
    return { services, currency: branding.currency };
  } catch (err) {
    console.error("[servicios] no se pudo leer el catálogo para el agente:", err);
    return undefined;
  }
}
