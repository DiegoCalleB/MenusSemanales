# Backlog de ¡Hecho!

Lo que se ha hablado y aún no está hecho, para que no se nos olvide. Lo hecho se queda en
[`decisiones.md`](decisiones.md). Orden aproximado de más a menos prioritario dentro de cada bloque.
Cada idea lleva una nota de **cómo sería** y, si la hay, una **precaución de diseño**.

## En marcha (fases acordadas)

- [x] Buscador global y buscador en Fechas (D-177).
- [x] Una sola caja con IA (D-178): escribir o dictar varias cosas y que se repartan en compra, evento, pendiente o papel, con un modal para elegir qué se apunta.
- [ ] «Pregúntale a tu casa»: preguntas en lenguaje natural sobre los datos del hogar (dentro del buscador).

## Ideas aceptadas, para más adelante

### 8. Plantillas reutilizables

Listas que se repiten y se clonan con un toque: «maleta de playa», «maleta de fin de semana», «rutina de
la mañana», «cosas del cumple de un niño». Al clonar se elige qué entra (como el modal de la compra) y
se manda a donde corresponda (compra, pendientes, mochila).
**Precaución:** pocas plantillas y fáciles de crear desde algo que ya existe («guardar esta lista como
plantilla»), para no tener que escribirlas desde cero.

### 9. Reglas sencillas de despensa, nevera y compra

El miedo: que no se lleve al día y no sirva para nada. Por eso, el diseño parte de **no pedir
mantenimiento**:

1. **Se alimenta de lo que ya se hace.** Al marcar algo como comprado, la despensa lo sabe. No hay que
   contar gramos: un botón grande de «se acabó» basta.
2. **Pocos básicos, no todo el inventario.** Se vigila una lista corta (leche, huevos, aceite, pan, café,
   papel…), no cada tarro.
3. **Nunca afirma, pregunta.** Si no se toca algo en un tiempo, dice «¿sigue habiendo leche?», no «hay
   leche». Un repaso semanal de 30 segundos (sí/no sobre diez básicos) sustituye al inventario completo.
4. **Propone, no hace.** Todo pasa por un modal para aceptar o descartar (como D-157: la app no sabe
   bien lo que hay en casa).
5. **Aprende los ritmos.** Si «se acabó la leche» se marca cada seis días, recuerda comprarla al quinto.

Reglas candidatas: «se acabó X» → a la compra; «X suele acabarse cada N días» → recordar; algo
próximo a caducar → proponer una cena que lo gaste; pendientes de compra que llevan días sin comprarse
→ avisar el sábado.

### 11. Pantalla de nevera

Un modo de la app para una tablet o un móvil viejo apoyado en la cocina, **sin tocarlo casi nunca**.
Pantalla completa, letra grande, la pantalla encendida y sin menús. Se actualiza sola y enseña:

- la hora y el día, el tiempo y si llueve;
- qué se cena hoy, qué comen en el cole y quién cocina;
- lo que hay que dejar preparado esta noche (mochila, paraguas) y lo de mañana;
- las próximas tres citas y los cumpleaños del mes;
- los pendientes importantes y los papeles que vencen pronto;
- unos botones grandes de «se acabó…» (leche, pan, huevos…) que añaden a la compra con un toque.

Es la forma de que la app esté presente sin abrirla (y de que los niños la vean). La tablet iniciaría
sesión una vez con la cuenta de la familia. Pendiente de decidir: si el modo es solo lectura (más
seguro) o con los botones de «se acabó».

### 12. Conexión con Obsidian

Obsidian es una app de notas que guarda **archivos de texto (Markdown) en tu ordenador**, sin nube. Para
qué serviría conectarlo, de más a menos útil:

1. **Copia de seguridad en un formato abierto.** Exportar todo a archivos `.md` para que los datos
   sean de la familia y se puedan abrir con cualquier cosa, aunque la app desapareciera.
2. **Diario de la familia.** Cada día un archivo `2026-11-17.md` con lo que se cenó, lo hecho, las
   citas y alguna foto: un diario que se escribe solo.
3. **Recetas.** Los platos como notas con sus ingredientes, enlazables entre sí.
4. **Ver el calendario y los papeles dentro de las notas** de quien ya use Obsidian.

Es sobre todo valioso si ya usas Obsidian para otras cosas. Si no, lo más rentable es la exportación a
Markdown (punto 1): barata y útil por sí sola. Se decide más adelante.

## Otras ideas pendientes

- **Garantías y documentos con foto.** Fotografiar el ticket; la IA saca la fecha de compra y los años
  de garantía y crea el vencimiento en Papeles. Guardar también el manual en PDF.
- **Libro de la casa.** Notas y contactos con buscador: el fontanero, el teléfono del colegio, las
  tallas de ropa, cómo se resetea el router. Sin contraseñas.
- **Revisión del domingo.** Pantalla guiada de dos minutos: pendientes que llevan tiempo, papeles que
  vencen, menú de la semana, citas (la revisión semanal de GTD).
- **«Hace un año hoy».** Un diario mínimo (una foto o una línea al día) y el recuerdo de hace un año.
- **Menciones y comentarios** en cada cosa («@Ana, ¿lo haces tú?»).
- **Turnos de la semana:** quién recoge a los niños, quién cocina, extraescolares, con aviso de «hoy te
  toca».
- **Salud de los niños:** revisiones y vacunas con fecha y recordatorio (cabe en Papeles).
- **Gastos del hogar:** cuánto se gasta al mes en comedor, compra y extraescolares.
- **Cenas según lo que hay en la despensa** (siempre como propuesta con modal).
- **Tablón de la nevera:** notas sueltas que ve toda la familia.
- **Aprender gustos también fuera de los planes del barrio** (restaurantes, regalos) con 👍/👎.
- **Aviso del viernes elegido según los gustos** y aprender también de las puntuaciones de las citas.
- **Menú del cole: dietas especiales** (hoy solo se lee el menú normal).
- **Papeles y vencimientos:** adjuntar la foto del documento y leer la fecha con IA.

## Pendiente por hacer (nuestro)

- **Resend y circulares por correo:** poner `RESEND_API_KEY` con acceso completo,
  `CORREO_CIRCULARES_DOMINIO` y el webhook `email.received` a `/api/circulares/correo` (D-147).
- **Notificaciones de Ana:** que active las suyas para que le llegue lo suyo.
- **Next.js:** `next build` avisa a veces de una vulnerabilidad conocida (`next upgrade --agent=security`).
  Decidir si se actualiza.

## Descartado (de momento)

- **Rellenar la lista de la compra sola con el menú:** la app no sabe lo que hay en casa; se propone y se
  elige (D-157).
- **Copiar el calendario a Google con un script (GAS-ICS-Sync) o con n8n:** crea copias de los eventos;
  se prefiere la suscripción por enlace, aunque Google tarde en refrescarla.
- **Cenas según el tiempo.**
