import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Regla de dependencias entre capas (ver docs/arquitectura.md):
 *
 *   app → aplicacion → dominio
 *   infraestructura → aplicacion (implementa sus puertos) y dominio
 *
 * El dominio no conoce frameworks ni E/S; la aplicación no conoce Supabase ni la UI.
 */
const prohibido = (grupo, mensaje) => ({ group: grupo, message: mensaje });

const marcos = prohibido(
  ["next", "next/*", "react", "react-dom", "react/*", "server-only", "@supabase/*"],
  "Esta capa no puede depender de frameworks ni de Supabase.",
);
const node = prohibido(
  ["node:*", "fs", "path", "crypto", "http", "https"],
  "El dominio es puro: nada de E/S ni APIs de Node.",
);
const capa = (nombre, motivo) =>
  prohibido([`@/${nombre}`, `@/${nombre}/*`, `**/${nombre}`, `**/${nombre}/*`], motivo);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Desactiva las reglas de estilo que chocan con Prettier (Prettier se encarga del formato).
  prettier,
  {
    files: ["src/dominio/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            marcos,
            node,
            capa("aplicacion", "El dominio no depende de la capa de aplicación."),
            capa("infraestructura", "El dominio no depende de la infraestructura."),
            capa("app", "El dominio no depende de la UI."),
          ],
        },
      ],
    },
  },
  {
    files: ["src/aplicacion/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            marcos,
            capa(
              "infraestructura",
              "La aplicación usa puertos (interfaces); la infraestructura los implementa.",
            ),
            capa("app", "La aplicación no depende de la UI."),
          ],
        },
      ],
    },
  },
  {
    files: ["src/infraestructura/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [capa("app", "La infraestructura no depende de la UI.")] },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
