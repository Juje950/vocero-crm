import { withAuth } from "@/lib/api";
import { handleCreate, handleList } from "@/server/servicios/http";

// La bandera SERVICIOS se lee en cada petición, nunca al construir.
export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => handleList(session));

export const POST = withAuth(async (session, req: Request) => handleCreate(session, req));
