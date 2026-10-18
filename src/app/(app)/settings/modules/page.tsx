import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentModuleStatuses } from "@/server/modules";

export const dynamic = "force-dynamic";

/**
 * 031 — Ajustes → Módulos: qué módulos tiene encendidos esta instancia y cómo
 * encender los demás. Solo informa: los módulos son banderas de despliegue
 * (ADR-001/002), así que se encienden en la plataforma donde corre el CRM, no
 * desde aquí — y esta pantalla lo dice en vez de esconderlo.
 */
export default function ModulesSettingsPage() {
  const modules = currentModuleStatuses();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h3 className="text-base font-semibold">Módulos</h3>
        <p className="text-sm text-muted-foreground">
          Funciones que se suman según el tipo de negocio. Los apagados no aparecen en el
          menú ni los conoce el agente.
        </p>
      </div>

      <ul className="space-y-3" aria-label="Módulos de la instancia">
        {modules.map((m) => (
          <li key={m.id} data-testid={`module-${m.id}`}>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{m.nombre}</CardTitle>
                    <CardDescription>{m.descripcion}</CardDescription>
                  </div>
                  <Badge variant={m.enabled ? "success" : "secondary"}>
                    {m.enabled ? "Encendido" : "Apagado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                {m.enabled ? (
                  <Link
                    href={m.href}
                    className="font-medium text-brand-text underline underline-offset-2"
                  >
                    Abrir {m.nombre} →
                  </Link>
                ) : (
                  <p className="text-muted-foreground">
                    Para encenderlo, agregá{" "}
                    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                      {m.variable}
                    </code>{" "}
                    a las variables de entorno del CRM y reinicialo.
                  </p>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
