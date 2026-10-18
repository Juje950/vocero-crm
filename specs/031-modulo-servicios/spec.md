# 031 — Módulo de Servicios (y el catálogo de módulos)

**Estado**: implementado en la rama `feat/modulo-servicios` · **Bandera**: `SERVICIOS=on`

## Por qué

Vocero usa la IA para conversar, pero no sabe qué vende el negocio más allá del
texto libre del knowledge base. Los rubros de servicios (estética, gimnasio,
talleres) necesitan una base común: **qué se vende, cuánto cuesta, cuánto dura
y cuánta seña se pide para reservar**. Sobre esa base se montan los módulos que
siguen (seña y saldo en los turnos, membresías, balance del mes), así que va
primero y va solo.

## Qué hace

1. **Catálogo de servicios** (`/services`, grupo «Negocio» del menú): nombre,
   descripción, precio, duración y seña opcional. Se puede agregar, editar,
   pausar (sale de lo que sabe el agente sin perderse) y borrar.
   - Quien configura (`owner`/`admin`) edita; un miembro solo consulta.
   - La seña nunca supera el precio: lo valida la pantalla, la API (422) y un
     `CHECK` de la tabla. En la edición parcial se valida contra lo guardado.
   - Dinero en centavos enteros, moneda la del negocio (Ajustes → Marca).
2. **El agente cotiza desde el catálogo**: con el módulo encendido, el prompt
   del agente recibe los servicios ACTIVOS con precio, duración, seña y saldo
   ya calculados, y la regla de no inventar ni redondear precios. El juez del
   Laboratorio recibe el mismo catálogo, para que un precio del catálogo no
   cuente como alucinación. Si la lectura falla, el turno sigue sin catálogo.
3. **Ajustes → Módulos**: lista los módulos opcionales (Servicios, Agenda,
   Atribución), si están encendidos y qué variable enciende cada uno. Solo
   informa: los módulos son banderas de despliegue (ADR-001/002).

## Fuera de alcance (siguientes vueltas)

- Seña y saldo registrados en cada turno de la agenda.
- Balance del mes (ingresos, señas, saldos pendientes, servicios más pedidos).
- Encender módulos por organización desde la app (hoy: variable de entorno,
  como exige la constitución para los módulos opcionales).

## Superficie

| Pieza | Dónde |
|---|---|
| Bandera | `src/server/servicios/flag.ts` (`SERVICIOS`, declarada en `lib/env.ts`) |
| Tabla | `service` (`src/lib/db/schema.ts`), migración `drizzle/0021_modulo_servicios.sql` |
| Reglas | `src/lib/servicios.ts` (Zod, `checkDeposit`, `formatDuration`) |
| Datos | `src/server/servicios/store.ts` (todo con `scoped()`) |
| API interna | `GET`/`POST /api/services`, `PATCH`/`DELETE /api/services/[id]` → `src/server/servicios/http.ts`; 404 con la bandera apagada, 403 para miembros al escribir |
| Agente | `renderServicios` en `src/server/ai/prompts.ts`, `catalogoParaAgente` en `src/server/servicios/agent.ts` |
| Catálogo de módulos | `src/lib/modules.ts` + `src/server/modules.ts` → `/settings/modules` |
| Health | `features.servicios` en `/api/health` |
| Demo | 5 servicios de la ferretería (uno pausado) en `seedDemo` |

## Verificación

- Unit: `tests/unit/servicios.test.ts` (bandera, reglas, prompt, permisos y 404).
- E2E: `tests/e2e/us-servicios.md`, arnés `scripts/e2e-servicios.mjs` (incluye
  que el agente cotice desde el catálogo con WhatsApp e IA simulados y que un
  servicio pausado no se cotice).
