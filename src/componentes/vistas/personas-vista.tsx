"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { enlaceWhatsApp } from "@/dominio/compartir";
import type { Persona } from "@/dominio/tipos";
import { MAX_LARGO_NOMBRE_PERSONA } from "@/aplicacion/estado";
import type { VinculosPersonas } from "../usar-nube";
import { useCuenta, useHogar } from "../proveedor-hogar";

const RACIONES = [
  { valor: 0.3, texto: "Pequeña (0,3)" },
  { valor: 0.5, texto: "Media (0,5)" },
  { valor: 0.75, texto: "Casi completa (0,75)" },
  { valor: 1, texto: "Completa (1)" },
  { valor: 1.5, texto: "Grande (1,5)" },
] as const;

const coma = (n: number) => String(n).replace(".", ",");

/** Quién forma la familia: a quién se cocina, cuánto come cada uno y quién tiene cuenta (D-092). */
export function PersonasVista() {
  const { estado, despachar } = useHogar();
  const cuenta = useCuenta();
  const [vinculos, setVinculos] = useState<VinculosPersonas | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const conectado = cuenta.fase === "conectado";

  // Lleva las personas a la tabla y lee quién tiene cuenta. Se repite si cambian las personas.
  const huella = JSON.stringify(estado.personas);
  const refrescar = useCallback(async () => {
    if (!conectado) return;
    const r = await cuenta.vinculos(estado.personas);
    if (r.ok) {
      setVinculos({ mia: r.mia, vinculadas: r.vinculadas, esAdmin: r.esAdmin });
      setMensaje("");
    } else setMensaje(r.mensaje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, huella]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refrescar();
  }, [refrescar]);

  async function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    setMensaje(r.ok ? "" : (r.mensaje ?? "No se ha podido completar."));
    if (r.ok) await refrescar();
  }

  const activas = estado.personas.filter((p) => p.activa);
  const inactivas = estado.personas.filter((p) => !p.activa);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Familia <span aria-hidden="true">👨‍👩‍👧‍👧</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Para quién se cocina y cuánto come cada uno. Con una cuenta vinculada, cada uno ve sus
          cosas y los regalos sorpresa siguen siendo sorpresa.
        </p>
      </header>

      {mensaje && (
        <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
          {mensaje}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {activas.map((p) => (
          <FilaPersona
            key={p.id}
            persona={p}
            vinculada={vinculos?.vinculadas.includes(p.id) ?? false}
            soyYo={vinculos?.mia === p.id}
            conectado={conectado}
            esAdmin={vinculos?.esAdmin ?? false}
            yaMeVincule={vinculos?.mia != null}
            codigo={codigos[p.id]}
            ocupado={ocupado}
            onGuardar={(nombre, tipo, factorRacion) =>
              despachar({
                tipo: "persona/guardar",
                id: p.id,
                nombre,
                personaTipo: tipo,
                factorRacion,
              })
            }
            onDesactivar={() => despachar({ tipo: "persona/activar", id: p.id, activa: false })}
            onVincularme={() => ejecutar(() => cuenta.vincularme(estado.personas, p.id))}
            onInvitar={() =>
              ejecutar(async () => {
                const r = await cuenta.invitarPersona(estado.personas, p.id);
                if (r.ok) setCodigos((c) => ({ ...c, [p.id]: r.codigo }));
                return r;
              })
            }
          />
        ))}
      </ul>

      {inactivas.length > 0 && (
        <section className="tarjeta flex flex-col gap-2" aria-labelledby="inactivas">
          <h2 id="inactivas" className="text-lg font-extrabold">
            Ya no cuentan
          </h2>
          <ul className="flex flex-col gap-2">
            {inactivas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base">{p.nombre}</span>
                <button
                  type="button"
                  className="boton-suave"
                  onClick={() => despachar({ tipo: "persona/activar", id: p.id, activa: true })}
                >
                  Volver a contar a {p.nombre}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NuevaPersona
        onAnadir={(n, t, f) =>
          despachar({ tipo: "persona/guardar", nombre: n, personaTipo: t, factorRacion: f })
        }
      />

      {!conectado && (
        <p className="text-tinta-suave text-sm">
          Para vincular cuentas hace falta estar conectado: entra desde «Cuenta».
        </p>
      )}
    </div>
  );
}

function FilaPersona(props: {
  persona: Persona;
  vinculada: boolean;
  soyYo: boolean;
  conectado: boolean;
  esAdmin: boolean;
  yaMeVincule: boolean;
  codigo: string | undefined;
  ocupado: boolean;
  onGuardar: (nombre: string, tipo: Persona["tipo"], factor: number) => void;
  onDesactivar: () => void;
  onVincularme: () => void;
  onInvitar: () => void;
}) {
  const { persona: p } = props;
  const [nombre, setNombre] = useState(p.nombre);
  const [tipo, setTipo] = useState<Persona["tipo"]>(p.tipo);
  const [factor, setFactor] = useState(p.factorRacion);
  const [copiado, setCopiado] = useState(false);
  const cambiado = nombre.trim() !== p.nombre || tipo !== p.tipo || factor !== p.factorRacion;
  const opciones = RACIONES.some((r) => r.valor === p.factorRacion)
    ? RACIONES
    : [...RACIONES, { valor: p.factorRacion, texto: `Otra (${coma(p.factorRacion)})` }];
  const texto = props.codigo
    ? `Hola ${p.nombre} 👋 Únete a nuestro hogar en Menús Semanales 🍽️\n1. Abre ${typeof window === "undefined" ? "" : window.location.origin}/cuenta\n2. Entra (con tu correo o sin correo)\n3. Elige «Unirme con un código» y escribe: ${props.codigo}`
    : "";

  return (
    <li className="tarjeta flex flex-col gap-3">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          props.onGuardar(nombre, tipo, factor);
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-base font-semibold">
            Nombre
            <input
              className="campo"
              value={nombre}
              maxLength={MAX_LARGO_NOMBRE_PERSONA}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-base font-semibold">
            Es
            <select
              className="campo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Persona["tipo"])}
            >
              <option value="adulto">Adulto</option>
              <option value="nino">Niño o niña</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-base font-semibold">
            Ración
            <select
              className="campo"
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
            >
              {opciones.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.texto}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cambiado && (
            <button type="submit" className="boton">
              Guardar a {p.nombre}
            </button>
          )}
          <span className="text-tinta-suave text-sm">
            {props.soyYo
              ? "✅ Eres tú"
              : props.vinculada
                ? "✅ Tiene su cuenta"
                : props.conectado
                  ? "Sin cuenta vinculada"
                  : ""}
          </span>
        </div>
      </form>

      {props.conectado && props.esAdmin && !props.vinculada && (
        <div className="flex flex-wrap gap-2">
          {!props.yaMeVincule && (
            <button
              type="button"
              className="boton-suave"
              disabled={props.ocupado}
              onClick={props.onVincularme}
            >
              Soy {p.nombre}
            </button>
          )}
          <button
            type="button"
            className="boton-suave"
            disabled={props.ocupado}
            onClick={props.onInvitar}
          >
            Código para {p.nombre}
          </button>
        </div>
      )}

      {props.codigo && (
        <div className="flex flex-col gap-2">
          <p
            className="text-3xl font-extrabold tracking-widest"
            aria-label={`Código para ${p.nombre}: ${props.codigo.split("").join(" ")}`}
          >
            {props.codigo}
          </p>
          <p className="text-tinta-suave text-sm">
            Solo vale una vez y caduca en 7 días. Quien lo use quedará vinculado a {p.nombre}.
          </p>
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
                  setCopiado(false);
                }
              }}
            >
              {copiado ? "Copiado ✓" : "Copiar mensaje"}
            </button>
          </div>
        </div>
      )}

      <div>
        <button type="button" className="boton-suave" onClick={props.onDesactivar}>
          Ya no cuenta {p.nombre}
        </button>
      </div>
    </li>
  );
}

function NuevaPersona({
  onAnadir,
}: {
  onAnadir: (nombre: string, tipo: Persona["tipo"], factor: number) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Persona["tipo"]>("adulto");
  const [factor, setFactor] = useState(1);
  return (
    <section className="tarjeta flex flex-col gap-3" aria-labelledby="nueva">
      <h2 id="nueva" className="text-lg font-extrabold">
        Añadir a alguien
      </h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim() === "") return;
          onAnadir(nombre, tipo, factor);
          setNombre("");
        }}
      >
        <label className="flex flex-col gap-1 text-base font-semibold">
          Nombre
          <input
            className="campo"
            value={nombre}
            maxLength={MAX_LARGO_NOMBRE_PERSONA}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Emma"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-base font-semibold">
            Es
            <select
              className="campo"
              value={tipo}
              onChange={(e) => {
                const t = e.target.value as Persona["tipo"];
                setTipo(t);
                setFactor(t === "adulto" ? 1 : 0.5);
              }}
            >
              <option value="adulto">Adulto</option>
              <option value="nino">Niño o niña</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-base font-semibold">
            Ración
            <select
              className="campo"
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
            >
              {RACIONES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.texto}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="boton w-fit">
          Añadir
        </button>
      </form>
    </section>
  );
}
