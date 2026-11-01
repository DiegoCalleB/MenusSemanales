## Qué cambia y por qué

<!-- Una o dos frases. Enlaza la decisión de docs/decisiones.md si aplica. -->

## Cómo se ha probado

- [ ] `pnpm check` en verde (lint, tipos, formato, tests)
- [ ] `pnpm test:db` en verde si toca `supabase/`
- [ ] Probado a mano en móvil si toca la interfaz

## Definición de hecho

- [ ] El dominio sigue sin depender de Next, React ni Supabase
- [ ] Datos externos validados con zod en el borde
- [ ] Migraciones: tests de RLS, advisors de Supabase revisados y tipos regenerados
- [ ] Decisión registrada en `docs/decisiones.md` si es relevante
- [ ] Sin secretos ni claves en el diff
