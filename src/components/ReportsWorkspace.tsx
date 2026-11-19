import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { FISCAL_MONTHS } from '../data/pcuCatalog';
import { LedgerTransaction, PcuSettings } from '../types/accounting';
import {
  computeAccrualStatement,
  computeForm401,
  computeForm404,
  computeForm407,
  computeMonthlyStatement,
  computeVoucherSummary,
  formatMoney,
  formatMoneyOrDash,
  formatThaiDateFull,
  formatThaiDateWithWeekday,
  getMonthDateRangeLabel,
  getThaiMonthFull,
  getThaiYearBE,
} from '../utils/accountingMath';

interface ReportsWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  onChangeMonth: (monthKey: string) => void;
  selectedDate407: string;
  onChangeDate407: (date: string) => void;
  onGoToSheetsSync: () => void;
}

type ReportTab =
  | 'monthly'
  | 'accrual'
  | 'voucher'
  | 'form401'
  | 'form404'
  | 'form407';

export const ReportsWorkspace: React.FC<ReportsWorkspaceProps> = ({
  settings,
  transactions,
  selectedMonthKey,
  onChangeMonth,
  selectedDate407,
  onChangeDate407,
  onGoToSheetsSync,
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('monthly');

  const monthInfo =
    FISCAL_MONTHS.find((m) => m.key === selectedMonthKey) || FISCAL_MONTHS[0];
  const dateRangeLabel = getMonthDateRangeLabel(selectedMonthKey);

  const monthly = useMemo(
    () => computeMonthlyStatement(settings, transactions, selectedMonthKey),
    [settings, transactions, selectedMonthKey]
  );

  const accrual = useMemo(
    () => computeAccrualStatement(settings, transactions, selectedMonthKey),
    [settings, transactions, selectedMonthKey]
  );

  const voucherSummary = useMemo(
    () => computeVoucherSummary(transactions, selectedMonthKey),
    [transactions, selectedMonthKey]
  );

  const form404 = useMemo(
    () => computeForm404(settings, transactions, selectedMonthKey),
    [settings, transactions, selectedMonthKey]
  );

  const form401Days = useMemo(
    () => computeForm401(settings, transactions, selectedMonthKey),
    [settings, transactions, selectedMonthKey]
  );

  const form407 = useMemo(
    () => computeForm407(settings, transactions, selectedDate407),
    [settings, transactions, selectedDate407]
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'monthly'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            งบเดือน รับ-จ่าย
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accrual')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'accrual'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            งบเดือน (ระบบเกณฑ์คงค้าง)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voucher')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'voucher'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            หน้างบใบสำคัญ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form401')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'form401'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            บัญชีเงินสด แบบ 401
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form404')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'form404'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            คุมเงินนอกงบฯ แบบ 404
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form407')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'form407'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            คงเหลือประจำวัน แบบ 407
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'form407' ? (
            <input
              type="date"
              value={selectedDate407}
              onChange={(e) => onChangeDate407(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800"
            />
          ) : (
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
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>พิมพ์รายงาน</span>
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

      {/* 1. Standard Monthly Statement */}
      {activeTab === 'monthly' && (
        <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-bold text-slate-900">
              รายการรับ - รายการจ่ายเงินบำรุง
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {settings.unitName} {settings.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {dateRangeLabel} · {settings.affiliationLabel}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                    รายการ
                  </th>
                  <th className="w-36 border border-slate-300 px-3 py-2 text-right font-semibold">
                    รวมเดือนนี้
                  </th>
                  <th className="w-36 border border-slate-300 px-3 py-2 text-right font-semibold">
                    รวมต้นปี
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={3} className="border border-slate-300 px-3 py-2">
                    รายรับ
                  </td>
                </tr>
                {monthly.incomeRows.map((row) => (
                  <tr key={row.code} className="hover:bg-slate-50/70">
                    <td
                      className={`border border-slate-200 px-3 py-1.5 ${
                        row.isSubItem
                          ? 'pl-7 text-slate-600'
                          : 'font-medium text-slate-900'
                      }`}
                    >
                      {row.isSubItem ? `- ${row.label}` : row.label}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {formatMoney(row.monthAmount)}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {formatMoney(row.ytdAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-emerald-50/70 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    รวมรายรับ
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.totalMonthIncome)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.totalYtdIncome)}
                  </td>
                </tr>

                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={3} className="border border-slate-300 px-3 py-2">
                    รายจ่าย
                  </td>
                </tr>
                {monthly.expenseRows.map((row) => (
                  <tr key={row.code} className="hover:bg-slate-50/70">
                    <td
                      className={`border border-slate-200 px-3 py-1.5 ${
                        row.isSubItem
                          ? 'pl-7 text-slate-600'
                          : 'font-medium text-slate-900'
                      }`}
                    >
                      {row.isSubItem ? `- ${row.label}` : row.label}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {formatMoney(row.monthAmount)}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {formatMoney(row.ytdAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-rose-50/70 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    รวมรายจ่าย
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.totalMonthExpense)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.totalYtdExpense)}
                  </td>
                </tr>

                <tr className="font-semibold">
                  <td className="border border-slate-300 px-3 py-2 text-right">
                    รายรับ ต่ำ / สูง กว่ารายจ่าย
                  </td>
                  <td
                    className={`font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      monthly.monthNetDiff < 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(monthly.monthNetDiff)}
                  </td>
                  <td
                    className={`font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      monthly.ytdNetDiff < 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(monthly.ytdNetDiff)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 text-right font-medium">
                    เงินบำรุงคงเหลือ ยกมาจากเดือนก่อน / ต้นปี
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.openingFromPrevMonth)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.openingFiscalYear)}
                  </td>
                </tr>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-right">
                    เงินบำรุงคงเหลือ ยกไป
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.closingMonthBalance)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(monthly.closingYtdBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Accrual-Basis Income & Expense Report (ระบบเกณฑ์คงค้าง) */}
      {activeTab === 'accrual' && (
        <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-bold text-slate-900">
              รายการรับ - รายการจ่ายเงินบำรุง (ระบบเกณฑ์คงค้าง)
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {settings.unitName} {settings.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {dateRangeLabel}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                    รายการ
                  </th>
                  <th className="w-36 border border-slate-300 px-3 py-2 text-right font-semibold">
                    รวมเดือนนี้
                  </th>
                  <th className="w-36 border border-slate-300 px-3 py-2 text-right font-semibold">
                    รวมต้นปี
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={3} className="border border-slate-300 px-3 py-2">
                    รายรับ
                  </td>
                </tr>
                {accrual.incomeRows.map((row) => (
                  <tr key={row.code} className="hover:bg-slate-50/70">
                    <td
                      className={`border border-slate-200 px-3 py-1.5 ${
                        row.isSubItem
                          ? 'pl-7 text-slate-600'
                          : 'font-medium text-slate-900'
                      }`}
                    >
                      {row.isSubItem ? `- ${row.label}` : row.label}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {formatMoney(row.monthAmount)}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {formatMoney(row.ytdAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-emerald-50/70 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    รวมรายรับ
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.totalMonthIncome)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.totalYtdIncome)}
                  </td>
                </tr>

                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={3} className="border border-slate-300 px-3 py-2">
                    รายจ่าย
                  </td>
                </tr>
                {accrual.expenseRows.map((row) => (
                  <tr
                    key={row.code}
                    className={
                      row.level === 1
                        ? 'bg-slate-50/60 font-semibold text-slate-900'
                        : row.level === 2
                        ? 'font-medium text-slate-800'
                        : 'hover:bg-slate-50/70'
                    }
                  >
                    <td
                      className={`border border-slate-200 px-3 py-1.5 ${
                        row.level === 2
                          ? 'pl-6'
                          : row.level === 3
                          ? 'pl-10 text-slate-600'
                          : ''
                      }`}
                    >
                      {row.level === 3 ? `. ${row.label}` : row.label}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {row.monthAmount === null ? '' : formatMoney(row.monthAmount)}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right tabular-nums">
                      {row.ytdAmount === null ? '' : formatMoney(row.ytdAmount)}
                    </td>
                  </tr>
                ))}

                <tr className="bg-rose-50/70 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    รวมรายจ่าย
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.totalMonthExpense)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.totalYtdExpense)}
                  </td>
                </tr>

                <tr className="font-semibold">
                  <td className="border border-slate-300 px-3 py-2 text-right">
                    รายรับ ต่ำ / สูง กว่ารายจ่าย
                  </td>
                  <td
                    className={`font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      accrual.monthNetDiff < 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(accrual.monthNetDiff)}
                  </td>
                  <td
                    className={`font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      accrual.ytdNetDiff < 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(accrual.ytdNetDiff)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 text-right font-medium">
                    เงินบำรุงคงเหลือ ยกมาจากเดือนก่อน / ต้นปี
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.openingFromPrevMonth)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.openingFiscalYear)}
                  </td>
                </tr>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-right">
                    เงินบำรุงคงเหลือ ยกไป
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.closingMonthBalance)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(accrual.closingYtdBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures + Notes */}
          <div className="mt-6 space-y-5 text-xs">
            <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-2">
              <div>
                <p>ลงชื่อ...................................................เจ้าหน้าที่การเงิน</p>
                <p className="mt-1 font-medium text-slate-900">
                  ( {settings.officers.financeOfficer} )
                </p>
              </div>
              <div>
                <p>ลงชื่อ...................................................หัวหน้าหน่วยงานย่อย</p>
                <p className="mt-1 font-medium text-slate-900">
                  ( {settings.officers.unitHead} )
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-rose-700">
              <p className="font-semibold text-slate-900">หมายเหตุ</p>
              <div className="mt-1.5 space-y-1">
                <p>
                  เงินบำรุงคงเหลือ ไม่รวมเงินในโครงการต่างๆ :{' '}
                  <span className="font-mono-num font-semibold tabular-nums">
                    {formatMoney(accrual.nonProjectRemainingTotal)}
                  </span>{' '}
                  บาท
                </p>
                <p>
                  เงินคงเหลือในโครงการต่างๆ :{' '}
                  <span className="font-mono-num font-semibold tabular-nums">
                    {formatMoney(accrual.projectRemainingTotal)}
                  </span>{' '}
                  บาท
                </p>
                <p>
                  ค่าครุภัณฑ์ต่ำกว่า 10,000 บาท เดือนนี้{' '}
                  <span className="font-mono-num font-semibold tabular-nums">
                    {formatMoney(accrual.lowValueEquipmentMonth)}
                  </span>{' '}
                  บาท · ตั้งแต่ต้นปี{' '}
                  <span className="font-mono-num font-semibold tabular-nums">
                    {formatMoney(accrual.lowValueEquipmentYtd)}
                  </span>{' '}
                  บาท
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Voucher Cover Summary (หน้างบใบสำคัญ) */}
      {activeTab === 'voucher' && (
        <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-bold text-slate-900">หน้างบใบสำคัญ</h2>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {settings.unitName} {settings.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{dateRangeLabel}</p>
          </div>

          {voucherSummary.groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              ไม่มีรายการใบสำคัญจ่ายในเดือน{monthInfo.label}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="w-44 border border-slate-300 px-3 py-2 text-center font-semibold">
                      ใบสำคัญที่
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                      หมวดประเภทรายจ่าย
                    </th>
                    <th className="w-40 border border-slate-300 px-3 py-2 text-right font-semibold">
                      จำนวนเงิน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {voucherSummary.groups.map((group) => (
                    <React.Fragment key={group.groupTitle}>
                      {group.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="font-mono-num border-x border-slate-300 px-3 py-1.5 text-center text-slate-700">
                            {item.docNo}
                          </td>
                          <td className="border-x border-slate-300 px-3 py-1.5 text-slate-900">
                            {idx === 0 && (
                              <p className="mb-1 font-bold underline">
                                {group.groupTitle}
                              </p>
                            )}
                            <p>{item.description}</p>
                          </td>
                          <td className="font-mono-num border-x border-slate-300 px-3 py-1.5 text-right align-bottom tabular-nums">
                            {formatMoney(item.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b border-slate-300 bg-slate-50/70 font-semibold">
                        <td className="border-x border-slate-300 px-3 py-1.5" />
                        <td className="border-x border-slate-300 px-3 py-1.5 text-right">
                          รวมเงิน
                        </td>
                        <td className="font-mono-num border-x border-slate-300 px-3 py-1.5 text-right tabular-nums">
                          {formatMoney(group.subtotal)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td
                      colSpan={2}
                      className="border border-slate-300 px-3 py-2.5 text-right"
                    >
                      รวมเงินทั้งหมด
                    </td>
                    <td className="font-mono-num border border-slate-300 px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(voucherSummary.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 flex justify-end text-xs">
            <div className="text-center">
              <p>(ลงชื่อ)...................................................เจ้าหน้าที่การเงิน</p>
              <p className="mt-1 font-medium text-slate-900">
                ( {settings.officers.financeOfficer} )
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Form 401 Cash Book */}
      {activeTab === 'form401' && (
        <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-bold text-slate-900">
              บัญชีเงินสด แบบ 401
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {settings.unitName} {settings.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              ประจำเดือน{monthInfo.label}
            </p>
          </div>

          {form401Days.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              ไม่มีรายการเคลื่อนไหวในเดือน{monthInfo.label}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 px-2 py-2 font-semibold">
                      เดือน/วัน
                    </th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold">
                      เอกสารที่ (รับ)
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left font-semibold">
                      รายการรับ
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-right font-semibold">
                      เงินสดเดบิต
                    </th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold">
                      เดือน/วัน
                    </th>
                    <th className="border border-slate-300 px-2 py-2 font-semibold">
                      เอกสารที่ (จ่าย)
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left font-semibold">
                      รายการจ่าย
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-right font-semibold">
                      เงินสดเครดิต
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form401Days.map((day) => {
                    const dNum = Number(day.date.slice(8, 10));
                    const mShort = getThaiMonthFull(day.date).slice(0, 3);
                    const rowCount = Math.max(
                      day.incomes.length,
                      day.expenses.length,
                      1
                    );
                    return (
                      <React.Fragment key={day.date}>
                        <tr className="bg-slate-50/70">
                          <td className="border border-slate-200 px-2 py-1.5 text-center font-medium">
                            {mShort} {dNum}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5 font-semibold">
                            ยกมา
                          </td>
                          <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-right font-medium tabular-nums">
                            {formatMoney(day.openingBalance)}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center font-medium">
                            {mShort} {dNum}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                            {day.expenses.length === 0 ? 'ไม่มีจ่าย' : ''}
                          </td>
                          <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                            {day.expenses.length === 0 ? '-' : ''}
                          </td>
                        </tr>
                        {Array.from({ length: rowCount }).map((_, idx) => {
                          const inc = day.incomes[idx];
                          const exp = day.expenses[idx];
                          if (!inc && !exp) return null;
                          return (
                            <tr key={`${day.date}-${idx}`}>
                              <td className="border border-slate-200 px-2 py-1.5" />
                              <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-slate-600">
                                {inc?.docNo || ''}
                              </td>
                              <td className="border border-slate-200 px-2 py-1.5">
                                {inc?.description || ''}
                              </td>
                              <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-right text-emerald-700 tabular-nums">
                                {inc ? formatMoney(inc.amount) : ''}
                              </td>
                              <td className="border border-slate-200 px-2 py-1.5" />
                              <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-slate-600">
                                {exp?.docNo || ''}
                              </td>
                              <td className="border border-slate-200 px-2 py-1.5">
                                {exp?.description || ''}
                              </td>
                              <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-right text-rose-700 tabular-nums">
                                {exp ? formatMoney(exp.amount) : ''}
                              </td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5" />
                          <td className="border border-slate-200 px-2 py-1.5 text-right font-semibold">
                            ยกไป
                          </td>
                          <td className="font-mono-num border border-slate-200 px-2 py-1.5 text-right font-semibold tabular-nums">
                            {formatMoney(day.closingBalance)}
                          </td>
                        </tr>
                        <tr className="border-b-2 border-slate-400 bg-slate-100 font-bold">
                          <td className="border border-slate-300 px-2 py-1.5" />
                          <td className="border border-slate-300 px-2 py-1.5" />
                          <td className="border border-slate-300 px-2 py-1.5 text-right">
                            รวม
                          </td>
                          <td className="font-mono-num border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                            {formatMoney(day.totalSide)}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5" />
                          <td className="border border-slate-300 px-2 py-1.5" />
                          <td className="border border-slate-300 px-2 py-1.5 text-right">
                            รวม
                          </td>
                          <td className="font-mono-num border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                            {formatMoney(day.totalSide)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Form 404 Non-Budgetary Control Ledger */}
      {activeTab === 'form404' && (
        <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-bold text-slate-900">
              ทะเบียนคุมเงินนอกงบประมาณ (แบบ 404 หน่วยงานย่อย)
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {settings.unitName} {settings.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              รวมทุกบัญชี เงินนอกงบประมาณ · {dateRangeLabel}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 font-semibold">
                    เดือน (พ.ศ.)
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold">
                    วัน
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                    ที่เอกสาร
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                    รายการ
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    รับ
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    จ่าย
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    คงเหลือ
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={6} className="border border-slate-300 px-3 py-2 text-right">
                    ยอดยกมาจากเดือนก่อน
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.openingFromPrevMonth)}
                  </td>
                </tr>
                {form404.rows.map((r) => (
                  <tr key={r.tx.id} className="hover:bg-slate-50/60">
                    <td className="border border-slate-200 px-3 py-1.5">
                      {getThaiMonthFull(r.tx.date)} {getThaiYearBE(r.tx.date)}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-center">
                      {Number(r.tx.date.slice(8, 10))}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-slate-600">
                      {r.tx.docNo || ''}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-slate-900">
                      {r.tx.description}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right text-emerald-700 tabular-nums">
                      {r.incomeAmount > 0 ? formatMoney(r.incomeAmount) : ''}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right text-rose-700 tabular-nums">
                      {r.expenseAmount > 0 ? formatMoney(r.expenseAmount) : ''}
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-1.5 text-right font-medium text-slate-900 tabular-nums">
                      {formatMoney(r.runningBalance)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={6} className="border border-slate-300 px-3 py-2 text-right">
                    ยอดยกไป
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.monthClosing)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <table className="w-full max-w-2xl border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                    สรุปยอดคุมเงินนอกงบประมาณ
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    ยอดยกมา
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    รับ
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    จ่าย
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    รับ - จ่าย
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                    คงเหลือ
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">
                    เดือนนี้
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.openingFromPrevMonth)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.monthIncome)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.monthExpense)}
                  </td>
                  <td
                    className={`font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      form404.monthIncome - form404.monthExpense < 0
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(form404.monthIncome - form404.monthExpense)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right font-bold tabular-nums">
                    {formatMoney(form404.monthClosing)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">
                    ตั้งแต่ต้นปี
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.openingFiscalYear)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.ytdIncome)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form404.ytdExpense)}
                  </td>
                  <td
                    className={`font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      form404.ytdIncome - form404.ytdExpense < 0
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(form404.ytdIncome - form404.ytdExpense)}
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right font-bold tabular-nums">
                    {formatMoney(form404.ytdClosing)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Form 407 Daily Cash Position Report */}
      {activeTab === 'form407' && (
        <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-bold text-slate-900">
              รายงานเงินคงเหลือประจำวัน (แบบ 407)
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {settings.unitName} {settings.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              ประจำ{formatThaiDateWithWeekday(selectedDate407)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                    รายการ
                  </th>
                  <th className="w-40 border border-slate-300 px-3 py-2 text-right font-semibold">
                    จำนวนเงิน (บาท)
                  </th>
                  <th className="w-64 border border-slate-300 px-3 py-2 text-left font-semibold">
                    หมายเหตุ (ความเคลื่อนไหวประจำวัน)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">เงินสดในมือ</td>
                  <td className="font-mono-num border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form407.cashInHand)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-600">
                    รับเงินสดในมือ: {formatMoneyOrDash(form407.dayCashIncome)} บาท
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">เช็คในมือ</td>
                  <td className="font-mono-num border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form407.chequeInHand)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-600">
                    รับเงินเข้าธนาคาร: {formatMoneyOrDash(form407.dayBankIncome)} บาท
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">ใบสำคัญรองจ่าย</td>
                  <td className="font-mono-num border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form407.advanceReceipt)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-600">
                    หักเช็ค/e-Pay รับฝาก: {formatMoneyOrDash(form407.dayWithholdingDeposit)} บาท
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">สัญญารับรองการยืมเงิน</td>
                  <td className="font-mono-num border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form407.loanContract)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-600">
                    จ่ายเงินสด: {formatMoneyOrDash(form407.dayCashExpense)} บาท
                  </td>
                </tr>
                {form407.accountSnapshots.map((snap, idx) => (
                  <tr key={snap.account.id}>
                    <td className="border border-slate-200 px-3 py-2 pl-6">
                      สมุดคู่ฝาก: {snap.account.name} ({snap.account.accountNo})
                    </td>
                    <td className="font-mono-num border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {formatMoney(snap.bankBalance)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-600">
                      {idx === 0
                        ? `จ่ายเช็คสุทธิ: ${formatMoneyOrDash(form407.dayChequeExpense)} · e-Pay: ${formatMoneyOrDash(form407.dayBankExpense)}`
                        : `ฝากเงินสด: ${formatMoneyOrDash(form407.dayCashDeposit)} · ถอน: ${formatMoneyOrDash(form407.dayCashWithdraw)}`}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-right">
                    รวม
                  </td>
                  <td className="font-mono-num border border-slate-300 px-3 py-2 text-right tabular-nums">
                    {formatMoney(form407.grandTotal)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2" />
                </tr>
                <tr className="bg-slate-50">
                  <td colSpan={3} className="border border-slate-300 px-3 py-2.5 text-center font-semibold text-slate-900">
                    จำนวนเงิน (ตัวอักษร) {form407.grandTotalThaiText}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 border border-slate-300 p-5 text-xs text-slate-700 md:grid-cols-2">
            <div className="text-center">
              <p>ลงชื่อ...................................................เจ้าหน้าที่การเงิน</p>
              <p className="mt-1 font-medium text-slate-900">
                ({settings.officers.financeOfficer})
              </p>
            </div>
            <div className="text-center">
              <p>ลงชื่อ...................................................หัวหน้าหน่วยงานย่อย</p>
              <p className="mt-1 font-medium text-slate-900">
                ({settings.officers.unitHead})
              </p>
            </div>

            <div className="border-t border-slate-200 pt-4 md:col-span-2">
              <p className="mb-4 text-center text-slate-600">
                คณะกรรมการเก็บรักษาเงิน ได้ตรวจนับเงินและหลักฐานแทนตัวเงินถูกต้องตามรายการข้างต้นแล้ว จึงได้รับฝากเก็บรักษาไว้ในลักษณะหีบห่อ หรือตู้นิรภัย
              </p>
              <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                <div>
                  <p>...................................................</p>
                  <p className="mt-1 font-medium text-slate-900">
                    ({settings.officers.cashCommittee1 || '-'})
                  </p>
                  <p className="text-slate-500">กรรมการ</p>
                </div>
                <div>
                  <p>...................................................</p>
                  <p className="mt-1 font-medium text-slate-900">
                    ({settings.officers.cashCommittee2 || '-'})
                  </p>
                  <p className="text-slate-500">กรรมการ</p>
                </div>
                <div>
                  <p>...................................................</p>
                  <p className="mt-1 font-medium text-slate-900">
                    ({settings.officers.cashCommittee3 || '-'})
                  </p>
                  <p className="text-slate-500">กรรมการ</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 text-center md:col-span-2">
              <p className="text-slate-600">
                ข้าพเจ้าผู้ได้รับมอบหมายได้รับเงินและเอกสารแทนตัวเงินตามรายละเอียดข้างต้นนี้ไปแล้ว เมื่อวันที่{' '}
                {formatThaiDateFull(selectedDate407)}
              </p>
              <p className="mt-4">
                ลงชื่อ...................................................ผู้รับเงิน
              </p>
              <p className="mt-1 font-medium text-slate-900">
                ({settings.officers.cashReceiver407})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
