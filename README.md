# Menús Semanales

Aplicación web privada para planificar los menús semanales de una familia: opciones equilibradas
por comida (adaptadas al comedor del cole), despensa y nevera, y lista de la compra compartida en
tiempo real. Diseñada desde el primer día para varios hogares.

Trabajo Fin de Máster · Máster de Desarrollo con IA (The Big School).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · Supabase (Postgres 17,
Auth, RLS, Realtime) · zod · Vitest · Playwright · Docker en Railway · PWA mobile-first.

## Puesta en marcha

Requisitos: Node 22 y pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # y rellena las claves (nunca las subas al repositorio)
pnpm dev                     # http://localhost:3000
```

## Scripts

| Script                         | Qué hace                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| `pnpm dev`                     | Servidor de desarrollo                                           |
| `pnpm build`                   | Build de producción                                              |
| `pnpm lint`                    | ESLint (sin avisos permitidos)                                   |
| `pnpm format` / `format:check` | Prettier                                                         |
| `pnpm typecheck`               | Genera los tipos de rutas de Next y ejecuta `tsc`                |
| `pnpm test` / `test:coverage`  | Tests unitarios (Vitest)                                         |
| `pnpm test:db`                 | Migraciones + tests de aislamiento RLS sobre un Postgres efímero |
| `pnpm check`                   | Lint, tipos, formato y tests                                     |

## Estructura

```
.github/workflows/   CI (calidad + base de datos)
docs/                Decisiones, infraestructura y uso de IA (material de la memoria)
scripts/             Utilidades (tests de base de datos, importación del seed)
src/app/             UI: rutas (App Router) y Server Actions finas
src/aplicacion/      Casos de uso y puertos (interfaces de repositorio)
src/dominio/         Reglas de negocio puras: menú, compra, despensa
src/infraestructura/ Supabase (clientes, tipos, repositorios) y variables de entorno
supabase/            Configuración, migraciones y tests SQL
```

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Seguridad desde el diseño](docs/seguridad.md)
- [Decisiones técnicas](docs/decisiones.md)
- [Infraestructura](docs/infraestructura.md)
- [Uso de IA en el desarrollo](docs/uso-de-ia.md)
