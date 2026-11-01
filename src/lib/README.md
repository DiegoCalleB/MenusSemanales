# `src/lib`

| Carpeta     | Contenido                        | Regla                                      |
| ----------- | -------------------------------- | ------------------------------------------ |
| `dominio/`  | Tipos y esquemas zod compartidos | Sin dependencias de Next ni Supabase       |
| `menu/`     | Generador de opciones de menú    | Funciones puras y deterministas, con tests |
| `compra/`   | Cálculo de la lista de la compra | Funciones puras y deterministas, con tests |
| `despensa/` | Descuento al cocinar y deshacer  | Funciones puras y deterministas, con tests |
| `supabase/` | Clientes y tipos generados       | Sin lógica de negocio                      |

El dominio (`dominio`, `menu`, `compra`, `despensa`) no importa nada de `next/*` ni de
`@supabase/*`: recibe datos y devuelve datos. Así se puede probar sin red ni base de datos.
