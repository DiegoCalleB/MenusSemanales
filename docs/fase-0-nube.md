# Fase 0: dejar los datos a salvo en la nube

Objetivo: que lo que la familia ha hecho en la app deje de depender del navegador de cada móvil. Es la primera fase del plan `docs/plan-datos-en-tablas.md` y lo único que se hace antes del cumpleaños de Ana. Hasta ahora **Supabase está vacío** (0 usuarios, 0 hogares): todo vive en el navegador.

**Orden importante: primero el móvil de Diego** (el que tiene los datos reales). El primer móvil que se conecta **sube** lo suyo; los siguientes **reciben** lo de la familia y descartan lo propio (la app guarda antes una copia, pero mejor no depender de ella).

## 1. En Railway (lo hace Diego)

En el servicio de la app, pestaña **Variables**:

| Variable                               | Valor                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://inzyvqffesgjhvdrgdgg.supabase.co` (entera, sin comillas ni espacios)                                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La clave **Publishable** de Supabase (Project Settings → API Keys). **Empieza por `sb_publishable_`.** No la «anon» (`eyJ…`) ni la «secret». |
| `GOOGLE_CALENDAR_ICAL_URL`             | (opcional) el enlace del calendario de Google                                                                                                |

Después, **redespliega** (pulsa «Redeploy»): las variables `NEXT_PUBLIC_*` se incrustan al construir la imagen, no al arrancar.

## 2. En Supabase (lo hace Diego)

**Authentication → Sign In / Providers:**

- Activa **Allow anonymous sign-ins** (para «Entrar sin correo»).
- Activa **Email** y **Allow new users to sign up** (para entrar con código por correo).

**Authentication → Email Templates → Magic Link:** el texto debe incluir `{{ .Token }}` (el código de 6 cifras).

**Authentication → URL Configuration:** `Site URL` = la dirección de Railway.

(El correo que envía Supabase por defecto está muy limitado. Para uso real conviene configurar un SMTP propio. Para empezar, «Entrar sin correo» no lo necesita.)

## 3. En la app

1. Abre la app en el móvil de **Diego** → **Más → Cuenta**.
2. Mira «Estado del acceso»: debe salir ✅ en lo que vayas a usar. Si sale ⚠️, la propia pantalla dice qué activar. Si arriba dice **«⚠️ La nube no está bien configurada»**, vuelve al paso 1 (la clave o la URL no tienen la forma esperada).
3. **Descarga una copia de seguridad** («Copia de seguridad» → «Descargar copia de este móvil») y guárdala (correo, Drive, ordenador).
4. **Entrar sin correo** (o con correo) → **Crear hogar**. En ese momento se sube todo lo de ese móvil.
5. **Crear código de invitación** y mándaselo a Ana.
6. En el iPhone de **Ana**: abrir la dirección en **Safari**, **Compartir → Añadir a pantalla de inicio**, abrir **la app instalada** (no Safari: tiene almacenamiento aparte), **Más → Cuenta → Entrar** y **Unirme** con el código.
7. Comprobar que Ana ve lo mismo que Diego.

## 4. Comprobar que está a salvo

- En Supabase → Table Editor: `hogar` y `miembro` con filas, y `hogar_estado` con **1 fila** (el plan completo en un documento). Las demás tablas (`persona`, `plato`…) **seguirán vacías**: no se usan hasta las fases siguientes.
- Un cambio en un móvil aparece en el otro en unos segundos.

## Si algo va mal

- **Cada móvil tiene su copia de seguridad** (descargada) y, si la nube sustituyó lo de un móvil, **una copia automática** en «Copia de seguridad → Copias automáticas».
- **Restaurar** una copia solo se permite **sin la cuenta conectada** (para no sobrescribir lo de la familia).
- Si Supabase rechaza algo, el mensaje de «Cuenta» lo cuenta en cristiano; si no, dime qué pone.
