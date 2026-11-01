# Fuentes y base de conocimiento nutricional

Las reglas del planificador que se apoyan en recomendaciones de salud (equilibrio semanal entre el cole y la cena) tienen que poder **rastrearse hasta una fuente**. Este documento recoge de dónde sale cada una, qué no hemos podido comprobar y cómo añadir más (por ejemplo, desde un cuaderno de NotebookLM). **No es consejo médico**: la app ofrece orientación general; para una dieta concreta, consultad al pediatra o a un nutricionista.

## Reglas implementadas (D-042, D-054)

| Regla                                                                                                                 | Dónde está                                           | Fuente                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Qué cenar según lo comido en el cole (verdura → pasta/arroz; carne → huevo o pescado; etc.)                           | `recomendadosParaCenar` en `src/dominio/menu.ts`     | «Recomendador de cenas» del cole (`docs/contexto/recomendador-cenas-cole.pdf`), tal cual |
| Frecuencias semanales orientativas, contando comida del cole + cena: legumbres 2–3, pescado 2–4, huevo 2–4, carne 2–4 | `OBJETIVOS_SEMANALES` en `src/dominio/equilibrio.ts` | Rango prudente que cabe en las fuentes de abajo; **orientativo**                         |
| Compensar un menú del cole contundente (≥ 700 kcal) con cena ligera, o uno ligero (≤ 540 kcal) con cena más completa  | `explicarOpcion` en `src/dominio/explicacion.ts`     | Criterio propio, a validar con una persona experta; las kcal salen del PDF del cole      |
| Tiempo máximo de trabajo (30 min entre semana, 15 si llegáis tarde)                                                   | `diaMenuDe` en `src/aplicacion/estado.ts`            | Necesidad de la familia (D-033), no es una fuente de salud                               |

## Lo que dicen las fuentes consultadas

Búsqueda realizada el 2026-11-01. Resumen de lo encontrado; **las cifras no coinciden entre fuentes**, por eso usamos rangos prudentes.

- **AESAN** (Agencia Española de Seguridad Alimentaria y Nutrición), criterios mínimos de los comedores escolares: al menos una ración semanal de legumbre, una de pescado y una de carne blanca; verdura cruda como guarnición; fruta; máximo dos frituras a la semana y tres platos precocinados al mes. Los comedores deberían cumplir al menos el 75 % de estos criterios. Ver [informe de control oficial 2022-2024](https://www.aesan.gob.es/dam/jcr:16ec7728-9759-44f7-ab45-6d9c8381ac21/Obj_Operativo_2_del_Programa_16._PNCOCA_2021-2025._Anios_2022,_2023_y_2024.pdf), [Consumer: criterios mínimos](https://www.consumer.es/?p=493349) y [AESAN: el comedor escolar](https://www.aesan.gob.es/AECOSAN/web/nutricion/campanyas/Comedor_escolar.htm).
- **Asociación Española de Pediatría (En Familia)**: página de comedores escolares con una tabla de frecuencias semanales para comida y cena (pescado, huevos, legumbres y carne, con la carne roja limitada). Según el resumen de la búsqueda: pescado hasta 4, huevos 3, legumbres 2–3, carne 3–4 con carne roja como máximo 1. [enfamilia.aeped.es/vida-sana/comedores-escolares](https://enfamilia.aeped.es/printpdf/vida-sana/comedores-escolares).
- **Otras guías** (Consumer, documentos de menús escolares de la administración balear): legumbres 3–4, huevos 1–4, pescado 1–4 y carne ≤ 3–4 por semana, según el documento. [Consumer: menú del día saludable para niños](https://www.consumer.es/alimentacion/menu-dia-saludable-ninos.html).

### Qué no hemos podido comprobar

- **No pude abrir la página de AEP**: el entorno de la sesión no tiene permitido ese dominio, así que las cifras de la AEP son las del resumen de la búsqueda y **no están contrastadas con el original**. Hay que leer la tabla completa en la fuente antes de dar por buenos los rangos.
- No tenemos todavía una fuente para las cantidades por ración según edad (Alba 9 años, Emma 5), que hoy se aproximan con un factor de ración (D-012).
- No hemos distinguido carne roja de carne blanca; el recomendador del cole tampoco lo hace, pero las guías sí limitan la roja.

## Cómo añadir más conocimiento (por ejemplo, de un cuaderno de NotebookLM)

No tengo conexión con NotebookLM ni con otras fuentes privadas. Para incorporar un cuaderno:

1. **Exportad o copiad** lo que queráis usar (resúmenes, tablas, citas con su enlace) a un archivo de texto o Markdown y pasádmelo por aquí, o guardadlo en `docs/conocimiento/` del repositorio.
2. Lo **leo y lo traduzco a reglas con fuente** (como la tabla de arriba), con una prueba por cada una; lo que sea ambiguo o contradictorio os lo pregunto antes de aplicarlo.
3. Cada regla nueva queda registrada aquí con su origen. Si una fuente no se puede comprobar, se marca como tal.

Más adelante, una IA podrá **redactar** las explicaciones con más calidez y resolver consultas libres («¿qué cenamos si hoy comieron cocido y mañana hay cumpleaños?»), pero **siempre a partir de estas reglas y fuentes**, sin inventar y con las restricciones duras aplicadas en código (D-041).
