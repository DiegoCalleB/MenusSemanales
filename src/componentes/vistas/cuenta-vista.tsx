"use client";

import { type FormEvent, useState } from "react";
import { enlaceWhatsApp } from "@/dominio/compartir";
import { MODO_DATOS, useCuenta, useHogar } from "../proveedor-hogar";

const ETIQUETA_SYNC = {
  inactivo: "Sin conectar",
  guardando: "Guardando…",
  "al-dia": "Al día",
  "sin-conexion": "Sin conexión: se guardará al volver",
  error: "No se ha podido guardar",
} as const;

/** Entrar, crear o unirse a un hogar e invitar a la familia. Todo lo demás lo hace la sincronización. */
export function CuentaVista() {
  const cuenta = useCuenta();
  const { restablecer } = useHogar();
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>, exito = "") {
    setOcupado(true);
    setMensaje("");
    const r = await accion();
    setOcupado(false);
    setMensaje(r.ok ? exito : (r.mensaje ?? "No se ha podido completar."));
    return r.ok;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Cuenta <span aria-hidden="true">☁️</span>
        </h1>
      </header>

      {mensaje && (
        <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
          {mensaje}
        </p>
      )}

      {cuenta.fase === "sin-configurar" && (
        <section className="tarjeta flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">Solo en este dispositivo</h2>
          <p className="text-base">
            La sincronización entre móviles aún no está activada en esta versión. Mientras tanto,
            los datos se guardan solo en este dispositivo.
          </p>
        </section>
      )}

      {cuenta.fase === "cargando" && <p className="text-base">Comprobando tu sesión…</p>}

      {cuenta.fase === "sin-sesion" && (
        <>
          <EntrarConCorreo cuenta={cuenta} ocupado={ocupado} ejecutar={ejecutar} />
          <section className="tarjeta flex flex-col gap-2" aria-labelledby="sin-correo">
            <h2 id="sin-correo" className="text-lg font-extrabold">
              Entrar sin correo
            </h2>
            <p className="text-tinta-suave text-base">
              Este dispositivo queda con acceso. Si borras los datos del navegador, tendrás que
              pedir un código de invitación nuevo.
            </p>
            <button
              type="button"
              className="boton-suave w-fit"
              disabled={ocupado}
              onClick={() => ejecutar(cuenta.entrarSinCorreo)}
            >
              Entrar sin correo
            </button>
          </section>
        </>
      )}

      {cuenta.fase === "sin-hogar" && (
        <HogarNuevo cuenta={cuenta} ocupado={ocupado} ejecutar={ejecutar} />
      )}

      {cuenta.fase === "conectado" && cuenta.hogar && (
        <>
          <section className="tarjeta flex flex-col gap-2" aria-labelledby="hogar">
            <h2 id="hogar" className="text-lg font-extrabold">
              ☁️ {cuenta.hogar.nombre}
            </h2>
            <p className="text-base" role="status">
              {ETIQUETA_SYNC[cuenta.sync]}
            </p>
            <p className="text-tinta-suave text-sm">
              Lo que cambie cualquiera de la familia aparece en los demás móviles.
            </p>
          </section>
          <Invitar cuenta={cuenta} />
          <section className="tarjeta flex flex-col gap-2" aria-labelledby="sesion">
            <h2 id="sesion" className="text-lg font-extrabold">
              Sesión
            </h2>
            <p className="text-base">
              {cuenta.correo ?? "Entraste sin correo en este dispositivo."}
            </p>
            <button type="button" className="boton-suave w-fit" onClick={cuenta.salir}>
              Salir de este dispositivo
            </button>
          </section>
        </>
      )}

      {cuenta.fase !== "conectado" && (
        <section className="tarjeta flex flex-col gap-2" aria-labelledby="local">
          <h2 id="local" className="text-lg font-extrabold">
            Datos de este dispositivo
          </h2>
          <button type="button" className="boton-suave w-fit" onClick={restablecer}>
            {MODO_DATOS === "diego" ? "Empezar de nuevo" : "Restablecer ejemplo"}
          </button>
        </section>
      )}
    </div>
  );
}

type Ejecutar = (
  a: () => Promise<{ ok: boolean; mensaje?: string }>,
  exito?: string,
) => Promise<boolean>;
type Props = { cuenta: ReturnType<typeof useCuenta>; ocupado: boolean; ejecutar: Ejecutar };

function EntrarConCorreo({ cuenta, ocupado, ejecutar }: Props) {
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function pedir(e: FormEvent) {
    e.preventDefault();
    if (
      await ejecutar(
        () => cuenta.pedirCodigo(correo.trim()),
        "Te hemos enviado un código de 6 cifras.",
      )
    ) {
      setEnviado(true);
    }
  }
  async function entrar(e: FormEvent) {
    e.preventDefault();
    await ejecutar(() => cuenta.verificar(correo.trim(), codigo.trim()));
  }

  return (
    <section className="tarjeta flex flex-col gap-3" aria-labelledby="con-correo">
      <h2 id="con-correo" className="text-lg font-extrabold">
        Entrar con tu correo
      </h2>
      <form onSubmit={pedir} className="flex flex-col gap-2">
        <label htmlFor="correo" className="text-base font-semibold">
          Correo
        </label>
        <input
          id="correo"
          type="email"
          className="campo"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <button type="submit" className="boton w-fit" disabled={ocupado || !correo.includes("@")}>
          {enviado ? "Enviar otro código" : "Enviarme un código"}
        </button>
      </form>
      {enviado && (
        <form onSubmit={entrar} className="flex flex-col gap-2">
          <label htmlFor="codigo" className="text-base font-semibold">
            Código de 6 cifras
          </label>
          <input
            id="codigo"
            className="campo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button
            type="submit"
            className="boton w-fit"
            disabled={ocupado || codigo.trim().length < 6}
          >
            Entrar
          </button>
        </form>
      )}
    </section>
  );
}

function HogarNuevo({ cuenta, ocupado, ejecutar }: Props) {
  const [nombre, setNombre] = useState("Nuestra familia");
  const [codigo, setCodigo] = useState("");
  return (
    <>
      <section className="tarjeta flex flex-col gap-2" aria-labelledby="crear">
        <h2 id="crear" className="text-lg font-extrabold">
          Crear el hogar de la familia
        </h2>
        <p className="text-tinta-suave text-base">
          Lo que tienes ahora en este móvil pasa a ser el plan compartido.
        </p>
        <label htmlFor="nombre-hogar" className="text-base font-semibold">
          Nombre del hogar
        </label>
        <input
          id="nombre-hogar"
          className="campo"
          maxLength={60}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <button
          type="button"
          className="boton w-fit"
          disabled={ocupado}
          onClick={() => ejecutar(() => cuenta.crearHogar(nombre))}
        >
          Crear hogar
        </button>
      </section>
      <section className="tarjeta flex flex-col gap-2" aria-labelledby="unirse">
        <h2 id="unirse" className="text-lg font-extrabold">
          Unirme con un código
        </h2>
        <p className="text-tinta-suave text-base">
          Si alguien de tu familia ya creó el hogar, pídele su código de invitación. Lo que haya en
          este móvil se sustituye por el plan de la familia.
        </p>
        <label htmlFor="codigo-hogar" className="text-base font-semibold">
          Código de invitación
        </label>
        <input
          id="codigo-hogar"
          className="campo uppercase"
          autoComplete="off"
          maxLength={20}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <button
          type="button"
          className="boton w-fit"
          disabled={ocupado || codigo.trim().length < 6}
          onClick={() => ejecutar(() => cuenta.unirse(codigo))}
        >
          Unirme
        </button>
      </section>
    </>
  );
}

function Invitar({ cuenta }: { cuenta: ReturnType<typeof useCuenta> }) {
  const [codigo, setCodigo] = useState("");
  const [problema, setProblema] = useState("");
  const [copiado, setCopiado] = useState(false);
  const texto = `Únete a nuestro hogar en Menús Semanales 🍽️\n1. Abre ${typeof window === "undefined" ? "" : window.location.origin}/cuenta\n2. Entra (con tu correo o sin correo)\n3. Elige «Unirme con un código» y escribe: ${codigo}`;

  async function crear() {
    setProblema("");
    setCopiado(false);
    const r = await cuenta.invitar();
    if (r.ok) setCodigo(r.codigo);
    else setProblema(r.mensaje);
  }

  return (
    <section className="tarjeta flex flex-col gap-2" aria-labelledby="invitar">
      <h2 id="invitar" className="text-lg font-extrabold">
        Invitar a alguien
      </h2>
      {problema && (
        <p className="text-peligro-texto bg-peligro-fondo rounded-2xl p-3 text-base">{problema}</p>
      )}
      {codigo ? (
        <>
          <p
            className="text-3xl font-extrabold tracking-widest"
            aria-label={`Código ${codigo.split("").join(" ")}`}
          >
            {codigo}
          </p>
          <p className="text-tinta-suave text-sm">Sirve una vez y caduca en unos días.</p>
          <div className="flex flex-wrap gap-2">
            <a
              className="boton"
              href={enlaceWhatsApp(texto)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar por WhatsApp
            </a>
            <button
              type="button"
              className="boton-suave"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(texto);
                  setCopiado(true);
                } catch {
                  setProblema("No se ha podido copiar.");
                }
              }}
            >
              {copiado ? "Copiado ✓" : "Copiar mensaje"}
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="boton w-fit" onClick={crear}>
          Crear código de invitación
        </button>
      )}
    </section>
  );
}
