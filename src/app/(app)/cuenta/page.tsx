import type { Metadata } from "next";
import { connection } from "next/server";
import { CuentaVista } from "@/componentes/vistas/cuenta-vista";

export const metadata: Metadata = { title: "Cuenta" };

/**
 * La versión instalada: el identificador del commit que Railway ha desplegado. Sirve para saber de
 * un vistazo si el servidor ya tiene lo último (D-130). Se lee al pedir la página, no al compilar.
 */
const versionDelServidor = (): string => {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA;
  return sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7) : "desarrollo";
};

export default async function PaginaCuenta() {
  await connection();
  return <CuentaVista version={versionDelServidor()} />;
}
