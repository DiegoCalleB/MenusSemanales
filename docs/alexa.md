# Alexa (D-214)

Una skill propia y privada, solo para vuestra casa (no se publica en la tienda de Alexa). Tres cosas:

| Dices                                       | Pasa                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| «Alexa, dile a Hecho que añada leche y pan» | Se apuntan en la lista de la compra de la app (en cuanto un móvil abre la app). |
| «Alexa, pregúntale a Hecho qué hay de cena» | Lee la cena de hoy y lo que han comido en el cole.                              |
| «Alexa, pregúntale a Hecho qué tengo hoy»   | Lee las citas y fechas señaladas de hoy.                                        |

**Privacidad:** Alexa solo habla de la compra, la cena y las citas. Nunca de Mi día, objetivos, notas, medicación ni Cuidarse.

## Cómo funciona

- Alexa llama a `POST https://<la app>/api/alexa/<token>`. El token es el del calendario del hogar (el de «Más → Enviar»); la dirección completa se copia de ahí: «Copiar la dirección para Alexa».
- La app comprueba que la petición viene de Amazon (firma y certificado) y de **vuestra skill** (`ALEXA_SKILL_ID`). Sin eso, no contesta.
- Lo pedido para la compra se guarda en `compra_alexa` (D-214) y el primer móvil que abre la app lo recoge y lo añade a la lista; cada producto lo recibe un solo móvil. Tope: 40 productos al día.
- Si falta `ALEXA_SKILL_ID`, el endpoint está apagado (503).

## Puesta en marcha (una vez, ~10 minutos)

1. Entra en <https://developer.amazon.com/alexa/console/ask> con **la misma cuenta de Amazon que usan vuestros Echo** (si no tienes cuenta de desarrollador, se crea gratis).
2. **Create Skill** → nombre «¡Hecho!», idioma **Spanish (ES)**, tipo **Custom**, hosting **Provision your own**, plantilla **Start from scratch**.
3. **Build → Interaction Model → JSON Editor**: pega todo el contenido de `alexa/modelo-es-ES.json` → **Save** → **Build Model**. (Si la consola pide un nombre de invocación de dos palabras, pon «casa hecha» y habla con «dile a casa hecha…».)
4. **Build → Endpoint → HTTPS**: en _Default Region_ pega la dirección copiada de la app. En el tipo de certificado elige **«My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority»**. **Save Endpoints**.
5. Copia el **Skill ID** (arriba, en la misma pantalla de Endpoint, `amzn1.ask.skill.…`) y ponlo como variable `ALEXA_SKILL_ID` en Railway (no es secreto). Hasta entonces la skill no contesta.
6. **Test → Development** y escribe «dile a hecho que añada leche». Abre la app y comprueba que «leche» está en la compra.
7. En el Echo: la skill en desarrollo ya está disponible en todos los dispositivos de esa cuenta. «Alexa, dile a Hecho que añada leche».

## Si algo no va

- _«Hubo un problema con la skill»_: el endpoint no contesta bien. Revisa que `ALEXA_SKILL_ID` está puesto y es el de esta skill, y que la dirección es la de la app (con el token).
- _«No encuentro vuestra casa»_: el token de la dirección no vale (se ha regenerado el enlace del calendario). Copia otra vez la dirección de la app y pégala en el Endpoint.
- _Apuntado, pero no sale en la app_: se recoge al abrir la app con la cuenta conectada; abre o vuelve a la app.
