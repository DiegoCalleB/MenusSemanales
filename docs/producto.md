# Producto: de una familia a todo el cole

## Visión

Una app que le quita a una familia la carga mental de la semana: **qué cenamos, qué hay que comprar, qué toca hacer en casa y qué pasa en el cole**. Empieza en una casa y está pensada para que la use cada familia de la clase.

## La idea que hace que funcione: el cole es compartido

El menú del comedor es **el mismo para todas las familias del colegio**. Si cada familia lo teclea, la app es un trabajo; si lo carga una sola vez y lo ven todas, es una ventaja.

> Una familia sube el menú del mes → las otras 30 abren la app y **ya tienen la semana adaptada** a lo que comen sus hijos en el cole.

Es el efecto red del producto, y el motivo de que cada familia nueva lo haga mejor, no más pesado. Lo mismo sirve para el calendario escolar (festivos, excursiones, material que traer).

### Experiencia de alta (objetivo: menos de 2 minutos)

1. Una familia recibe un enlace o código en el grupo de WhatsApp de la clase.
2. Crea su hogar y añade a las personas (con alias).
3. Elige su cole con el código: **el menú del mes ya está cargado**.
4. Pulsa "generar semana" y ve opciones de cena que complementan lo que comen en el cole.

## Modelo de datos: qué es de cada hogar y qué se comparte

| Dato                                                         | Ámbito                   | Quién escribe                    | Quién lee                    |
| ------------------------------------------------------------ | ------------------------ | -------------------------------- | ---------------------------- |
| Personas, asistencia, despensa, compra, tareas, valoraciones | **Hogar** (privado)      | Miembros del hogar               | Miembros del hogar           |
| Catálogo de platos del hogar                                 | Hogar                    | Miembros                         | Miembros                     |
| Biblioteca de platos candidatos                              | **Global**, solo lectura | Curación del proyecto            | Todos los hogares            |
| Menú del comedor, calendario escolar                         | **Centro** (compartido)  | Hogares vinculados, con revisión | Hogares vinculados al centro |

Esto es una **excepción deliberada** al aislamiento por hogar. Se controla así:

- El vínculo hogar ↔ centro se hace **a nivel de hogar, nunca de niño**. No se comparte quién es cada niño ni a qué clase va.
- **Versionado y autoría:** cada cambio al menú queda registrado (quién, cuándo, valor anterior) y se puede revertir.
- **Rol de curador** por centro (las primeras familias) para validar cambios; el resto propone.
- **Aviso de error** de un toque ("esto no es lo que sirvió el cole").
- Los tests de RLS demuestran que un hogar vinculado al centro **sigue sin ver nada privado de otro hogar**.

## "Organizar la vida": módulos y prioridad

Cada módulo sigue el mismo patrón (datos por hogar, más una parte compartida por centro cuando tiene sentido), así que añadirlos es barato una vez resuelta la base.

| #   | Módulo                                                        | Valor    | Esfuerzo | Fase                  |
| --- | ------------------------------------------------------------- | -------- | -------- | --------------------- |
| 1   | Menú semanal con opciones, adaptado al cole                   | Muy alto | Alto     | **MVP**               |
| 2   | Lista de la compra automática + manual (sustituye a Keep)     | Muy alto | Medio    | **MVP**               |
| 3   | Despensa y nevera, con mínimos                                | Alto     | Medio    | **MVP**               |
| 4   | Menú del cole compartido por centro                           | Muy alto | Bajo     | **MVP** (diferencial) |
| 5   | Tareas del hogar recurrentes (sábanas, filtros…)              | Alto     | Bajo     | 2                     |
| 6   | Calendario escolar compartido y material a traer              | Alto     | Medio    | 2                     |
| 7   | Recordatorios push                                            | Alto     | Medio    | 2                     |
| 8   | Leer el menú del cole desde una foto o PDF (IA, con revisión) | Alto     | Medio    | 3                     |
| 9   | Cumpleaños, regalos, tupper y merienda                        | Medio    | Bajo     | 3                     |

Regla: **no se añade un módulo hasta que el anterior se usa de verdad** en casa.

## Calidad que se exige (porque lo usarán otros)

- **Accesibilidad** WCAG 2.2 AA: contraste, tamaños táctiles, navegación por teclado, lectores de pantalla.
- **Rendimiento:** carga rápida en móvil con datos limitados; presupuesto de tamaño de JavaScript.
- **Sin conexión** para la lista de la compra (en el súper no siempre hay cobertura).
- **Español** en toda la interfaz y mensajes de error comprensibles.
- **Observabilidad:** errores en producción con Sentry, sin datos personales en los registros.
- **Soporte:** una página de ayuda, un canal de contacto y copias de seguridad probadas.

## Privacidad y responsabilidad (decisión importante)

En cuanto otras familias usan la app, **quien la publica es responsable del tratamiento** de sus datos según el RGPD, y se trata de datos de menores. Esto no es un detalle técnico:

| Obligación                 | Cómo se cubre                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Minimización               | De los niños, solo alias, tipo y factor de ración. Sin apellidos, fotos, fecha de nacimiento ni clase |
| Información                | Política de privacidad y condiciones de uso claras, en español                                        |
| Base legal                 | Ejecución del servicio que el usuario adulto solicita; consentimiento donde corresponda               |
| Derechos                   | Exportar y borrar todos los datos del hogar desde la app                                              |
| Encargados del tratamiento | Supabase y Railway, con sus acuerdos de tratamiento de datos (DPA)                                    |
| Brechas                    | Procedimiento y plazo de 72 h de aviso a la AEPD                                                      |
| Datos en la UE             | Supabase eu-west-1 y Railway EU West                                                                  |

**Esto no sustituye al asesoramiento legal.** Antes de abrir la app a todo el colegio recomiendo una consulta breve (por ejemplo, con el AMPA) y avisar al centro: el menú del comedor suele ser información pública, pero conviene su visto bueno.

## Hoja de ruta de lanzamiento

1. **Tu familia** (ahora): producto mínimo funcionando y desplegado.
2. **Piloto de 3-5 familias** de la clase, con consentimiento y feedback semanal.
3. **Apertura al curso o al colegio** por código de centro, tras la revisión legal y con soporte básico.
4. **Más centros**, si el modelo funciona.

## Qué cuenta como éxito

- Una familia nueva llega a su **primera semana planificada en menos de 5 minutos**.
- **Al menos el 70 % de las familias del piloto** siguen usándola a las 4 semanas.
- Cero incidentes de acceso entre hogares (verificado por los tests de RLS y revisiones).
