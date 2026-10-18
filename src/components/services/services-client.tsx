"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyCents, parseMoneyToCents } from "@/lib/money";
import { formatDuration, SENA_SUPERA_PRECIO, type ServiceDto } from "@/lib/servicios";

/**
 * 031 — Pantalla del catálogo de servicios.
 *
 * Quien configura agrega, edita, pausa y borra; un miembro del equipo solo
 * consulta (necesita los precios para atender, no para cambiarlos). Pausar
 * («Activo» apagado) saca el servicio de lo que sabe el agente sin perderlo.
 */

type Form = {
  name: string;
  description: string;
  price: string;
  duration: string;
  deposit: string;
};

const EMPTY_FORM: Form = { name: "", description: "", price: "", duration: "", deposit: "" };

function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function toForm(s: ServiceDto): Form {
  return {
    name: s.name,
    description: s.description ?? "",
    price: centsToInput(s.priceCents),
    duration: s.durationMinutes ? String(s.durationMinutes) : "",
    deposit: centsToInput(s.depositCents),
  };
}

/** Del formulario al cuerpo de la API, o un mensaje de error para mostrar. */
function toBody(form: Form): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const name = form.name.trim();
  if (!name) return { ok: false, error: "Poné un nombre al servicio." };
  const priceCents = parseMoneyToCents(form.price);
  if (priceCents === null || priceCents < 0) {
    return { ok: false, error: "El precio tiene que ser un número (por ejemplo 15000)." };
  }
  const durationRaw = form.duration.trim();
  const durationMinutes = durationRaw ? Number.parseInt(durationRaw, 10) : null;
  if (durationRaw && (!Number.isFinite(durationMinutes) || (durationMinutes ?? 0) <= 0)) {
    return { ok: false, error: "La duración va en minutos (por ejemplo 45)." };
  }
  const depositRaw = form.deposit.trim();
  const depositCents = depositRaw ? parseMoneyToCents(depositRaw) : null;
  if (depositRaw && (depositCents === null || depositCents < 0)) {
    return { ok: false, error: "La seña tiene que ser un número." };
  }
  if (depositCents !== null && depositCents > priceCents) {
    return { ok: false, error: `${SENA_SUPERA_PRECIO}.` };
  }
  return {
    ok: true,
    body: {
      name,
      description: form.description.trim() || null,
      priceCents,
      durationMinutes,
      depositCents,
    },
  };
}

export function ServicesClient({ currency, canEdit }: { currency: string; canEdit: boolean }) {
  const [services, setServices] = useState<ServiceDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // `null` = formulario cerrado; "" = nuevo; un id = editando ese.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Borrar pide confirmar en el mismo renglón (sin diálogos del navegador).
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/services").catch(() => null);
    if (!res?.ok) {
      setLoadError(true);
      return;
    }
    const data = (await res.json()) as { services: ServiceDto[] };
    setLoadError(false);
    setServices(data.services);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const money = (cents: number | null) => formatMoneyCents(cents, currency);

  function openNew() {
    setEditing("");
    setForm(EMPTY_FORM);
    setError(null);
  }

  function openEdit(s: ServiceDto) {
    setEditing(s.id);
    setForm(toForm(s));
    setError(null);
  }

  function close() {
    setEditing(null);
    setError(null);
  }

  async function save() {
    const parsed = toBody(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    const res = await fetch(editing ? `/api/services/${editing}` : "/api/services", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? "No se pudo guardar. Probá de nuevo.");
      return;
    }
    close();
    void refetch();
  }

  async function toggleActive(s: ServiceDto, active: boolean) {
    // Optimista: el interruptor responde al instante y el refetch confirma.
    setServices((prev) => prev?.map((x) => (x.id === s.id ? { ...x, active } : x)) ?? prev);
    await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    }).catch(() => null);
    void refetch();
  }

  async function remove(s: ServiceDto) {
    setConfirmDelete(null);
    await fetch(`/api/services/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (editing === s.id) close();
    void refetch();
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">Servicios</h2>
          <p className="text-sm text-muted-foreground">
            Lo que vendés, con su precio. El agente responde con estos datos y no inventa precios.
          </p>
        </div>
        {canEdit && editing === null && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo servicio
          </Button>
        )}
      </header>

      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          {loadError && (
            <p className="rounded-md border border-danger-soft bg-danger-tint p-3 text-sm text-danger-text">
              No se pudo cargar el catálogo. Recargá la página.
            </p>
          )}
          {services === null && !loadError && (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          )}
          {services?.length === 0 && (
            <Card className="border-dashed">
              <EmptyState
                icon={Tags}
                title="Todavía no hay servicios"
                description={
                  canEdit
                    ? "Cargá lo que vendés: nombre, precio, duración y, si pedís, la seña para reservar."
                    : "Quien administra el negocio todavía no cargó el catálogo."
                }
                action={
                  canEdit ? (
                    <Button size="sm" onClick={openNew}>
                      <Plus className="h-4 w-4" /> Agregar el primero
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          )}
          {services && services.length > 0 && (
            <ul className="space-y-2" aria-label="Catálogo de servicios">
              {services.map((s) => (
                <li
                  key={s.id}
                  data-testid="service-row"
                  className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{s.name}</p>
                      {!s.active && <Badge variant="secondary">Pausado</Badge>}
                    </div>
                    {s.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold tabular-nums" data-testid="service-price">
                        {money(s.priceCents)}
                      </span>
                      {s.durationMinutes && (
                        <span className="text-muted-foreground">{formatDuration(s.durationMinutes)}</span>
                      )}
                      {s.depositCents !== null && (
                        <span className="text-muted-foreground">
                          Seña {money(s.depositCents)} · saldo {money(s.priceCents - s.depositCents)}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={s.active}
                        label={`${s.name} activo`}
                        onCheckedChange={(v) => void toggleActive(s, v)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${s.name}`}
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {confirmDelete === s.id ? (
                        <span className="flex items-center gap-1">
                          <Button size="sm" variant="destructive" onClick={() => void remove(s)}>
                            Eliminar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            No
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar ${s.name}`}
                          onClick={() => setConfirmDelete(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canEdit && editing !== null && (
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>{editing ? "Editar servicio" : "Nuevo servicio"}</CardTitle>
              <CardDescription>
                Montos en {currency}. La seña es opcional: dejala vacía si no pedís.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="sv-name">Nombre</Label>
                  <Input
                    id="sv-name"
                    placeholder="p. ej. Limpieza facial"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sv-price">Precio</Label>
                    <Input
                      id="sv-price"
                      inputMode="decimal"
                      placeholder="15000"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sv-duration">Duración (min)</Label>
                    <Input
                      id="sv-duration"
                      inputMode="numeric"
                      placeholder="60"
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-deposit">Seña para reservar (opcional)</Label>
                  <Input
                    id="sv-deposit"
                    inputMode="decimal"
                    placeholder="5000"
                    value={form.deposit}
                    onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-description">Descripción (opcional)</Label>
                  <Textarea
                    id="sv-description"
                    rows={3}
                    placeholder="Qué incluye, para quién es…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-danger-text">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={close}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
