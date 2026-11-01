import Link from "next/link";
import { IconoCompra, IconoDespensa, IconoMenu, IconoReparto } from "@/componentes/iconos";

const MODULOS = [
  {
    href: "/menu",
    titulo: "Menú de la semana",
    texto:
      "Varias opciones para cada cena, adaptadas al tiempo que tenéis y al menú del cole. Elegid la que os cuadre.",
    Icono: IconoMenu,
  },
  {
    href: "/compra",
    titulo: "Lista de la compra",
    texto:
      "Se calcula sola con lo que habéis elegido cenar y con lo que se está acabando. Marcadla en el súper, entre los dos.",
    Icono: IconoCompra,
  },
  {
    href: "/despensa",
    titulo: "Despensa y nevera",
    texto: "Qué hay, qué caduca pronto y qué se descuenta al cocinar. Todo se puede deshacer.",
    Icono: IconoDespensa,
  },
  {
    href: "/reparto",
    titulo: "Reparto de la semana",
    texto:
      "Quién se encarga de qué, contando también lo que no se ve: acordarse, decidir y organizar.",
    Icono: IconoReparto,
  },
] as const;

export default function Inicio() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Menús Semanales</h1>
        <p className="text-tinta-suave max-w-prose text-lg">
          Menos tiempo planificando y más repartido: la compra, la despensa y las tareas de casa de
          toda la familia.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map(({ href, titulo, texto, Icono }) => (
          <li key={href}>
            <Link
              href={href}
              className="tarjeta hover:bg-fondo flex h-full flex-col gap-3 transition-colors"
            >
              <Icono width={32} height={32} className="text-marca" />
              <span className="text-xl font-semibold">{titulo}</span>
              <span className="text-tinta-suave text-base">{texto}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="tarjeta bg-aviso-fondo text-aviso-texto text-base">
        <strong>Versión de demostración.</strong> Los datos son de ejemplo y no se guardan: puedes
        probar todo con tranquilidad.
      </p>
    </div>
  );
}
