import React, { useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ArrowUpRight, Layers, PieChart as PieChartIcon } from 'lucide-react';
import { EXPENSE_CATEGORIES, FISCAL_MONTHS } from '../data/pcuCatalog';
import { LedgerTransaction, PcuSettings } from '../types/accounting';
import {
  formatMoney,
  formatThaiDateShort,
  getCategoryLabel,
  getMonthKey,
} from '../utils/accountingMath';

interface ExpenseBreakdownPieChartProps {
  settings: PcuSettings;
  filteredTransactions: LedgerTransaction[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  onNavigate: (section: 'ledger' | 'summary' | 'reports') => void;
}

type PeriodScope = 'annual' | 'quarter' | 'month';
type GroupingGranularity = 'major' | 'detailed';

interface ExpenseBucket {
  key: string;
  label: string;
  majorLabel: string;
  amount: number;
  count: number;
  pct: number;
  avgAmount: number;
  color: string;
  isOtherGroup?: boolean;
  transactions: LedgerTransaction[];
}

interface PieSliceDatum {
  key: string;
  label: string;
  majorLabel: string;
  value: number;
  count: number;
  pct: number;
  color: string;
  isOtherGroup?: boolean;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: PieSliceDatum;
  }>;
}

const SLICE_PALETTE = [
  '#0f766e', // deep clinical teal
  '#e11d48', // rose crimson
  '#0284c7', // sky blue
  '#d97706', // amber gold
  '#4f46e5', // indigo
  '#059669', // emerald
  '#9333ea', // violet
  '#64748b', // muted slate for others / tail
];

const PAYMENT_METHOD_THAI: Record<LedgerTransaction['paymentMethod'], string> = {
  bank: 'เงินโอน / e-Pay',
  cheque: 'เช็ค',
  cash: 'เงินสด',
};

function getQuarterForMonthKey(monthKey: string): {
  quarter: 1 | 2 | 3 | 4;
  label: string;
  monthKeys: string[];
} {
  const idx = Math.max(
    0,
    FISCAL_MONTHS.findIndex((m) => m.key === monthKey)
  );
  const qIdx = Math.floor(idx / 3);
  const quarter = (qIdx + 1) as 1 | 2 | 3 | 4;
  const qMonths = FISCAL_MONTHS.slice(qIdx * 3, qIdx * 3 + 3);
  const ranges = [
    'ต.ค. – ธ.ค.',
    'ม.ค. – มี.ค.',
    'เม.ย. – มิ.ย.',
    'ก.ค. – ก.ย.',
  ];
  return {
    quarter,
    label: `ไตรมาส ${quarter} (${ranges[qIdx]})`,
    monthKeys: qMonths.map((m) => m.key),
  };
}

function getBucketKeyAndLabel(
  tx: LedgerTransaction,
  granularity: GroupingGranularity
): { key: string; label: string; majorLabel: string } {
  const majorCat = EXPENSE_CATEGORIES.find((c) => c.code === tx.categoryCode);
  const majorLabel = majorCat?.shortLabel || majorCat?.name || tx.categoryCode || 'อื่น ๆ';

  if (granularity === 'major') {
    return {
      key: tx.categoryCode || 'EXP_14',
      label: majorCat ? `${majorCat.number}. ${majorCat.shortLabel}` : majorLabel,
      majorLabel,
    };
  }

  if (tx.subCategoryCode && majorCat) {
    const sub = majorCat.subItems.find((s) => s.code === tx.subCategoryCode);
    if (sub) {
      return {
        key: `${tx.categoryCode}::${tx.subCategoryCode}`,
        label: sub.name,
        majorLabel,
      };
    }
  }

  return {
    key: tx.categoryCode || 'EXP_14',
    label: majorCat
      ? majorCat.name.replace(/^\d+\.\s*/, '')
      : getCategoryLabel('expense', tx.categoryCode, tx.subCategoryCode),
    majorLabel,
  };
}

const PieCustomTooltip: React.FC<PieTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }
  const d = payload[0].payload;
  return (
    <div className="min-w-[220px] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-xs"
          style={{ backgroundColor: d.color }}
        />
        <span className="font-bold text-slate-900">{d.label}</span>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">ยอดจ่ายรวม:</span>
          <span className="font-mono-num font-bold text-slate-900 tabular-nums">
            {formatMoney(d.value)} บ.
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">สัดส่วนของรายจ่าย:</span>
          <span className="font-mono-num font-bold text-teal-700 tabular-nums">
            {d.pct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500">
          <span>จำนวนรายการ:</span>
          <span className="font-mono-num tabular-nums">{d.count} รายการ</span>
        </div>
      </div>
    </div>
  );
};

export const ExpenseBreakdownPieChart: React.FC<
  ExpenseBreakdownPieChartProps
> = ({
  settings,
  filteredTransactions,
  selectedMonthKey,
  onSelectMonth,
  onNavigate,
}) => {
  const [periodScope, setPeriodScope] = useState<PeriodScope>('annual');
  const [granularity, setGranularity] =
    useState<GroupingGranularity>('detailed');
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  const selectedMonthInfo = useMemo(
    () =>
      FISCAL_MONTHS.find((m) => m.key === selectedMonthKey) || FISCAL_MONTHS[0],
    [selectedMonthKey]
  );

  const activeQuarterInfo = useMemo(
    () => getQuarterForMonthKey(selectedMonthKey),
    [selectedMonthKey]
  );

  const scopedExpenses = useMemo(() => {
    const allExp = filteredTransactions.filter((t) => t.type === 'expense');
    if (periodScope === 'month') {
      return allExp.filter((t) => getMonthKey(t.date) === selectedMonthKey);
    }
    if (periodScope === 'quarter') {
      return allExp.filter((t) =>
        activeQuarterInfo.monthKeys.includes(getMonthKey(t.date))
      );
    }
    return allExp;
  }, [filteredTransactions, periodScope, selectedMonthKey, activeQuarterInfo]);

  const totalExpense = useMemo(
    () => scopedExpenses.reduce((s, t) => s + t.amount, 0),
    [scopedExpenses]
  );

  const buckets = useMemo<ExpenseBucket[]>(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        majorLabel: string;
        amount: number;
        transactions: LedgerTransaction[];
      }
    >();

    for (const tx of scopedExpenses) {
      const info = getBucketKeyAndLabel(tx, granularity);
      const existing = map.get(info.key);
      if (existing) {
        existing.amount += tx.amount;
        existing.transactions.push(tx);
      } else {
        map.set(info.key, {
          key: info.key,
          label: info.label,
          majorLabel: info.majorLabel,
          amount: tx.amount,
          transactions: [tx],
        });
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    return sorted.map((item, idx) => {
      const sortedTxs = [...item.transactions].sort(
        (a, b) => b.amount - a.amount
      );
      return {
        key: item.key,
        label: item.label,
        majorLabel: item.majorLabel,
        amount: item.amount,
        count: item.transactions.length,
        pct: totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0,
        avgAmount:
          item.transactions.length > 0
            ? item.amount / item.transactions.length
            : 0,
        color:
          idx < SLICE_PALETTE.length - 1
            ? SLICE_PALETTE[idx]
            : SLICE_PALETTE[SLICE_PALETTE.length - 1],
        transactions: sortedTxs,
      };
    });
  }, [scopedExpenses, granularity, totalExpense]);

  // Keep Pie Chart readable: top 7 categories + aggregated "หมวดอื่น ๆ" if > 8 categories
  const pieData = useMemo<PieSliceDatum[]>(() => {
    if (buckets.length <= 8) {
      return buckets.map((b) => ({
        key: b.key,
        label: b.label,
        majorLabel: b.majorLabel,
        value: b.amount,
        count: b.count,
        pct: b.pct,
        color: b.color,
      }));
    }

    const topSeven = buckets.slice(0, 7).map((b) => ({
      key: b.key,
      label: b.label,
      majorLabel: b.majorLabel,
      value: b.amount,
      count: b.count,
      pct: b.pct,
      color: b.color,
    }));

    const rest = buckets.slice(7);
    const restAmount = rest.reduce((s, b) => s + b.amount, 0);
    const restCount = rest.reduce((s, b) => s + b.count, 0);

    return [
      ...topSeven,
      {
        key: '__others__',
        label: `หมวดอื่น ๆ (${rest.length} หมวด)`,
        majorLabel: 'อื่น ๆ',
        value: restAmount,
        count: restCount,
        pct: totalExpense > 0 ? (restAmount / totalExpense) * 100 : 0,
        color: SLICE_PALETTE[SLICE_PALETTE.length - 1],
        isOtherGroup: true,
      },
    ];
  }, [buckets, totalExpense]);

  const activeBucket = useMemo<ExpenseBucket | null>(() => {
    if (buckets.length === 0) return null;
    if (pinnedKey && pinnedKey !== '__others__') {
      const found = buckets.find((b) => b.key === pinnedKey);
      if (found) return found;
    }
    if (pinnedKey === '__others__' && buckets.length > 7) {
      const rest = buckets.slice(7);
      const restTxs = rest
        .flatMap((b) => b.transactions)
        .sort((a, b) => b.amount - a.amount);
      const restAmount = rest.reduce((s, b) => s + b.amount, 0);
      return {
        key: '__others__',
        label: `หมวดอื่น ๆ (${rest.length} หมวด)`,
        majorLabel: 'รวมหมวดย่อยลำดับรอง',
        amount: restAmount,
        count: restTxs.length,
        pct: totalExpense > 0 ? (restAmount / totalExpense) * 100 : 0,
        avgAmount: restTxs.length > 0 ? restAmount / restTxs.length : 0,
        color: SLICE_PALETTE[SLICE_PALETTE.length - 1],
        isOtherGroup: true,
        transactions: restTxs,
      };
    }
    return buckets[0];
  }, [buckets, pinnedKey, totalExpense]);

  const deepInsights = useMemo(() => {
    const top1 = buckets[0] || null;
    const top3 = buckets.slice(0, 3);
    const top3Amount = top3.reduce((s, b) => s + b.amount, 0);
    const top3Pct = totalExpense > 0 ? (top3Amount / totalExpense) * 100 : 0;

    const largestTx =
      scopedExpenses.length > 0
        ? scopedExpenses.reduce((max, tx) =>
            tx.amount > max.amount ? tx : max
          )
        : null;
    const avgPerTx =
      scopedExpenses.length > 0 ? totalExpense / scopedExpenses.length : 0;

    return {
      top1,
      top3Amount,
      top3Pct,
      largestTx,
      avgPerTx,
    };
  }, [buckets, scopedExpenses, totalExpense]);

  const activePaymentBreakdown = useMemo(() => {
    if (!activeBucket) return [];
    const totals: Record<LedgerTransaction['paymentMethod'], number> = {
      bank: 0,
      cheque: 0,
      cash: 0,
    };
    for (const tx of activeBucket.transactions) {
      totals[tx.paymentMethod] += tx.amount;
    }
    return (['bank', 'cheque', 'cash'] as const)
      .filter((method) => totals[method] > 0)
      .map((method) => ({
        method,
        label: PAYMENT_METHOD_THAI[method],
        amount: totals[method],
        pct:
          activeBucket.amount > 0
            ? (totals[method] / activeBucket.amount) * 100
            : 0,
      }));
  }, [activeBucket]);

  const periodDescription =
    periodScope === 'annual'
      ? `ตลอดปีงบประมาณ ${settings.fiscalYearBE}`
      : periodScope === 'quarter'
      ? activeQuarterInfo.label
      : `เดือน${selectedMonthInfo.label}`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900">
              วิเคราะห์สัดส่วนการใช้จ่ายเงินบำรุงแยกตามหมวดหมู่ ({periodDescription})
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            คลิกที่ชิ้นส่วนบนกราฟวงกลมหรือรายการด้านขวาเพื่อเจาะลึกใบสำคัญจ่ายและสัดส่วนการใช้เงินบำรุงแต่ละหมวด
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          {/* Period Scope Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setPeriodScope('annual');
                setPinnedKey(null);
              }}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                periodScope === 'annual'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งปีงบฯ
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodScope('quarter');
                setPinnedKey(null);
              }}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                periodScope === 'quarter'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ไตรมาส {activeQuarterInfo.quarter}
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodScope('month');
                setPinnedKey(null);
              }}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                periodScope === 'month'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {selectedMonthInfo.shortLabel}
            </button>
          </div>

          {/* Granularity Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setGranularity('detailed');
                setPinnedKey(null);
              }}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                granularity === 'detailed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เจาะลึกหมวดย่อย
            </button>
            <button
              type="button"
              onClick={() => {
                setGranularity('major');
                setPinnedKey(null);
              }}
              className={`whitespace-nowrap rounded-md px-3 py-1 font-semibold transition-colors ${
                granularity === 'major'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              หมวดหลัก 14 หมวด
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('summary')}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <span>ดูสรุปรายหมวด</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {scopedExpenses.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            ไม่พบรายการรายจ่ายในช่วง{periodDescription}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ลองเปลี่ยนช่วงเวลาเป็น “ทั้งปีงบฯ” หรือปรับตัวกรองบัญชี/โครงการด้านบน
          </p>
        </div>
      ) : (
        <>
          {/* Deep-Dive Analytical KPI Strip */}
          <div className="mt-4 grid grid-cols-1 gap-3 border-y border-slate-100 py-3.5 md:grid-cols-3">
            <div className="px-1">
              <p className="text-[11px] font-medium text-slate-500">
                หมวดที่ใช้งบสูงสุดอันดับ 1
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                {deepInsights.top1?.label || '-'}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                <span className="font-mono-num font-bold text-teal-700 tabular-nums">
                  {deepInsights.top1?.pct.toFixed(1)}%
                </span>{' '}
                ของรายจ่ายทั้งหมด ·{' '}
                <span className="font-mono-num font-semibold text-slate-800 tabular-nums">
                  {formatMoney(deepInsights.top1?.amount || 0)} บ.
                </span>
              </p>
            </div>

            <div className="border-t border-slate-100 pt-2.5 md:border-t-0 md:border-l md:pt-0 md:pl-4">
              <p className="text-[11px] font-medium text-slate-500">
                ความกระจุกตัวรายจ่าย (3 อันดับแรก)
              </p>
              <p className="font-mono-num mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
                {deepInsights.top3Pct.toFixed(1)}% ของยอดจ่ายรวม
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                รวม 3 หมวดหลัก{' '}
                <span className="font-mono-num font-semibold text-slate-800 tabular-nums">
                  {formatMoney(deepInsights.top3Amount)} บ.
                </span>{' '}
                · จากทั้งหมด {buckets.length} หมวด
              </p>
            </div>

            <div className="border-t border-slate-100 pt-2.5 md:border-t-0 md:border-l md:pt-0 md:pl-4">
              <p className="text-[11px] font-medium text-slate-500">
                ยอดจ่ายสูงสุดต่อใบสำคัญ / เฉลี่ยต่อรายการ
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                {deepInsights.largestTx?.description || '-'}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                สูงสุด{' '}
                <span className="font-mono-num font-semibold text-rose-700 tabular-nums">
                  {formatMoney(deepInsights.largestTx?.amount || 0)} บ.
                </span>{' '}
                · เฉลี่ย{' '}
                <span className="font-mono-num font-semibold text-slate-800 tabular-nums">
                  {formatMoney(deepInsights.avgPerTx)} บ./ครั้ง
                </span>
              </p>
            </div>
          </div>

          {/* Main 2-Column Pie Chart + Interactive Category Inspector */}
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Recharts Donut / Pie Chart */}
            <div className="flex flex-col justify-between lg:col-span-5">
              <div className="relative h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="56%"
                      outerRadius="86%"
                      paddingAngle={2}
                      onClick={(_, idx) => {
                        const clicked = pieData[idx];
                        if (!clicked) return;
                        setPinnedKey((prev) =>
                          prev === clicked.key ? null : clicked.key
                        );
                      }}
                    >
                      {pieData.map((entry) => {
                        const isSelected = activeBucket?.key === entry.key;
                        return (
                          <Cell
                            key={entry.key}
                            fill={entry.color}
                            stroke="#ffffff"
                            strokeWidth={isSelected ? 3 : 1.5}
                            fillOpacity={
                              pinnedKey && pinnedKey !== entry.key ? 0.45 : 1
                            }
                            className="cursor-pointer outline-none transition-opacity"
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip content={<PieCustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Donut Readout */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                  <span className="text-[11px] font-medium text-slate-500">
                    {pinnedKey && activeBucket
                      ? 'หมวดที่กำลังเจาะลึก'
                      : `รายจ่ายรวม (${scopedExpenses.length} รายการ)`}
                  </span>
                  <span className="font-mono-num mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                    {formatMoney(
                      pinnedKey && activeBucket
                        ? activeBucket.amount
                        : totalExpense
                    )}
                  </span>
                  <span className="mt-0.5 max-w-[140px] truncate text-[11px] font-semibold text-teal-700">
                    {pinnedKey && activeBucket
                      ? `${activeBucket.pct.toFixed(1)}% · ${activeBucket.label}`
                      : `บาท · ${buckets.length} หมวดหมู่`}
                  </span>
                </div>
              </div>

              {/* Compact Legend Swatches under Donut */}
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px]">
                {pieData.map((slice) => {
                  const isActive = activeBucket?.key === slice.key;
                  return (
                    <button
                      key={slice.key}
                      type="button"
                      onClick={() =>
                        setPinnedKey((prev) =>
                          prev === slice.key ? null : slice.key
                        )
                      }
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors ${
                        isActive
                          ? 'bg-slate-100 font-semibold text-slate-900'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="truncate">{slice.label}</span>
                      </span>
                      <span className="font-mono-num shrink-0 font-semibold text-slate-800 tabular-nums">
                        {slice.pct.toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Ranked Breakdown Table + Selected Category Drill-Down */}
            <div className="flex flex-col gap-4 lg:col-span-7">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Layers className="h-3.5 w-3.5 text-teal-700" />
                    <span>อันดับสัดส่วนรายจ่ายแยกตามหมวดหมู่ (คลิกเพื่อดูรายการจริง)</span>
                  </h3>
                  {pinnedKey && (
                    <button
                      type="button"
                      onClick={() => setPinnedKey(null)}
                      className="text-[11px] font-semibold text-teal-700 hover:underline"
                    >
                      แสดงภาพรวมทั้งหมด
                    </button>
                  )}
                </div>

                <div className="max-h-[235px] space-y-1.5 overflow-y-auto pr-1">
                  {buckets.map((bucket, idx) => {
                    const isSelected = activeBucket?.key === bucket.key;
                    return (
                      <button
                        key={bucket.key}
                        type="button"
                        onClick={() =>
                          setPinnedKey((prev) =>
                            prev === bucket.key ? null : bucket.key
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50/40'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-xs"
                              style={{ backgroundColor: bucket.color }}
                            />
                            <span className="font-mono-num text-[11px] font-semibold text-slate-400 tabular-nums">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate font-semibold text-slate-900">
                              {bucket.label}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-[11px] text-slate-500">
                              {bucket.count} รายการ
                            </span>
                            <span className="font-mono-num w-24 text-right font-bold text-slate-900 tabular-nums">
                              {formatMoney(bucket.amount)}
                            </span>
                            <span className="font-mono-num w-12 text-right font-bold text-teal-700 tabular-nums">
                              {bucket.pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-xs bg-slate-100">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.min(100, bucket.pct)}%`,
                              backgroundColor: bucket.color,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Category Voucher Drill-Down */}
              {activeBucket && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-xs"
                          style={{ backgroundColor: activeBucket.color }}
                        />
                        <h4 className="text-xs font-bold text-slate-900">
                          เจาะลึกรายการในหมวด: {activeBucket.label}
                        </h4>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {activeBucket.majorLabel} · {activeBucket.count} รายการ · เฉลี่ย{' '}
                        <span className="font-mono-num font-semibold text-slate-700 tabular-nums">
                          {formatMoney(activeBucket.avgAmount)}
                        </span>{' '}
                        บ./รายการ
                        {activePaymentBreakdown.length > 0 && (
                          <>
                            {' · '}
                            {activePaymentBreakdown
                              .map(
                                (pm) => `${pm.label} ${pm.pct.toFixed(0)}%`
                              )
                              .join(' / ')}
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('ledger')}
                      className="text-[11px] font-semibold text-teal-700 hover:underline"
                    >
                      เปิดทะเบียนคุม
                    </button>
                  </div>

                  <div className="mt-2.5 divide-y divide-slate-200/70">
                    {activeBucket.transactions.slice(0, 5).map((tx) => {
                      const txShare =
                        activeBucket.amount > 0
                          ? (tx.amount / activeBucket.amount) * 100
                          : 0;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between gap-3 py-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-900">
                              {tx.description}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectMonth(getMonthKey(tx.date))
                                }
                                className="font-medium text-teal-700 hover:underline"
                                title="คลิกเพื่อเลือกดูเดือนนี้"
                              >
                                {formatThaiDateShort(tx.date)}
                              </button>
                              <span aria-hidden="true">·</span>
                              <span>
                                เลขที่ {tx.docNo || '-'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {PAYMENT_METHOD_THAI[tx.paymentMethod]}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="font-mono-num font-bold text-slate-900 tabular-nums">
                              {formatMoney(tx.amount)} บ.
                            </p>
                            <p className="font-mono-num text-[10px] text-slate-500 tabular-nums">
                              {txShare.toFixed(1)}% ของหมวด
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {activeBucket.transactions.length > 5 && (
                    <p className="mt-2 border-t border-slate-200/70 pt-2 text-center text-[11px] text-slate-500">
                      แสดงสูงสุด 5 รายการแรกจากทั้งหมด {activeBucket.transactions.length} รายการ (เรียงจากยอดจ่ายมากไปน้อย)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
