# Diseño y responsive

La interfaz es **mobile-first**: se diseña para el móvil de una persona que va con prisa (en el súper, con una mano) y se amplía hacia arriba. Todo lo que sigue se **verifica automáticamente** (`e2e/responsive.spec.ts`), no se da por supuesto.

## Estructura por tamaño de pantalla

| Ancho                           | Navegación                                                                             | Contenido                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| < 768 px (móvil)                | Barra de pestañas **fija abajo**, al alcance del pulgar, con la zona segura del iPhone | Una columna; tarjetas a todo el ancho                                              |
| 768 – 1023 px (tablet)          | Barra lateral de 14 rem                                                                | Dos columnas de tarjetas                                                           |
| ≥ 1024 px (portátil/escritorio) | Barra lateral de 16 rem                                                                | Cuadrícula de 2–3 columnas, paneles fijos laterales (p. ej. «Cocinar y descontar») |
| ≥ 1280 px                       | Igual; el contenido se limita a 64 rem para que las líneas no sean larguísimas         | Hasta 3 columnas                                                                   |

El punto de corte (768 px) es único: la barra inferior y la lateral nunca conviven.

## Reglas que se cumplen en todas las pantallas

- **Nada desborda**, ni siquiera a 320 px (reflujo, WCAG 1.4.10): las palabras largas parten, el contenido ancho (tablas) se desplaza dentro de su propia caja y nunca arrastra la página.
- **Lo táctil mide ≥ 44 × 44 px** (WCAG 2.5.5): botones, enlaces, selectores, pestañas y filas con casilla. Una casilla se toca por **toda su fila** (56 px de alto), no por el cuadradito.
- **Texto ≥ 16 px** en el cuerpo y en los campos (iOS no amplía la pantalla al enfocar un campo). Se respeta el tamaño de letra del dispositivo y **no se bloquea el zoom**.
- **La barra inferior no tapa el contenido**: la página deja espacio al final y el aviso («Deshacer») flota por encima de ella.
- **Zonas seguras** (`viewport-fit=cover` + `env(safe-area-inset-bottom)`): sin recortes con muesca ni barra de gestos.
- **Tema claro y oscuro** según el sistema, con tokens propios en los dos.
- **Movimiento reducido** (`prefers-reduced-motion`) respetado.
- **Foco siempre visible** y enlace «Saltar al contenido».

## Accesibilidad (WCAG 2.2 AA)

Revisión automática con axe en 4 tamaños × 2 temas × 4 pantallas (32 comprobaciones), sin ninguna violación. Además:

- Estados que **no dependen solo del color**: «Caducado», «Caduca mañana» y «Bajo mínimo» llevan icono y texto.
- Pestañas con **teclado** (flechas izquierda/derecha) y roles ARIA correctos.
- Avisos anunciados a lectores de pantalla (`role="status"`).
- El gráfico tiene **alternativa en tabla** y etiqueta descriptiva.

## El gráfico del reparto (guía de visualización de datos)

Es una comparación de **dos series sobre un mismo eje** (ejecutar y organizar, por persona), así que la forma correcta es una **barra apilada horizontal**, no un círculo.

- **Colores:** los dos primeros de la paleta categórica validada (`#2a78d6` azul y `#eb6834` naranja en claro; `#3987e5` y `#d95926` en oscuro). Se comprobaron con el validador: separación para daltonismo ΔE 24–27 (mínimo exigido 8), visión normal ΔE 32–34 (mínimo 15), contraste ≥ 3:1 contra la superficie, en los dos temas.
- **Marcas:** barras de 16 px, extremo del dato redondeado a 4 px y arranque recto en la línea base, hueco de 2 px entre segmentos (en el color de la superficie, no un borde).
- **Etiquetas:** leyenda siempre presente, total y porcentaje junto a cada barra, minutos de cada serie debajo. El texto **nunca** lleva el color de la serie.
- **Escala común:** la barra más larga ocupa todo el ancho y las demás se comparan con ella.
- **Sin `style` en línea:** la CSP estricta (D-025) los bloquea, así que las anchuras son atributos SVG.

## Tono del panel de reparto

Es **descriptivo y neutral** (D-032): muestra minutos y porcentajes, nunca puntuaciones ni reproches. Cuando hay diferencia, el texto dice que «puede ser lo que habéis acordado» y ofrece repartir de otra forma, para abrir la conversación, no para zanjarla.

## Aspecto: cálido y amable (D-045)

La primera versión era sobria y apagada. Ahora la interfaz es **luminosa y cercana**, pensada para que apetezca abrirla:

- **Paleta:** fondo crema-melocotón, tarjetas blancas con sombra suave rosada, color de marca frambuesa (`#c72a63`) y tonos pastel (rosa, melocotón y menta) para acentos. Los verdes se reservan para «elegido» y «hecho». El tema oscuro es un berenjena cálido, no negro.
- **Forma:** esquinas muy redondeadas, botones en píldora y tipografía redondeada (Nunito).
- **Calidez:** un emoji por grupo de plato (🥦 🍝 🍚 🐟 🍗 🍳 🫘), una portada que dice qué se cena hoy y un saludo, y textos en segunda persona del plural.
- **Sigue siendo accesible:** todos los pares de color cumplen WCAG 2.2 AA en claro y oscuro (verificado con axe en 10 tamaños) y los emojis son decorativos (`aria-hidden`).
