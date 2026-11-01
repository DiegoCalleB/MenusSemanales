# Infraestructura

## Entornos

| Entorno | Uso | Base de datos | Despliegue |
|---|---|---|---|
| Local | Desarrollo y tests | `supabase start` (Docker) o Postgres 16 efímero con shim de `auth` | `pnpm dev` |
| CI | Lint, tipos, tests unitarios y de RLS | Postgres efímero en GitHub Actions | — |
| Producción | Uso real de la familia | Supabase `menus-semanales` (eu-west-1) | Vercel (`dub1`) |

Staging/previews: Supabase Branching cuando el proyecto pase a plan Pro.

## Supabase: configuración objetivo

| Área | Configuración | Fase |
|---|---|---|
| Región | eu-west-1 (Irlanda) | 1 |
| Esquema | Solo vía migraciones del repo (`supabase/migrations`) | 1 |
| RLS | Activada y forzada en todas las tablas; políticas por pertenencia a hogar | 1 |
| Advisors | Seguridad + rendimiento tras cada migración, sin avisos abiertos | 1 |
| Tipos | `supabase gen types typescript` → `src/lib/supabase/database.types.ts` | 1 |
| Claves | Publishable en cliente; secret solo en servidor/CI/scripts | 1 |
| Auth | Magic link + Google; redirecciones localhost y Vercel; alta por invitación | 3 |
| Email | SMTP propio con Resend (el integrado tiene límites de prueba) | 3 |
| Realtime | Solo tablas de colaboración (comidas, compra, despensa, tareas) | 3 |
| Storage | Bucket privado por hogar para menús del cole (foto/PDF) | 4 |
| Edge Functions | Extracción con IA; clave de API como secreto | 4 |
| pg_cron | Recordatorios de tareas de casa | 3 |
| Copias | Diarias con plan Pro (recomendado antes de uso real prolongado) | — |

## Secretos

Nunca en git. Plantilla en `.env.example`.

| Variable | Dónde vive |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel, `.env.local` |
| `SUPABASE_SECRET_KEY` | Vercel (server), `.env.local`, script de importación |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | Secretos de GitHub (despliegue de migraciones) |

## Flujo de migraciones

1. Crear migración en local (`supabase migration new <nombre>`).
2. Tests de RLS en local y en CI.
3. Revisión en PR.
4. Merge a `main` → despliegue explícito (`supabase db push`) → advisors.
