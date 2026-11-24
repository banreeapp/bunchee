import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { FISCAL_MONTHS } from '../data/pcuCatalog';
import { LedgerTransaction, PcuSettings } from '../types/accounting';
import {
  filterTransactionsByProjectScope,
  formatMoney,
  getMonthKey,
  getOpeningTotalAllAccounts,
  ProjectScopeFilter,
} from '../utils/accountingMath';

interface MonthlyTrendChartProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  projectScope: ProjectScopeFilter;
  onSelectMonth?: (monthKey: string) => void;
}

interface ChartDatum {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
  runningBalance: number;
}

type ChartMode = 'bar' | 'trend';

function formatAxisTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
  payload?: ChartDatum;
}

const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 border-b border-slate-100 pb-1.5 font-bold text-slate-900">
        เดือน{d.fullLabel}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-xs bg-emerald-600" />
            รายรับ:
          </span>
          <span className="font-mono-num font-semibold text-emerald-700 tabular-nums">
            {formatMoney(d.income)} บาท
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-xs bg-rose-600" />
            รายจ่าย:
          </span>
          <span className="font-mono-num font-semibold text-rose-700 tabular-nums">
            {formatMoney(d.expense)} บาท
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-1">
          <span className="text-slate-600">ดุลรับ-จ่ายเดือนนี้:</span>
          <span
            className={`font-mono-num font-semibold tabular-nums ${
              d.net >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {d.net >= 0 ? '+' : ''}
            {formatMoney(d.net)} บาท
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-xs bg-sky-700" />
            คงเหลือสะสม:
          </span>
          <span className="font-mono-num font-bold text-slate-900 tabular-nums">
            {formatMoney(d.runningBalance)} บาท
          </span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({
  settings,
  transactions,
  selectedMonthKey,
  projectScope,
  onSelectMonth,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [collapsed, setCollapsed] = useState(false);

  const openingBalance = useMemo(
    () => getOpeningTotalAllAccounts(settings),
    [settings]
  );

  const chartData = useMemo<ChartDatum[]>(() => {
    const scopedTxs = filterTransactionsByProjectScope(
      transactions.filter((t) => t.type !== 'transfer'),
      projectScope
    );

    let running = openingBalance;
    return FISCAL_MONTHS.map((m) => {
      const mTxs = scopedTxs.filter((t) => getMonthKey(t.date) === m.key);
      const income = mTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = mTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const net = income - expense;
      running += net;

      return {
        monthKey: m.key,
        shortLabel: m.shortLabel,
        fullLabel: m.label,
        income,
        expense,
        net,
        runningBalance: running,
      };
    });
  }, [transactions, projectScope, openingBalance]);

  const totals = useMemo(() => {
    const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
    const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
    const netDiff = totalIncome - totalExpense;
    const endingBalance =
      chartData.length > 0
        ? chartData[chartData.length - 1].runningBalance
        : openingBalance;
    return { totalIncome, totalExpense, netDiff, endingBalance };
  }, [chartData, openingBalance]);

  const scopeLabel =
    projectScope === 'only_project'
      ? 'เฉพาะในโครงการ'
      : projectScope === 'exclude_project'
      ? 'ไม่รวมโครงการ'
      : 'รวมทุกรายการ';

  const selectedMonthInfo = FISCAL_MONTHS.find(
    (m) => m.key === selectedMonthKey
  );

  return (
    <section className="print-sheet rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            กราฟเปรียบเทียบแนวโน้มรายรับ - รายจ่ายรายเดือน (ปีงบประมาณ{' '}
            {settings.fiscalYearBE})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ขอบเขตข้อมูล: {scopeLabel} · เดือนที่เลือกดูตาราง:{' '}
            {selectedMonthInfo?.label || selectedMonthKey} (คลิกที่แท่งกราฟเพื่อสลับเดือนได้)
          </p>
        </div>

        <div className="no-print flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                chartMode === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>กราฟแท่งเปรียบเทียบ</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('trend')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                chartMode === 'trend'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>แนวโน้ม &amp; คงเหลือสะสม</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            title={collapsed ? 'แสดงกราฟ' : 'ซ่อนกราฟ'}
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>แสดงกราฟ</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>ย่อ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Annual KPI Strip */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">
                รายรับสะสมทั้งปี ({scopeLabel})
              </p>
              <p className="font-mono-num mt-0.5 text-base font-bold text-emerald-700 tabular-nums">
                {formatMoney(totals.totalIncome)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">
                รายจ่ายสะสมทั้งปี ({scopeLabel})
              </p>
              <p className="font-mono-num mt-0.5 text-base font-bold text-rose-700 tabular-nums">
                {formatMoney(totals.totalExpense)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">
                ดุลรับ - จ่ายสุทธิทั้งปี
              </p>
              <p
                className={`font-mono-num mt-0.5 text-base font-bold tabular-nums ${
                  totals.netDiff >= 0 ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {totals.netDiff >= 0 ? '+' : ''}
                {formatMoney(totals.netDiff)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">
                เงินคงเหลือสะสม ณ สิ้นปี
              </p>
              <p className="font-mono-num mt-0.5 text-base font-bold text-slate-900 tabular-nums">
                {formatMoney(totals.endingBalance)}
              </p>
            </div>
          </div>

          {/* Recharts Visualization */}
          <div className="mt-4 h-[310px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'bar' ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                  onClick={(state) => {
                    const idx = state?.activeTooltipIndex;
                    if (
                      typeof idx === 'number' &&
                      chartData[idx] &&
                      onSelectMonth
                    ) {
                      onSelectMonth(chartData[idx].monthKey);
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAxisTick}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  />
                  <Bar
                    dataKey="income"
                    name="รายรับ (บาท)"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="expense"
                    name="รายจ่าย (บาท)"
                    fill="#e11d48"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              ) : (
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                  onClick={(state) => {
                    const idx = state?.activeTooltipIndex;
                    if (
                      typeof idx === 'number' &&
                      chartData[idx] &&
                      onSelectMonth
                    ) {
                      onSelectMonth(chartData[idx].monthKey);
                    }
                  }}
                >
                  <defs>
                    <linearGradient
                      id="incomeAreaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#059669"
                        stopOpacity={0.2}
                      />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="expenseAreaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#e11d48"
                        stopOpacity={0.18}
                      />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAxisTick}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="รายรับ (บาท)"
                    stroke="#059669"
                    strokeWidth={2}
                    fill="url(#incomeAreaGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="รายจ่าย (บาท)"
                    stroke="#e11d48"
                    strokeWidth={2}
                    fill="url(#expenseAreaGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="runningBalance"
                    name="เงินคงเหลือสะสม (บาท)"
                    stroke="#0369a1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0369a1' }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
};
