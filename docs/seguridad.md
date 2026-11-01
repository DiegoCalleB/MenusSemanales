# Seguridad desde el diseño

La seguridad no se añade al final: cada decisión de arquitectura parte de la pregunta "¿qué puede salir mal?", y cada control tiene una **verificación automática** que falla si alguien lo rompe.

## Principios

1. **Mínimo privilegio:** cada rol (navegador, servidor, CI, contenedor) tiene solo los permisos que necesita.
2. **Defensa en profundidad:** varias capas independientes; si una falla, la siguiente contiene el daño.
3. **Seguro por defecto:** lo que no se permite explícitamente está denegado (RLS, CSP, permisos del navegador).
4. **Minimización de datos:** solo se guarda lo necesario; de las niñas, un alias.
5. **Verificable:** cada control tiene un test que se ejecuta en CI, y los tests de seguridad se validan con mutaciones.

## Activos y actores

| Activo                                                | Por qué importa                                 |
| ----------------------------------------------------- | ----------------------------------------------- |
| Datos del hogar (personas, horarios, menús, despensa) | Revelan rutinas familiares y datos de menores   |
| Cuentas de los miembros                               | Dan acceso a todo lo anterior                   |
| Clave secreta de Supabase                             | Ignora la RLS: acceso total a todos los hogares |
| Disponibilidad de la app                              | Uso diario (compra en el súper)                 |

| Actor                    | Capacidad                                                       |
| ------------------------ | --------------------------------------------------------------- |
| Visitante anónimo        | Acceso a la URL pública                                         |
| Usuario de otro hogar    | Cuenta válida, intenta ver o tocar datos ajenos                 |
| Contenido malicioso      | Texto que acaba en la página (nombre de plato, respuesta de IA) |
| Dependencia comprometida | Código de terceros ejecutándose en build o en el navegador      |

## Modelo de amenazas (STRIDE)

| Amenaza                               | Ejemplo                                                    | Mitigación                                                                                                                                                    | Verificación                                               |
| ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **S**uplantación                      | Usar la sesión de otra persona                             | Supabase Auth (enlace mágico/OAuth), cookies `HttpOnly`/`Secure`, HTTPS forzado (HSTS)                                                                        | E2E de cabeceras                                           |
| **T**ampering (manipulación)          | Modificar datos de otro hogar; mover una fila a otro hogar | RLS con `USING` + `WITH CHECK`, FK compuestas con `hogar_id`, validación zod en el borde                                                                      | 43 tests de RLS + mutaciones                               |
| **R**epudio                           | "Yo no borré la lista"                                     | Columnas de autoría y fecha; registro de movimientos de despensa (deshacer)                                                                                   | **Pendiente:** llega con las tablas de catálogo y despensa |
| **I**nformation disclosure (fuga)     | Leer datos ajenos; exponer la clave secreta                | RLS; `anon` sin permisos; clave secreta solo en servidor; zod rechaza `sb_secret_` en variables públicas; códigos de invitación hasheados; sin `X-Powered-By` | Tests de RLS, test de entorno, E2E                         |
| **D**enegación de servicio            | Abusar de endpoints                                        | Límites de Supabase Auth; Railway con reinicio ante fallos; rate limiting en acciones costosas (IA, fase 4)                                                   | Revisión manual                                            |
| **E**levation of privilege (escalada) | Un miembro se hace admin; XSS que actúa como el usuario    | Políticas por rol, RPC `SECURITY DEFINER` con comprobación explícita y `search_path` fijo; CSP estricta con nonce                                             | Tests de RLS y E2E de XSS                                  |

## Controles por capa

### Navegador

- **CSP estricta con nonce por petición** (`src/proxy.ts`, `src/infraestructura/seguridad/csp.ts`): sin `unsafe-inline` ni `unsafe-eval` en producción; `connect-src` limitado a la app y a Supabase; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- **Cabeceras** (`src/infraestructura/seguridad/cabeceras.ts`): HSTS (2 años), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (sin cámara, micrófono ni ubicación), `Cross-Origin-Opener-Policy`.
- **Límite conocido:** `'strict-dynamic'` confía en los scripts que crea un script de confianza. La CSP frena el HTML inyectado (el XSS habitual), pero no a una dependencia comprometida que ya se ejecuta; eso lo cubren los controles de cadena de suministro.

### Servidor (Next.js)

- **Autorización en la capa de acceso a datos**, no en el proxy: cada Server Action valida la entrada con zod y comprueba la sesión antes de actuar (recomendación oficial de Next 16). El proxy solo añade la CSP.
- **DTO mínimos:** al cliente solo llegan los campos que necesita.
- `server-only` impide importar código de servidor (y su configuración) desde componentes de cliente.
- La comprobación de salud no expone versiones ni configuración.

### Base de datos (Supabase)

- RLS activada y **forzada** en todas las tablas; `anon` sin privilegios.
- Funciones de pertenencia en un esquema no expuesto (`privado`).
- FK compuestas con `hogar_id`: la base de datos impide mezclar hogares aunque una política estuviera mal.
- Códigos de invitación: aleatorios, de un solo uso, con caducidad de 7 días, guardados como hash SHA-256.
- Advisors de seguridad tras cada migración; avisos aceptados justificados en `decisiones.md`.

### Infraestructura (Railway)

- **Imagen Docker** por etapas, con la imagen base fijada por digest: sin código fuente ni dependencias de desarrollo.
- **Usuario sin privilegios** (`node`) y **código de solo lectura** para el proceso: solo `.next/cache` es escribible. La CI lo comprueba.
- Secretos como variables del servicio en Railway, nunca en la imagen ni en el repositorio. `.dockerignore` excluye `.env*`.
- Región EU (Ámsterdam), próxima a Supabase eu-west-1: los datos no salen de la UE.

### Cadena de suministro

- `pnpm install --frozen-lockfile` en CI y en la imagen: se instala exactamente lo revisado.
- `minimumReleaseAge: 1440`: pnpm no instala versiones publicadas hace menos de 24 h (la mayoría de paquetes comprometidos se retiran antes). pnpm 10 además bloquea los scripts `postinstall` por defecto.
- Actions de terceros fijadas por **SHA de commit**; el token de la CI es de solo lectura y no se guardan credenciales en el checkout.
- **gitleaks** sobre todo el historial (binario verificado por checksum) y **`pnpm audit`** de producción en cada push.
- Dependabot para npm, Actions y la imagen base de Docker.

### Desarrollo

- Ningún secreto en el repositorio: `.env*` ignorado salvo la plantilla.
- Revisión por PR con la definición de hecho (incluye "sin secretos en el diff").

## Centro compartido: la excepción al aislamiento

Es la única tabla compartida entre hogares, por eso concentra los controles más estrictos (D-034):

| Riesgo                                        | Control                                                              | Verificación                                   |
| --------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Saber qué familias usan el colegio            | Cada hogar solo ve su propio vínculo                                 | Test + mutación                                |
| Acceso a datos privados por compartir colegio | Ninguna política de datos privados considera el centro               | Test: B no ve hogar, personas ni miembros de A |
| Código adivinado o reutilizado sin control    | 48 bits, hash, caducidad, límite de usos, revocación, error uniforme | Tests + mutación                               |
| Vandalismo del menú                           | Historial inmutable con autor, visible solo para curadores           | Tests + mutación                               |
| Spam de centros                               | Máximo 3 por usuario; solo administradores                           | Test                                           |
| Mover datos a un centro ajeno                 | `WITH CHECK`                                                         | Test                                           |

## Privacidad (RGPD)

- Datos alojados en la UE (Supabase eu-west-1, Railway EU West).
- Minimización: de las personas sin cuenta (las niñas) solo se guarda un alias, el tipo (adulto/niño) y el factor de ración.
- Derecho de supresión: borrar el hogar elimina en cascada todos sus datos, y borrar la cuenta de quien lo creó no lo impide (D-035).
- Fase 4 (IA): las fotos del menú del cole no contienen datos personales; aun así se procesarán solo con consentimiento y sin conservarse más de lo necesario.

## Verificación automática

| Control                                     | Dónde se verifica                                           |
| ------------------------------------------- | ----------------------------------------------------------- |
| Aislamiento entre hogares                   | `supabase/tests/rls_aislamiento.test.sql` (CI, Postgres 17) |
| Cabeceras, CSP, nonce único, bloqueo de XSS | `e2e/seguridad.spec.ts` (CI, Chromium)                      |
| Construcción correcta de la CSP             | `src/infraestructura/seguridad/csp.test.ts`                 |
| Clave secreta nunca como pública            | `src/infraestructura/env.test.ts`                           |
| Contenedor sin root y código inmutable      | Trabajo `imagen` de la CI                                   |
| Secretos en el historial                    | Trabajo `seguridad` (gitleaks)                              |
| Vulnerabilidades en dependencias            | Trabajo `seguridad` (`pnpm audit`) + Dependabot             |
| Capas sin acoplamientos peligrosos          | ESLint `no-restricted-imports`                              |

Los tests de RLS y de CSP se han validado con **mutaciones**: se rompió el control a propósito (política abierta, `WITH CHECK (true)`, FK sin `hogar_id`, CSP eliminada) y los tests fallaron.

## Configuración manual pendiente (no se puede hacer por código)

**Supabase → Authentication** (fase 3, antes de dar acceso real):

- [ ] Protección de contraseñas filtradas activada (si se usan contraseñas).
- [ ] Caducidad corta del enlace mágico / OTP (≤ 1 h).
- [ ] URLs de redirección limitadas al dominio de Railway y a localhost.
- [ ] Registro público desactivado: alta solo por invitación.
- [ ] SMTP propio (Resend) para que los enlaces lleguen y no se agote el límite.

**Cuentas:**

- [ ] 2FA en GitHub, Supabase y Railway.
- [ ] Protección de la rama `main` en GitHub (CI obligatoria, sin pushes directos).

## Avisos aceptados

| Aviso                                                        | Motivo                                                          | Revisión                  |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------- |
| 2 vulnerabilidades moderadas en `minimatch` (vía ESLint 9)   | Solo herramienta de desarrollo; no está en la imagen desplegada | Al actualizar a ESLint 10 |
| `authenticated_security_definer_function_executable` (3 RPC) | Intencionado; ver D-018                                         | —                         |
