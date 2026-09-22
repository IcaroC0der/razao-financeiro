import { ensureSchema, sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { rows } = await sql`
    SELECT salario, meta_poupanca_percentual
    FROM settings
    WHERE user_id = ${user.id}
    LIMIT 1;
  `;
  const salario = Number(rows[0]?.salario ?? 0);
  const metaPoupancaPercentual = Number(rows[0]?.meta_poupanca_percentual ?? 0);

  return NextResponse.json(
    { salario, metaPoupancaPercentual },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function PUT(req: Request) {
  await ensureSchema();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json();
  const salario = body.salario !== undefined ? Number(body.salario) : undefined;
  const metaPoupancaPercentual =
    body.metaPoupancaPercentual !== undefined
      ? Number(body.metaPoupancaPercentual)
      : undefined;

  if (salario !== undefined && (Number.isNaN(salario) || salario < 0)) {
    return NextResponse.json({ error: "Salário inválido." }, { status: 400 });
  }
  if (
    metaPoupancaPercentual !== undefined &&
    (Number.isNaN(metaPoupancaPercentual) ||
      metaPoupancaPercentual < 0 ||
      metaPoupancaPercentual > 100)
  ) {
    return NextResponse.json(
      { error: "A porcentagem deve estar entre 0 e 100%." },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    INSERT INTO settings (user_id, salario, meta_poupanca_percentual)
    VALUES (
      ${user.id},
      ${salario ?? 0},
      ${metaPoupancaPercentual ?? 0}
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      salario = COALESCE(${salario}, settings.salario),
      meta_poupanca_percentual = COALESCE(${metaPoupancaPercentual}, settings.meta_poupanca_percentual)
    RETURNING salario, meta_poupanca_percentual;
  `;

  return NextResponse.json(
    {
      salario: Number(rows[0].salario),
      metaPoupancaPercentual: Number(rows[0].meta_poupanca_percentual),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
