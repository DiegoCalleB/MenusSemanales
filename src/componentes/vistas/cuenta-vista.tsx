"use client";

import { ESTADO_NUBE } from "../usar-nube";
import { type FormEvent, useState } from "react";
import { enlaceWhatsApp } from "@/dominio/compartir";
import { DiagnosticoAcceso } from "../diagnostico-acceso";
import { PanelRespaldo } from "../panel-respaldo";
import { PanelTablas } from "../panel-tablas";
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
        <section
          className="tarjeta flex flex-col gap-2"
          role={ESTADO_NUBE === "ok" || ESTADO_NUBE === "ausente" ? undefined : "alert"}
        >
          <h2 className="text-lg font-extrabold">
            {ESTADO_NUBE === "ausente"
              ? "Solo en este dispositivo"
              : "⚠️ La nube no está bien configurada"}
          </h2>
          {ESTADO_NUBE === "ausente" && (
            <p className="text-base">
              Esta instalación no tiene configurada la sincronización. Los datos se guardan solo en
              este dispositivo: <strong>si se borran los datos del navegador, se pierden</strong>.
            </p>
          )}
          {ESTADO_NUBE === "clave-invalida" && (
            <p className="text-base">
              La clave de Supabase de esta instalación no tiene la forma esperada: tiene que ser la
              clave <strong>«Publishable»</strong> y empezar por <code>sb_publishable_</code> (no la
              «anon», que empieza por <code>eyJ</code>, ni la «secret»). Corrige{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en Railway y vuelve a desplegar.
              Mientras tanto, los datos se guardan <strong>solo en este dispositivo</strong>.
            </p>
          )}
          {ESTADO_NUBE === "url-invalida" && (
            <p className="text-base">
              La dirección de Supabase de esta instalación no es válida: tiene que ser una URL
              entera como <code>https://xxxx.supabase.co</code>, sin comillas ni espacios. Corrige{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> en Railway y vuelve a desplegar. Mientras tanto,
              los datos se guardan <strong>solo en este dispositivo</strong>.
            </p>
          )}
          {ESTADO_NUBE === "ok" && (
            <p className="text-base">
              No se ha podido iniciar la conexión con la nube en este navegador. Recarga la página;
              si sigue igual, los datos se guardan solo en este dispositivo.
            </p>
          )}
        </section>
      )}

      {cuenta.fase === "cargando" && <p className="text-base">Comprobando tu sesión…</p>}

      {cuenta.fase === "sin-sesion" && <DiagnosticoAcceso />}

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
          {!cuenta.anonimo && (
            <PonerContrasena cuenta={cuenta} ocupado={ocupado} ejecutar={ejecutar} />
          )}
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

      <PanelRespaldo />
      <PanelTablas />
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
  const [contrasena, setContrasena] = useState("");

  async function conContrasena(e: FormEvent) {
    e.preventDefault();
    await ejecutar(() => cuenta.entrarConContrasena(correo.trim(), contrasena));
  }

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
      <div className="flex flex-col gap-2">
        <label htmlFor="correo" className="text-base font-semibold">
          Correo
        </label>
        <input
          id="correo"
          type="email"
          className="campo"
          autoComplete="username"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>
      <form onSubmit={conContrasena} className="flex flex-col gap-2">
        <label htmlFor="contrasena" className="text-base font-semibold">
          Contraseña
        </label>
        <input
          id="contrasena"
          type="password"
          className="campo"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
        <button
          type="submit"
          className="boton w-fit"
          disabled={ocupado || !correo.includes("@") || contrasena.length < 6}
        >
          Entrar con contraseña
        </button>
      </form>
      <p className="text-tinta-suave text-base">
        ¿Sin contraseña o la has olvidado? Te mando un código por correo (Google limita los envíos:
        si no llega, espera una hora):
      </p>
      <form onSubmit={pedir} className="flex flex-col gap-2">
        <button
          type="submit"
          className="boton-suave w-fit"
          disabled={ocupado || !correo.includes("@")}
        >
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

function PonerContrasena({ cuenta, ocupado, ejecutar }: Props) {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const distintas = repetida !== "" && nueva !== repetida;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (
      await ejecutar(
        () => cuenta.ponerContrasena(nueva),
        "Contraseña guardada. Si se cierra la sesión, podrás entrar sin esperar un correo.",
      )
    ) {
      setNueva("");
      setRepetida("");
    }
  }

  return (
    <section className="tarjeta flex flex-col gap-3" aria-labelledby="contrasena-nueva">
      <h2 id="contrasena-nueva" className="text-lg font-extrabold">
        Contraseña
      </h2>
      <p className="text-tinta-suave text-base">
        Ponla una vez y entrarás con ella cuando se cierre la sesión, sin depender del correo (que
        tiene límite de envíos). Usa al menos 10 caracteres.
      </p>
      <form onSubmit={guardar} className="flex flex-col gap-2">
        <label htmlFor="contrasena-1" className="text-base font-semibold">
          Contraseña nueva
        </label>
        <input
          id="contrasena-1"
          type="password"
          className="campo"
          autoComplete="new-password"
          minLength={10}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <label htmlFor="contrasena-2" className="text-base font-semibold">
          Repítela
        </label>
        <input
          id="contrasena-2"
          type="password"
          className="campo"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
        {distintas && <p className="text-aviso-texto text-base">No coinciden.</p>}
        <button
          type="submit"
          className="boton w-fit"
          disabled={ocupado || nueva.length < 10 || nueva !== repetida}
        >
          Guardar contraseña
        </button>
      </form>
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
  const texto = `Únete a nuestro hogar en ¡Hecho! ✅\n1. Abre ${typeof window === "undefined" ? "" : window.location.origin}/cuenta\n2. Entra (con tu correo o sin correo)\n3. Elige «Unirme con un código» y escribe: ${codigo}`;

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
