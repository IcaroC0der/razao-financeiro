import { sql } from "@vercel/postgres";

export { sql };

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nome TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      salario NUMERIC NOT NULL DEFAULT 0,
      user_id INTEGER
    );
  `;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id INTEGER;`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS meta_poupanca_percentual NUMERIC NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE settings DROP CONSTRAINT IF EXISTS single_row;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS settings_user_id_idx ON settings (user_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('valor','percentual')),
      valor NUMERIC,
      percentual NUMERIC,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS user_id INTEGER;`;

  await sql`
    CREATE TABLE IF NOT EXISTS cycles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado')),
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE cycles ADD COLUMN IF NOT EXISTS user_id INTEGER;`;

  await sql`
    CREATE TABLE IF NOT EXISTS variable_expenses (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      descricao TEXT NOT NULL,
      valor NUMERIC NOT NULL,
      data DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      dentro_do_limite BOOLEAN NOT NULL,
      valor_gasto NUMERIC NOT NULL,
      orcamento_do_dia NUMERIC NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE(cycle_id, data)
    );
  `;
}
