import type { SVGProps } from "react";

/** Iconos en línea (sin librería externa: una dependencia menos que vigilar). Decorativos. */
function Icono({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoCompra = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 7H6" />
  </Icono>
);
export const IconoDespensa = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18" />
  </Icono>
);
export const IconoReparto = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M12 3v18M5 21h14" />
    <path d="M5 7h14" />
    <path d="M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" />
  </Icono>
);
export const IconoCerrar = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icono>
);
export const IconoMas = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);
export const IconoMenos = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M5 12h14" />
  </Icono>
);
export const IconoReloj = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icono>
);
export const IconoAlerta = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18h.01" />
  </Icono>
);
export const IconoDeshacer = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Icono>
);
export const IconoMenu = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4M8 14h3M8 17.5h6" />
  </Icono>
);
export const IconoAgenda = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
    <circle cx="8" cy="14" r="1" />
    <circle cx="12" cy="14" r="1" />
    <circle cx="16" cy="14" r="1" />
    <circle cx="8" cy="18" r="1" />
    <circle cx="12" cy="18" r="1" />
  </Icono>
);

export const IconoHoy = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icono>
);
export const IconoCasa = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </Icono>
);
export const IconoOpciones = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </Icono>
);
