import { manejar } from "./manejar";

/**
 * La skill de Alexa (D-214): `POST /api/alexa?t=<token del calendario>`. Tres cosas: «añade X a la
 * compra», «qué hay de cena» y «qué tengo hoy». Apagada mientras no esté `ALEXA_SKILL_ID` (el
 * identificador de la skill): solo contesta a esa skill y solo a peticiones con la firma de Amazon.
 * Por privacidad solo habla de compra, cena y citas.
 */
export async function POST(request: Request) {
  return manejar(request, new URL(request.url).searchParams.get("t") ?? "");
}
