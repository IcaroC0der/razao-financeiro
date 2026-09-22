import { ensureSchema, sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const id = Number(params.id);
  await sql`
    DELETE FROM daily_checkins
    WHERE id = ${id}
      AND cycle_id IN (SELECT id FROM cycles WHERE user_id = ${user.id});
  `;
  return NextResponse.json({ ok: true });
}
