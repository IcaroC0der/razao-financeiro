# Razão — Controle Financeiro Pessoal & Multitenant

App moderno de controle de gastos com arquitetura **Multitenant**, autenticação segura (JWT em cookies HTTP-only), reserva de poupança configurável, recálculo dinâmico de orçamento diário e interface tátil inspirada no design industrial.

Feito em **Next.js 14 (App Router)** + **PostgreSQL (Neon / Vercel Postgres)** + **Tailwind CSS**.

---

## Funcionalidades

- **Multitenant com Autenticação Completa**: Qualquer usuário pode criar uma conta privada com isolamento total de dados.
- **Reserva de Dinheiro Guardado (%)**: Defina uma porcentagem do salário reservada para poupança/investimentos, protegendo-a do orçamento diário e acumulando-a no total guardado.
- **Gastos Fixos e Salário Salvos**: Configurados uma única vez no perfil e herdados automaticamente para todos os ciclos futuros.
- **Orçamento Diário Recalculado**: Cada check-in diário redistribui dinamicamente o saldo restante entre os dias que faltam no ciclo.
- **Múltiplos Ciclos & Histórico Acumulado**: Navegue entre ciclos anteriores e confira a aba de relatórios acumulados com totais economizados e taxa média de poupança.
- **Design Industrial & Tátil**: Interface limpa inspirada em referências analógicas (Braun/Dieter Rams, Aeonik Fono e soft-neumorphism).

---

## Configuração Local

1. Clone o repositório e instale as dependências:
```bash
git clone https://github.com/IcaroC0der/razao-financeiro.git
cd razao-financeiro
npm install
```

2. Crie um arquivo `.env.local` na raiz com as credenciais do seu banco Neon / PostgreSQL e o segredo de autenticação:
```env
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."

# Segredo para assinatura de tokens JWT da sessão (mínimo 32 caracteres)
AUTH_SECRET="razao_prod_auth_secret_super_seguro_min_32_chars_123456"
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Acesse `http://localhost:3000`.

---

## Deploy na Vercel com Banco Neon

1. Suba o projeto para o GitHub:
```bash
git add .
git commit -m "feat: razao financeiro completo"
git branch -M main
git remote add origin https://github.com/IcaroC0der/razao-financeiro.git
git push -u origin main
```

2. Na **Vercel** (`vercel.com`):
   - Clique em **"Add New…"** → **"Project"**.
   - Selecione o repositório `IcaroC0der/razao-financeiro` e clique em **Import**.
   - Em **Environment Variables**, adicione as seguintes variáveis:
     - `POSTGRES_URL`: Cole a connection string do Neon (`postgres://...`).
     - `POSTGRES_PRISMA_URL`: Cole a mesma string (ou com pooling).
     - `POSTGRES_URL_NON_POOLING`: Cole a connection string direta do Neon.
     - `POSTGRES_USER`: Usuário do banco Neon.
     - `POSTGRES_HOST`: Host do Neon (`ep-xxx.neon.tech`).
     - `POSTGRES_PASSWORD`: Senha do Neon.
     - `POSTGRES_DATABASE`: Nome do banco (`neondb`).
     - `AUTH_SECRET`: Uma chave segura aleatória com mais de 32 caracteres (ex: `razao_prod_auth_secret_super_seguro_min_32_chars_123456`).
   - *(Dica alternativa: Você também pode usar a integração oficial "Neon" na aba Integrations da Vercel para preencher as variáveis do banco com 1 clique).*
3. Clique em **Deploy**.
4. Assim que o deploy terminar, acesse a URL da sua aplicação (ex: `https://razao-financeiro.vercel.app`).
   - O schema das tabelas é criado/atualizado de forma 100% automática na primeira requisição!
