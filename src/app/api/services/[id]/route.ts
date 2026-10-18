import { withAuth } from "@/lib/api";
import { handleDelete, handlePatch } from "@/server/servicios/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  return handlePatch(session, req, id);
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  return handleDelete(session, id);
});
