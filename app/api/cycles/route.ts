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

export async function GET(_req: Request) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { rows } = await sql`
    SELECT 
      c.id,
      c.data_inicio,
      c.data_fim,
      c.status,
      COALESCE((SELECT SUM(v.valor) FROM variable_expenses v WHERE v.cycle_id = c.id), 0) AS total_variavel,
      COALESCE((SELECT SUM(d.valor_gasto) FROM daily_checkins d WHERE d.cycle_id = c.id), 0) AS total_checkins,
      COALESCE((SELECT COUNT(*) FROM daily_checkins d WHERE d.cycle_id = c.id), 0) AS checkins_count
    FROM cycles c
    WHERE c.user_id = ${user.id}
    ORDER BY c.data_inicio DESC, c.id DESC;
  `;

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      data_inicio: formatDate(r.data_inicio),
      data_fim: formatDate(r.data_fim),
      status: r.status,
      total_variavel: Number(r.total_variavel),
      total_checkins: Number(r.total_checkins),
      checkins_count: Number(r.checkins_count),
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
  const { dataInicio, dataFim } = body;

  if (!dataInicio || !dataFim) {
    return NextResponse.json(
      { error: "Informe o início e o fim do ciclo." },
      { status: 400 }
    );
  }
  if (new Date(dataFim) <= new Date(dataInicio)) {
    return NextResponse.json(
      { error: "A data final deve ser depois da inicial." },
      { status: 400 }
    );
  }

  await sql`
    UPDATE cycles
    SET status = 'encerrado'
    WHERE status = 'ativo' AND user_id = ${user.id};
  `;

  const { rows } = await sql`
    INSERT INTO cycles (user_id, data_inicio, data_fim, status)
    VALUES (${user.id}, ${dataInicio}, ${dataFim}, 'ativo')
    RETURNING id, data_inicio, data_fim, status;
  `;
  return NextResponse.json({
    id: rows[0].id,
    data_inicio: formatDate(rows[0].data_inicio),
    data_fim: formatDate(rows[0].data_fim),
    status: rows[0].status,
  });
}
