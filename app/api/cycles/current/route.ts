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
    SELECT id, data_inicio, data_fim, status
    FROM cycles
    WHERE status = 'ativo' AND user_id = ${user.id}
    ORDER BY id DESC
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { cycle: null, variableExpenses: [], checkins: [] },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }

  const cycle = rows[0];

  const [{ rows: variableExpenses }, { rows: checkins }] = await Promise.all([
    sql`
      SELECT id, descricao, valor, data
      FROM variable_expenses
      WHERE cycle_id = ${cycle.id}
      ORDER BY data DESC, created_at DESC;
    `,
    sql`
      SELECT id, data, dentro_do_limite, valor_gasto, orcamento_do_dia
      FROM daily_checkins
      WHERE cycle_id = ${cycle.id}
      ORDER BY data ASC;
    `,
  ]);

  return NextResponse.json(
    {
      cycle: {
        id: cycle.id,
        data_inicio: formatDate(cycle.data_inicio),
        data_fim: formatDate(cycle.data_fim),
        status: cycle.status,
      },
      variableExpenses: variableExpenses.map((v) => ({
        id: v.id,
        descricao: v.descricao,
        valor: Number(v.valor),
        data: formatDate(v.data),
      })),
      checkins: checkins.map((c) => ({
        id: c.id,
        data: formatDate(c.data),
        dentro_do_limite: c.dentro_do_limite,
        valor_gasto: Number(c.valor_gasto),
        orcamento_do_dia: Number(c.orcamento_do_dia),
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
