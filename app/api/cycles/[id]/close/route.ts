import { ensureSchema, sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const id = Number(params.id);
  await sql`UPDATE cycles SET status = 'encerrado' WHERE id = ${id} AND user_id = ${user.id};`;
  return NextResponse.json({ ok: true });
}
