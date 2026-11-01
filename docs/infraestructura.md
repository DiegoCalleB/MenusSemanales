# Infraestructura

## Proyecto de producción

| Dato           | Valor                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Nombre         | Menus Semanales                                                                                            |
| Ref            | `inzyvqffesgjhvdrgdgg`                                                                                     |
| URL de la API  | https://inzyvqffesgjhvdrgdgg.supabase.co                                                                   |
| Región         | eu-west-1 (Irlanda)                                                                                        |
| Postgres       | 17                                                                                                         |
| Creado         | 2026-11-01                                                                                                 |
| Estado inicial | Sin tablas ni migraciones · advisor de seguridad sin avisos · 1 aviso INFO de rendimiento aceptado (D-011) |

La ref y la URL no son secretas: la URL viaja al navegador en cualquier app de Supabase. Las claves sí lo son y nunca se guardan en el repositorio.

## Entornos

| Entorno    | Uso                                   | Base de datos                                                      | Despliegue        |
| ---------- | ------------------------------------- | ------------------------------------------------------------------ | ----------------- |
| Local      | Desarrollo y tests                    | `supabase start` (Docker) o Postgres 17 efímero con shim de `auth` | `pnpm dev`        |
| CI         | Lint, tipos, tests unitarios y de RLS | Contenedor `postgres:17` en GitHub Actions                         | —                 |
| Producción | Uso real de la familia                | Supabase `menus-semanales` (eu-west-1)                             | Railway (EU West) |

Staging/previews: Supabase Branching cuando el proyecto pase a plan Pro.

## Supabase: configuración objetivo

| Área           | Configuración                                                                          | Fase |
| -------------- | -------------------------------------------------------------------------------------- | ---- |
| Región         | eu-west-1 (Irlanda)                                                                    | 1    |
| Esquema        | Solo vía migraciones del repo (`supabase/migrations`)                                  | 1    |
| RLS            | Activada y forzada en todas las tablas; políticas por pertenencia a hogar              | 1    |
| Advisors       | Seguridad + rendimiento tras cada migración, sin avisos abiertos                       | 1    |
| Tipos          | `supabase gen types typescript` → `src/infraestructura/supabase/database.types.ts`     | 1    |
| Claves         | Publishable en cliente; secret solo en servidor/CI/scripts                             | 1    |
| Auth           | Magic link + Google; redirecciones localhost y dominio de Railway; alta por invitación | 3    |
| Email          | SMTP propio con Resend (el integrado tiene límites de prueba)                          | 3    |
| Realtime       | Solo tablas de colaboración (comidas, compra, despensa, tareas)                        | 3    |
| Storage        | Bucket privado por hogar para menús del cole (foto/PDF)                                | 4    |
| Edge Functions | Extracción con IA; clave de API como secreto                                           | 4    |
| pg_cron        | Recordatorios de tareas de casa                                                        | 3    |
| Copias         | Activas desde el primer día (el panel muestra copias de seguridad realizadas)          | —    |

## Secretos

Nunca en git. Plantilla en `.env.example`.

| Variable                                                                | Dónde vive                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                              | Railway (variable del servicio, también en build), `.env.local`  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                  | Railway (variable del servicio, también en build), `.env.local`  |
| `SUPABASE_SECRET_KEY`                                                   | Solo donde se use (script de importación), nunca en el navegador |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | Secretos de GitHub (despliegue de migraciones)                   |

## Migraciones aplicadas

| Versión          | Nombre                             | Contenido                                                                         |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| `20261101131702` | `fundacion_hogares`                | Hogares, miembros, invitaciones, personas y asistencia, con RLS                   |
| `20261101131747` | `indices_claves_foraneas`          | Índices de claves foráneas                                                        |
| `20261101135511` | `centro_compartido`                | Centro, códigos, menú del cole con historial; corrección del derecho de supresión |
| `20261101143913` | `catalogo_platos`                  | Ingredientes, platos del hogar, biblioteca comunitaria y moderación               |
| `20261101143940` | `administrador_politica_explicita` | Política que deniega todo acceso a la lista de administradores                    |

## Flujo de migraciones

1. Crear migración en local (`supabase migration new <nombre>`).
2. Tests de RLS en local y en CI.
3. Revisión en PR.
4. Merge a `main` → despliegue explícito (`supabase db push`) → advisors.

## Despliegue en Railway

| Elemento     | Configuración                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Construcción | `Dockerfile` (definido en `railway.json`)                                                                                                                                                           |
| Región       | EU West (Ámsterdam), próxima a Supabase eu-west-1                                                                                                                                                   |
| Salud        | `GET /api/salud` → `{"estado":"ok"}` (Railway espera a que responda antes de dar tráfico)                                                                                                           |
| Reinicio     | Ante fallo, hasta 3 intentos                                                                                                                                                                        |
| Variables    | `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como variables del servicio. Railway las pasa también como argumentos de build, necesarios porque Next las incrusta al compilar |
| Despliegue   | Automático al hacer push a `main` (cuando exista), tras pasar la CI                                                                                                                                 |

### Pasos de alta (una vez, en el panel de Railway)

1. New Project → Deploy from GitHub repo → `DiegoCalleB/MenusSemanales`.
2. Settings → Region: EU West.
3. Variables: las dos `NEXT_PUBLIC_*` (valores en Supabase → Project Settings → API).
4. Settings → Networking → Generate Domain (o dominio propio).
5. Añadir ese dominio a las URLs de redirección de Supabase Auth.
6. Activar "Wait for CI" para que no se despliegue un commit con la CI en rojo.
