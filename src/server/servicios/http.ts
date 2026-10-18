import { apiError, parseBody } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import type { SessionContext } from "@/lib/auth/session";
import { createServiceSchema, patchServiceSchema, SENA_SUPERA_PRECIO } from "@/lib/servicios";
import { serviciosDisabledResponse, serviciosEnabled } from "./flag";
import { createService, deleteService, listServices, updateService } from "./store";

/**
 * 031 — Lógica de `/api/services`. Los `route.ts` solo exportan handlers
 * (Next rechaza otros exports), así que lo que se prueba vive aquí.
 *
 * Leer el catálogo lo puede cualquiera del equipo (quien atiende la Bandeja
 * necesita los precios). Cambiarlo, solo quien configura: un precio es una
 * decisión del dueño, igual que el conocimiento del agente.
 */

function soloQuienConfigura(session: SessionContext): Response | null {
  return canConfigure(session.role)
    ? null
    : apiError(403, "forbidden", "Solo quien administra el negocio puede cambiar el catálogo");
}

export async function handleList(session: SessionContext): Promise<Response> {
  if (!serviciosEnabled()) return serviciosDisabledResponse();
  const services = await listServices(session.organizationId);
  return Response.json({ services });
}

export async function handleCreate(session: SessionContext, req: Request): Promise<Response> {
  if (!serviciosEnabled()) return serviciosDisabledResponse();
  const denied = soloQuienConfigura(session);
  if (denied) return denied;
  const body = await parseBody(req, createServiceSchema);
  if (!body.ok) return body.response;
  const service = await createService(session.organizationId, body.data);
  return Response.json({ service }, { status: 201 });
}

export async function handlePatch(
  session: SessionContext,
  req: Request,
  id: string
): Promise<Response> {
  if (!serviciosEnabled()) return serviciosDisabledResponse();
  const denied = soloQuienConfigura(session);
  if (denied) return denied;
  const body = await parseBody(req, patchServiceSchema);
  if (!body.ok) return body.response;
  const result = await updateService(session.organizationId, id, body.data);
  if (result.ok) return Response.json({ service: result.service });
  if (result.reason === "deposit_exceeds_price") {
    return apiError(422, "invalid_body", `depositCents: ${SENA_SUPERA_PRECIO}`);
  }
  return apiError(404, "not_found", "Servicio no encontrado");
}

export async function handleDelete(session: SessionContext, id: string): Promise<Response> {
  if (!serviciosEnabled()) return serviciosDisabledResponse();
  const denied = soloQuienConfigura(session);
  if (denied) return denied;
  const ok = await deleteService(session.organizationId, id);
  if (!ok) return apiError(404, "not_found", "Servicio no encontrado");
  return Response.json({ deleted: true });
}
