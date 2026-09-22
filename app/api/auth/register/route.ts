import { ensureSchema, sql } from "@/lib/db";
import { AUTH_COOKIE_NAME, createSessionToken, hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`register:${ip}`, 8, 5 * 60 * 1000); // máx 8 cadastros a cada 5 min por IP
  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas tentativas de cadastro. Por segurança, aguarde alguns minutos." },
      { status: 429 }
    );
  }

  await ensureSchema();
  const body = await req.json();
  const { nome, email, senha } = body;

  if (!nome || typeof nome !== "string" || !nome.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  if (!senha || typeof senha !== "string" || senha.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter no mínimo 6 caracteres." },
      { status: 400 }
    );
  }

  const cleanEmail = email.trim().toLowerCase();

  // Verifica se o e-mail já existe
  const { rows: existing } = await sql`
    SELECT id FROM users WHERE email = ${cleanEmail} LIMIT 1;
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Este e-mail já está cadastrado. Faça login." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(senha);

  const { rows: newUsers } = await sql`
    INSERT INTO users (nome, email, password_hash)
    VALUES (${nome.trim()}, ${cleanEmail}, ${passwordHash})
    RETURNING id, nome, email;
  `;
  const user = newUsers[0];

  // Apenas se for o primeiro usuário administrador inicial e houver registros legados
  if (user.id === 1) {
    await sql`UPDATE settings SET user_id = ${user.id} WHERE user_id IS NULL;`;
    await sql`UPDATE fixed_expenses SET user_id = ${user.id} WHERE user_id IS NULL;`;
    await sql`UPDATE cycles SET user_id = ${user.id} WHERE user_id IS NULL;`;
  }

  // Garante registro de settings para o novo usuário se não tiver
  await sql`
    INSERT INTO settings (user_id, salario)
    VALUES (${user.id}, 0)
    ON CONFLICT (user_id) DO NOTHING;
  `;

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
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  });

  return response;
}
