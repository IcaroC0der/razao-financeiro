import { ensureSchema, sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

function formatDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const cycleId = Number(params.id);
  const body = await req.json();
  const { data, dentroDoLimite, valorGasto, orcamentoDoDia } = body;

  if (!data || typeof dentroDoLimite !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Verifica se o ciclo pertence ao usuário
  const { rows: cycleCheck } = await sql`
    SELECT id, data_inicio, data_fim FROM cycles WHERE id = ${cycleId} AND user_id = ${user.id};
  `;
  if (cycleCheck.length === 0) {
    return NextResponse.json({ error: "Ciclo não encontrado." }, { status: 404 });
  }

  const { rows } = await sql`
    INSERT INTO daily_checkins (cycle_id, data, dentro_do_limite, valor_gasto, orcamento_do_dia)
    VALUES (${cycleId}, ${data}, ${dentroDoLimite}, ${Number(valorGasto)}, ${Number(orcamentoDoDia)})
    ON CONFLICT (cycle_id, data)
    DO UPDATE SET
      dentro_do_limite = EXCLUDED.dentro_do_limite,
      valor_gasto = EXCLUDED.valor_gasto,
      orcamento_do_dia = EXCLUDED.orcamento_do_dia
    RETURNING id, data, dentro_do_limite, valor_gasto, orcamento_do_dia;
  `;
  return NextResponse.json({
    id: rows[0].id,
    data: formatDate(rows[0].data),
    dentro_do_limite: rows[0].dentro_do_limite,
    valor_gasto: Number(rows[0].valor_gasto),
    orcamento_do_dia: Number(rows[0].orcamento_do_dia),
  });
}
