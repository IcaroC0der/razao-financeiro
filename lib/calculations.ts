export type FixedExpense = {
  id: number;
  nome: string;
  tipo: "valor" | "percentual";
  valor: number | null;
  percentual: number | null;
};

export type Cycle = {
  id: number;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string; // YYYY-MM-DD
  status: "ativo" | "encerrado";
};

export type VariableExpense = {
  id: number;
  descricao: string;
  valor: number;
  data: string;
};

export type CheckIn = {
  id: number;
  data: string;
  dentro_do_limite: boolean;
  valor_gasto: number;
  orcamento_do_dia: number;
};

export function toDateString(val: string | Date | null | undefined): string {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export function parseDateOnly(val: string | Date): Date {
  const str = toDateString(val);
  return new Date(str + "T00:00:00");
}

/** Number of calendar days spanned by a cycle, inclusive of both ends. */
export function daysInCycle(cycle: Pick<Cycle, "data_inicio" | "data_fim">) {
  const start = parseDateOnly(cycle.data_inicio);
  const end = parseDateOnly(cycle.data_fim);
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 1);
}

/** Which calendar day of the cycle "today" is (1-indexed). Clamped to the cycle span. */
export function dayIndexInCycle(
  cycle: Pick<Cycle, "data_inicio" | "data_fim">,
  today: Date | string = new Date()
) {
  const start = parseDateOnly(cycle.data_inicio);
  const t = parseDateOnly(today);
  const diffFromStart = Math.round((t.getTime() - start.getTime()) / 86400000);
  const total = daysInCycle(cycle);
  if (diffFromStart < 0) return 0; // ainda não iniciou
  return Math.min(diffFromStart + 1, total);
}

export function totalFixedExpenses(
  fixedExpenses: FixedExpense[],
  salario: number
) {
  return fixedExpenses.reduce((sum, fe) => {
    if (fe.tipo === "percentual") {
      return sum + ((fe.percentual ?? 0) / 100) * salario;
    }
    return sum + (fe.valor ?? 0);
  }, 0);
}

export type CycleStats = {
  diasTotais: number;
  diaAtual: number;
  diasRestantes: number;
  totalFixo: number;
  percentualFixoDoSalario: number;
  metaPoupancaPercentual: number;
  valorGuardadoPlanejado: number;
  totalGuardadoNoCiclo: number; // valorGuardadoPlanejado + saldoRestante
  disponivelTotal: number; // salario - valorGuardadoPlanejado - gastos fixos
  gastoVariavelTotal: number;
  gastoDiarioRegistrado: number; // sum of valor_gasto from check-ins
  saldoRestante: number; // disponivelTotal - variaveis - diario registrado
  orcamentoDiarioAtual: number; // saldoRestante / diasRestantes
  orcamentoDiarioBase: number; // disponivelTotal / diasTotais, para referência
  diasEncerrando: boolean; // true if within 2 days of data_fim or past it
  cicloNaoIniciado: boolean; // true se hoje for antes de data_inicio
  cicloEmAndamento: boolean; // true se hoje estiver entre data_inicio e data_fim
  cicloEncerrado: boolean; // true se hoje for depois de data_fim
  diasParaIniciar: number; // quantidade de dias até o ciclo começar
};

export function computeCycleStats(
  cycle: Pick<Cycle, "data_inicio" | "data_fim">,
  fixedExpenses: FixedExpense[],
  salario: number,
  variableExpenses: VariableExpense[],
  checkins: CheckIn[],
  metaPoupancaPercentual: number = 0,
  today: Date | string = new Date()
): CycleStats {
  const start = parseDateOnly(cycle.data_inicio);
  const end = parseDateOnly(cycle.data_fim);
  const t = parseDateOnly(today);

  const diasTotais = daysInCycle(cycle);

  const diffFromStart = Math.round((t.getTime() - start.getTime()) / 86400000);
  const diffToEnd = Math.round((end.getTime() - t.getTime()) / 86400000);

  const cicloNaoIniciado = diffFromStart < 0;
  const cicloEncerrado = diffToEnd < 0;
  const cicloEmAndamento = !cicloNaoIniciado && !cicloEncerrado;
  const diasParaIniciar = cicloNaoIniciado ? Math.abs(diffFromStart) : 0;

  const diaAtual = cicloNaoIniciado
    ? 0
    : cicloEncerrado
    ? diasTotais
    : diffFromStart + 1;

  const diasComCheckin = checkins.length;
  const diasRestantes = cicloNaoIniciado
    ? diasTotais
    : Math.max(diasTotais - diasComCheckin, 1);

  const valorGuardadoPlanejado = (metaPoupancaPercentual / 100) * salario;
  const totalFixo = totalFixedExpenses(fixedExpenses, salario);
  const percentualFixoDoSalario = salario > 0 ? (totalFixo / salario) * 100 : 0;

  // Disponível para despesas do ciclo = salário menos o que foi reservado para guardar e os gastos fixos
  const disponivelTotal = Math.max(salario - valorGuardadoPlanejado - totalFixo, 0);

  const gastoVariavelTotal = variableExpenses.reduce(
    (s, v) => s + Number(v.valor),
    0
  );
  const gastoDiarioRegistrado = checkins.reduce(
    (s, c) => s + Number(c.valor_gasto),
    0
  );

  const saldoRestante =
    (salario - valorGuardadoPlanejado - totalFixo) -
    gastoVariavelTotal -
    gastoDiarioRegistrado;

  const orcamentoDiarioAtual = saldoRestante / diasRestantes;
  const orcamentoDiarioBase = diasTotais > 0 ? disponivelTotal / diasTotais : 0;

  // Total guardado acumulado no ciclo: o que foi reservado + o que sobrou
  const totalGuardadoNoCiclo = valorGuardadoPlanejado + saldoRestante;

  // Só ativa alerta de término se o ciclo já tiver começado e faltarem <= 2 dias ou já tiver passado
  const diasEncerrando = !cicloNaoIniciado && diffToEnd <= 2;

  return {
    diasTotais,
    diaAtual,
    diasRestantes,
    totalFixo,
    percentualFixoDoSalario,
    metaPoupancaPercentual,
    valorGuardadoPlanejado,
    totalGuardadoNoCiclo,
    disponivelTotal,
    gastoVariavelTotal,
    gastoDiarioRegistrado,
    saldoRestante,
    orcamentoDiarioAtual,
    orcamentoDiarioBase,
    diasEncerrando,
    cicloNaoIniciado,
    cicloEmAndamento,
    cicloEncerrado,
    diasParaIniciar,
  };
}

export function formatBRL(value: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "R$ 0,00";
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type CycleListItem = {
  id: number;
  data_inicio: string;
  data_fim: string;
  status: "ativo" | "encerrado";
  total_variavel: number;
  total_checkins: number;
  checkins_count: number;
};

export type CycleReportItem = {
  cycle: CycleListItem;
  diasTotais: number;
  salario: number;
  totalFixo: number;
  valorGuardadoPlanejado: number;
  totalVariavel: number;
  totalCheckins: number;
  totalGasto: number;
  guardado: number; // Salário - Total Gasto (saldo que sobrou/economizou)
  percentualEconomizado: number;
  percentualGasto: number;
};

export type AccumulatedReport = {
  items: CycleReportItem[];
  totalGeralSalarios: number;
  totalGeralGasto: number;
  totalGeralGuardado: number;
  taxaMediaEconomia: number;
};

export function computeAccumulatedReport(
  cycles: CycleListItem[],
  fixedExpenses: FixedExpense[],
  salario: number,
  metaPoupancaPercentual: number = 0
): AccumulatedReport {
  const totalFixo = totalFixedExpenses(fixedExpenses, salario);
  const valorGuardadoPlanejado = (metaPoupancaPercentual / 100) * salario;

  const items: CycleReportItem[] = cycles.map((c) => {
    const dias = daysInCycle(c);
    const totalGasto = totalFixo + c.total_variavel + c.total_checkins;
    const guardado = salario - totalGasto;
    const percentualEconomizado = salario > 0 ? (guardado / salario) * 100 : 0;
    const percentualGasto = salario > 0 ? (totalGasto / salario) * 100 : 0;

    return {
      cycle: c,
      diasTotais: dias,
      salario,
      totalFixo,
      valorGuardadoPlanejado,
      totalVariavel: c.total_variavel,
      totalCheckins: c.total_checkins,
      totalGasto,
      guardado,
      percentualEconomizado,
      percentualGasto,
    };
  });

  const totalGeralSalarios = items.reduce((acc, it) => acc + it.salario, 0);
  const totalGeralGasto = items.reduce((acc, it) => acc + it.totalGasto, 0);
  const totalGeralGuardado = items.reduce((acc, it) => acc + it.guardado, 0);
  const taxaMediaEconomia =
    totalGeralSalarios > 0 ? (totalGeralGuardado / totalGeralSalarios) * 100 : 0;

  return {
    items,
    totalGeralSalarios,
    totalGeralGasto,
    totalGeralGuardado,
    taxaMediaEconomia,
  };
}
