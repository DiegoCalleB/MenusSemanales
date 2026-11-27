# Conchi, en Alexa (D-214, D-215)

Una skill propia y privada, solo para vuestra casa (no se publica en la tienda de Alexa). Se llama **Conchi**.

## Qué se le puede decir

Siempre con «dile a Conchi…» o «pregúntale a Conchi…» (o «Alexa, abre Conchi» y seguir).

**Apuntar**

| Dices                                                            | Pasa                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| «Alexa, dile a Conchi que añada leche y pan»                     | Van a la lista de la compra.                                                              |
| «…que apunte llamar al dentista»                                 | Va a Pendientes.                                                                          |
| «…que apunte el jueves a las seis el psicotécnico»               | Conchi repite el día y la hora y pregunta «¿Apunto…? Di sí o no». Con un sí, va a Fechas. |
| «…que apunte pañales, llamar al fontanero y el viernes pediatra» | Una IA lo reparte: la compra y los pendientes se guardan; las citas se confirman.         |
| «…que ya he hecho la lavadora»                                   | Marca esa tarea de casa como hecha.                                                       |

**Preguntar**

| Dices                                  | Contesta                                   |
| -------------------------------------- | ------------------------------------------ |
| «qué hay de cena»                      | La cena de hoy y la comida del cole.       |
| «qué tengo hoy» / «qué tengo mañana»   | Las citas y fechas señaladas.              |
| «qué se lleva mañana al cole»          | Lo que hay que dejar preparado esta noche. |
| «qué toca hacer en casa»               | Las tareas de casa de hoy.                 |
| «qué tiempo hace»                      | Frío, lluvia, paraguas y abrigo.           |
| «dame el resumen» / «qué avisos tengo» | Todo lo anterior, solo lo que haya.        |

**Privacidad:** Conchi solo habla de compra, cena, citas, casa, mochila y tiempo. Nunca de Mi día, objetivos, notas, medicación ni Cuidarse. Tampoco guarda notas: eso es personal y no se sabe quién habla.

**Recordatorios con hora (D-216)**

| Dices                                         | Pasa                                                                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «…que me recuerde a las seis sacar la basura» | Alexa pone un recordatorio y **el Echo lo dice en voz alta a esa hora**. Sin «de la mañana/tarde», las seis son las 18:00 (de 1 a 7 tarde, de 8 a 11 mañana; sin día, la próxima vez que llegue esa hora). |
| «…que me avise en media hora de…»             | Igual, con la hora calculada.                                                                                                                                                                              |

La primera vez, Conchi pide permiso con una tarjeta en la app de Alexa: se acepta una vez y se vuelve a pedir.

**Quitar y deshacer**

| Dices                                  | Pasa                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| «borra lo último» / «me he equivocado» | Quita lo último que se apuntó por voz (compra, pendiente o cita) en las dos últimas horas. |
| «quita la leche de la compra»          | La quita de la lista.                                                                      |

**Leer más cosas**

| Dices                                                                                                      | Contesta                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| «qué hay en la compra» / «hay leche en la compra»                                                          | Lo apuntado a mano en la compra y sin comprar (no incluye lo que sale del menú).                                                                  |
| «qué pendientes tenemos»                                                                                   | Los pendientes sin fecha.                                                                                                                         |
| «qué vence pronto»                                                                                         | Los papeles que vencen en dos meses.                                                                                                              |
| «hay partido hoy»                                                                                          | El Metropolitano.                                                                                                                                 |
| «cuándo fue la última vez que cambiamos las sábanas», «cuándo es el cumple de Ana», «quién saca la basura» | Una IA contesta **solo con los datos de la casa** (citas, cumples, casa, comidas, mochila, pendientes, papeles). Si no está, dice que no lo sabe. |

**Quién habla**

Con un perfil de voz en la app de Alexa, di una vez «soy Diego» y Conchi recuerda tu voz: te saluda por tu nombre y «qué me toca» lee tus tareas de casa de hoy. Sin perfil de voz, todo funciona igual pero sin nombre.

**Notificación a la familia:** cada vez que Conchi apunta algo (compra, pendiente, cita confirmada, tarea hecha), los móviles de la casa reciben «🗣️ Conchi ha apuntado…» (como mucho una cada 15 segundos).

## Cómo funciona

- Alexa llama a `POST https://<la app>/api/alexa/<token>`. El token es el del calendario del hogar (el de «Más → Enviar»); la dirección completa se copia de ahí: «Copiar la dirección para Alexa».
- La app comprueba que la petición viene de Amazon (firma y certificado) y de **vuestra skill** (`ALEXA_SKILL_ID`). Sin eso, no contesta.
- Lo que se pide para guardar va a una cola (`alexa_entrada`) y el primer móvil que abre la app con la cuenta conectada lo recoge y lo guarda donde toca; cada cosa la recibe un solo móvil. Tope: 60 cosas al día.
- Las frases libres y las preguntas las resuelve la IA de la app (Gemini), con límite de tiempo (Alexa corta a los 8 s) y dentro del mismo tope diario que la IA de la app (40 al día por hogar).
- Si falta `ALEXA_SKILL_ID`, el endpoint está apagado (503).

## Puesta en marcha (una vez, ~10 minutos)

1. Entra en <https://developer.amazon.com/alexa/console/ask> con **la misma cuenta de Amazon que usan vuestros Echo**.
2. **Create Skill** → nombre «¡Hecho!» (el que quieras), idioma **Spanish (ES)**, tipo **Custom**, hosting **Provision your own**, plantilla **Start from scratch**.
3. **Build → Interaction Model → JSON Editor**: pega todo el contenido de `alexa/modelo-es-ES.json` → **Save** → **Build Model**. Cada vez que cambie ese archivo, se pega y se construye de nuevo.
4. **Build → Endpoint → HTTPS**: en _Default Region_ pega la dirección copiada de la app. En el certificado elige **«My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority»**. **Save Endpoints**.
5. Copia el **Skill ID** y ponlo como variable `ALEXA_SKILL_ID` en Railway (no es secreto).
6. **Test → Development** y escribe «abre conchi», y luego «añade leche».
7. En el Echo: «Alexa, dile a Conchi que añada leche».

### Dos ajustes más en la consola (para los recordatorios y la voz)

- **Permisos:** en **Build → Permissions** activa **Reminders** (recordatorios). Sin esto, «recuérdame a las seis…» pide un permiso que la skill no tiene.
- **Voz de cada persona:** en la app de Alexa, **Más → Ajustes → Cuenta → Reconocimiento de voz** (o «Voice ID»), cada persona crea su perfil de voz. Después, una vez: «Alexa, dile a Conchi que soy Diego».

## El nombre de la skill

El **nombre de invocación** (`conchi` en el modelo) es lo que se dice a Alexa; el nombre de la lista de skills es otra cosa. No uses «hecho»: Alexa lo entiende como «echo». Si lo cambias, cambia `invocationName` en el modelo y construye de nuevo.

## Si algo no va

- _«Hubo un problema con la skill»_: el endpoint no contesta bien. Revisa `ALEXA_SKILL_ID` y la dirección.
- _«No encuentro vuestra casa»_: el token ya no vale (se regeneró el enlace del calendario). Copia otra vez la dirección y pégala en el Endpoint.
- _Apuntado, pero no sale en la app_: se recoge al abrir la app con la cuenta conectada.
- _Alexa no entiende una frase_: apúntala y se añade al modelo.
