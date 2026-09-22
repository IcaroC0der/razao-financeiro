import { ensureSchema } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  await ensureSchema();
  return NextResponse.json({ ok: true, message: "Banco inicializado." });
}
