import { ensureSchema, sql } from "@/lib/db";
import { AUTH_COOKIE_NAME, createSessionToken, verifyPassword } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json();
  const { email, senha } = body;

  if (!email || !senha) {
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 }
    );
  }

  const cleanEmail = String(email).trim().toLowerCase();

  const { rows } = await sql`
    SELECT id, nome, email, password_hash
    FROM users
    WHERE email = ${cleanEmail}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 }
    );
  }

  const user = rows[0];
  const isValid = await verifyPassword(String(senha), user.password_hash);
  if (!isValid) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    nome: user.nome,
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, nome: user.nome },
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
