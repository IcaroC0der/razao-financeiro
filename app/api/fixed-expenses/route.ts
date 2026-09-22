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
    SELECT id, nome, tipo, valor, percentual
    FROM fixed_expenses
    WHERE user_id = ${user.id}
    ORDER BY created_at ASC;
  `;
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo,
      valor: r.valor === null ? null : Number(r.valor),
      percentual: r.percentual === null ? null : Number(r.percentual),
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
  const { nome, tipo } = body;

  if (!nome || typeof nome !== "string") {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (tipo !== "valor" && tipo !== "percentual") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const valor = tipo === "valor" ? Number(body.valor) : null;
  const percentual = tipo === "percentual" ? Number(body.percentual) : null;

  if (tipo === "valor" && (Number.isNaN(valor) || (valor ?? 0) < 0)) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }
  if (
    tipo === "percentual" &&
    (Number.isNaN(percentual) || (percentual ?? 0) < 0 || (percentual ?? 0) > 100)
  ) {
    return NextResponse.json(
      { error: "Percentual deve estar entre 0 e 100." },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    INSERT INTO fixed_expenses (user_id, nome, tipo, valor, percentual)
    VALUES (${user.id}, ${nome}, ${tipo}, ${valor}, ${percentual})
    RETURNING id, nome, tipo, valor, percentual;
  `;
  return NextResponse.json(rows[0]);
}
