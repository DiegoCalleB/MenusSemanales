import { manejar } from "../manejar";

/** La skill de Alexa con el token en la ruta (D-214): `/api/alexa/<token>`. */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return manejar(request, token);
}
