"use client";

import { useEstampado } from "./usar-estampado";

/**
 * Una cinta de animal print (leopardo o cebra) de adorno. Con «los dos», la cinta normal sale de
 * leopardo y la `otra` de cebra, así se alternan. Con «sin estampado» no pinta nada.
 */
export function CintaAnimal({
  otra = false,
  className = "",
}: {
  otra?: boolean;
  className?: string;
}) {
  const [estampado] = useEstampado();
  if (estampado === "ninguno") return null;
  const tipo = estampado === "los-dos" ? (otra ? "cebra" : "leopardo") : estampado;
  return <div aria-hidden="true" className={`cinta cinta-${tipo} ${className}`} />;
}

/** ¿Se pinta la cebra grande de fondo? Sí con «cebra» y con «leopardo y cebra». */
export function useFondoCebra(): boolean {
  const [estampado] = useEstampado();
  return estampado === "cebra" || estampado === "los-dos";
}
