import { ensureSchema, sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const id = Number(params.id);
  const body = await req.json();
  const { nome, tipo } = body;

  if (tipo !== "valor" && tipo !== "percentual") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  const valor = tipo === "valor" ? Number(body.valor) : null;
  const percentual = tipo === "percentual" ? Number(body.percentual) : null;

  const { rows } = await sql`
    UPDATE fixed_expenses
    SET nome = ${nome}, tipo = ${tipo}, valor = ${valor}, percentual = ${percentual}
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING id, nome, tipo, valor, percentual;
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

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
  await sql`DELETE FROM fixed_expenses WHERE id = ${id} AND user_id = ${user.id};`;
  return NextResponse.json({ ok: true });
}
