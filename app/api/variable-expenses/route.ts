import { ensureSchema, sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function GET(req: Request) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cycleId = Number(searchParams.get("cycleId"));
  if (!cycleId) {
    return NextResponse.json({ error: "cycleId é obrigatório." }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, descricao, valor, data
    FROM variable_expenses
    WHERE cycle_id = ${cycleId}
      AND cycle_id IN (SELECT id FROM cycles WHERE user_id = ${user.id})
    ORDER BY data DESC, created_at DESC;
  `;
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      descricao: r.descricao,
      valor: Number(r.valor),
      data: formatDate(r.data),
    })),
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

export async function POST(req: Request) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json();
  const { cycleId, descricao, valor, data } = body;

  if (!cycleId || !descricao || Number.isNaN(Number(valor))) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Verifica posse do ciclo
  const { rows: cycleCheck } = await sql`
    SELECT id FROM cycles WHERE id = ${cycleId} AND user_id = ${user.id};
  `;
  if (cycleCheck.length === 0) {
    return NextResponse.json({ error: "Ciclo não encontrado." }, { status: 404 });
  }

  const { rows } = await sql`
    INSERT INTO variable_expenses (cycle_id, descricao, valor, data)
    VALUES (${cycleId}, ${descricao}, ${Number(valor)}, ${data || new Date().toISOString().slice(0, 10)})
    RETURNING id, descricao, valor, data;
  `;
  return NextResponse.json({
    id: rows[0].id,
    descricao: rows[0].descricao,
    valor: Number(rows[0].valor),
    data: formatDate(rows[0].data),
  });
}
