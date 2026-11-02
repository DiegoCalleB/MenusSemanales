# Cuenta y sincronización entre dispositivos

Qué hace, cómo funciona y qué hay que configurar a mano. Decisión: D-063.

## Qué hace

- **Entrar:** con el correo (te llega un código de 6 cifras) o **sin correo** (el dispositivo queda con acceso).
- **Hogar:** quien entra primero **crea el hogar** (lo que tenía en ese móvil pasa a ser el plan compartido) y genera un **código de invitación**; los demás entran y eligen «Unirme con un código».
- **Sincronización:** el plan completo (menú, compra, despensa, tareas…) es un documento con versión en Supabase (`hogar_estado`). Cada dispositivo aplica los cambios al instante y los sube a los 0,8 s; los demás los reciben en directo (Realtime) y al volver a abrir la app.
- **Dos personas a la vez:** si dos dispositivos cambian cosas distintas a la vez no se pierde ninguno: el que llega segundo baja lo nuevo y **reaplica sus cambios encima** (el reductor es puro). Probado con una nube simulada (`sincronizacion.test.ts`).
- **Sin red:** la app sigue funcionando; los cambios se suben al volver. Aviso «Sin conexión».

## Qué hay que configurar a mano (una vez)

1. **Base de datos:** aplicar la migración `supabase/migrations/…_hogar_estado.sql` (tabla `hogar_estado` con RLS y la función `guardar_estado_hogar`, y alta en Realtime).
2. **Supabase → Authentication:**
   - _Sign In / Providers → Allow anonymous sign-ins:_ **activar** (para «Entrar sin correo»).
   - _Email Templates → Magic Link:_ añadir `{{ .Token }}` al texto del correo para que llegue el **código de 6 cifras** (si solo lleva el enlace, el código no se ve).
   - _SMTP:_ el correo integrado de Supabase está muy limitado (pocos correos por hora). Para uso real, configurar un SMTP propio (por ejemplo Resend).
   - _URL Configuration:_ **Site URL** = la URL de la app en Railway.
3. **Railway → Variables** (son públicas, se incrustan al construir; después, **volver a desplegar**):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://inzyvqffesgjhvdrgdgg.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = la clave **publishable** (`sb_publishable_…`) del proyecto.
   - **Nunca** la clave `secret` ni `service_role`.

Sin las dos variables, la app funciona igual pero solo en el dispositivo (banner «Modo Diego»).

## Límites conocidos

- **«Entrar sin correo» es una sesión anónima:** si se borran los datos del navegador, ese dispositivo pierde el acceso y hay que pedir un código nuevo. Además, cualquiera puede abrir sesiones anónimas: es aceptable para un piloto familiar; antes de abrirlo a más familias hay que activar CAPTCHA y límites (D-029).
- **El plan completo viaja a la nube**, con los nombres de las personas del hogar (también las niñas) y sus tareas. Está protegido por RLS (solo miembros del hogar), pero antes del piloto con otras familias hace falta la revisión de privacidad (RGPD, menores) de D-029.
- **Un solo documento por hogar:** hasta 1,5 MB. Hoy el plan pesa decenas de KB.
- **No verificado con correo real:** las pruebas cubren el almacén, el conflicto de versiones y la base de datos (con mutaciones), no el envío real del código ni el Realtime sobre Supabase.
- **Si la estructura de los datos cambia** (nueva versión de la app), un dispositivo con la versión antigua verá «datos de otra versión» hasta que se actualice la página.
