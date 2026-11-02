# Plan: reorganizar y simplificar la app («método Marie Kondo»)

**Estado:** propuesta para revisar (2026-11-02). No se ha tocado código. Nada de lo de aquí abajo está decidido hasta que Diego y Ana lo digan; las decisiones que faltan están en la sección 7.

## 1. Por qué

La app ha crecido por capas, cada una respondiendo a una petición. Funciona, pero se nota:

- **15 pantallas** y una barra inferior que solo llega a 5 (Menú, Agenda, Compra, Despensa, Reparto). Casa, Tareas, Fechas, Cumples, Enviar, Cuenta, Platos y Regalo solo se alcanzan desde botones sueltos de la portada.
- **La portada tiene unos 11 accesos** (Ver el menú, Hoy llego tarde, Zafarrancho ×2, Casa ×2, Fechas, Cumples, Regalo…) y ninguna acción principal.
- **Tres módulos para «quién hace qué»:** Reparto (cargas y turnos), Tareas («Día de zafarrancho», por persona) y Casa (recurrente).
- **Tres módulos para «fechas»:** Calendario, Fechas (apuntes) y Cumples. Regalo cuelga aparte.
- **Un solo diseño para móvil y escritorio:** solo cambia la barra (inferior o lateral) y el número de columnas.

El objetivo de la app es **quitarle carga mental a Ana** (`docs/plan-carga-mental.md`). Cada módulo se juzga con la misma pregunta: _¿quita una cosa que alguien tenga que recordar?_ Lo que no, se esconde o se quita. Una app con más cosas que encontrar es más carga, no menos.

## 2. Principios

1. **Organizar por la pregunta que se hace la persona**, no por la tabla de datos que hay detrás.
2. **Cuatro pilares y «Más».** Todo cuelga de uno; nada queda huérfano en un botón de la portada.
3. **Una acción principal por pantalla** y como mucho una secundaria visible; el resto, a un toque.
4. **Lo que no sirve se esconde antes de borrarse**, y se borra solo con permiso de Diego y Ana.
5. **Móvil y escritorio son dos diseños, con la misma lógica:** comparten dominio, estado y acciones; lo único distinto es la composición de pantalla.
6. **Las URL actuales siguen funcionando** (enlaces guardados, el calendario `.ics`, la instalación en la pantalla de inicio).
7. **Nada de cambios de datos:** esta reorganización no toca el estado ni la base de datos.

## 3. Los cuatro pilares

| Pilar      | La pregunta                   | Qué agrupa hoy                                                                               |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| **Hoy**    | ¿Qué toca hoy?                | Portada: cena y comida de hoy, lo que toca en casa, cuenta atrás, felicitación de cumpleaños |
| **Comer**  | ¿Qué comemos y qué compramos? | Menú, cole, «Hoy llego tarde», Compra, Despensa, Platos                                      |
| **Casa**   | ¿Quién hace qué?              | Casa (recurrente y gatos), Tareas por persona (zafarrancho), Reparto                         |
| **Fechas** | ¿Qué se acerca?               | Calendario, Próximas fechas (apuntar), Cumples y regalos                                     |
| **Más**    | Ajustes y salidas             | Enviar (WhatsApp, Keep, `.ics`), Cuenta y sincronización, perfil, tema                       |

### Dónde va cada pantalla actual

| Pantalla actual                           | Pilar  | Cambio                                                                                    |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `/` Portada                               | Hoy    | Rediseñada (sección 5)                                                                    |
| `/menu`, `/menu/cole`, `/menu/emergencia` | Comer  | Pestañas «Cena», «Cole» y atajo «Hoy llego tarde»                                         |
| `/menu/platos`                            | Comer  | Pestaña «Platos» (se esconde de la barra principal)                                       |
| `/compra`, `/despensa`                    | Comer  | Pestañas «Compra» y «Despensa»                                                            |
| `/casa`, `/tareas`, `/reparto`            | Casa   | Tres pestañas de un mismo sitio: «Recurrente», «Hoy por persona» y «Reparto» (ver duda 1) |
| `/calendario`, `/fechas`, `/cumples`      | Fechas | Tres pestañas: «Mes», «Próximas» y «Cumples y regalos»                                    |
| `/regalo`                                 | Fechas | Se abre desde un cumple, no desde la portada                                              |
| `/compartir`, `/cuenta`                   | Más    | Sin cambios de contenido                                                                  |

## 4. Móvil (≤ 767 px)

**Barra inferior fija, 5 entradas:** Hoy · Comer · Casa · Fechas · Más. Cada una con icono y texto (no solo icono).

**Dentro de un pilar**, una fila de pestañas pegada arriba (`Cena · Cole · Compra · Despensa`) con scroll horizontal si no caben. Una sola columna.

**Botón «＋ Apuntar» flotante** en todas las pantallas, encima de la barra: abre una hoja con una caja de texto que entiende lo que ya entiende la app (compra, fechas, tareas), con la misma lógica de «Apuntar» y «Añadir rápido» de hoy, unificada.

```
┌──────────────────────────┐
│ Hola, Ana 👋             │
│ ┌──────────────────────┐ │
│ │ 🎂 Hoy cumple Alba   │ │   felicitación (solo ese día)
│ └──────────────────────┘ │
│  ⏳ Ana (42) · en 5 días │   cuenta atrás: 1 línea
│ ┌──────────────────────┐ │
│ │ Hoy cenáis…          │ │   UNA acción principal
│ │ Filetes de ternera   │ │
│ │ [ Ver el menú ]      │ │
│ │ ☀️ Comida: Paella    │ │
│ └──────────────────────┘ │
│ 🏠 Hoy toca en casa      │   máx. 3, con «✓ Hecha»
│  🐱 Limpiar areneros  ✓  │
│  🛏️ Sábanas           ✓  │
│ 🛒 Faltan 7 cosas  ›     │   un enlace, no una lista
│                          │
│              (＋ Apuntar)│
├──────────────────────────┤
│ Hoy  Comer  Casa  Fechas Más │
└──────────────────────────┘
```

Reglas de la portada en móvil: **máximo 5 bloques**, ordenados por urgencia; lo que no toca hoy no aparece. «Hoy llego tarde» pasa a ser un atajo dentro de «Comer». El resto de accesos (Zafarrancho, Cumples, Fechas…) salen de la portada: están en su pilar.

## 5. Escritorio (≥ 768 px)

**Barra lateral fija** con los mismos pilares, **con sus apartados desplegados** (en escritorio hay sitio, y evita un clic). Perfil y tema abajo.

**Cada pilar usa el ancho**, no una columna estirada. Propuesta pantalla a pantalla:

| Pantalla             | Composición en escritorio                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hoy**              | Panel de 3 columnas: _Ahora_ (cena y comida, cole) · _Casa_ (lo que toca, por persona) · _Se acerca_ (cuenta atrás, compra pendiente). Todo a la vista, sin desplazarse. |
| **Fechas → Mes**     | Calendario del mes grande a la izquierda y, a la derecha, el detalle del día seleccionado (cena, comida, cole, apuntes). Ya existe en parte.                             |
| **Casa**             | Dos columnas: tareas recurrentes agrupadas por urgencia a la izquierda y, a la derecha, el reparto por persona (quién lleva qué) con el equilibrio.                      |
| **Comer → Compra**   | Tabla por sección del súper con cantidades y el motivo; teclado y ratón (atajos).                                                                                        |
| **Comer → Despensa** | Tabla ordenable por caducidad, con filtros.                                                                                                                              |
| **Comer → Cena**     | Semana en cuadrícula de 7 días, con las opciones de cada día en la misma pantalla.                                                                                       |

Esto es lo que más trabajo da: **no es una versión estirada del móvil**, son composiciones distintas que comparten los mismos componentes de datos y acciones.

## 6. Cómo hacerlo, por fases

Cada fase se entrega sola, con todos los tests en verde, y se puede parar después de cualquiera.

| Fase              | Qué se hace                                                                                                                                                                                         | Riesgo                                      | Antes del 7 de nov. |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------- |
| **1. Estructura** | Navegación de 4 pilares + «Más» (móvil y escritorio) y pestañas dentro de cada pilar. Portada nueva y más corta. Las pantallas siguen siendo las mismas, solo se reubican; las URL actuales siguen. | Bajo: se mueven enlaces, no lógica          | **Sí**              |
| **2. Fusionar**   | Casa + Tareas + Reparto en un solo sitio; Fechas + Calendario + Cumples en otro. Se elimina lo duplicado (por ejemplo, dos formas de apuntar una fecha).                                            | Medio: cambia dónde se hace cada cosa       | No                  |
| **3. Escritorio** | Composiciones propias para Hoy, Fechas, Casa y Compra.                                                                                                                                              | Medio: layout y accesibilidad en 10 tamaños | No                  |
| **4. Repaso**     | Textos, tamaños, atajos, accesibilidad y revisión con Ana.                                                                                                                                          | Bajo                                        | No                  |

**Red de seguridad:** hay 382 pruebas de extremo a extremo (accesibilidad WCAG 2.2 AA, 10 tamaños de pantalla, claro y oscuro, objetivos táctiles ≥ 44 px) y 420 unitarias. Las rutas se cubren con una prueba por pantalla; al mover pantallas habrá que actualizar esas pruebas, pero no deberían desaparecer.

**Cómo evitar romper lo que ya funciona:**

- Las URL actuales se mantienen (o redirigen) durante toda la reorganización.
- La reorganización no cambia datos, estado ni base de datos.
- Fase a fase, con despliegue y comprobación en Railway antes de empezar la siguiente (hubo un fallo de configuración que tumbó la app; D-077).

## 7. Decisiones que faltan (para Diego y Ana)

1. **¿Fusionamos Reparto y Tareas dentro de Casa?** Reparto es la pantalla de estadísticas de carga (método Fair Play); quizá solo la miréis de vez en cuando. Alternativa: dejarla en «Más» como «Equilibrio».
2. **¿Cuánto antes del 7 de noviembre?** Recomendación: solo la **fase 1**. Ana ya tiene una app que funciona para su cumpleaños; una reorganización profunda a pocos días arriesga regresiones, y la fase 1 ya quita la mayoría del desorden.
3. **¿Qué se tira?** ¿Usa Ana «Platos» (editar el catálogo)? ¿Y «Despensa»? Lo que no se use se esconde en «Más» o se quita.
4. **El botón «＋ Apuntar» único:** ¿lo queréis (una caja que entiende compra, fecha y tarea) o preferís botones separados? Si la caja se equivoca (por ejemplo, «Sábanas» como tarea o como compra) hay que decidir qué hace por defecto.
5. **Escritorio:** ¿quién lo usará de verdad y para qué? Si es solo para organizar la semana (Diego), conviene priorizar Cena, Fechas y Compra.

## 8. Lo que no se hace (a propósito)

- **No se añaden funciones nuevas** durante la reorganización.
- **No se cambia el modelo de datos** ni la sincronización.
- **No se rediseña la identidad visual** (colores, tipografía): solo composición y navegación.
- **No se mide con métricas inventadas:** el criterio de éxito es que Ana encuentre lo de hoy sin buscar y que el número de toques para las tareas habituales baje (apuntar una fecha, marcar algo hecho, añadir a la compra).

## 9. Criterios para dar por buena cada fase

- Todos los tests (unitarios y E2E) en verde, con las pruebas actualizadas a las nuevas rutas.
- Sin violaciones de accesibilidad (WCAG 2.2 AA) ni desbordes en los 10 tamaños.
- Revisión de Ana en su iPhone (WebKit): esto **no se ha probado nunca** y es el mayor riesgo de toda la app, también de la reorganización.
- Cada decisión registrada en `docs/decisiones.md`.
