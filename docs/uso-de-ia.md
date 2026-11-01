# Uso de IA en el desarrollo

Registro de prompts que funcionaron o fallaron, con lo aprendido. Material para la memoria del TFM.

---

## 2026-11-01 · Arranque del proyecto

### ❌ Prompt que referencia archivos que no están en el repositorio

- **Prompt:** "Antes de nada, lee completos: CLAUDE.md, seed-platos.json y prototipo.html…"
- **Qué pasó:** el repositorio estaba vacío. El agente lo detectó (comprobó el clon local y GitHub) y se negó a inventar la especificación.
- **Aprendizaje:** subir el contexto antes de lanzar el agente. Un agente que inventa el esquema produce trabajo que hay que tirar.

### ⚠️ "Haz el plan perfecto" sin especificación

- **Qué pasó:** el agente entregó un plan _provisional_, marcó qué partes dependían de los archivos ausentes y listó las preguntas que bloqueaban el diseño.
- **Aprendizaje:** pedir calidad sin contexto produce, como mucho, un buen esqueleto. Las respuestas a las preguntas fueron las que movieron el diseño.

### ✅ Aportar contexto real del dominio (capturas de la app anterior)

- **Prompt:** 6 capturas de la app de menús que la familia usaba antes + "estos son los platos más típicos".
- **Qué pasó:** el agente extrajo los 58 platos únicos (coincide con el tamaño del seed), detectó que "EN EL TRABAJO PAPA Y MAMÁ" era un pseudo-plato (→ modelo de asistencia), los roles Principal/Guarnición/Básico, que las fechas de "hace N días" estaban obsoletas (→ saturación de antigüedad) y que había poco pescado para los objetivos nutricionales.
- **Aprendizaje:** datos reales > descripciones. Una captura aportó más requisitos que varios párrafos.

### ✅ Respuestas concretas a preguntas concretas

- **Ejemplo:** "Las niñas comen en el cole de L a V; Diego come en la oficina M y X; Ana de M a V, pero depende" → se convirtió directamente en la decisión D-003 (patrón semanal + excepciones).

### ❌ Creación del proyecto Supabase desde el agente

- **Qué pasó:** dos intentos de `create_project` caducaron porque la confirmación de coste del conector no llegó a responderse a tiempo (60 s).
- **Aprendizaje:** las acciones con coste requieren confirmación humana; si el canal de confirmación no funciona, hacer el paso a mano en el panel y que el agente continúe desde ahí.

## 2026-11-01 · Migraciones y proyecto base

### ⚠️ Errores del propio agente detectados a tiempo

- **Script de tests que ocultaba fallos:** la primera versión filtraba la salida con `grep … || true`, así que un test fallido no habría hecho fallar el script. El agente lo detectó al revisar su propio código y lo corrigió para que mande el código de salida de `psql`.
- **Desalineación repo/producción:** al aplicar la migración por MCP, el agente añadió tres índices que no estaban en el archivo del repositorio. Lo detectó al comparar y sincronizó el archivo.
- **Aprendizaje:** pedir siempre verificación explícita ("demuestra que el test falla si rompo la política") en lugar de fiarse de un "todo verde".

### ✅ Tests de mutación para validar tests de seguridad

- **Técnica:** romper a propósito la seguridad (política abierta, `WITH CHECK (true)`, FK sin `hogar_id`) y comprobar que los tests fallan.
- **Resultado:** una mutación sobrevivió porque era equivalente (en `FOR ALL`, Postgres reutiliza `USING` como `WITH CHECK`); se sustituyó por una mutación real, que sí se detectó.

### ✅ Documentación local para agentes (`AGENTS.md` de Next 16)

- Next 16 genera un `AGENTS.md` que avisa a los agentes de que sus conocimientos pueden estar desfasados y les remite a `node_modules/next/dist/docs`. Seguirlo evitó dos errores: la configuración de Vitest y el tipo global `LayoutProps`, que requiere `next typegen` antes de `tsc`.
