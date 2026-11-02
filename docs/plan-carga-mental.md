# Plan: la app como «cerebro de la casa»

Objetivo: **liberar la mente de Ana**. Lo que más agota no es lo que se hace con las manos, sino lo que hay que **acordarse, decidir y vigilar** (la carga mental). La app debe encargarse de eso por defecto, para que Ana pueda jugar con sus hijas y con su marido.

## 1. Diagnóstico

La carga mental tiene tres partes (método Fair Play, ver D-032): **concebir** (darse cuenta de que algo toca), **planificar** (decidir cuándo y cómo) y **ejecutar**. Hoy la familia reparte bien la ejecución en algunos casos, pero **concebir y planificar recaen en Ana**: los regalos de las niñas, cambiar sábanas y toallas, qué se cena, qué falta, qué hay que llevar al cole.

Las dos quejas concretas de esta semana son el mismo problema:

- **Regalos** (cumpleaños, Reyes, Papá Noel, Ratoncito Pérez): Ana piensa siempre en todo, y además tiene que ocultarlo a las niñas.
- **Sábanas y toallas**: Diego «nunca se acuerda». La tarea no es difícil; lo difícil es que **alguien tiene que acordarse de que toca**, y hoy ese alguien es Ana.

## 2. Principios de diseño (valen para todo lo que se añada)

1. **Cada cosa tiene un responsable desde el principio.** Nada queda «sin dueño»: la app propone y los dos vetan.
2. **El aviso va a quien le toca, no a quien lo organiza.** Diego recibe «hoy toca cambiar las sábanas»; Ana no tiene que recordárselo ni vigilar que lo haga.
3. **Capturar sin esfuerzo.** Una idea de regalo, algo que se acaba, una cita: apuntarla debe costar un toque o una frase dictada.
4. **Lo recurrente se genera solo.** Si algo se repite, se programa una vez y no se vuelve a pensar.
5. **Una sola pantalla responde a «¿qué toca?».** Ana no consulta cinco sitios.
6. **Sin reproches.** La app muestra lo que hay y quién lo lleva; no puntúa ni compara personas (D-032).
7. **Honestidad sobre la privacidad.** Ocultar algo de las niñas se diseña como ocultación real, y se dice con claridad qué protege y qué no.

## 3. Módulos

### A. «Hoy toca» (el radar)

Una pantalla —la portada— que junta lo que importa **hoy y esta semana**, ordenado: la cena y si se tiene todo, lo que hay que comprar, las tareas de cada uno, lo recurrente de la casa que vence, los cumpleaños y regalos próximos (con margen para comprar), y lo del cole. Cada elemento lleva su responsable y se marca en un toque. **Ya existe en parte** (cena, cole, tareas, contador de compra); falta incorporar lo recurrente y los regalos.

### B. Casa: lo recurrente (sábanas, toallas y compañía)

Catálogo de tareas de mantenimiento con **frecuencia**, **responsable** y **última vez hecha**. La app calcula la próxima fecha, la pone en «Hoy toca» cuando vence, avisa al responsable y, al marcarla hecha, reprograma sola. Si nadie la hace, **sube de prioridad y se ve para los dos** (sin señalar).

- **Plantilla inicial** (editable; frecuencias orientativas): sábanas (cada 14 días; las de las niñas, cada 7), toallas de baño (cada 7), toallas de manos y trapos de cocina (cada 3), limpiar la nevera (mensual), cepillos de dientes (cada 3 meses), botiquín y caducidades (cada 6 meses), cambio de ropa de temporada (abril y octubre), filtros (campana, aspirador), revisión del coche y la caldera, citas del pediatra y el dentista, material escolar de cada trimestre.
- **Reparto justo:** reutiliza el motor de reparto que ya existe (`proponerRotacion`): propone quién lleva cada cosa equilibrando la carga **incluida la mental**, y se acuerda entre los dos.
- **Qué hay ya:** el modelo de cargas, turnos y responsable existe (base de datos y pantalla de Reparto). Falta la **recurrencia automática** y el aviso.

### C. Regalos (con secreto)

Sección **«Regalos»** con tres piezas:

1. **Calendario de ocasiones**: cumpleaños (de las niñas, de Ana y Diego, de la familia y de los amigos del cole), Reyes, Papá Noel, Ratoncito Pérez, Día del Padre y de la Madre, aniversarios. Cada ocasión sabe su fecha y **cuánta antelación pide** (por ejemplo, los Reyes empiezan a prepararse a principios de noviembre).
2. **Ideas y estado por persona**: lista de ideas (que cualquiera apunta por voz en un toque), presupuesto, quién compra, estado (idea → comprado → envuelto → escondido → entregado) y **dónde está escondido**.
3. **Automatismos**: recordatorio con margen («faltan 3 semanas para los Reyes: ¿ideas de Alba y Emma?»), recordatorio de comprar a tiempo, lista de regalos de cumples de amigos del cole, y para el **Ratoncito Pérez** un botón «se le ha caído un diente a Emma» que programa el aviso **para esa noche** al adulto de guardia (y lleva el registro de dientes de cada niña, que luego es un recuerdo bonito).

**Secreto, cómo y hasta dónde.**

- Los regalos quedan **ocultos para las niñas y para quien los recibe** (los de Ana, ocultos a Ana). Cada móvil recuerda «quién eres» (ya existe): si es una niña, la sección **desaparece** y nada de regalos aparece en el calendario, la compra ni los mensajes de WhatsApp.
- **Candado para adultos**: la sección se abre con un PIN y se cierra sola a los pocos minutos, por si una niña coge el móvil de papá o mamá ya desbloqueado.
- **Avisos discretos**: las notificaciones dicen «tienes un recordatorio privado», nunca el nombre del regalo, porque se ve en la pantalla de bloqueo.
- **Honestidad:** esto protege de curiosear, no de alguien que sepa de informática. Para un secreto fuerte hay que guardar los regalos aparte de lo que se sincroniza con todos los dispositivos (con permisos por persona en la base de datos). Se hace así desde el principio, no como parche.

### D. Avisos y recordatorios (que funcionen sin abrir la app)

Si hay que abrir la app para acordarse, no se ha quitado carga mental. Opciones, de menos a más esfuerzo:

1. **Calendario de Google con avisos**: la app publica un calendario suscrito (lo que toca a cada persona, con alarma). Los móviles lo avisan solos, sin instalar nada y de forma fiable. **Recomendado como primer paso.**
2. **Notificaciones push** (la app instalada como aplicación del móvil): más directas; en iPhone exigen instalarla en la pantalla de inicio.
3. **Resumen diario o semanal por correo o WhatsApp**: «hoy cenáis X, falta Y, toca Z».

### E. La reunión de 10 minutos de los domingos

Un guion corto que la app prepara sola: revisar la semana que viene (cenas propuestas, compra, cole), repartir lo recurrente que vence, ver qué regalos o fechas se acercan y cerrar **tres decisiones**. Sustituye a ir pensándolo todo el día. Puede acabar enviando el plan a WhatsApp.

### F. Capturar sin esfuerzo

Botón flotante, voz y «lo de siempre» (ya hay para la compra); se extiende a ideas de regalo, citas y tareas con la misma frase corta.

### G. El cole sin sorpresas (más adelante)

Circulares, excursiones, material y fechas: leer la foto o el PDF con IA, con revisión humana, y llevarlo al calendario y a «Hoy toca». Es el siguiente caso natural de IA después del menú del cole.

### H. Medir si funciona

Un panel neutro con la carga de cada uno **incluyendo la invisible** (acordarse, decidir) y una pregunta semanal a Ana: «¿cuánto has tenido que pensar esta semana?» (1 a 5). Si no baja, el plan no funciona. Sirve también como **evidencia para la memoria del TFM**.

## 4. Automatizaciones concretas

| Cuando…                              | La app…                                                         | Para…                  |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------- |
| Vence una tarea recurrente (sábanas) | La pone en «Hoy toca» y avisa                                   | El responsable (Diego) |
| Nadie la hace en 3 días              | Sube de prioridad y la muestra a los dos, sin señalar           | Ambos                  |
| Se marca hecha                       | Reprograma la siguiente                                         | Nadie: es automático   |
| Llega el domingo                     | Propone las cenas de la semana y prepara el resumen             | Ambos                  |
| Se acerca un cumpleaños o una fiesta | Recuerda con margen, propone ideas guardadas y avisa de comprar | Quien compra           |
| Empieza noviembre                    | Abre la «Operación Reyes y Papá Noel» con fechas límite         | Los dos (en secreto)   |
| Se cae un diente                     | Programa el aviso del Ratoncito para esa noche                  | Adulto de guardia      |
| Queda poco de algo                   | Lo apunta a la compra                                           | Quien compra           |
| Algo caduca pronto                   | Lo sube en la propuesta de cena                                 | Quien cocina           |

## 5. Fases

**Ya hecho** (base): menú con el cole y equilibrio semanal, compra con voz y «lo de siempre», despensa («qué queda poco»), tareas por persona («Día de zafarrancho»), reparto, enviar por WhatsApp o calendario, cuentas y sincronización (a falta de probar con dos móviles reales).

1. **Para el cumpleaños de Ana (sábado):** probar la sincronización con vuestros dos móviles, la pantalla de felicitación con las palabras de Diego, y que Ana vea su nombre y su «Hoy toca».
2. **Semana siguiente — alivio inmediato:** módulo **Casa** (recurrente con responsable y aviso en «Hoy toca»), con la plantilla de sábanas y toallas, y el **calendario suscrito con alarmas**.
3. **Después — regalos:** sección Regalos con secreto (PIN, ocultación por persona, avisos discretos), calendario de ocasiones, «Operación Reyes» y Ratoncito Pérez.
4. **Después — cerebro completo:** reunión de los domingos, avisos push, panel de carga mental.
5. **Más adelante:** circulares del cole con IA, y migrar los datos a tablas por pantalla con permisos finos (necesario para el secreto fuerte y para otras familias).

## 6. Riesgos y decisiones abiertas

- **Más funciones pueden ser más carga.** Cada módulo se juzga por una pregunta: ¿quita una cosa que Ana tenga que recordar? Si no, no entra.
- **Que Diego use los avisos.** Todo el plan falla si los avisos no llegan al responsable. Por eso van en el calendario del móvil antes que en cualquier otra cosa.
- **Privacidad de menores** (D-029): los regalos y los dientes son datos de las niñas; hay que revisarlo antes de abrir la app a otras familias.
- **Secreto frente a sincronización:** hoy todo el plan viaja en un documento único; los regalos no deben ir ahí.
- **Qué usar para avisar** (calendario, push, correo o WhatsApp), y **quién lleva qué** de lo recurrente: se decide con los dos.
