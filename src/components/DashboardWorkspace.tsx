import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileBarChart2,
  Filter,
  Landmark,
  TrendingUp,
} from 'lucide-react';
import { EXPENSE_CATEGORIES, FISCAL_MONTHS } from '../data/pcuCatalog';
import {
  LedgerTransaction,
  PaymentMethod,
  PcuSettings,
} from '../types/accounting';
import {
  computeAccountBalances,
  filterTransactionsByProjectScope,
  formatMoney,
  getCategoryLabel,
  getMonthKey,
  getOpeningTotalAllAccounts,
  ProjectScopeFilter,
} from '../utils/accountingMath';

interface DashboardWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  onChangeMonth: (monthKey: string) => void;
  onNavigate: (
    section: 'ledger' | 'reports' | 'summary' | 'sheets' | 'settings'
  ) => void;
}

interface MonthlyLineDatum {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
  runningBalance: number;
  txCount: number;
  spendRatio: number | null;
}

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
  payload?: MonthlyLineDatum;
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

const DashboardLineTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }
  const d = payload[0].payload;
  return (
    <div className="min-w-[240px] rounded-lg border border-slate-200 bg-white p-3.5 text-xs shadow-lg">
      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
        <span className="font-bold text-slate-900">เดือน{d.fullLabel}</span>
        <span className="text-[11px] text-slate-500">{d.txCount} รายการ</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-xs bg-emerald-600" />
            รายรับรวม:
          </span>
          <span className="font-mono-num font-semibold text-emerald-700 tabular-nums">
            {formatMoney(d.income)} บาท
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-xs bg-rose-600" />
            รายจ่ายรวม:
          </span>
          <span className="font-mono-num font-semibold text-rose-700 tabular-nums">
            {formatMoney(d.expense)} บาท
          </span>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-1.5">
          <span className="text-slate-600">ดุลรับ - จ่ายสุทธิ:</span>
          <span
            className={`font-mono-num font-bold tabular-nums ${
              d.net >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {d.net >= 0 ? '+' : ''}
            {formatMoney(d.net)} บาท
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-xs bg-sky-700" />
            เงินคงเหลือสะสม:
          </span>
          <span className="font-mono-num font-semibold text-slate-900 tabular-nums">
            {formatMoney(d.runningBalance)} บาท
          </span>
        </div>
        {d.spendRatio !== null && (
          <div className="flex items-center justify-between gap-5 text-[11px] text-slate-500">
            <span>สัดส่วนใช้จ่ายต่อรายรับ:</span>
            <span className="font-mono-num font-semibold tabular-nums">
              {d.spendRatio.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
        คลิกที่จุดเดือนบนกราฟเพื่อดูรายละเอียดหมวดหมู่ด้านล่าง
      </p>
    </div>
  );
};

export const DashboardWorkspace: React.FC<DashboardWorkspaceProps> = ({
  settings,
  transactions,
  selectedMonthKey,
  onChangeMonth,
  onNavigate,
}) => {
  const [projectScope, setProjectScope] = useState<ProjectScopeFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>(
    'all'
  );
  const [bankFilter, setBankFilter] = useState<string>('all');

  // Interactive Line Series Toggles
  const [showIncomeLine, setShowIncomeLine] = useState(true);
  const [showExpenseLine, setShowExpenseLine] = useState(true);
  const [showNetLine, setShowNetLine] = useState(false);
  const [showBalanceLine, setShowBalanceLine] = useState(false);
  const [showAvgExpenseRef, setShowAvgExpenseRef] = useState(true);

  // Filtered non-transfer transactions for trend & category analytics
  const filteredTxs = useMemo(() => {
    const nonTransfer = transactions.filter((t) => t.type !== 'transfer');
    const byScope = filterTransactionsByProjectScope(nonTransfer, projectScope);
    return byScope.filter((t) => {
      if (paymentFilter !== 'all' && t.paymentMethod !== paymentFilter) {
        return false;
      }
      if (bankFilter !== 'all' && t.bankAccountId !== bankFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, projectScope, paymentFilter, bankFilter]);

  const openingBase = useMemo(() => {
    if (bankFilter === 'all') {
      return getOpeningTotalAllAccounts(settings);
    }
    const found = settings.bankAccounts.find((b) => b.id === bankFilter);
    if (!found) return 0;
    return (
      found.openingBank +
      found.openingCash +
      found.openingLoan +
      found.openingAdvance +
      found.openingCheque
    );
  }, [settings, bankFilter]);

  const monthlySeries = useMemo<MonthlyLineDatum[]>(() => {
    let running = openingBase;
    return FISCAL_MONTHS.map((m) => {
      const mTxs = filteredTxs.filter((t) => getMonthKey(t.date) === m.key);
      const income = mTxs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);
      const expense = mTxs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
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
        txCount: mTxs.length,
        spendRatio: income > 0 ? (expense / income) * 100 : null,
      };
    });
  }, [filteredTxs, openingBase]);

  const annualSummary = useMemo(() => {
    const totalIncome = monthlySeries.reduce((s, d) => s + d.income, 0);
    const totalExpense = monthlySeries.reduce((s, d) => s + d.expense, 0);
    const netDiff = totalIncome - totalExpense;
    const activeMonthsExpense = monthlySeries.filter((d) => d.expense > 0);
    const activeMonthsIncome = monthlySeries.filter((d) => d.income > 0);
    const avgMonthlyExpense =
      activeMonthsExpense.length > 0
        ? totalExpense / activeMonthsExpense.length
        : 0;
    const avgMonthlyIncome =
      activeMonthsIncome.length > 0
        ? totalIncome / activeMonthsIncome.length
        : 0;

    const peakExpenseMonth = monthlySeries.reduce<MonthlyLineDatum | null>(
      (best, curr) => (!best || curr.expense > best.expense ? curr : best),
      null
    );
    const peakIncomeMonth = monthlySeries.reduce<MonthlyLineDatum | null>(
      (best, curr) => (!best || curr.income > best.income ? curr : best),
      null
    );

    const spendRate =
      totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      netDiff,
      avgMonthlyExpense,
      avgMonthlyIncome,
      peakExpenseMonth,
      peakIncomeMonth,
      spendRate,
    };
  }, [monthlySeries]);

  const accountBalances = useMemo(
    () => computeAccountBalances(settings, transactions),
    [settings, transactions]
  );

  const liveCashAndBankTotal = useMemo(
    () =>
      accountBalances.reduce(
        (acc, s) => ({
          bank: acc.bank + s.bankBalance,
          cash: acc.cash + s.cashInHand,
          total: acc.total + s.totalBalance,
        }),
        { bank: 0, cash: 0, total: 0 }
      ),
    [accountBalances]
  );

  const selectedMonthIdx = Math.max(
    0,
    FISCAL_MONTHS.findIndex((m) => m.key === selectedMonthKey)
  );
  const selectedMonthInfo = FISCAL_MONTHS[selectedMonthIdx];
  const selectedMonthStats =
    monthlySeries[selectedMonthIdx] || monthlySeries[0];

  const selectedMonthTopExpenses = useMemo(() => {
    const map = new Map<string, { code: string; label: string; amount: number; count: number }>();
    filteredTxs
      .filter(
        (t) =>
          t.type === 'expense' && getMonthKey(t.date) === selectedMonthKey
      )
      .forEach((t) => {
        const cat = EXPENSE_CATEGORIES.find((c) => c.code === t.categoryCode);
        const label = cat?.name || getCategoryLabel('expense', t.categoryCode, t.subCategoryCode);
        const curr = map.get(t.categoryCode) || {
          code: t.categoryCode,
          label,
          amount: 0,
          count: 0,
        };
        curr.amount += t.amount;
        curr.count += 1;
        map.set(t.categoryCode, curr);
      });
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTxs, selectedMonthKey]);

  const annualTopExpenses = useMemo(() => {
    const map = new Map<string, { code: string; label: string; amount: number; count: number }>();
    filteredTxs
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = EXPENSE_CATEGORIES.find((c) => c.code === t.categoryCode);
        const label = cat?.name || getCategoryLabel('expense', t.categoryCode, t.subCategoryCode);
        const curr = map.get(t.categoryCode) || {
          code: t.categoryCode,
          label,
          amount: 0,
          count: 0,
        };
        curr.amount += t.amount;
        curr.count += 1;
        map.set(t.categoryCode, curr);
      });
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [filteredTxs]);

  const stepMonth = (delta: -1 | 1) => {
    const nextIdx = selectedMonthIdx + delta;
    if (nextIdx >= 0 && nextIdx < FISCAL_MONTHS.length) {
      onChangeMonth(FISCAL_MONTHS[nextIdx].key);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Interactive Filter Bar */}
      <section className="no-print rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Filter className="h-3.5 w-3.5 text-teal-700" />
              <span>ตัวกรองภาพรวมปีงบประมาณ {settings.fiscalYearBE}:</span>
            </div>

            {/* Project Scope Segmented Control */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              {(
                [
                  { id: 'all', label: 'รวมทุกรายการ' },
                  { id: 'exclude_project', label: 'ไม่รวมโครงการ' },
                  { id: 'only_project', label: 'เฉพาะโครงการ/402/404' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProjectScope(opt.id)}
                  className={`whitespace-nowrap rounded-md px-3 py-1 font-medium transition-colors ${
                    projectScope === opt.id
                      ? 'bg-white font-semibold text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value as 'all' | PaymentMethod)
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              <option value="all">ทุกช่องทางเงิน</option>
              <option value="bank">เงินโอน / e-Pay</option>
              <option value="cash">เงินสด</option>
              <option value="cheque">เช็ค</option>
            </select>

            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              <option value="all">รวมทุกบัญชีธนาคาร</option>
              {settings.bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  ธ.{b.order} {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>บันทึกรายวัน</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileBarChart2 className="h-3.5 w-3.5" />
              <span>รายงานการเงิน</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Annual Executive KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              รายรับรวมปีงบ {settings.fiscalYearBE}
            </p>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="font-mono-num mt-1.5 text-2xl font-bold text-emerald-700 tabular-nums">
            {formatMoney(annualSummary.totalIncome)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            เฉลี่ยเดือนที่มีรับ{' '}
            <span className="font-mono-num font-semibold text-slate-700 tabular-nums">
              {formatMoney(annualSummary.avgMonthlyIncome)}
            </span>{' '}
            บ.
            {annualSummary.peakIncomeMonth &&
              annualSummary.peakIncomeMonth.income > 0 && (
                <> · สูงสุด {annualSummary.peakIncomeMonth.shortLabel}</>
              )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              รายจ่ายรวมปีงบ {settings.fiscalYearBE}
            </p>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <p className="font-mono-num mt-1.5 text-2xl font-bold text-rose-700 tabular-nums">
            {formatMoney(annualSummary.totalExpense)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            เฉลี่ยเดือนที่มีจ่าย{' '}
            <span className="font-mono-num font-semibold text-slate-700 tabular-nums">
              {formatMoney(annualSummary.avgMonthlyExpense)}
            </span>{' '}
            บ.
            {annualSummary.peakExpenseMonth &&
              annualSummary.peakExpenseMonth.expense > 0 && (
                <> · สูงสุด {annualSummary.peakExpenseMonth.shortLabel}</>
              )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              ดุลรับ - จ่ายสุทธิทั้งปี
            </p>
            <TrendingUp
              className={`h-4 w-4 ${
                annualSummary.netDiff >= 0 ? 'text-teal-700' : 'text-rose-600'
              }`}
            />
          </div>
          <p
            className={`font-mono-num mt-1.5 text-2xl font-bold tabular-nums ${
              annualSummary.netDiff >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {annualSummary.netDiff >= 0 ? '+' : ''}
            {formatMoney(annualSummary.netDiff)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            สัดส่วนรายจ่ายต่อรายรับ{' '}
            <span className="font-mono-num font-semibold text-slate-700 tabular-nums">
              {annualSummary.spendRate.toFixed(1)}%
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              ยอดเงินคงเหลือปัจจุบัน (ทุกบัญชี)
            </p>
            <Landmark className="h-4 w-4 text-sky-700" />
          </div>
          <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(liveCashAndBankTotal.total)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            ธนาคาร{' '}
            <span className="font-mono-num font-semibold text-slate-700 tabular-nums">
              {formatMoney(liveCashAndBankTotal.bank)}
            </span>{' '}
            · เงินสด{' '}
            <span className="font-mono-num font-semibold text-slate-700 tabular-nums">
              {formatMoney(liveCashAndBankTotal.cash)}
            </span>
          </p>
        </div>
      </section>

      {/* Main Recharts Interactive LineChart Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              แนวโน้มเปรียบเทียบรายรับ - รายจ่ายรายเดือน (ปีงบประมาณ{' '}
              {settings.fiscalYearBE})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              คลิกที่จุดข้อมูลแต่ละเดือนบนกราฟเส้น หรือเลือก/ซ่อนเส้นข้อมูลด้านขวาเพื่อวิเคราะห์แนวโน้มการใช้จ่าย
            </p>
          </div>

          {/* Interactive Series Toggles */}
          <div className="no-print flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowIncomeLine((v) => !v)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
                showIncomeLine
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
              <span>รายรับ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExpenseLine((v) => !v)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
                showExpenseLine
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-rose-600" />
              <span>รายจ่าย</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNetLine((v) => !v)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
                showNetLine
                  ? 'border-teal-300 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-teal-600" />
              <span>ดุลสุทธิ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBalanceLine((v) => !v)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
                showBalanceLine
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-700" />
              <span>คงเหลือสะสม</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAvgExpenseRef((v) => !v)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${
                showAvgExpenseRef
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>เส้นค่าเฉลี่ยรายจ่าย</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlySeries}
              margin={{ top: 14, right: 20, left: 6, bottom: 6 }}
              onClick={(state) => {
                const idx = state?.activeTooltipIndex;
                if (typeof idx === 'number' && monthlySeries[idx]) {
                  onChangeMonth(monthlySeries[idx].monthKey);
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
                tick={{ fontSize: 12, fill: '#475569' }}
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
              <Tooltip content={<DashboardLineTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

              {selectedMonthInfo && (
                <ReferenceLine
                  x={selectedMonthInfo.shortLabel}
                  stroke="#0f766e"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}

              {showAvgExpenseRef && annualSummary.avgMonthlyExpense > 0 && (
                <ReferenceLine
                  y={annualSummary.avgMonthlyExpense}
                  stroke="#d97706"
                  strokeDasharray="5 5"
                  label={{
                    value: `เฉลี่ยจ่าย ${formatAxisTick(
                      annualSummary.avgMonthlyExpense
                    )}`,
                    position: 'insideTopRight',
                    fill: '#b45309',
                    fontSize: 11,
                  }}
                />
              )}

              {showIncomeLine && (
                <Line
                  type="monotone"
                  dataKey="income"
                  name="รายรับรวม (บาท)"
                  stroke="#059669"
                  strokeWidth={2.75}
                  dot={{ r: 4, fill: '#059669', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              )}

              {showExpenseLine && (
                <Line
                  type="monotone"
                  dataKey="expense"
                  name="รายจ่ายรวม (บาท)"
                  stroke="#e11d48"
                  strokeWidth={2.75}
                  dot={{ r: 4, fill: '#e11d48', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              )}

              {showNetLine && (
                <Line
                  type="monotone"
                  dataKey="net"
                  name="ดุลรับ - จ่ายสุทธิ (บาท)"
                  stroke="#0d9488"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: '#0d9488' }}
                  activeDot={{ r: 5 }}
                />
              )}

              {showBalanceLine && (
                <Line
                  type="monotone"
                  dataKey="runningBalance"
                  name="เงินคงเหลือสะสม (บาท)"
                  stroke="#0369a1"
                  strokeWidth={2.25}
                  dot={{ r: 3, fill: '#0369a1' }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 12-Month Quick Selector Strip */}
        <div className="no-print mt-4 grid grid-cols-4 gap-1.5 border-t border-slate-100 pt-3 sm:grid-cols-6 lg:grid-cols-12">
          {monthlySeries.map((m) => {
            const isSelected = m.monthKey === selectedMonthKey;
            return (
              <button
                key={m.monthKey}
                type="button"
                onClick={() => onChangeMonth(m.monthKey)}
                className={`rounded-lg border px-2 py-1.5 text-center text-[11px] transition-colors ${
                  isSelected
                    ? 'border-teal-700 bg-teal-700 font-semibold text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                <div>{m.shortLabel}</div>
                <div
                  className={`font-mono-num text-[10px] tabular-nums ${
                    isSelected ? 'text-teal-100' : 'text-slate-500'
                  }`}
                >
                  {m.txCount} รายการ
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Interactive Drill-Down Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Selected Month Inspector */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-700" />
              <h3 className="text-sm font-bold text-slate-900">
                เจาะลึกรายละเอียดเดือน{selectedMonthInfo.label}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={selectedMonthIdx === 0}
                onClick={() => stepMonth(-1)}
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={selectedMonthKey}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                {FISCAL_MONTHS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selectedMonthIdx === FISCAL_MONTHS.length - 1}
                onClick={() => stepMonth(1)}
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="เดือนถัดไป"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-[11px] font-medium text-emerald-800">รายรับเดือนนี้</p>
              <p className="font-mono-num mt-0.5 text-sm font-bold text-emerald-700 tabular-nums">
                {formatMoney(selectedMonthStats.income)}
              </p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[11px] font-medium text-rose-800">รายจ่ายเดือนนี้</p>
              <p className="font-mono-num mt-0.5 text-sm font-bold text-rose-700 tabular-nums">
                {formatMoney(selectedMonthStats.expense)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-medium text-slate-600">ดุลสุทธิเดือนนี้</p>
              <p
                className={`font-mono-num mt-0.5 text-sm font-bold tabular-nums ${
                  selectedMonthStats.net >= 0
                    ? 'text-teal-700'
                    : 'text-rose-700'
                }`}
              >
                {selectedMonthStats.net >= 0 ? '+' : ''}
                {formatMoney(selectedMonthStats.net)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-800">
              หมวดรายจ่ายสูงสุดในเดือน{selectedMonthInfo.label}
            </p>
            {selectedMonthTopExpenses.length === 0 ? (
              <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
                ไม่มีรายการรายจ่ายในเดือน{selectedMonthInfo.label} ตามตัวกรองที่เลือก
              </p>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                {selectedMonthTopExpenses.map((item) => {
                  const pct =
                    selectedMonthStats.expense > 0
                      ? (item.amount / selectedMonthStats.expense) * 100
                      : 0;
                  return (
                    <div key={item.code} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-700">
                          {item.label} ({item.count})
                        </span>
                        <span className="font-mono-num shrink-0 font-semibold text-slate-900 tabular-nums">
                          {formatMoney(item.amount)} บ. ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-slate-100">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Annual Expense Structure */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              โครงสร้างรายจ่ายสะสมสูงสุดตลอดปีงบ {settings.fiscalYearBE}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('summary')}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              ดูตารางสรุปทั้งหมด
            </button>
          </div>

          {annualTopExpenses.length === 0 ? (
            <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
              ยังไม่มีข้อมูลรายจ่ายในปีงบประมาณนี้ตามตัวกรองที่เลือก
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {annualTopExpenses.map((item) => {
                const pct =
                  annualSummary.totalExpense > 0
                    ? (item.amount / annualSummary.totalExpense) * 100
                    : 0;
                return (
                  <div key={item.code} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-800">
                        {item.label} ({item.count} รายการ)
                      </span>
                      <span className="font-mono-num shrink-0 font-semibold text-slate-900 tabular-nums">
                        {formatMoney(item.amount)} บ. ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-xs bg-slate-100">
                      <div
                        className="h-full bg-teal-600"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Account Balance Quick Snapshot */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold text-slate-700">
              ยอดเงินคงเหลือแยกบัญชีธนาคาร ณ ปัจจุบัน
            </p>
            <div className="space-y-1.5">
              {accountBalances.map((snap) => (
                <div
                  key={snap.account.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="truncate font-medium text-slate-700">
                    ธ.{snap.account.order} {snap.account.name}
                  </span>
                  <span className="font-mono-num shrink-0 font-bold text-slate-900 tabular-nums">
                    {formatMoney(snap.totalBalance)} บ.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 12-Month Comparative Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              ตารางเปรียบเทียบรายรับ - รายจ่ายรายเดือนตลอดปีงบประมาณ{' '}
              {settings.fiscalYearBE}
            </h3>
            <p className="text-xs text-slate-500">
              คลิกที่แถวเดือนใดก็ได้เพื่อเลือกดูรายละเอียดของเดือนนั้น
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-2.5 font-semibold">เดือน</th>
                <th className="px-4 py-2.5 text-right font-semibold">จำนวนรายการ</th>
                <th className="px-4 py-2.5 text-right font-semibold">รายรับ (บาท)</th>
                <th className="px-4 py-2.5 text-right font-semibold">รายจ่าย (บาท)</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  ดุลรับ - จ่ายสุทธิ
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  จ่าย / รับ (%)
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  เงินคงเหลือสะสม
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlySeries.map((row) => {
                const isSelected = row.monthKey === selectedMonthKey;
                return (
                  <tr
                    key={row.monthKey}
                    onClick={() => onChangeMonth(row.monthKey)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-50/80 font-semibold'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-2.5 text-slate-900">
                      {row.fullLabel}
                    </td>
                    <td className="font-mono-num px-4 py-2.5 text-right text-slate-600 tabular-nums">
                      {row.txCount}
                    </td>
                    <td className="font-mono-num px-4 py-2.5 text-right text-emerald-700 tabular-nums">
                      {formatMoney(row.income)}
                    </td>
                    <td className="font-mono-num px-4 py-2.5 text-right text-rose-700 tabular-nums">
                      {formatMoney(row.expense)}
                    </td>
                    <td
                      className={`font-mono-num px-4 py-2.5 text-right tabular-nums ${
                        row.net >= 0 ? 'text-teal-700' : 'text-rose-700'
                      }`}
                    >
                      {row.net >= 0 ? '+' : ''}
                      {formatMoney(row.net)}
                    </td>
                    <td className="font-mono-num px-4 py-2.5 text-right text-slate-600 tabular-nums">
                      {row.spendRatio !== null
                        ? `${row.spendRatio.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="font-mono-num px-4 py-2.5 text-right text-slate-900 tabular-nums">
                      {formatMoney(row.runningBalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-2.5">รวมทั้งปีงบประมาณ</td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {filteredTxs.length}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right text-emerald-700 tabular-nums">
                  {formatMoney(annualSummary.totalIncome)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right text-rose-700 tabular-nums">
                  {formatMoney(annualSummary.totalExpense)}
                </td>
                <td
                  className={`font-mono-num px-4 py-2.5 text-right tabular-nums ${
                    annualSummary.netDiff >= 0
                      ? 'text-teal-700'
                      : 'text-rose-700'
                  }`}
                >
                  {annualSummary.netDiff >= 0 ? '+' : ''}
                  {formatMoney(annualSummary.netDiff)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {annualSummary.spendRate.toFixed(1)}%
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(
                    monthlySeries[monthlySeries.length - 1]?.runningBalance ??
                      openingBase
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};
