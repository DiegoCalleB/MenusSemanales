/**
 * El dominio de recepción de las circulares por correo (D-147), para enseñar la dirección del
 * hogar. Público: sin el código del hogar no sirve para nada. Vacío si no está configurado.
 */
export function GET() {
  const dominio = (process.env.CORREO_CIRCULARES_DOMINIO ?? "").trim().toLowerCase();
  return Response.json(
    { dominio: /^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio) ? dominio : "" },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
