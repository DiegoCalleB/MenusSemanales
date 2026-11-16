"use client";

import { Papeles } from "../papeles";

/** Papeles y vencimientos (D-174): lo que caduca o hay que renovar, con su aviso. */
export function PapelesVista() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Papeles y vencimientos <span aria-hidden="true">📄</span>
        </h1>
        <p className="text-tinta-suave text-base">
          La ITV, los seguros, el DNI y el pasaporte de cada uno… Apunta cuándo vencen y te aviso
          con tiempo. Al renovarlos, pasan solos a la fecha siguiente.
        </p>
      </header>
      <Papeles />
    </div>
  );
}
