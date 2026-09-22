"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIn,
  Cycle,
  FixedExpense,
  VariableExpense,
  CycleListItem,
  computeCycleStats,
  computeAccumulatedReport,
  formatBRL,
  todayISO,
} from "@/lib/calculations";

type FixedForm = {
  nome: string;
  tipo: "valor" | "percentual";
  valor: string;
  percentual: string;
};

const emptyFixedForm: FixedForm = {
  nome: "",
  tipo: "valor",
  valor: "",
  percentual: "",
};

type User = {
  id: number;
  email: string;
  nome: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authNome, setAuthNome] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<"ciclo" | "relatorio">("ciclo");

  const [loading, setLoading] = useState(false);
  const [salario, setSalario] = useState(0);
  const [salarioInput, setSalarioInput] = useState("0");
  const [metaPoupanca, setMetaPoupanca] = useState(0);
  const [metaPoupancaInput, setMetaPoupancaInput] = useState("0");
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [allCycles, setAllCycles] = useState<CycleListItem[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);

  const [fixedForm, setFixedForm] = useState<FixedForm>(emptyFixedForm);
  const [editingFixedId, setEditingFixedId] = useState<number | null>(null);

  const [varDescricao, setVarDescricao] = useState("");
  const [varValor, setVarValor] = useState("");
  const [varData, setVarData] = useState(todayISO());

  const [showCycleModal, setShowCycleModal] = useState(false);
  const [novoInicio, setNovoInicio] = useState(todayISO());
  const [novoFim, setNovoFim] = useState("");

  const [checkinPending, setCheckinPending] = useState<{
    dentroDoLimite: boolean;
    valor: string;
  } | null>(null);

  // Checagem inicial de autenticação
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch {
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  async function loadAll(showLoadingScreen = false, cycleIdToLoad: number | null = selectedCycleId) {
    if (showLoadingScreen) setLoading(true);
    try {
      const cycleEndpoint = cycleIdToLoad
        ? `/api/cycles/${cycleIdToLoad}`
        : "/api/cycles/current";

      const [settingsRes, fixedRes, currentRes, cyclesListRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/fixed-expenses", { cache: "no-store" }).then((r) => r.json()),
        fetch(cycleEndpoint, { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/cycles", { cache: "no-store" }).then((r) => r.json()),
      ]);

      const sal = Number(settingsRes.salario ?? 0);
      setSalario(sal);
      setSalarioInput(String(sal));
      const poupanca = Number(settingsRes.metaPoupancaPercentual ?? 0);
      setMetaPoupanca(poupanca);
      setMetaPoupancaInput(String(poupanca));
      setFixedExpenses(Array.isArray(fixedRes) ? fixedRes : []);
      setCycle(currentRes.cycle || null);
      setVariableExpenses(currentRes.variableExpenses ?? []);
      setCheckins(currentRes.checkins ?? []);
      setAllCycles(Array.isArray(cyclesListRes) ? cyclesListRes : []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      if (showLoadingScreen) setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadAll(true, selectedCycleId);
    }
  }, [user, selectedCycleId]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authEmail, senha: authSenha }
        : { nome: authNome, email: authEmail, senha: authSenha };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Ocorreu um erro. Tente novamente.");
      } else {
        setUser(data.user);
        setAuthSenha("");
        setAuthError("");
      }
    } catch {
      setAuthError("Erro de conexão. Verifique sua rede.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSelectedCycleId(null);
    setCycle(null);
  }

  const stats = useMemo(() => {
    if (!cycle) return null;
    return computeCycleStats(
      cycle,
      fixedExpenses,
      salario,
      variableExpenses,
      checkins,
      metaPoupanca
    );
  }, [cycle, fixedExpenses, salario, variableExpenses, checkins, metaPoupanca]);

  const report = useMemo(() => {
    return computeAccumulatedReport(allCycles, fixedExpenses, salario, metaPoupanca);
  }, [allCycles, fixedExpenses, salario, metaPoupanca]);

  const hoje = todayISO();
  const checkinDeHoje = checkins.find((c) => c.data.slice(0, 10) === hoje);

  async function saveSalario() {
    const v = Number(salarioInput);
    if (Number.isNaN(v) || v < 0) return;
    setSalario(v);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salario: v }),
    });
  }

  async function saveMetaPoupanca() {
    const v = Number(metaPoupancaInput);
    if (Number.isNaN(v) || v < 0 || v > 100) return;
    setMetaPoupanca(v);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metaPoupancaPercentual: v }),
    });
  }

  function startEditFixed(fe: FixedExpense) {
    setEditingFixedId(fe.id);
    setFixedForm({
      nome: fe.nome,
      tipo: fe.tipo,
      valor: fe.valor !== null ? String(fe.valor) : "",
      percentual: fe.percentual !== null ? String(fe.percentual) : "",
    });
  }

  function cancelEditFixed() {
    setEditingFixedId(null);
    setFixedForm(emptyFixedForm);
  }

  async function submitFixed() {
    if (!fixedForm.nome.trim()) return;

    const currentSal = Number(salarioInput);
    if (!Number.isNaN(currentSal) && currentSal >= 0 && currentSal !== salario) {
      await saveSalario();
    }
    const currentMeta = Number(metaPoupancaInput);
    if (!Number.isNaN(currentMeta) && currentMeta >= 0 && currentMeta <= 100 && currentMeta !== metaPoupanca) {
      await saveMetaPoupanca();
    }

    const payload =
      fixedForm.tipo === "valor"
        ? { nome: fixedForm.nome, tipo: "valor", valor: Number(fixedForm.valor) }
        : {
            nome: fixedForm.nome,
            tipo: "percentual",
            percentual: Number(fixedForm.percentual),
          };

    if (editingFixedId) {
      await fetch(`/api/fixed-expenses/${editingFixedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/fixed-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    cancelEditFixed();
    loadAll(false);
  }

  async function deleteFixed(id: number) {
    await fetch(`/api/fixed-expenses/${id}`, { method: "DELETE" });
    loadAll(false);
  }

  async function submitVariable() {
    if (!cycle || !varDescricao.trim() || !varValor) return;
    await fetch("/api/variable-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cycleId: cycle.id,
        descricao: varDescricao,
        valor: Number(varValor),
        data: varData,
      }),
    });
    setVarDescricao("");
    setVarValor("");
    setVarData(todayISO());
    loadAll(false);
  }

  async function deleteVariable(id: number) {
    await fetch(`/api/variable-expenses/${id}`, { method: "DELETE" });
    loadAll(false);
  }

  function handleOpenNewCycle() {
    if (cycle?.data_fim) {
      const fimDate = new Date(cycle.data_fim.slice(0, 10) + "T00:00:00");
      fimDate.setDate(fimDate.getDate() + 1);
      const nextStart = fimDate.toISOString().slice(0, 10);
      setNovoInicio(nextStart);

      const nextEnd = new Date(fimDate);
      nextEnd.setMonth(nextEnd.getMonth() + 1);
      nextEnd.setDate(nextEnd.getDate() - 1);
      setNovoFim(nextEnd.toISOString().slice(0, 10));
    } else {
      setNovoInicio(todayISO());
      setNovoFim("");
    }
    setShowCycleModal(true);
  }

  async function createCycle() {
    if (!novoInicio || !novoFim) return;
    await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataInicio: novoInicio, dataFim: novoFim }),
    });
    setShowCycleModal(false);
    setNovoFim("");
    setSelectedCycleId(null);
    loadAll(false, null);
  }

  function openCheckin(dentroDoLimite: boolean) {
    if (!stats) return;
    setCheckinPending({
      dentroDoLimite,
      valor: stats.orcamentoDiarioAtual.toFixed(2),
    });
  }

  async function confirmCheckin() {
    if (!cycle || !checkinPending || !stats) return;
    await fetch(`/api/cycles/${cycle.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: hoje,
        dentroDoLimite: checkinPending.dentroDoLimite,
        valorGasto: Number(checkinPending.valor),
        orcamentoDoDia: stats.orcamentoDiarioAtual,
      }),
    });
    setCheckinPending(null);
    loadAll(false);
  }

  async function undoCheckin(id: number) {
    await fetch(`/api/checkins/${id}`, { method: "DELETE" });
    loadAll(false);
  }

  if (authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ceramic text-ink">
        <div className="flex items-center gap-3 card-neu px-6 py-4">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald"></span>
          </span>
          <p className="font-mono text-xs uppercase tracking-widest text-ink/70">
            carregando o razão…
          </p>
        </div>
      </main>
    );
  }

  // Se não estiver autenticado, exibe tela de login / cadastro
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 py-12 bg-ceramic text-ink">
        <div className="w-full max-w-md card-neu p-8 sm:p-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill mb-4 text-emerald font-mono font-bold text-xl">
              RZ
            </div>
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-ink mb-1">
              Razão
            </h1>
            <p className="font-mono text-xs text-slate-ind uppercase tracking-widest">
              Controle Financeiro Pessoal
            </p>
          </header>

          <div className="mb-6 flex rounded-2xl bg-ceramic-recessed p-1.5 shadow-neu-inset text-xs font-mono uppercase tracking-wider">
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
              className={`flex-1 py-2 rounded-xl text-center transition-all ${
                authMode === "login"
                  ? "bg-ceramic-card text-ink font-semibold shadow-neu-pill border border-white/60"
                  : "text-ink/50 hover:text-ink"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
              className={`flex-1 py-2 rounded-xl text-center transition-all ${
                authMode === "register"
                  ? "bg-ceramic-card text-ink font-semibold shadow-neu-pill border border-white/60"
                  : "text-ink/50 hover:text-ink"
              }`}
            >
              Criar conta
            </button>
          </div>

          {authError && (
            <div className="mb-5 rounded-xl border border-brick/30 bg-brick/10 p-3.5 text-xs text-brick font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "register" && (
              <Field label="Seu nome">
                <input
                  required
                  placeholder="Como gostaria de ser chamado"
                  value={authNome}
                  onChange={(e) => setAuthNome(e.target.value)}
                  className="input"
                />
              </Field>
            )}

            <Field label="E-mail">
              <input
                required
                type="email"
                placeholder="seu@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Senha">
              <input
                required
                type="password"
                placeholder={authMode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                value={authSenha}
                onChange={(e) => setAuthSenha(e.target.value)}
                className="input"
              />
            </Field>

            <button
              type="submit"
              disabled={authSubmitting}
              className="btn-primary w-full mt-4 !py-3 !text-sm"
            >
              {authSubmitting
                ? "Aguarde…"
                : authMode === "login"
                ? "Entrar no Razão"
                : "Criar minha conta"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const isViewingPastCycle = selectedCycleId !== null && cycle?.status === "encerrado";

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12 bg-ceramic text-ink">
      <div className="mx-auto max-w-4xl space-y-6">
        <Header
          today={hoje}
          userName={user.nome}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {activeTab === "relatorio" ? (
          <ReportView
            report={report}
            onSelectCycle={(cId) => {
              setSelectedCycleId(cId);
              setActiveTab("ciclo");
            }}
          />
        ) : (
          <>
            {/* Barra de Seleção de Ciclos */}
            {allCycles.length > 0 && (
              <CycleSelectorBar
                cycles={allCycles}
                selectedCycleId={selectedCycleId}
                onSelect={(id) => setSelectedCycleId(id)}
                onNewCycle={handleOpenNewCycle}
              />
            )}

            {isViewingPastCycle && (
              <div className="flex items-center justify-between rounded-2xl bg-ceramic-recessed border border-[#CFD8C8] px-5 py-3.5 text-xs text-ink shadow-neu-inset">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-ind"></span>
                  Visualizando histórico do ciclo anterior (modo somente leitura).
                </span>
                <button
                  onClick={() => setSelectedCycleId(null)}
                  className="font-medium underline hover:text-ink/80"
                >
                  Voltar ao ciclo atual
                </button>
              </div>
            )}

            {!cycle ? (
              <NoActiveCycle
                novoInicio={novoInicio}
                novoFim={novoFim}
                setNovoInicio={setNovoInicio}
                setNovoFim={setNovoFim}
                onCreate={createCycle}
              />
            ) : (
              stats && (
                <>
                  {stats.diasEncerrando && !isViewingPastCycle && (
                    <ClosingBanner
                      dataFim={cycle.data_fim}
                      onOpen={handleOpenNewCycle}
                    />
                  )}

                  {/* Painel Hero Dashboard com Dial Radial & Métricas */}
                  <HeroDashboard stats={stats} />

                  {!isViewingPastCycle && (
                    <CheckinControlCard
                      cycle={cycle}
                      stats={stats}
                      jaRegistrado={checkinDeHoje}
                      onSim={() => openCheckin(true)}
                      onNao={() => openCheckin(false)}
                      onUndo={() => checkinDeHoje && undoCheckin(checkinDeHoje.id)}
                    />
                  )}

                  <div className="grid gap-6 sm:grid-cols-2">
                    <FixedExpensesCard
                      salario={salario}
                      salarioInput={salarioInput}
                      setSalarioInput={setSalarioInput}
                      onSaveSalario={saveSalario}
                      metaPoupanca={metaPoupanca}
                      metaPoupancaInput={metaPoupancaInput}
                      setMetaPoupancaInput={setMetaPoupancaInput}
                      onSaveMetaPoupanca={saveMetaPoupanca}
                      fixedExpenses={fixedExpenses}
                      totalFixo={stats.totalFixo}
                      percentualFixo={stats.percentualFixoDoSalario}
                      form={fixedForm}
                      setForm={setFixedForm}
                      editingId={editingFixedId}
                      onEdit={startEditFixed}
                      onCancelEdit={cancelEditFixed}
                      onSubmit={submitFixed}
                      onDelete={deleteFixed}
                      readOnly={isViewingPastCycle}
                    />

                    <VariableExpensesCard
                      variableExpenses={variableExpenses}
                      total={stats.gastoVariavelTotal}
                      descricao={varDescricao}
                      setDescricao={setVarDescricao}
                      valor={varValor}
                      setValor={setVarValor}
                      data={varData}
                      setData={setVarData}
                      onSubmit={submitVariable}
                      onDelete={deleteVariable}
                      readOnly={isViewingPastCycle}
                    />
                  </div>

                  <HistoryCard
                    checkins={checkins}
                    onUndo={undoCheckin}
                    readOnly={isViewingPastCycle}
                  />

                  {!isViewingPastCycle && (
                    <CycleControls
                      cycle={cycle}
                      onOpenNewCycle={handleOpenNewCycle}
                    />
                  )}

                  <OpenFinanceNote />
                </>
              )
            )}
          </>
        )}
      </div>

      {showCycleModal && (
        <CycleModal
          novoInicio={novoInicio}
          novoFim={novoFim}
          setNovoInicio={setNovoInicio}
          setNovoFim={setNovoFim}
          onClose={() => setShowCycleModal(false)}
          onCreate={createCycle}
        />
      )}

      {checkinPending && stats && (
        <CheckinModal
          pending={checkinPending}
          setPending={setCheckinPending}
          orcamento={stats.orcamentoDiarioAtual}
          onCancel={() => setCheckinPending(null)}
          onConfirm={confirmCheckin}
        />
      )}
    </main>
  );
}

// ==========================================
// COMPONENTES VISUAIS (DESIGN SYSTEM)
// ==========================================

function Header({
  today,
  userName,
  onLogout,
  activeTab,
  setActiveTab,
}: {
  today: string;
  userName: string;
  onLogout: () => void;
  activeTab: "ciclo" | "relatorio";
  setActiveTab: (t: "ciclo" | "relatorio") => void;
}) {
  const d = new Date(today + "T00:00:00");
  const label = d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill text-emerald font-mono font-bold text-lg">
            RZ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans text-2xl font-bold tracking-tight text-ink">
                Razão
              </h1>
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-ind px-2 py-0.5 rounded-full bg-ceramic-recessed border border-[#CFD8C8]">
                v2.0
              </span>
            </div>
            <p className="font-mono text-[11px] text-slate-ind capitalize">
              {label}
            </p>
          </div>
        </div>

        {/* User Pill (Inspirado na Ref 3) */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ceramic-card border border-white/80 shadow-neu-pill text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald"></span>
          </span>
          <span className="text-ink font-medium">Olá, {userName}</span>
          <span className="text-ink/20">|</span>
          <button
            onClick={onLogout}
            className="text-ink/60 hover:text-brick text-[11px] font-mono uppercase tracking-wider transition-colors"
          >
            sair
          </button>
        </div>
      </div>

      {/* Tabs de Navegação Técnicas (Inspiradas na Ref 2) */}
      <nav className="flex gap-6 border-b border-[#D2DACB] text-xs font-mono uppercase tracking-widest pt-2">
        <button
          onClick={() => setActiveTab("ciclo")}
          className={`pb-3 relative transition-all ${
            activeTab === "ciclo"
              ? "text-ink font-bold"
              : "text-ink/50 hover:text-ink"
          }`}
        >
          Meu Ciclo
          {activeTab === "ciclo" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("relatorio")}
          className={`pb-3 relative transition-all ${
            activeTab === "relatorio"
              ? "text-ink font-bold"
              : "text-ink/50 hover:text-ink"
          }`}
        >
          Acumulado & Histórico
          {activeTab === "relatorio" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink rounded-full" />
          )}
        </button>
      </nav>
    </header>
  );
}

function CycleSelectorBar({
  cycles,
  selectedCycleId,
  onSelect,
  onNewCycle,
}: {
  cycles: CycleListItem[];
  selectedCycleId: number | null;
  onSelect: (id: number | null) => void;
  onNewCycle: () => void;
}) {
  const activeCycle = cycles.find((c) => c.status === "ativo");

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-slate-ind uppercase tracking-wider">
          Ciclo:
        </span>
        <button
          onClick={() => onSelect(null)}
          className={`px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all ${
            selectedCycleId === null
              ? "bg-[#171D19] text-[#EEF3EA] font-semibold shadow-neu-sm border border-[#2b332d]"
              : "bg-ceramic-card text-ink/70 hover:text-ink border border-white/80 shadow-neu-pill"
          }`}
        >
          Ciclo Atual{" "}
          {activeCycle
            ? `(${new Date(activeCycle.data_inicio.slice(0, 10) + "T00:00:00").toLocaleDateString(
                "pt-BR"
              )})`
            : ""}
        </button>

        {cycles.filter((c) => c.status === "encerrado").length > 0 && (
          <select
            value={selectedCycleId ?? ""}
            onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
            className="input !py-1.5 !px-3 !text-xs !w-auto font-mono cursor-pointer"
          >
            <option value="">Anteriores…</option>
            {cycles
              .filter((c) => c.status === "encerrado")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {new Date(c.data_inicio.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")} até{" "}
                  {new Date(c.data_fim.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")}
                </option>
              ))}
          </select>
        )}
      </div>

      <button
        onClick={onNewCycle}
        className="btn-neu flex items-center gap-1.5 !py-1.5 !px-3.5 !text-xs font-mono uppercase tracking-wider"
      >
        <span className="text-base leading-none text-emerald">+</span> Iniciar Novo Ciclo
      </button>
    </div>
  );
}

// =======================================================
// HERO DASHBOARD COM DIAL RADIAL (REFs 1, 2 & 3)
// =======================================================

function HeroDashboard({ stats }: { stats: ReturnType<typeof computeCycleStats> }) {
  const percentCycleCompleted =
    stats.diasTotais > 0
      ? Math.min(Math.round((stats.diaAtual / stats.diasTotais) * 100), 100)
      : 0;

  return (
    <section className="card-neu p-6 sm:p-8 space-y-6">
      {/* Barra de Status em Pílula Superior (Inspirada na Ref 1) */}
      <div className="flex items-center justify-between flex-wrap gap-4 rounded-2xl bg-ceramic-recessed p-3 sm:px-5 shadow-neu-inset border border-[#CFD8C8]">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center h-7 w-7 rounded-xl bg-ceramic-card border border-white/80 shadow-neu-pill text-xs font-mono font-bold text-ink">
            {stats.cicloNaoIniciado ? "⏱" : "✦"}
          </span>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
              {stats.cicloNaoIniciado
                ? `Ciclo Inicia em ${stats.diasParaIniciar} ${
                    stats.diasParaIniciar === 1 ? "dia" : "dias"
                  }`
                : stats.cicloEncerrado
                ? "Ciclo Concluído"
                : `Dia ${stats.diaAtual} de ${stats.diasTotais}`}
            </p>
            <p className="font-mono text-[10px] text-slate-ind">
              {stats.diasRestantes} dias restantes no período
            </p>
          </div>
        </div>

        {/* Anel de Progresso Circular (Inspirado no 68% da Ref 1) */}
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-slate-ind tracking-wider uppercase hidden sm:inline">
            Progresso do Ciclo
          </span>
          <div className="relative flex items-center justify-center h-10 w-10">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-[#CFD8C8]"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-emerald transition-all duration-500"
                strokeWidth="3.2"
                strokeDasharray="88"
                strokeDashoffset={88 - (88 * percentCycleCompleted) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-mono text-[10px] font-bold text-ink">
              {percentCycleCompleted}%
            </span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Dial Radial (Ref 2 & 3) + Módulos de Métricas (Ref 1 & 3) */}
      <div className="grid gap-6 lg:grid-cols-12 items-center">
        {/* Dial Radial Analógico */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-2">
          <RadialGaugeDial
            orcamentoHoje={stats.orcamentoDiarioAtual}
            diasRestantes={stats.diasRestantes}
            diaAtual={stats.diaAtual}
            diasTotais={stats.diasTotais}
            percentCompleted={percentCycleCompleted}
            cicloNaoIniciado={stats.cicloNaoIniciado}
          />
        </div>

        {/* Painéis Modulares Técnicos (Ref 1 & 3) */}
        <div className="lg:col-span-7 grid gap-4 sm:grid-cols-2">
          {/* Card: Disponível no ciclo */}
          <div className="rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-ind">
                Disponível no Ciclo
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald"></span>
            </div>
            <p className="font-mono text-2xl font-bold text-ink tabular">
              {formatBRL(stats.disponivelTotal)}
            </p>
            <p className="font-mono text-[11px] text-slate-ind">
              Livre para gastos após reserva e fixos
            </p>
          </div>

          {/* Card: Saldo Restante */}
          <div className="rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-ind">
                Saldo Restante
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  stats.saldoRestante < 0 ? "bg-brick" : "bg-emerald"
                }`}
              ></span>
            </div>
            <p
              className={`font-mono text-2xl font-bold tabular ${
                stats.saldoRestante < 0 ? "text-brick" : "text-emerald-dark"
              }`}
            >
              {formatBRL(stats.saldoRestante)}
            </p>
            <p className="font-mono text-[11px] text-slate-ind">
              Para os próximos {stats.diasRestantes} dias
            </p>
          </div>

          {/* Card Destaque: Dinheiro Guardado no Ciclo (Col-span 2) */}
          <div className="sm:col-span-2 rounded-2xl bg-ceramic-card border border-emerald/20 shadow-neu-pill p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏦</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-dark font-bold">
                  Total Guardado no Ciclo
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald/10 text-emerald-dark font-semibold">
                Reserva + Sobra
              </span>
            </div>

            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <p
                className={`font-mono text-3xl font-bold tabular ${
                  stats.totalGuardadoNoCiclo < 0 ? "text-brick" : "text-emerald-dark"
                }`}
              >
                {formatBRL(stats.totalGuardadoNoCiclo)}
              </p>
            </div>

            <div className="pt-2 border-t border-[#D2DACB]/60 flex items-center justify-between text-xs font-mono text-slate-ind flex-wrap gap-1">
              <span>
                {stats.metaPoupancaPercentual > 0 ? (
                  <>
                    <strong className="text-ink font-semibold">
                      {formatBRL(stats.valorGuardadoPlanejado)}
                    </strong>{" "}
                    ({stats.metaPoupancaPercentual}% reserva) +{" "}
                    <strong className="text-ink font-semibold">
                      {formatBRL(stats.saldoRestante)}
                    </strong>{" "}
                    sobra
                  </>
                ) : (
                  <>
                    <strong className="text-ink font-semibold">
                      {formatBRL(stats.saldoRestante)}
                    </strong>{" "}
                    de sobra não gasta
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Dial Radial com 44 Tick Marks circulares inspirado fielmente na Referência 2 e 3
 */
function RadialGaugeDial({
  orcamentoHoje,
  diasRestantes,
  diaAtual,
  diasTotais,
  percentCompleted,
  cicloNaoIniciado,
}: {
  orcamentoHoje: number;
  diasRestantes: number;
  diaAtual: number;
  diasTotais: number;
  percentCompleted: number;
  cicloNaoIniciado?: boolean;
}) {
  const totalTicks = 44;
  const activeTicksCount = Math.round((percentCompleted / 100) * totalTicks);
  const cx = 110;
  const cy = 110;
  const r1 = 78; // Raio interno
  const r2 = 94; // Raio externo

  // Calcular linhas de marcação (tick marks)
  const ticks = Array.from({ length: totalTicks }).map((_, i) => {
    const angle = (i / totalTicks) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r1 * Math.cos(angle);
    const y1 = cy + r1 * Math.sin(angle);
    const x2 = cx + r2 * Math.cos(angle);
    const y2 = cy + r2 * Math.sin(angle);
    const isActive = i <= activeTicksCount;

    return { i, x1, y1, x2, y2, isActive, angle };
  });

  // Ponto indicador ativo na escala (como o dot na Ref 2)
  const activeAngle = (activeTicksCount / totalTicks) * 2 * Math.PI - Math.PI / 2;
  const dotX = cx + (r1 - 10) * Math.cos(activeAngle);
  const dotY = cy + (r1 - 10) * Math.sin(activeAngle);

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg width="220" height="220" className="overflow-visible">
        {/* Marcadores de escala (Ticks) */}
        {ticks.map((t) => (
          <line
            key={t.i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.isActive ? "#171D19" : "#CFD8C8"}
            strokeWidth={t.isActive ? 2.2 : 1.4}
            strokeLinecap="round"
            className="transition-colors duration-300"
          />
        ))}

        {/* Ponto indicador de posição na escala */}
        {percentCompleted > 0 && (
          <circle
            cx={dotX}
            cy={dotY}
            r="3.5"
            fill="#1E6B47"
            className="transition-all duration-300"
          />
        )}
      </svg>

      {/* Núcleo Central do Dial */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-ind mb-1">
          {cicloNaoIniciado ? "Orçamento Previsto" : "Orçamento de Hoje"}
        </span>
        <p
          className={`font-mono text-2xl font-bold tracking-tight tabular ${
            orcamentoHoje < 0 ? "text-brick" : "text-ink"
          }`}
        >
          {formatBRL(orcamentoHoje)}
        </p>
        <span className="font-mono text-[10px] text-slate-ind mt-1">
          {cicloNaoIniciado
            ? `${diasTotais} dias de ciclo`
            : `${diasRestantes} dias restantes`}
        </span>
      </div>
    </div>
  );
}

// =======================================================
// CONTROLE DE CHECK-IN DIÁRIO (INSPIRADO NAS REFs 1 & 3)
// =======================================================

function CheckinControlCard({
  cycle,
  stats,
  jaRegistrado,
  onSim,
  onNao,
  onUndo,
}: {
  cycle: Cycle;
  stats: ReturnType<typeof computeCycleStats>;
  jaRegistrado?: CheckIn;
  onSim: () => void;
  onNao: () => void;
  onUndo: () => void;
}) {
  if (stats.cicloNaoIniciado) {
    const dataInicioFormatada = new Date(
      cycle.data_inicio.slice(0, 10) + "T00:00:00"
    ).toLocaleDateString("pt-BR");
    return (
      <section className="card-neu p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div>
            <span className="inline-block px-3 py-1 mb-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-full bg-ceramic-recessed border border-[#CFD8C8] text-slate-ind">
              Ciclo Agendado
            </span>
            <p className="font-sans text-lg font-semibold text-ink mb-1">
              Check-in diário pausado
            </p>
            <p className="font-sans text-sm text-ink/70">
              Hoje ainda não está dentro do período deste ciclo (inicia em{" "}
              <strong>{dataInicioFormatada}</strong>, daqui a {stats.diasParaIniciar}{" "}
              {stats.diasParaIniciar === 1 ? "dia" : "dias"}). O check-in diário
              será liberado dia após dia a partir do início do ciclo.
            </p>
          </div>
          <div className="text-right shrink-0 border-l border-[#D2DACB] pl-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-ind">
              Orçamento Previsto
            </p>
            <p className="font-mono text-2xl font-bold text-emerald-dark tabular">
              {formatBRL(stats.orcamentoDiarioAtual)}
            </p>
            <p className="font-mono text-xs text-slate-ind mt-0.5">
              {stats.diasTotais} dias de ciclo
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (stats.cicloEncerrado) {
    const dataFimFormatada = new Date(
      cycle.data_fim.slice(0, 10) + "T00:00:00"
    ).toLocaleDateString("pt-BR");
    return (
      <section className="card-neu p-6 sm:p-7">
        <span className="inline-block px-3 py-1 mb-2 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-full bg-ceramic-recessed border border-[#CFD8C8] text-slate-ind">
          Ciclo Finalizado
        </span>
        <p className="font-sans text-lg font-semibold text-ink mb-1">
          Ciclo encerrado
        </p>
        <p className="font-sans text-sm text-ink/70">
          Este ciclo terminou em <strong>{dataFimFormatada}</strong>. Você pode
          iniciar o próximo ciclo a qualquer momento.
        </p>
      </section>
    );
  }

  return (
    <section className="card-neu p-6 sm:p-7 space-y-4">
      <div className="flex items-center justify-between border-b border-[#D2DACB]/60 pb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-ind font-semibold">
          CONTROLE DIÁRIO
        </span>
        <span className="font-mono text-xs text-slate-ind">
          Limite de hoje: <strong>{formatBRL(stats.orcamentoDiarioAtual)}</strong>
        </span>
      </div>

      {jaRegistrado ? (
        <div className="flex items-center justify-between flex-wrap gap-4 rounded-2xl bg-ceramic-recessed p-4 border border-[#CFD8C8] shadow-neu-inset">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${
                jaRegistrado.dentro_do_limite ? "bg-emerald" : "bg-brick"
              }`}
            />
            <p className="text-sm font-sans text-ink">
              Hoje você marcou{" "}
              <strong
                className={
                  jaRegistrado.dentro_do_limite ? "text-emerald-dark" : "text-brick"
                }
              >
                {jaRegistrado.dentro_do_limite ? "dentro do limite" : "acima do limite"}
              </strong>{" "}
              — gasto considerado de{" "}
              <span className="font-mono font-bold tabular">
                {formatBRL(jaRegistrado.valor_gasto)}
              </span>
              .
            </p>
          </div>
          <button
            onClick={onUndo}
            className="btn-neu !py-1.5 !px-3 font-mono text-xs text-ink/70 hover:text-brick"
          >
            desfazer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="font-sans text-lg font-medium text-ink">
            Você ficou dentro do limite diário hoje?
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onSim}
              className="flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill hover:border-emerald/40 active:shadow-neu-pill-active transition-all group"
            >
              <span className="h-3 w-3 rounded-full bg-emerald group-hover:scale-110 transition-transform"></span>
              <span className="font-mono font-bold text-sm text-ink">
                SIM · NO LIMITE
              </span>
            </button>

            <button
              onClick={onNao}
              className="flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill hover:border-brick/40 active:shadow-neu-pill-active transition-all group"
            >
              <span className="h-3 w-3 rounded-full bg-brick group-hover:scale-110 transition-transform"></span>
              <span className="font-mono font-bold text-sm text-ink">
                NÃO · ACIMA
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// =======================================================
// GASTOS FIXOS & RESERVA
// =======================================================

function FixedExpensesCard({
  salario,
  salarioInput,
  setSalarioInput,
  onSaveSalario,
  metaPoupanca,
  metaPoupancaInput,
  setMetaPoupancaInput,
  onSaveMetaPoupanca,
  fixedExpenses,
  totalFixo,
  percentualFixo,
  form,
  setForm,
  editingId,
  onEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  readOnly,
}: {
  salario: number;
  salarioInput: string;
  setSalarioInput: (v: string) => void;
  onSaveSalario: () => void;
  metaPoupanca: number;
  metaPoupancaInput: string;
  setMetaPoupancaInput: (v: string) => void;
  onSaveMetaPoupanca: () => void;
  fixedExpenses: FixedExpense[];
  totalFixo: number;
  percentualFixo: number;
  form: FixedForm;
  setForm: (f: FixedForm) => void;
  editingId: number | null;
  onEdit: (fe: FixedExpense) => void;
  onCancelEdit: () => void;
  onSubmit: () => void;
  onDelete: (id: number) => void;
  readOnly?: boolean;
}) {
  return (
    <section className="card-neu p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between border-b border-[#D2DACB]/60 pb-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-ind">
          SALÁRIO & GASTOS FIXOS
        </h2>
        <span className="font-mono text-xs font-bold text-ink">
          {formatBRL(totalFixo)} fixos
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Salário base">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              disabled={readOnly}
              value={salarioInput}
              onChange={(e) => setSalarioInput(e.target.value)}
              onBlur={onSaveSalario}
              className="input font-mono"
              placeholder="R$ 0,00"
            />
            {!readOnly && (
              <button
                onClick={onSaveSalario}
                className="btn-neu !py-2 !px-3 font-mono text-xs shrink-0"
              >
                Salvar
              </button>
            )}
          </div>
        </Field>

        <Field label="Guardar do salário (%)">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              disabled={readOnly}
              value={metaPoupancaInput}
              onChange={(e) => setMetaPoupancaInput(e.target.value)}
              onBlur={onSaveMetaPoupanca}
              className="input font-mono"
              placeholder="0%"
            />
            {!readOnly && (
              <button
                onClick={onSaveMetaPoupanca}
                className="btn-neu !py-2 !px-3 font-mono text-xs shrink-0"
              >
                Salvar
              </button>
            )}
          </div>
        </Field>
      </div>

      {metaPoupanca > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-ceramic-recessed border border-[#CFD8C8] px-4 py-2.5 text-xs shadow-neu-inset">
          <span className="font-mono text-slate-ind">
            Reserva ({metaPoupanca}%):
          </span>
          <span className="font-mono font-bold text-emerald-dark tabular">
            {formatBRL((metaPoupanca / 100) * salario)} protegidos
          </span>
        </div>
      )}

      {/* Lista de Gastos Fixos em Pílulas Táteis */}
      <ul className="space-y-2.5">
        {fixedExpenses.map((fe) => (
          <li
            key={fe.id}
            className="p-3.5 rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-sans text-sm font-semibold text-ink">{fe.nome}</p>
              <p className="font-mono text-xs text-slate-ind">
                {fe.tipo === "valor"
                  ? formatBRL(fe.valor ?? 0)
                  : `${fe.percentual}% (${formatBRL(
                      ((fe.percentual ?? 0) / 100) * salario
                    )})`}
              </p>
            </div>
            {!readOnly && (
              <div className="flex gap-2 text-xs font-mono shrink-0">
                <button
                  onClick={() => onEdit(fe)}
                  className="btn-neu !py-1 !px-2.5 text-ink/70 hover:text-ink text-[11px]"
                >
                  editar
                </button>
                <button
                  onClick={() => onDelete(fe.id)}
                  className="btn-neu !py-1 !px-2.5 text-brick/80 hover:text-brick text-[11px]"
                >
                  remover
                </button>
              </div>
            )}
          </li>
        ))}
        {fixedExpenses.length === 0 && (
          <p className="py-3 text-xs font-mono text-slate-ind italic text-center">
            Nenhum gasto fixo cadastrado.
          </p>
        )}
      </ul>

      {/* Resumo do Fixo */}
      <div className="pt-3 border-t border-[#D2DACB]/60 flex items-center justify-between text-xs font-mono text-slate-ind">
        <span>Total fixo: {percentualFixo.toFixed(1)}% do salário</span>
        <span className="font-bold text-ink">{formatBRL(totalFixo)}</span>
      </div>

      {!readOnly && (
        <div className="pt-4 border-t border-[#D2DACB]/60 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-ind">
            {editingId ? "Editar Gasto Fixo" : "Adicionar Gasto Fixo"}
          </p>
          <div className="space-y-3">
            <input
              placeholder="Nome (ex.: aluguel, condomínio)"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="input"
            />
            <div className="flex gap-2">
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as "valor" | "percentual" })
                }
                className="input !w-auto font-mono text-xs cursor-pointer"
              >
                <option value="valor">R$ Fixo</option>
                <option value="percentual">% Salário</option>
              </select>
              {form.tipo === "valor" ? (
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="input font-mono"
                />
              ) : (
                <input
                  type="number"
                  step="0.1"
                  placeholder="%"
                  value={form.percentual}
                  onChange={(e) => setForm({ ...form, percentual: e.target.value })}
                  className="input font-mono"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onSubmit} className="btn-primary !py-2 !px-4 text-xs font-mono">
                {editingId ? "Salvar alteração" : "+ Adicionar"}
              </button>
              {editingId && (
                <button
                  onClick={onCancelEdit}
                  className="btn-neu !py-2 !px-4 text-xs font-mono"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// =======================================================
// GASTOS VARIÁVEIS
// =======================================================

function VariableExpensesCard({
  variableExpenses,
  total,
  descricao,
  setDescricao,
  valor,
  setValor,
  data,
  setData,
  onSubmit,
  onDelete,
  readOnly,
}: {
  variableExpenses: VariableExpense[];
  total: number;
  descricao: string;
  setDescricao: (v: string) => void;
  valor: string;
  setValor: (v: string) => void;
  data: string;
  setData: (v: string) => void;
  onSubmit: () => void;
  onDelete: (id: number) => void;
  readOnly?: boolean;
}) {
  return (
    <section className="card-neu p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between border-b border-[#D2DACB]/60 pb-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-ind">
          GASTOS VARIÁVEIS
        </h2>
        <span className="font-mono text-xs font-bold text-ink">
          {formatBRL(total)} total
        </span>
      </div>

      <ul className="space-y-2.5">
        {variableExpenses.map((v) => (
          <li
            key={v.id}
            className="p-3.5 rounded-2xl bg-ceramic-card border border-white/80 shadow-neu-pill flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-sans text-sm font-semibold text-ink">{v.descricao}</p>
              <p className="font-mono text-[11px] text-slate-ind">
                {new Date(v.data.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm font-bold text-ink tabular">
                {formatBRL(v.valor)}
              </span>
              {!readOnly && (
                <button
                  onClick={() => onDelete(v.id)}
                  className="btn-neu !py-1 !px-2.5 text-brick/80 hover:text-brick text-[11px] font-mono"
                >
                  remover
                </button>
              )}
            </div>
          </li>
        ))}
        {variableExpenses.length === 0 && (
          <p className="py-3 text-xs font-mono text-slate-ind italic text-center">
            Nenhum gasto variável no ciclo.
          </p>
        )}
      </ul>

      {!readOnly && (
        <div className="pt-4 border-t border-[#D2DACB]/60 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-ind">
            Adicionar Gasto Variável
          </p>
          <input
            placeholder="Descrição (ex.: cartão, conserto, viagem)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="R$ 0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="input font-mono"
            />
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="input font-mono !w-auto"
            />
          </div>
          <button onClick={onSubmit} className="btn-primary !py-2 !px-4 text-xs font-mono">
            + Adicionar
          </button>
        </div>
      )}
    </section>
  );
}

// =======================================================
// HISTÓRICO DO CICLO
// =======================================================

function HistoryCard({
  checkins,
  onUndo,
  readOnly,
}: {
  checkins: CheckIn[];
  onUndo: (id: number) => void;
  readOnly?: boolean;
}) {
  const ordenados = [...checkins].sort((a, b) => (a.data < b.data ? 1 : -1));

  return (
    <section className="card-neu p-6 sm:p-7 space-y-4">
      <div className="flex items-center justify-between border-b border-[#D2DACB]/60 pb-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-ind">
          HISTÓRICO DO CICLO
        </h2>
        <span className="font-mono text-xs text-slate-ind">
          {ordenados.length} check-ins realizados
        </span>
      </div>

      {ordenados.length === 0 ? (
        <p className="py-3 text-xs font-mono text-slate-ind italic text-center">
          Nenhum check-in registrado ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {ordenados.map((c) => (
            <li
              key={c.id}
              className="p-3 rounded-xl bg-ceramic-card border border-white/80 shadow-neu-pill flex items-center justify-between gap-3 text-xs font-mono"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    c.dentro_do_limite ? "bg-emerald" : "bg-brick"
                  }`}
                />
                <span className="text-ink/80 font-medium">
                  {new Date(c.data.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    c.dentro_do_limite
                      ? "bg-emerald/10 text-emerald-dark"
                      : "bg-brick/10 text-brick"
                  }`}
                >
                  {c.dentro_do_limite ? "Dentro do limite" : "Acima do limite"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-ink tabular">
                  {formatBRL(c.valor_gasto)}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => onUndo(c.id)}
                    className="text-[11px] underline text-slate-ind hover:text-brick"
                  >
                    desfazer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// =======================================================
// RELATÓRIO ACUMULADO & HISTÓRICO
// =======================================================

function ReportView({
  report,
  onSelectCycle,
}: {
  report: ReturnType<typeof computeAccumulatedReport>;
  onSelectCycle: (cId: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* 4 Cards de Métricas Acumuladas */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card-neu p-5 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-ind">
            Total Guardado
          </p>
          <p
            className={`font-mono text-2xl font-bold tabular ${
              report.totalGeralGuardado < 0 ? "text-brick" : "text-emerald-dark"
            }`}
          >
            {formatBRL(report.totalGeralGuardado)}
          </p>
        </div>

        <div className="card-neu p-5 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-ind">
            Taxa de Poupança
          </p>
          <p className="font-mono text-2xl font-bold text-ink tabular">
            {report.taxaMediaEconomia.toFixed(1)}%
          </p>
        </div>

        <div className="card-neu p-5 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-ind">
            Total Geral Gasto
          </p>
          <p className="font-mono text-2xl font-bold text-ink tabular">
            {formatBRL(report.totalGeralGasto)}
          </p>
        </div>

        <div className="card-neu p-5 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-ind">
            Ciclos Registrados
          </p>
          <p className="font-mono text-2xl font-bold text-ink tabular">
            {report.items.length}
          </p>
        </div>
      </section>

      {/* Tabela Comparativa de Ciclos */}
      <section className="card-neu p-6 sm:p-7 space-y-4">
        <div>
          <h2 className="font-sans text-lg font-bold text-ink">Histórico por Ciclo</h2>
          <p className="font-mono text-xs text-slate-ind">
            Consolidado de gastos fixos, variáveis, check-ins e sobra de cada período.
          </p>
        </div>

        {report.items.length === 0 ? (
          <p className="py-6 font-mono text-xs text-slate-ind italic text-center">
            Nenhum ciclo cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D2DACB] text-slate-ind uppercase tracking-wider text-[10px]">
                  <th className="py-3 pr-3">Período</th>
                  <th className="py-3 px-2">Salário</th>
                  <th className="py-3 px-2">Fixos</th>
                  <th className="py-3 px-2">Variáveis</th>
                  <th className="py-3 px-2">Diários</th>
                  <th className="py-3 px-2">Total Gasto</th>
                  <th className="py-3 px-2 font-bold text-ink">Guardado / Sobra</th>
                  <th className="py-3 pl-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D2DACB]/60">
                {report.items.map((it) => (
                  <tr key={it.cycle.id} className="hover:bg-ceramic-recessed/50 transition-colors">
                    <td className="py-3.5 pr-3">
                      <p className="font-semibold text-ink">
                        {new Date(it.cycle.data_inicio.slice(0, 10) + "T00:00:00").toLocaleDateString(
                          "pt-BR"
                        )}{" "}
                        a{" "}
                        {new Date(it.cycle.data_fim.slice(0, 10) + "T00:00:00").toLocaleDateString(
                          "pt-BR"
                        )}
                      </p>
                      <span className="text-[10px] text-slate-ind capitalize">
                        {it.cycle.status} · {it.diasTotais} dias
                      </span>
                    </td>
                    <td className="py-3.5 px-2 tabular">{formatBRL(it.salario)}</td>
                    <td className="py-3.5 px-2 tabular text-slate-ind">{formatBRL(it.totalFixo)}</td>
                    <td className="py-3.5 px-2 tabular text-slate-ind">
                      {formatBRL(it.totalVariavel)}
                    </td>
                    <td className="py-3.5 px-2 tabular text-slate-ind">
                      {formatBRL(it.totalCheckins)}
                    </td>
                    <td className="py-3.5 px-2 tabular font-semibold text-ink">
                      {formatBRL(it.totalGasto)}
                    </td>
                    <td className="py-3.5 px-2 tabular">
                      <span
                        className={`font-bold ${
                          it.guardado >= 0 ? "text-emerald-dark" : "text-brick"
                        }`}
                      >
                        {formatBRL(it.guardado)} ({it.percentualEconomizado.toFixed(0)}%)
                      </span>
                      {it.valorGuardadoPlanejado > 0 && (
                        <p className="text-[10px] text-slate-ind whitespace-nowrap">
                          {formatBRL(it.valorGuardadoPlanejado)} reserva +{" "}
                          {formatBRL(it.guardado - it.valorGuardadoPlanejado)} sobra
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 pl-2 text-right">
                      <button
                        onClick={() => onSelectCycle(it.cycle.id)}
                        className="btn-neu !py-1 !px-2.5 text-[11px] font-mono"
                      >
                        ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// =======================================================
// AVISOS & MODAIS TÁTEIS
// =======================================================

function ClosingBanner({
  dataFim,
  onOpen,
}: {
  dataFim: string;
  onOpen: () => void;
}) {
  const isPast =
    new Date(dataFim.slice(0, 10) + "T00:00:00") <
    new Date(todayISO() + "T00:00:00");

  return (
    <div className="card-neu !bg-gold/10 border border-gold/30 p-5 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="font-sans text-sm font-semibold text-ink">
            {isPast ? "Seu ciclo já terminou." : "Seu ciclo está terminando."}
          </p>
          <p className="font-sans text-xs text-ink/70">
            Hora de fechar as contas e configurar o próximo ciclo de salário.
          </p>
        </div>
      </div>
      <button onClick={onOpen} className="btn-primary !py-2 !px-4 text-xs font-mono">
        Iniciar Próximo Ciclo
      </button>
    </div>
  );
}

function NoActiveCycle({
  novoInicio,
  novoFim,
  setNovoInicio,
  setNovoFim,
  onCreate,
}: {
  novoInicio: string;
  novoFim: string;
  setNovoInicio: (v: string) => void;
  setNovoFim: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="card-neu p-8 sm:p-10 space-y-6">
      <div>
        <h2 className="font-sans text-2xl font-bold text-ink mb-2">Comece um ciclo</h2>
        <p className="font-sans text-sm text-ink/70">
          Um ciclo vai do dia em que seu salário cai até a véspera do próximo
          pagamento. Defina as datas — seu salário base e gastos fixos são
          aplicados automaticamente!
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início do ciclo">
          <input
            type="date"
            value={novoInicio}
            onChange={(e) => setNovoInicio(e.target.value)}
            className="input font-mono"
          />
        </Field>
        <Field label="Fim do ciclo">
          <input
            type="date"
            value={novoFim}
            onChange={(e) => setNovoFim(e.target.value)}
            className="input font-mono"
          />
        </Field>
      </div>

      <button onClick={onCreate} className="btn-primary">
        Iniciar ciclo
      </button>
    </section>
  );
}

function CycleControls({
  cycle,
  onOpenNewCycle,
}: {
  cycle: Cycle;
  onOpenNewCycle: () => void;
}) {
  const inicio = new Date(cycle.data_inicio.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR");
  const fim = new Date(cycle.data_fim.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <section className="flex items-center justify-between text-xs font-mono text-slate-ind px-2">
      <span>
        Ciclo ativo: {inicio} até {fim}
      </span>
      <button onClick={onOpenNewCycle} className="underline hover:text-ink">
        encerrar ciclo agora
      </button>
    </section>
  );
}

function CycleModal({
  novoInicio,
  novoFim,
  setNovoInicio,
  setNovoFim,
  onClose,
  onCreate,
}: {
  novoInicio: string;
  novoFim: string;
  setNovoInicio: (v: string) => void;
  setNovoFim: (v: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="font-sans text-xl font-bold text-ink mb-2">Iniciar Novo Ciclo</h3>
      <p className="font-sans text-xs text-ink/70 mb-4">
        O ciclo atual será concluído e arquivado no seu histórico. Defina o período do próximo ciclo:
      </p>

      <div className="mb-5 rounded-2xl bg-emerald/10 border border-emerald/20 p-4 text-xs font-sans text-ink space-y-1">
        <p className="font-semibold text-emerald-dark">
          ✨ Gastos base preservados:
        </p>
        <p className="text-ink/70">
          Seu <strong>salário base</strong>, todos os <strong>gastos fixos</strong> e a{" "}
          <strong>porcentagem guardada</strong> são mantidos automaticamente! Você só precisa confirmar as datas.
        </p>
      </div>

      <div className="space-y-4">
        <Field label="Início do novo ciclo">
          <input
            type="date"
            value={novoInicio}
            onChange={(e) => setNovoInicio(e.target.value)}
            className="input font-mono"
          />
        </Field>
        <Field label="Fim do novo ciclo">
          <input
            type="date"
            value={novoFim}
            onChange={(e) => setNovoFim(e.target.value)}
            className="input font-mono"
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={onCreate} className="btn-primary flex-1 font-mono text-xs">
          Confirmar e Iniciar
        </button>
        <button onClick={onClose} className="btn-neu flex-1 font-mono text-xs">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

function CheckinModal({
  pending,
  setPending,
  orcamento,
  onCancel,
  onConfirm,
}: {
  pending: { dentroDoLimite: boolean; valor: string };
  setPending: (v: { dentroDoLimite: boolean; valor: string }) => void;
  orcamento: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`h-3 w-3 rounded-full ${
            pending.dentroDoLimite ? "bg-emerald" : "bg-brick"
          }`}
        />
        <h3 className="font-sans text-lg font-bold text-ink">
          {pending.dentroDoLimite ? "Dentro do limite" : "Acima do limite"}
        </h3>
      </div>
      <p className="font-sans text-xs text-ink/70 mb-4">
        Orçamento previsto para hoje: <strong>{formatBRL(orcamento)}</strong>. Ajuste abaixo quanto você realmente gastou hoje — isso recalcula o orçamento dos próximos dias.
      </p>
      <Field label="Valor gasto hoje (R$)">
        <input
          type="number"
          step="0.01"
          value={pending.valor}
          onChange={(e) => setPending({ ...pending, valor: e.target.value })}
          className="input font-mono !text-lg !font-bold"
        />
      </Field>
      <div className="mt-6 flex gap-3">
        <button onClick={onConfirm} className="btn-primary flex-1 font-mono text-xs">
          Confirmar Registro
        </button>
        <button onClick={onCancel} className="btn-neu flex-1 font-mono text-xs">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

function OpenFinanceNote() {
  return (
    <section className="rounded-2xl border border-dashed border-[#CFD8C8] p-5 text-xs text-slate-ind space-y-1">
      <h2 className="font-mono font-semibold uppercase tracking-wider text-ink text-[11px]">
        Sobre automação bancária (Open Finance)
      </h2>
      <p>
        É possível sincronizar faturas e extratos bancários automaticamente via Open Finance usando Pluggy ou Belvo. Essa funcionalidade pode ser conectada futuramente sem alterar suas regras de cálculo.
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-widest text-slate-ind mb-1.5 font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-neu p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
