/**
 * Lo que se comparte con la app desde otra (WhatsApp, Galería…) llega aquí por POST (D-138). Si el
 * service worker está activo, lo recoge él (y guarda la foto); esto es por si aún no lo está: se
 * queda con el texto y abre `/compartido`. Una foto no se puede guardar aquí, así que se avisa.
 */
const MAX_TEXTO = 6000;

export async function POST(request: Request) {
  const q = new URLSearchParams();
  try {
    const datos = await request.formData();
    for (const k of ["title", "text", "url"]) {
      const v = datos.get(k);
      if (typeof v === "string" && v.trim() !== "") q.set(k, v.slice(0, MAX_TEXTO));
    }
    if (datos.getAll("archivo").some((f) => typeof f === "object" && f.size > 0)) {
      q.set("archivo", "perdido");
    }
  } catch {
    // Formulario roto o demasiado grande: se abre la pantalla vacía.
  }
  const s = q.toString();
  return new Response(null, {
    status: 303,
    headers: { Location: s ? `/compartido?${s}` : "/compartido", "Cache-Control": "no-store" },
  });
}
