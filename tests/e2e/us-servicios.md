# US — Módulo de Servicios (031)

Arnés: `node --env-file=.env scripts/e2e-servicios.mjs` con la app en `pnpm dev`,
`SERVICIOS=on` y los mocks (`WA_MOCK_ENABLED=true`, `META_GRAPH_BASE_URL` →
wa-mock, `OPENROUTER_BASE_URL` → ai-mock).

## Con `SERVICIOS=on`

1. El menú muestra el grupo **Negocio** con **Servicios**.
2. Con la demo cargada hay 5 servicios; «Renta de rotomartillo por día» se ve
   **Pausado**; los que piden seña muestran «Seña … · saldo …».
3. Crear un servicio con seña mayor que el precio → mensaje «La seña no puede
   ser mayor que el precio» y no se guarda. La API responde 422 a lo mismo.
4. Corregir la seña y guardar → aparece al final de la lista.
5. Editar el precio → el renglón muestra el precio nuevo y el saldo recalculado.
6. Pausar y reactivar con el interruptor.
7. Borrar pide confirmación en el renglón y lo quita.
8. Ajustes → Módulos muestra Servicios **Encendido** y, para los apagados, la
   variable que los enciende.
9. Un cliente pregunta por WhatsApp «¿cuánto sale el duplicado de llaves?» → el
   agente responde con el precio del catálogo. Preguntando por el servicio
   pausado, el agente no lo cotiza.

## Con la bandera apagada

- `/services` y `/api/services` responden 404.
- El menú no tiene grupo Negocio; Ajustes → Módulos muestra Servicios
  **Apagado** con `SERVICIOS=on`.
- El prompt del agente no menciona servicios.

## Permisos

- Un miembro del equipo ve el catálogo pero no puede crear, editar ni borrar
  (403 en la API; la pantalla no muestra los controles).
