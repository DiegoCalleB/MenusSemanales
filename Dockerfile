# syntax=docker/dockerfile:1
#
# Imagen de producción para Railway (ver docs/seguridad.md y docs/infraestructura.md).
# - Imagen base fijada por digest (reproducible; Dependabot la actualiza).
# - Construcción en etapas: la imagen final no contiene código fuente, herramientas ni
#   dependencias de desarrollo, solo el servidor autónomo de Next.
# - Se ejecuta como usuario sin privilegios y el código es de solo lectura para ese usuario.
# - Ningún secreto entra en la imagen: solo las variables NEXT_PUBLIC_*, que son públicas.

FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# --- Dependencias (capa cacheable, lockfile congelado) -----------------------------------
FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build -------------------------------------------------------------------------------
FROM base AS build
RUN corepack enable
# Railway pasa las variables del servicio como argumentos de build si se declaran aquí.
# Next incrusta las NEXT_PUBLIC_* en el código en tiempo de build.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Ejecución ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Código propiedad de root (el proceso no puede modificarlo); solo la caché es escribible.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000
CMD ["node", "server.js"]
