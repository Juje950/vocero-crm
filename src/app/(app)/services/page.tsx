import { notFound, redirect } from "next/navigation";
import { ServicesClient } from "@/components/services/services-client";
import { canConfigure } from "@/lib/auth/roles";
import { getSessionOrNull } from "@/lib/auth/session";
import { getBranding } from "@/server/branding";
import { serviciosEnabled } from "@/server/servicios/flag";

export const dynamic = "force-dynamic";

/**
 * 031 — Catálogo de servicios. La moneda es la del negocio (Ajustes → Marca)
 * y se resuelve aquí, en el servidor, igual que el resto del dinero del CRM.
 */
export default async function ServicesPage() {
  // Sin la bandera esta pantalla no existe en esta instancia.
  if (!serviciosEnabled()) notFound();
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  const branding = await getBranding(session.organizationId);

  return (
    <ServicesClient currency={branding.currency} canEdit={canConfigure(session.role)} />
  );
}
