import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { FISCAL_MONTHS } from '../data/pcuCatalog';
import { LedgerTransaction, PcuSettings } from '../types/accounting';
import {
  computeExpenseCategoryByMonthMatrix,
  computeExpenseByDetailType,
  computeExpenseGroupDrilldown,
  computeExpenseMonthlyByBucket,
  computeIncomeCategoryByMonthMatrix,
  computeIncomeDailyByCategory,
  computeIncomeMonthlyByBucket,
  computeProjectBalances,
  filterTransactionsByProjectScope,
  formatMoney,
  formatMoneyOrDash,
  formatThaiDateShort,
  getCategoryLabel,
  getMonthKey,
  INCOME_SUMMARY_BUCKETS,
  MAJOR_EXPENSE_BUCKETS,
  MajorExpenseBucketKey,
  ProjectScopeFilter,
  sortTransactionsChronological,
} from '../utils/accountingMath';

interface SummaryWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  onChangeMonth: (monthKey: string) => void;
  onGoToSheetsSync: () => void;
}

type MainSection = 'income' | 'expense';
type IncomeMode =
  | 'daily_cat'
  | 'daily_payer'
  | 'monthly_cat'
  | 'cat_by_month'
  | 'projects';
type ExpenseMode =
  | 'this_month'
  | 'monthly_group'
  | 'group_by_month'
  | 'by_type'
  | 'drilldown';

export const SummaryWorkspace: React.FC<SummaryWorkspaceProps> = ({
  settings,
  transactions,
  selectedMonthKey,
  onChangeMonth,
  onGoToSheetsSync,
}) => {
  const [mainSection, setMainSection] = useState<MainSection>('income');
  const [incomeMode, setIncomeMode] = useState<IncomeMode>('daily_cat');
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>('this_month');
  const [expenseBucket, setExpenseBucket] =
    useState<MajorExpenseBucketKey>('services');
  const [projectScope, setProjectScope] = useState<ProjectScopeFilter>('all');
  const [periodScope, setPeriodScope] = useState<'month' | 'ytd'>('ytd');

  const monthInfo =
    FISCAL_MONTHS.find((m) => m.key === selectedMonthKey) || FISCAL_MONTHS[0];

  // Income Computations
  const incomeDailyCat = useMemo(
    () => computeIncomeDailyByCategory(transactions, selectedMonthKey),
    [transactions, selectedMonthKey]
  );

  const incomeDailyPayer = useMemo(
    () =>
      sortTransactionsChronological(transactions).filter(
        (t) => t.type === 'income' && getMonthKey(t.date) === selectedMonthKey
      ),
    [transactions, selectedMonthKey]
  );

  const incomeMonthlyBucket = useMemo(
    () => computeIncomeMonthlyByBucket(transactions, FISCAL_MONTHS),
    [transactions]
  );

  const incomeCatMatrix = useMemo(
    () => computeIncomeCategoryByMonthMatrix(transactions, FISCAL_MONTHS),
    [transactions]
  );

  const projectBalances = useMemo(
    () => computeProjectBalances(settings, transactions, selectedMonthKey),
    [settings, transactions, selectedMonthKey]
  );

  // Expense Computations
  const expenseThisMonthTxs = useMemo(
    () =>
      filterTransactionsByProjectScope(
        sortTransactionsChronological(transactions).filter(
          (t) =>
            t.type === 'expense' && getMonthKey(t.date) === selectedMonthKey
        ),
        projectScope
      ),
    [transactions, selectedMonthKey, projectScope]
  );

  const expenseMonthlyBucket = useMemo(
    () =>
      computeExpenseMonthlyByBucket(transactions, FISCAL_MONTHS, projectScope),
    [transactions, projectScope]
  );

  const expenseCatMatrix = useMemo(
    () =>
      computeExpenseCategoryByMonthMatrix(
        transactions,
        FISCAL_MONTHS,
        projectScope
      ),
    [transactions, projectScope]
  );

  const expenseDetailTypes = useMemo(
    () =>
      computeExpenseByDetailType(
        transactions,
        selectedMonthKey,
        periodScope,
        projectScope
      ),
    [transactions, selectedMonthKey, periodScope, projectScope]
  );

  const expenseDrilldown = useMemo(
    () =>
      computeExpenseGroupDrilldown(
        transactions,
        expenseBucket,
        selectedMonthKey,
        periodScope,
        projectScope
      ),
    [transactions, expenseBucket, selectedMonthKey, periodScope, projectScope]
  );

  const scopeLabel =
    projectScope === 'only_project'
      ? 'เฉพาะในโครงการ'
      : projectScope === 'exclude_project'
      ? 'ไม่รวมโครงการ'
      : 'รวมทั้งหมด';

  return (
    <div className="space-y-5">
      {/* Top Switcher & Controls */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMainSection('income')}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              mainSection === 'income'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            สรุป รายรับ
          </button>
          <button
            type="button"
            onClick={() => setMainSection('expense')}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              mainSection === 'expense'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            สรุป รายจ่าย
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedMonthKey}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800"
          >
            {FISCAL_MONTHS.map((m) => (
              <option key={m.key} value={m.key}>
                เดือน{m.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>พิมพ์สรุป</span>
          </button>

          <button
            type="button"
            onClick={onGoToSheetsSync}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>ส่งขึ้น Google Sheets</span>
          </button>
        </div>
      </div>

      {/* ============================ */}
      {/* SECTION 1: สรุป รายรับ        */}
      {/* ============================ */}
      {mainSection === 'income' && (
        <div className="space-y-4">
          {/* 5 Sub-modes matching PCU Money */}
          <div className="no-print flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
            {[
              { id: 'daily_cat', label: 'รายวัน แยกประเภท' },
              { id: 'daily_payer', label: 'รายวัน ผู้จ่ายเงิน' },
              { id: 'monthly_cat', label: 'รายเดือน แยกประเภท' },
              { id: 'cat_by_month', label: 'แยกประเภท / เดือน' },
              { id: 'projects', label: 'โครงการต่างๆ' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setIncomeMode(tab.id as IncomeMode)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  incomeMode === tab.id
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1.1 รายวัน แยกประเภท */}
          {incomeMode === 'daily_cat' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายรับ รายวัน แยกประเภท
                </h2>
                <p className="text-xs text-slate-500">
                  {settings.unitName} · เดือน{monthInfo.label}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        วันที่
                      </th>
                      {INCOME_SUMMARY_BUCKETS.map((b) => (
                        <th
                          key={b.key}
                          className="border border-slate-300 px-2.5 py-2 text-right font-semibold"
                        >
                          {b.label}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รวมรายวัน
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeDailyCat.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={INCOME_SUMMARY_BUCKETS.length + 2}
                          className="border border-slate-200 px-4 py-8 text-center text-slate-500"
                        >
                          ไม่มีรายรับในเดือน{monthInfo.label}
                        </td>
                      </tr>
                    ) : (
                      incomeDailyCat.rows.map((r) => (
                        <tr key={r.date} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap border border-slate-200 px-3 py-2 font-medium">
                            {formatThaiDateShort(r.date)}
                          </td>
                          {INCOME_SUMMARY_BUCKETS.map((b) => (
                            <td
                              key={b.key}
                              className="font-mono-num border border-slate-200 px-2.5 py-2 text-right tabular-nums"
                            >
                              {formatMoneyOrDash(r.buckets[b.key])}
                            </td>
                          ))}
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-emerald-700 tabular-nums">
                            {formatMoney(r.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/70 font-bold text-slate-900">
                      <td className="border border-slate-300 px-3 py-2">
                        รวมเดือนนี้
                      </td>
                      {INCOME_SUMMARY_BUCKETS.map((b) => (
                        <td
                          key={b.key}
                          className="font-mono-num border border-slate-300 px-2.5 py-2 text-right tabular-nums"
                        >
                          {formatMoney(incomeDailyCat.totals[b.key] || 0)}
                        </td>
                      ))}
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-emerald-800 tabular-nums">
                        {formatMoney(incomeDailyCat.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 1.2 รายวัน ผู้จ่ายเงิน */}
          {incomeMode === 'daily_payer' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายรับ รายวัน แยกตามผู้จ่ายเงิน / รายการ
                </h2>
                <p className="text-xs text-slate-500">
                  {settings.unitName} · เดือน{monthInfo.label}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        วันที่
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        เลขที่ใบเสร็จ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        ผู้จ่ายเงิน / รายการรับ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        หมวดรายรับ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        ช่องทางรับเงิน
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        จำนวนเงิน (บาท)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeDailyPayer.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-slate-200 px-4 py-8 text-center text-slate-500"
                        >
                          ไม่มีรายรับในเดือน{monthInfo.label}
                        </td>
                      </tr>
                    ) : (
                      incomeDailyPayer.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap border border-slate-200 px-3 py-2">
                            {formatThaiDateShort(tx.date)}
                          </td>
                          <td className="font-mono-num whitespace-nowrap border border-slate-200 px-3 py-2 text-slate-600">
                            {tx.docNo || '—'}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 font-medium text-slate-900">
                            {tx.description}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-slate-600">
                            {getCategoryLabel(
                              'income',
                              tx.categoryCode,
                              tx.subCategoryCode
                            )}
                          </td>
                          <td className="whitespace-nowrap border border-slate-200 px-3 py-2 text-slate-600">
                            {tx.paymentMethod === 'cash'
                              ? 'เงินสด'
                              : tx.paymentMethod === 'cheque'
                              ? 'เช็ค'
                              : 'โอน/e-Pay'}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-emerald-700 tabular-nums">
                            {formatMoney(tx.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/70 font-bold text-slate-900">
                      <td
                        colSpan={5}
                        className="border border-slate-300 px-3 py-2 text-right"
                      >
                        รวมรายรับทั้งสิ้น ({incomeDailyPayer.length} รายการ)
                      </td>
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-emerald-800 tabular-nums">
                        {formatMoney(
                          incomeDailyPayer.reduce((s, t) => s + t.amount, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 1.3 รายเดือน แยกประเภท */}
          {incomeMode === 'monthly_cat' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายรับ รายเดือน แยกประเภท (ตลอดปีงบประมาณ {settings.fiscalYearBE})
                </h2>
                <p className="text-xs text-slate-500">{settings.unitName}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        เดือน
                      </th>
                      {INCOME_SUMMARY_BUCKETS.map((b) => (
                        <th
                          key={b.key}
                          className="border border-slate-300 px-2 py-2 text-right font-semibold"
                        >
                          {b.label}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รวมรายเดือน
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeMonthlyBucket.rows.map((r) => (
                      <tr key={r.monthKey} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap border border-slate-200 px-3 py-2 font-medium">
                          {r.label}
                        </td>
                        {INCOME_SUMMARY_BUCKETS.map((b) => (
                          <td
                            key={b.key}
                            className="font-mono-num border border-slate-200 px-2 py-2 text-right tabular-nums"
                          >
                            {formatMoneyOrDash(r.buckets[b.key])}
                          </td>
                        ))}
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-emerald-700 tabular-nums">
                          {formatMoneyOrDash(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/70 font-bold text-slate-900">
                      <td className="border border-slate-300 px-3 py-2">
                        รวมทั้งปี
                      </td>
                      {INCOME_SUMMARY_BUCKETS.map((b) => (
                        <td
                          key={b.key}
                          className="font-mono-num border border-slate-300 px-2 py-2 text-right tabular-nums"
                        >
                          {formatMoney(incomeMonthlyBucket.totals[b.key] || 0)}
                        </td>
                      ))}
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-emerald-800 tabular-nums">
                        {formatMoney(incomeMonthlyBucket.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 1.4 แยกประเภท / เดือน (Matrix 13 หมวด x 12 เดือน) */}
          {incomeMode === 'cat_by_month' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายรับ แยกประเภท / เดือน (ปีงบประมาณ {settings.fiscalYearBE})
                </h2>
                <p className="text-xs text-slate-500">{settings.unitName}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="min-w-[210px] border border-slate-300 px-3 py-2 text-left font-semibold">
                        หมวดรายรับ (13 หมวด)
                      </th>
                      {FISCAL_MONTHS.map((m) => (
                        <th
                          key={m.key}
                          className="whitespace-nowrap border border-slate-300 px-2 py-2 text-right font-semibold"
                        >
                          {m.shortLabel}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รวมทั้งปี
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeCatMatrix.rows.map((r) => (
                      <tr key={r.code} className="hover:bg-slate-50/70">
                        <td className="border border-slate-200 px-3 py-1.5 font-medium text-slate-900">
                          {r.name}
                        </td>
                        {FISCAL_MONTHS.map((m) => (
                          <td
                            key={m.key}
                            className="font-mono-num border border-slate-200 px-2 py-1.5 text-right tabular-nums"
                          >
                            {formatMoneyOrDash(r.byMonth[m.key] || 0)}
                          </td>
                        ))}
                        <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right font-semibold text-emerald-700 tabular-nums">
                          {formatMoney(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/70 font-bold text-slate-900">
                      <td className="border border-slate-300 px-3 py-2">
                        รวมรายรับทั้งสิ้น
                      </td>
                      {FISCAL_MONTHS.map((m) => (
                        <td
                          key={m.key}
                          className="font-mono-num border border-slate-300 px-2 py-2 text-right tabular-nums"
                        >
                          {formatMoney(
                            incomeCatMatrix.monthTotals[m.key] || 0
                          )}
                        </td>
                      ))}
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-emerald-800 tabular-nums">
                        {formatMoney(incomeCatMatrix.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 1.5 โครงการต่างๆ */}
          {incomeMode === 'projects' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปเงินรับ - จ่าย และยอดคงเหลือแยกตามโครงการ / 402 / 404 ย่อย
                </h2>
                <p className="text-xs text-slate-500">
                  {settings.unitName} · ถึงเดือน{monthInfo.label}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-center font-semibold">
                        ลำดับ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        ชื่อโครงการ / 402 / 404
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        ยกมาจากปีก่อน
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รับเดือนนี้
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รับสะสมต้นปี
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        จ่ายสะสมต้นปี
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        คงเหลือ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectBalances.map((snap) => (
                      <tr key={snap.project.id} className="hover:bg-slate-50/70">
                        <td className="border border-slate-200 px-3 py-2 text-center">
                          {snap.project.order}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          <p className="font-semibold text-slate-900">
                            {snap.project.shortName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {snap.project.fullName}
                          </p>
                        </td>
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right tabular-nums">
                          {formatMoney(snap.project.openingBalance)}
                        </td>
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right text-emerald-700 tabular-nums">
                          {formatMoney(snap.receivedMonth)}
                        </td>
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right text-emerald-700 tabular-nums">
                          {formatMoney(snap.receivedYtd)}
                        </td>
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right text-rose-700 tabular-nums">
                          {formatMoney(snap.spentYtd)}
                        </td>
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-teal-800 tabular-nums">
                          {formatMoney(snap.remainingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================ */}
      {/* SECTION 2: สรุป รายจ่าย       */}
      {/* ============================ */}
      {mainSection === 'expense' && (
        <div className="space-y-4">
          {/* Sub-modes + Project Scope & Period Controls */}
          <div className="no-print space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'this_month', label: 'รายจ่ายเดือนนี้' },
                  { id: 'monthly_group', label: 'รายเดือน แยกหมวด' },
                  { id: 'group_by_month', label: 'หมวด แยกรายเดือน' },
                  { id: 'by_type', label: 'แยก แต่ละประเภท' },
                  { id: 'drilldown', label: 'แยกหมวด / ประเภท / ชนิด' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setExpenseMode(tab.id as ExpenseMode)}
                    className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      expenseMode === tab.id
                        ? 'bg-rose-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setProjectScope('all')}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                      projectScope === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    รวมทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectScope('exclude_project')}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                      projectScope === 'exclude_project'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    ไม่รวมโครงการ
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectScope('only_project')}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                      projectScope === 'only_project'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    เฉพาะในโครงการ
                  </button>
                </div>

                {(expenseMode === 'by_type' || expenseMode === 'drilldown') && (
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPeriodScope('month')}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                        periodScope === 'month'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      เดือนนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodScope('ytd')}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${
                        periodScope === 'ytd'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      ทั้งปี
                    </button>
                  </div>
                )}
              </div>
            </div>

            {expenseMode === 'drilldown' && (
              <div className="flex flex-wrap gap-1.5 border-t border-slate-200 pt-3">
                {MAJOR_EXPENSE_BUCKETS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setExpenseBucket(b.key)}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      expenseBucket === b.key
                        ? 'border-rose-700 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2.1 รายจ่ายเดือนนี้ */}
          {expenseMode === 'this_month' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายจ่ายเดือนนี้ ({scopeLabel})
                </h2>
                <p className="text-xs text-slate-500">
                  {settings.unitName} · เดือน{monthInfo.label}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        วันที่
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        ใบสำคัญที่
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        หมวดรายจ่าย
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        รายการ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        โครงการ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        จำนวนเงิน (บาท)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseThisMonthTxs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-slate-200 px-4 py-8 text-center text-slate-500"
                        >
                          ไม่มีรายจ่ายตามเงื่อนไข ({scopeLabel}) ในเดือน{monthInfo.label}
                        </td>
                      </tr>
                    ) : (
                      expenseThisMonthTxs.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap border border-slate-200 px-3 py-2">
                            {formatThaiDateShort(tx.date)}
                          </td>
                          <td className="font-mono-num whitespace-nowrap border border-slate-200 px-3 py-2 text-slate-600">
                            {tx.docNo || '—'}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-slate-600">
                            {getCategoryLabel(
                              'expense',
                              tx.categoryCode,
                              tx.subCategoryCode
                            )}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 font-medium text-slate-900">
                            {tx.description}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-slate-600">
                            {tx.projectCode || '—'}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-rose-700 tabular-nums">
                            {formatMoney(tx.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/70 font-bold text-slate-900">
                      <td
                        colSpan={5}
                        className="border border-slate-300 px-3 py-2 text-right"
                      >
                        รวมรายจ่ายเดือนนี้ ({expenseThisMonthTxs.length} รายการ)
                      </td>
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-rose-800 tabular-nums">
                        {formatMoney(
                          expenseThisMonthTxs.reduce((s, t) => s + t.amount, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2.2 รายเดือน แยกหมวด */}
          {expenseMode === 'monthly_group' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายจ่าย รายเดือน แยกหมวด ({scopeLabel})
                </h2>
                <p className="text-xs text-slate-500">
                  {settings.unitName} · ปีงบประมาณ {settings.fiscalYearBE}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        เดือน
                      </th>
                      {MAJOR_EXPENSE_BUCKETS.map((b) => (
                        <th
                          key={b.key}
                          className="border border-slate-300 px-2 py-2 text-right font-semibold"
                        >
                          {b.label}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รวมรายเดือน
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseMonthlyBucket.rows.map((r) => (
                      <tr key={r.monthKey} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap border border-slate-200 px-3 py-2 font-medium">
                          {r.label}
                        </td>
                        {MAJOR_EXPENSE_BUCKETS.map((b) => (
                          <td
                            key={b.key}
                            className="font-mono-num border border-slate-200 px-2 py-2 text-right tabular-nums"
                          >
                            {formatMoneyOrDash(r.buckets[b.key])}
                          </td>
                        ))}
                        <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-rose-700 tabular-nums">
                          {formatMoneyOrDash(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/70 font-bold text-slate-900">
                      <td className="border border-slate-300 px-3 py-2">
                        รวมทั้งปี
                      </td>
                      {MAJOR_EXPENSE_BUCKETS.map((b) => (
                        <td
                          key={b.key}
                          className="font-mono-num border border-slate-300 px-2 py-2 text-right tabular-nums"
                        >
                          {formatMoney(expenseMonthlyBucket.totals[b.key] || 0)}
                        </td>
                      ))}
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-rose-800 tabular-nums">
                        {formatMoney(expenseMonthlyBucket.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2.3 หมวด แยกรายเดือน (Matrix 14 หมวด x 12 เดือน) */}
          {expenseMode === 'group_by_month' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายจ่าย หมวด แยกรายเดือน ({scopeLabel})
                </h2>
                <p className="text-xs text-slate-500">
                  {settings.unitName} · ปีงบประมาณ {settings.fiscalYearBE}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="min-w-[210px] border border-slate-300 px-3 py-2 text-left font-semibold">
                        หมวดรายจ่าย (14 หมวด)
                      </th>
                      {FISCAL_MONTHS.map((m) => (
                        <th
                          key={m.key}
                          className="whitespace-nowrap border border-slate-300 px-2 py-2 text-right font-semibold"
                        >
                          {m.shortLabel}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        รวมทั้งปี
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseCatMatrix.rows.map((r) => (
                      <tr key={r.code} className="hover:bg-slate-50/70">
                        <td className="border border-slate-200 px-3 py-1.5 font-medium text-slate-900">
                          {r.name}
                        </td>
                        {FISCAL_MONTHS.map((m) => (
                          <td
                            key={m.key}
                            className="font-mono-num border border-slate-200 px-2 py-1.5 text-right tabular-nums"
                          >
                            {formatMoneyOrDash(r.byMonth[m.key] || 0)}
                          </td>
                        ))}
                        <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right font-semibold text-rose-700 tabular-nums">
                          {formatMoney(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/70 font-bold text-slate-900">
                      <td className="border border-slate-300 px-3 py-2">
                        รวมรายจ่ายทั้งสิ้น
                      </td>
                      {FISCAL_MONTHS.map((m) => (
                        <td
                          key={m.key}
                          className="font-mono-num border border-slate-300 px-2 py-2 text-right tabular-nums"
                        >
                          {formatMoney(
                            expenseCatMatrix.monthTotals[m.key] || 0
                          )}
                        </td>
                      ))}
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-rose-800 tabular-nums">
                        {formatMoney(expenseCatMatrix.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2.4 แยก แต่ละประเภท */}
          {expenseMode === 'by_type' && (
            <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายจ่าย แยกแต่ละประเภท ({scopeLabel} ·{' '}
                  {periodScope === 'month'
                    ? `เดือน${monthInfo.label}`
                    : `ตั้งแต่ต้นปีถึง${monthInfo.label}`}
                  )
                </h2>
                <p className="text-xs text-slate-500">{settings.unitName}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        หมวดตามงบเดือน
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        ประเภทรายจ่ายย่อย (เกณฑ์คงค้าง)
                      </th>
                      <th className="w-24 border border-slate-300 px-3 py-2 text-center font-semibold">
                        จำนวนครั้ง
                      </th>
                      <th className="w-40 border border-slate-300 px-3 py-2 text-right font-semibold">
                        ยอดเงินรวม (บาท)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseDetailTypes.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="border border-slate-200 px-4 py-8 text-center text-slate-500"
                        >
                          ไม่มีรายจ่ายตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    ) : (
                      expenseDetailTypes.items.map((item) => (
                        <tr key={item.key} className="hover:bg-slate-50/70">
                          <td className="border border-slate-200 px-3 py-2 text-slate-600">
                            {item.categoryLabel}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 font-medium text-slate-900">
                            {item.accrualLabel}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-center tabular-nums">
                            {item.count}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-rose-700 tabular-nums">
                            {formatMoney(item.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/70 font-bold text-slate-900">
                      <td
                        colSpan={3}
                        className="border border-slate-300 px-3 py-2 text-right"
                      >
                        รวมทั้งสิ้น
                      </td>
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-rose-800 tabular-nums">
                        {formatMoney(expenseDetailTypes.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2.5 แยกหมวด / ประเภท / ชนิด (7 กลุ่มรายจ่ายหลัก) */}
          {expenseMode === 'drilldown' && (
            <div className="print-sheet space-y-5 rounded-xl border border-slate-200 bg-white p-6">
              <div className="text-center">
                <h2 className="text-base font-bold text-slate-900">
                  สรุปรายจ่ายหมวด: {expenseDrilldown.bucketLabel} ({scopeLabel} ·{' '}
                  {periodScope === 'month'
                    ? `เดือน${monthInfo.label}`
                    : `ทั้งปีงบประมาณ ${settings.fiscalYearBE}`}
                  )
                </h2>
                <p className="text-xs text-slate-500">{settings.unitName}</p>
              </div>

              {/* Breakdown by Sub-type */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        ชนิด / ประเภทรายจ่ายย่อยในหมวด{expenseDrilldown.bucketLabel}
                      </th>
                      <th className="w-28 border border-slate-300 px-3 py-2 text-center font-semibold">
                        จำนวนรายการ
                      </th>
                      <th className="w-40 border border-slate-300 px-3 py-2 text-right font-semibold">
                        จำนวนเงิน (บาท)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseDrilldown.subBreakdown.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-slate-200 px-4 py-6 text-center text-slate-500"
                        >
                          ไม่มีรายจ่ายในหมวด{expenseDrilldown.bucketLabel}
                        </td>
                      </tr>
                    ) : (
                      expenseDrilldown.subBreakdown.map((sub) => (
                        <tr key={sub.label} className="hover:bg-slate-50/70">
                          <td className="border border-slate-200 px-3 py-2 font-medium text-slate-900">
                            {sub.label}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-center tabular-nums">
                            {sub.count}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-2 text-right font-semibold text-rose-700 tabular-nums">
                            {formatMoney(sub.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/70 font-bold text-slate-900">
                      <td
                        colSpan={2}
                        className="border border-slate-300 px-3 py-2 text-right"
                      >
                        รวมหมวด{expenseDrilldown.bucketLabel}
                      </td>
                      <td className="font-mono-num border border-slate-300 px-3 py-2 text-right text-rose-800 tabular-nums">
                        {formatMoney(expenseDrilldown.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Detail list */}
              {expenseDrilldown.txs.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs font-semibold text-slate-700">
                    รายละเอียดใบสำคัญจ่ายในหมวด ({expenseDrilldown.txs.length} รายการ)
                  </p>
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700">
                        <th className="border border-slate-200 px-3 py-1.5 text-left font-semibold">
                          วันที่
                        </th>
                        <th className="border border-slate-200 px-3 py-1.5 text-left font-semibold">
                          เลขที่เอกสาร
                        </th>
                        <th className="border border-slate-200 px-3 py-1.5 text-left font-semibold">
                          รายการ
                        </th>
                        <th className="border border-slate-200 px-3 py-1.5 text-right font-semibold">
                          จำนวนเงิน (บาท)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseDrilldown.txs.map((tx) => (
                        <tr key={tx.id}>
                          <td className="whitespace-nowrap border border-slate-200 px-3 py-1.5">
                            {formatThaiDateShort(tx.date)}
                          </td>
                          <td className="font-mono-num whitespace-nowrap border border-slate-200 px-3 py-1.5 text-slate-600">
                            {tx.docNo || '—'}
                          </td>
                          <td className="border border-slate-200 px-3 py-1.5 text-slate-900">
                            {tx.description}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                            {formatMoney(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
