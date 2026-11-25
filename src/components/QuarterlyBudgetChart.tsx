import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Edit3, RotateCcw, Target, X } from 'lucide-react';
import {
  DEFAULT_QUARTERLY_BUDGETS,
  FISCAL_MONTHS,
} from '../data/pcuCatalog';
import {
  LedgerTransaction,
  PcuSettings,
  QuarterlyBudgetTarget,
} from '../types/accounting';
import { formatMoney, getMonthKey } from '../utils/accountingMath';

interface QuarterlyBudgetChartProps {
  settings: PcuSettings;
  filteredTransactions: LedgerTransaction[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  onUpdateQuarterlyBudgets: (nextBudgets: QuarterlyBudgetTarget[]) => void;
}

type CalculationMode = 'cumulative' | 'quarterly';
type SeriesFocus = 'both' | 'income' | 'expense';

interface QuarterDefinition {
  quarter: 1 | 2 | 3 | 4;
  shortTitle: string;
  rangeLabel: string;
  monthIndices: [number, number, number];
}

const QUARTER_DEFS: QuarterDefinition[] = [
  {
    quarter: 1,
    shortTitle: 'ไตรมาส 1',
    rangeLabel: 'ต.ค. – ธ.ค.',
    monthIndices: [0, 1, 2],
  },
  {
    quarter: 2,
    shortTitle: 'ไตรมาส 2',
    rangeLabel: 'ม.ค. – มี.ค.',
    monthIndices: [3, 4, 5],
  },
  {
    quarter: 3,
    shortTitle: 'ไตรมาส 3',
    rangeLabel: 'เม.ย. – มิ.ย.',
    monthIndices: [6, 7, 8],
  },
  {
    quarter: 4,
    shortTitle: 'ไตรมาส 4',
    rangeLabel: 'ก.ค. – ก.ย.',
    monthIndices: [9, 10, 11],
  },
];

interface QuarterChartDatum {
  quarter: 1 | 2 | 3 | 4;
  label: string;
  rangeLabel: string;
  firstMonthKey: string;
  monthKeys: string[];
  incomeActual: number;
  incomeTarget: number;
  expenseActual: number;
  expenseTarget: number;
  incomePct: number;
  expensePct: number;
}

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
  payload?: QuarterChartDatum;
}

function formatAxisTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

function normalizeQuarterlyBudgets(
  raw?: QuarterlyBudgetTarget[]
): QuarterlyBudgetTarget[] {
  return QUARTER_DEFS.map((def) => {
    const found = raw?.find((b) => b.quarter === def.quarter);
    const fallback = DEFAULT_QUARTERLY_BUDGETS.find(
      (b) => b.quarter === def.quarter
    )!;
    return {
      quarter: def.quarter,
      incomeTarget:
        found && typeof found.incomeTarget === 'number' && found.incomeTarget >= 0
          ? found.incomeTarget
          : fallback.incomeTarget,
      expenseTarget:
        found &&
        typeof found.expenseTarget === 'number' &&
        found.expenseTarget >= 0
          ? found.expenseTarget
          : fallback.expenseTarget,
    };
  });
}

const QuarterlyTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  mode: CalculationMode;
}> = ({ active, payload, mode }) => {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }
  const d = payload[0].payload;
  const incomeDiff = d.incomeActual - d.incomeTarget;
  const expenseRemaining = d.expenseTarget - d.expenseActual;

  return (
    <div className="min-w-[260px] rounded-lg border border-slate-200 bg-white p-3.5 text-xs shadow-lg">
      <div className="mb-2 border-b border-slate-100 pb-1.5">
        <p className="font-bold text-slate-900">
          {d.label} ({d.rangeLabel})
        </p>
        <p className="text-[11px] text-slate-500">
          {mode === 'cumulative'
            ? 'ยอดสะสมตั้งแต่ต้นปีงบประมาณ ณ สิ้นไตรมาส'
            : 'ยอดเฉพาะภายในไตรมาส (3 เดือน)'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-xs bg-emerald-300" />
              เป้ารายรับ:
            </span>
            <span className="font-mono-num text-slate-700 tabular-nums">
              {formatMoney(d.incomeTarget)} บ.
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-xs bg-emerald-600" />
              รายรับจริง:
            </span>
            <span className="font-mono-num font-bold text-emerald-700 tabular-nums">
              {formatMoney(d.incomeActual)} บ. ({d.incomePct.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-slate-500">ผลต่างเทียบเป้า:</span>
            <span
              className={`font-mono-num font-semibold tabular-nums ${
                incomeDiff >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {incomeDiff >= 0 ? '+' : ''}
              {formatMoney(incomeDiff)} บ.
            </span>
          </div>
        </div>

        <div className="space-y-0.5 border-t border-slate-100 pt-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-xs bg-rose-200" />
              เป้างบรายจ่าย:
            </span>
            <span className="font-mono-num text-slate-700 tabular-nums">
              {formatMoney(d.expenseTarget)} บ.
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-xs bg-rose-600" />
              รายจ่ายจริง:
            </span>
            <span className="font-mono-num font-bold text-rose-700 tabular-nums">
              {formatMoney(d.expenseActual)} บ. ({d.expensePct.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-slate-500">งบคงเหลือตามเป้า:</span>
            <span
              className={`font-mono-num font-semibold tabular-nums ${
                expenseRemaining >= 0 ? 'text-teal-700' : 'text-rose-700'
              }`}
            >
              {expenseRemaining >= 0 ? '' : 'เกิน '}
              {formatMoney(Math.abs(expenseRemaining))} บ.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const QuarterlyBudgetChart: React.FC<QuarterlyBudgetChartProps> = ({
  settings,
  filteredTransactions,
  selectedMonthKey,
  onSelectMonth,
  onUpdateQuarterlyBudgets,
}) => {
  const [calcMode, setCalcMode] = useState<CalculationMode>('cumulative');
  const [seriesFocus, setSeriesFocus] = useState<SeriesFocus>('both');
  const [editingTargets, setEditingTargets] = useState(false);

  const normalizedBudgets = useMemo(
    () => normalizeQuarterlyBudgets(settings.quarterlyBudgets),
    [settings.quarterlyBudgets]
  );

  const [draftTargets, setDraftTargets] =
    useState<QuarterlyBudgetTarget[]>(normalizedBudgets);

  useEffect(() => {
    setDraftTargets(normalizedBudgets);
  }, [normalizedBudgets]);

  const chartData = useMemo<QuarterChartDatum[]>(() => {
    let cumIncActual = 0;
    let cumIncTarget = 0;
    let cumExpActual = 0;
    let cumExpTarget = 0;

    return QUARTER_DEFS.map((def) => {
      const months = def.monthIndices.map((idx) => FISCAL_MONTHS[idx]);
      const monthKeys = months.map((m) => m.key);
      const qTxs = filteredTransactions.filter(
        (t) =>
          t.type !== 'transfer' && monthKeys.includes(getMonthKey(t.date))
      );

      const qIncActual = qTxs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);
      const qExpActual = qTxs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);

      const targetObj = normalizedBudgets.find(
        (b) => b.quarter === def.quarter
      )!;
      const qIncTarget = targetObj.incomeTarget;
      const qExpTarget = targetObj.expenseTarget;

      cumIncActual += qIncActual;
      cumIncTarget += qIncTarget;
      cumExpActual += qExpActual;
      cumExpTarget += qExpTarget;

      const incomeActual =
        calcMode === 'cumulative' ? cumIncActual : qIncActual;
      const incomeTarget =
        calcMode === 'cumulative' ? cumIncTarget : qIncTarget;
      const expenseActual =
        calcMode === 'cumulative' ? cumExpActual : qExpActual;
      const expenseTarget =
        calcMode === 'cumulative' ? cumExpTarget : qExpTarget;

      return {
        quarter: def.quarter,
        label: def.shortTitle,
        rangeLabel: def.rangeLabel,
        firstMonthKey: monthKeys[0],
        monthKeys,
        incomeActual,
        incomeTarget,
        expenseActual,
        expenseTarget,
        incomePct: incomeTarget > 0 ? (incomeActual / incomeTarget) * 100 : 0,
        expensePct:
          expenseTarget > 0 ? (expenseActual / expenseTarget) * 100 : 0,
      };
    });
  }, [filteredTransactions, normalizedBudgets, calcMode]);

  const activeQuarter = useMemo(() => {
    const found = chartData.find((q) => q.monthKeys.includes(selectedMonthKey));
    return found?.quarter ?? 1;
  }, [chartData, selectedMonthKey]);

  const handleUpdateDraft = (
    quarter: 1 | 2 | 3 | 4,
    field: 'incomeTarget' | 'expenseTarget',
    val: string
  ) => {
    const num = Math.max(0, Number(val) || 0);
    setDraftTargets((prev) =>
      prev.map((item) =>
        item.quarter === quarter ? { ...item, [field]: num } : item
      )
    );
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateQuarterlyBudgets(draftTargets);
    setEditingTargets(false);
  };

  const handleResetDefaultTargets = () => {
    setDraftTargets(DEFAULT_QUARTERLY_BUDGETS);
    onUpdateQuarterlyBudgets(DEFAULT_QUARTERLY_BUDGETS);
  };

  const annualTotals = chartData[chartData.length - 1];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      {/* Header & Interactive Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900">
              สรุปยอดรายรับ - รายจ่ายสะสมเทียบเป้าหมายงบประมาณรายไตรมาส (ปีงบ{' '}
              {settings.fiscalYearBE})
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {calcMode === 'cumulative'
              ? 'เปรียบเทียบยอดสะสมตั้งแต่ต้นปีงบประมาณ (ต.ค.) เทียบกับเป้าหมายงบประมาณสะสม ณ สิ้นแต่ละไตรมาส'
              : 'เปรียบเทียบยอดรับ-จ่ายจริงเฉพาะภายในแต่ละไตรมาส (3 เดือน) เทียบกับเป้างบประมาณประจำไตรมาส'}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          {/* Cumulative vs Quarterly Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setCalcMode('cumulative')}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                calcMode === 'cumulative'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ยอดสะสม (YTD)
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('quarterly')}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                calcMode === 'quarterly'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              แยกเฉพาะไตรมาส
            </button>
          </div>

          {/* Series Focus Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            {(
              [
                { id: 'both', label: 'ทั้งหมด' },
                { id: 'income', label: 'เทียบเป้ารายรับ' },
                { id: 'expense', label: 'เทียบงบรายจ่าย' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeriesFocus(opt.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  seriesFocus === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setEditingTargets((v) => !v)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Edit3 className="h-3.5 w-3.5 text-teal-700" />
            <span>ตั้งเป้าหมายงบประมาณ</span>
          </button>
        </div>
      </div>

      {/* Inline Quarterly Budget Target Editor */}
      {editingTargets && (
        <form
          onSubmit={handleSaveTargets}
          className="no-print mt-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                กำหนดเป้าหมายรายรับ และวงเงินงบประมาณรายจ่ายรายไตรมาส (บาท)
              </h3>
              <p className="text-[11px] text-slate-600">
                กรอกเป้าเฉพาะของแต่ละไตรมาส ระบบจะรวมเป็นเป้าสะสมให้อัตโนมัติเมื่อดูโหมดยอดสะสม (YTD)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaultTargets}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3 w-3" />
                <span>คืนค่าเริ่มต้น</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingTargets(false)}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3 w-3" />
                <span>ปิด</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUARTER_DEFS.map((def) => {
              const item =
                draftTargets.find((b) => b.quarter === def.quarter) ||
                DEFAULT_QUARTERLY_BUDGETS[def.quarter - 1];
              return (
                <div
                  key={def.quarter}
                  className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs"
                >
                  <p className="font-bold text-slate-900">
                    {def.shortTitle} ({def.rangeLabel})
                  </p>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-emerald-800">
                      เป้ารายรับ (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={item.incomeTarget}
                      onChange={(e) =>
                        handleUpdateDraft(
                          def.quarter,
                          'incomeTarget',
                          e.target.value
                        )
                      }
                      className="font-mono-num w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-right text-xs font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-rose-800">
                      เป้างบรายจ่าย (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={item.expenseTarget}
                      onChange={(e) =>
                        handleUpdateDraft(
                          def.quarter,
                          'expenseTarget',
                          e.target.value
                        )
                      }
                      className="font-mono-num w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-right text-xs font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Check className="h-3.5 w-3.5" />
              <span>บันทึกเป้าหมายงบประมาณ</span>
            </button>
          </div>
        </form>
      )}

      {/* Recharts BarChart */}
      <div className="mt-4 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 16, left: 6, bottom: 4 }}
            onClick={(state) => {
              const idx = state?.activeTooltipIndex;
              if (typeof idx === 'number' && chartData[idx]) {
                onSelectMonth(chartData[idx].firstMonthKey);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatAxisTick}
              tick={{ fontSize: 11, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              content={<QuarterlyTooltip mode={calcMode} />}
              cursor={{ fill: '#f8fafc' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

            {(seriesFocus === 'both' || seriesFocus === 'income') && (
              <>
                <Bar
                  dataKey="incomeTarget"
                  name={
                    calcMode === 'cumulative'
                      ? 'เป้ารายรับสะสม (บาท)'
                      : 'เป้ารายรับไตรมาส (บาท)'
                  }
                  fill="#a7f3d0"
                  stroke="#10b981"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="incomeActual"
                  name={
                    calcMode === 'cumulative'
                      ? 'รายรับจริงสะสม (บาท)'
                      : 'รายรับจริงไตรมาส (บาท)'
                  }
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </>
            )}

            {(seriesFocus === 'both' || seriesFocus === 'expense') && (
              <>
                <Bar
                  dataKey="expenseTarget"
                  name={
                    calcMode === 'cumulative'
                      ? 'เป้างบรายจ่ายสะสม (บาท)'
                      : 'เป้างบรายจ่ายไตรมาส (บาท)'
                  }
                  fill="#fecdd3"
                  stroke="#fb7185"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="expenseActual"
                  name={
                    calcMode === 'cumulative'
                      ? 'รายจ่ายจริงสะสม (บาท)'
                      : 'รายจ่ายจริงไตรมาส (บาท)'
                  }
                  fill="#e11d48"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4-Quarter Target Attainment Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {chartData.map((q) => {
          const isActiveQuarter = q.quarter === activeQuarter;
          const overExpenseBudget = q.expenseActual > q.expenseTarget;
          return (
            <button
              key={q.quarter}
              type="button"
              onClick={() => onSelectMonth(q.firstMonthKey)}
              className={`rounded-lg border p-3.5 text-left transition-colors ${
                isActiveQuarter
                  ? 'border-teal-600 bg-teal-50/40'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {q.label} · {q.rangeLabel}
                </span>
                {calcMode === 'cumulative' && q.quarter === 4 && annualTotals && (
                  <span className="text-[10px] font-semibold text-teal-700">
                    สิ้นปีงบฯ
                  </span>
                )}
              </div>

              <div className="mt-2.5 space-y-2 text-[11px]">
                <div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>รายรับเทียบเป้า</span>
                    <span className="font-mono-num font-bold text-emerald-700 tabular-nums">
                      {q.incomePct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-emerald-100">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${Math.min(100, q.incomePct)}%` }}
                    />
                  </div>
                  <p className="font-mono-num mt-0.5 text-[10px] text-slate-500 tabular-nums">
                    {formatMoney(q.incomeActual)} / {formatMoney(q.incomeTarget)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>ใช้จ่ายเทียบงบ</span>
                    <span
                      className={`font-mono-num font-bold tabular-nums ${
                        overExpenseBudget ? 'text-rose-700' : 'text-slate-800'
                      }`}
                    >
                      {q.expensePct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-rose-100">
                    <div
                      className={`h-full ${
                        overExpenseBudget ? 'bg-rose-700' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, q.expensePct)}%` }}
                    />
                  </div>
                  <p className="font-mono-num mt-0.5 text-[10px] text-slate-500 tabular-nums">
                    {formatMoney(q.expenseActual)} / {formatMoney(q.expenseTarget)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
