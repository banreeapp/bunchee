import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  ACCRUAL_SELECTABLE_LEAVES,
  EXPENSE_CATEGORIES,
  FISCAL_MONTHS,
  INCOME_CATEGORIES,
  resolveAccrualExpenseCode,
} from '../data/pcuCatalog';
import {
  LedgerTransaction,
  PaymentMethod,
  PcuSettings,
  TransactionType,
  TransferDirection,
} from '../types/accounting';
import {
  computeAccountBalances,
  findDuplicateReceiptDocs,
  formatMoney,
  formatMoneyOrDash,
  formatThaiDateShort,
  getCategoryLabel,
  getMonthKey,
  sortTransactionsChronological,
} from '../utils/accountingMath';
import { ConfirmModal } from './ConfirmModal';

interface LedgerWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  onChangeMonth: (monthKey: string) => void;
  onAddTransaction: (tx: Omit<LedgerTransaction, 'id' | 'createdAt'>) => void;
  onUpdateTransaction: (tx: LedgerTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenAiEntry: () => void;
}

export const LedgerWorkspace: React.FC<LedgerWorkspaceProps> = ({
  settings,
  transactions,
  selectedMonthKey,
  onChangeMonth,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onOpenAiEntry,
}) => {
  const [txType, setTxType] = useState<TransactionType>('income');
  const [date, setDate] = useState<string>(`${selectedMonthKey}-01`);
  const [docNo, setDocNo] = useState<string>(
    settings.docPrefixes.receiptBookMain + ' / '
  );
  const [categoryCode, setCategoryCode] = useState<string>('INC_01');
  const [subCategoryCode, setSubCategoryCode] = useState<string>('INC_01_01');
  const [accrualCode, setAccrualCode] = useState<string>('');
  const [isLowValueEquipment, setIsLowValueEquipment] =
    useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [bankAccountId, setBankAccountId] = useState<string>(
    settings.bankAccounts[0]?.id || 'bank-1'
  );
  const [chequeNo, setChequeNo] = useState<string>('');
  const [transferDirection, setTransferDirection] =
    useState<TransferDirection>('cash_to_bank');
  const [projectId, setProjectId] = useState<string>('');
  const [issuerName, setIssuerName] = useState<string>(
    settings.officers.financeOfficer
  );
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const [formNotice, setFormNotice] = useState<string>('');

  // Table Filters
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingDeleteTx, setPendingDeleteTx] =
    useState<LedgerTransaction | null>(null);

  const activeCategoryList =
    txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCategoryGroup = activeCategoryList.find(
    (c) => c.code === categoryCode
  );

  const handleTypeSwitch = (nextType: TransactionType) => {
    setTxType(nextType);
    if (nextType === 'income') {
      setCategoryCode('INC_01');
      setSubCategoryCode('INC_01_01');
      setAccrualCode('');
      setIsLowValueEquipment(false);
      if (!editingTx) setDocNo(`${settings.docPrefixes.receiptBookMain} / `);
    } else if (nextType === 'expense') {
      setCategoryCode('EXP_09');
      setSubCategoryCode('EXP_09_01');
      setAccrualCode('ACC_EXP_05_01');
      if (!editingTx) setDocNo(settings.docPrefixes.expensePrefix);
    } else {
      setCategoryCode('TRANSFER');
      setSubCategoryCode('');
      setAccrualCode('');
      setIsLowValueEquipment(false);
      if (!editingTx) setDocNo('');
    }
  };

  const handleCategoryChange = (nextCatCode: string) => {
    setCategoryCode(nextCatCode);
    const found = activeCategoryList.find((c) => c.code === nextCatCode);
    const nextSub = found?.subItems[0]?.code || '';
    setSubCategoryCode(nextSub);
    if (txType === 'expense') {
      const suggested = resolveAccrualExpenseCode({
        id: '',
        date,
        type: 'expense',
        docNo,
        categoryCode: nextCatCode,
        subCategoryCode: nextSub,
        description,
        amount: 0,
        paymentMethod,
        bankAccountId,
        issuerName,
        createdAt: '',
      });
      setAccrualCode(suggested);
    }
  };

  const accountBalances = useMemo(
    () => computeAccountBalances(settings, transactions),
    [settings, transactions]
  );

  const totalsAllAccounts = useMemo(() => {
    return accountBalances.reduce(
      (acc, snap) => ({
        opening: acc.opening + snap.openingTotal,
        bank: acc.bank + snap.bankBalance,
        cash: acc.cash + snap.cashInHand,
        cheque: acc.cheque + snap.chequeInHand,
        loan: acc.loan + snap.loanAndAdvance,
        total: acc.total + snap.totalBalance,
      }),
      { opening: 0, bank: 0, cash: 0, cheque: 0, loan: 0, total: 0 }
    );
  }, [accountBalances]);

  const monthStats = useMemo(() => {
    const inMonth = transactions.filter(
      (t) => getMonthKey(t.date) === selectedMonthKey && t.type !== 'transfer'
    );
    const income = inMonth
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = inMonth
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense, count: inMonth.length };
  }, [transactions, selectedMonthKey]);

  const duplicateDocs = useMemo(
    () => findDuplicateReceiptDocs(transactions),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const sorted = sortTransactionsChronological(transactions).reverse();
    return sorted.filter((tx) => {
      if (getMonthKey(tx.date) !== selectedMonthKey) return false;
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const catText = getCategoryLabel(
          tx.type,
          tx.categoryCode,
          tx.subCategoryCode
        ).toLowerCase();
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.docNo.toLowerCase().includes(q) ||
          (tx.projectCode || '').toLowerCase().includes(q) ||
          catText.includes(q)
        );
      }
      return true;
    });
  }, [transactions, selectedMonthKey, filterType, searchQuery]);

  const resetForm = () => {
    setEditingTx(null);
    setDescription('');
    setAmount('');
    setChequeNo('');
    setProjectId('');
    setIsLowValueEquipment(false);
    setDocNo(
      txType === 'income'
        ? `${settings.docPrefixes.receiptBookMain} / `
        : txType === 'expense'
        ? settings.docPrefixes.expensePrefix
        : ''
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!date || isNaN(numericAmount) || numericAmount <= 0) {
      setFormNotice('กรุณาระบุวันที่และจำนวนเงินที่มากกว่า 0 บาท');
      return;
    }

    const finalDescription =
      description.trim() ||
      (txType === 'transfer'
        ? transferDirection === 'cash_to_bank'
          ? 'นำเงินสดฝากเข้าบัญชีธนาคาร'
          : 'ถอนเงินสดจากธนาคาร'
        : getCategoryLabel(txType, categoryCode, subCategoryCode));

    const selectedProject = (settings.projects || []).find(
      (p) => p.id === projectId
    );

    const payload: Omit<LedgerTransaction, 'id' | 'createdAt'> = {
      date,
      type: txType,
      docNo: docNo.trim(),
      categoryCode: txType === 'transfer' ? 'TRANSFER' : categoryCode,
      subCategoryCode: txType === 'transfer' ? '' : subCategoryCode,
      accrualCode:
        txType === 'expense' ? accrualCode || undefined : undefined,
      isLowValueEquipment: txType === 'expense' ? isLowValueEquipment : false,
      description: finalDescription,
      amount: numericAmount,
      paymentMethod: txType === 'transfer' ? 'bank' : paymentMethod,
      bankAccountId,
      chequeNo: paymentMethod === 'cheque' ? chequeNo.trim() : '',
      transferDirection:
        txType === 'transfer' ? transferDirection : undefined,
      projectId: selectedProject?.id || '',
      projectCode: selectedProject?.shortName || '',
      issuerName: issuerName.trim() || settings.officers.financeOfficer,
    };

    if (editingTx) {
      onUpdateTransaction({
        ...editingTx,
        ...payload,
      });
      setFormNotice('แก้ไขรายการเรียบร้อยแล้ว');
    } else {
      onAddTransaction(payload);
      setFormNotice('บันทึกรายการลงสมุดรายวันเรียบร้อยแล้ว');
    }
    resetForm();
    setTimeout(() => setFormNotice(''), 3500);
  };

  const handleStartEdit = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setDate(tx.date);
    setDocNo(tx.docNo);
    setCategoryCode(tx.categoryCode);
    setSubCategoryCode(tx.subCategoryCode);
    setAccrualCode(tx.accrualCode || '');
    setIsLowValueEquipment(Boolean(tx.isLowValueEquipment));
    setDescription(tx.description);
    setAmount(String(tx.amount));
    setPaymentMethod(tx.paymentMethod);
    setBankAccountId(tx.bankAccountId);
    setChequeNo(tx.chequeNo || '');
    setTransferDirection(tx.transferDirection || 'cash_to_bank');
    setProjectId(tx.projectId || '');
    setIssuerName(tx.issuerName);
  };

  return (
    <div className="space-y-6">
      {/* Top 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">
            เงินฝากธนาคารรวมทุกบัญชี
          </p>
          <p className="font-mono-num mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatMoney(totalsAllAccounts.bank)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            บาท · {settings.bankAccounts.length} บัญชีธนาคาร
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">เงินสดในมือคงเหลือ</p>
          <p className="font-mono-num mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatMoney(totalsAllAccounts.cash)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            บาท · รวมคงเหลือ {formatMoney(totalsAllAccounts.total)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">
            รายรับเดือนที่เลือก
          </p>
          <p className="font-mono-num mt-1.5 text-2xl font-semibold text-emerald-700 tabular-nums">
            +{formatMoney(monthStats.income)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            บาท ·{' '}
            {FISCAL_MONTHS.find((m) => m.key === selectedMonthKey)?.label || ''}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">
            รายจ่ายเดือนที่เลือก
          </p>
          <p className="font-mono-num mt-1.5 text-2xl font-semibold text-rose-700 tabular-nums">
            -{formatMoney(monthStats.expense)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            บาท · ส่วนต่าง {monthStats.net >= 0 ? '+' : ''}
            {formatMoney(monthStats.net)}
          </p>
        </div>
      </div>

      {/* Bank Accounts Balance Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              ยอดเงินคงเหลือแยกตามบัญชีธนาคาร
            </h2>
            <p className="text-xs text-slate-500">
              คำนวณจากยอดยกมาต้นปีงบประมาณ {settings.fiscalYearBE} และรายการรับ-จ่ายสะสมทั้งหมด
            </p>
          </div>
          {duplicateDocs.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>พบเลขที่ใบเสร็จซ้ำ: {duplicateDocs.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-2.5 font-semibold">บัญชีธนาคาร</th>
                <th className="px-4 py-2.5 text-right font-semibold">ยกมา</th>
                <th className="px-4 py-2.5 text-right font-semibold">เงินในธนาคาร</th>
                <th className="px-4 py-2.5 text-right font-semibold">เช็คในมือ</th>
                <th className="px-4 py-2.5 text-right font-semibold">เงินสดในมือ</th>
                <th className="px-4 py-2.5 text-right font-semibold">เงินยืม+สำรอง</th>
                <th className="px-4 py-2.5 text-right font-semibold">คงเหลือรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accountBalances.map((snap) => (
                <tr key={snap.account.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    ธ.{snap.account.order} {snap.account.name}{' '}
                    <span className="font-mono-num text-slate-500">
                      ({snap.account.accountNo})
                    </span>
                  </td>
                  <td className="font-mono-num px-4 py-2.5 text-right text-slate-600 tabular-nums">
                    {formatMoney(snap.openingTotal)}
                  </td>
                  <td className="font-mono-num px-4 py-2.5 text-right text-slate-900 tabular-nums">
                    {formatMoneyOrDash(snap.bankBalance)}
                  </td>
                  <td className="font-mono-num px-4 py-2.5 text-right text-slate-600 tabular-nums">
                    {formatMoneyOrDash(snap.chequeInHand)}
                  </td>
                  <td className="font-mono-num px-4 py-2.5 text-right text-slate-900 tabular-nums">
                    {formatMoneyOrDash(snap.cashInHand)}
                  </td>
                  <td className="font-mono-num px-4 py-2.5 text-right text-slate-600 tabular-nums">
                    {formatMoneyOrDash(snap.loanAndAdvance)}
                  </td>
                  <td className="font-mono-num px-4 py-2.5 text-right font-semibold text-teal-800 tabular-nums">
                    {formatMoney(snap.totalBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-2.5">รวมทุกบัญชี</td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(totalsAllAccounts.opening)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(totalsAllAccounts.bank)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {formatMoneyOrDash(totalsAllAccounts.cheque)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(totalsAllAccounts.cash)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right tabular-nums">
                  {formatMoneyOrDash(totalsAllAccounts.loan)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right text-teal-800 tabular-nums">
                  {formatMoney(totalsAllAccounts.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Daily Entry Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingTx ? 'แก้ไขรายการบัญชี' : 'บันทึกรายรับ - รายจ่าย ประจำวัน'}
            </h2>
            <p className="text-xs text-slate-500">
              จัดหมวดหมู่ตามมาตรฐาน PCU Money ออกรายงานเกณฑ์เงินสด, เกณฑ์คงค้าง, หน้างบใบสำคัญ, แบบ 401/404/407 และคุมโครงการ/402/404 ย่อย
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAiEntry}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>ให้ AI อ่านใบเสร็จ/สลิปลงบัญชี</span>
          </button>
        </div>

        {/* Segmented Type Selector */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleTypeSwitch('income')}
              className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                txType === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายรับเงินบำรุง
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('expense')}
              className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                txType === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายจ่ายเงินบำรุง
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('transfer')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                txType === 'transfer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>ฝาก - ถอนเงินสด</span>
            </button>
          </div>

          {formNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
              <CheckCircle2 className="h-4 w-4" />
              {formNotice}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              วันที่รายการ
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              required
            />
          </div>

          {txType === 'transfer' ? (
            <div className="md:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                ประเภทการโอนย้ายเงินสด-ธนาคาร
              </label>
              <select
                value={transferDirection}
                onChange={(e) =>
                  setTransferDirection(e.target.value as TransferDirection)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="cash_to_bank">
                  ฝากเงินสดเข้าบัญชีธนาคาร (เงินสดลด / ธนาคารเพิ่ม)
                </option>
                <option value="bank_to_cash">
                  ถอนเงินจากธนาคารเป็นเงินสด (ธนาคารลด / เงินสดเพิ่ม)
                </option>
              </select>
            </div>
          ) : (
            <>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  หมวดหลัก ({txType === 'income' ? 'รายรับ' : 'รายจ่าย'})
                </label>
                <select
                  value={categoryCode}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  {activeCategoryList.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  หมวดย่อยตามงบเดือน
                </label>
                <select
                  value={subCategoryCode}
                  onChange={(e) => setSubCategoryCode(e.target.value)}
                  disabled={
                    !selectedCategoryGroup ||
                    selectedCategoryGroup.subItems.length === 0
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:border-teal-600 focus:outline-none"
                >
                  {selectedCategoryGroup &&
                  selectedCategoryGroup.subItems.length > 0 ? (
                    selectedCategoryGroup.subItems.map((sub) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.name}
                      </option>
                    ))
                  ) : (
                    <option value="">— ไม่มีหมวดย่อย —</option>
                  )}
                </select>
              </div>
            </>
          )}

          <div className={txType === 'transfer' ? 'md:col-span-3' : 'md:col-span-2'}>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              เลขที่เอกสาร / ใบสำคัญ
            </label>
            <input
              type="text"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              placeholder={
                txType === 'income' ? 'สบ./ดพ.041 / 04 - 04' : 'สบ1133.6.2/100'
              }
              className="font-mono-num w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className={txType === 'transfer' ? 'md:col-span-3' : 'md:col-span-2'}>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              จำนวนเงิน (บาท)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono-num w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              รายละเอียดรายการ (แสดงในแบบ 401 / 404 / หน้างบใบสำคัญ)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="เช่น ค่าไฟฟ้า 11/69 หรือ จ้างเหมาบริการทำความสะอาด"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              บัญชีธนาคาร
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              {settings.bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  ธ.{b.order} {b.name}
                </option>
              ))}
            </select>
          </div>

          {txType !== 'transfer' && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                ช่องทางเงิน
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="cash">เงินสด</option>
                <option value="bank">เงินโอน / e-Pay</option>
                <option value="cheque">จ่าย/รับเช็ค</option>
              </select>
            </div>
          )}

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              โครงการ / 402 / 404 ย่อย
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              <option value="">— เงินบำรุงทั่วไป (ไม่ระบุโครงการ) —</option>
              {(settings.projects || []).map((proj) => (
                <option key={proj.id} value={proj.id}>
                  [{proj.order}] {proj.shortName}
                </option>
              ))}
            </select>
          </div>

          {paymentMethod === 'cheque' && txType !== 'transfer' && (
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                เลขที่เช็ค
              </label>
              <input
                type="text"
                value={chequeNo}
                onChange={(e) => setChequeNo(e.target.value)}
                placeholder="เช่น 61438793"
                className="font-mono-num w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          )}

          {txType === 'expense' && (
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                หมวดย่อยระบบเกณฑ์คงค้าง (สำหรับรายงานระบบเกณฑ์คงค้าง)
              </label>
              <select
                value={accrualCode}
                onChange={(e) => setAccrualCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="">— จัดหมวดเกณฑ์คงค้างอัตโนมัติ —</option>
                {ACCRUAL_SELECTABLE_LEAVES.map((node) => (
                  <option key={node.code} value={node.code}>
                    {node.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {txType === 'expense' && (
            <div className="flex items-end pb-2 md:col-span-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isLowValueEquipment}
                  onChange={(e) => setIsLowValueEquipment(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                <span>เป็นครุภัณฑ์ต่ำกว่า 10,000 บาท</span>
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 md:col-span-12">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>ผู้บันทึก/ผู้ออกใบเสร็จ:</span>
              <input
                type="text"
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              {editingTx && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิกแก้ไข
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                <span>{editingTx ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Transactions Ledger Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              ประวัติรายการรับ - จ่าย
            </h2>
            <select
              value={selectedMonthKey}
              onChange={(e) => {
                onChangeMonth(e.target.value);
                setDate(`${e.target.value}-01`);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              {FISCAL_MONTHS.map((m) => (
                <option key={m.key} value={m.key}>
                  เดือน{m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`whitespace-nowrap rounded-md px-3 py-1 font-medium ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setFilterType('income')}
                className={`whitespace-nowrap rounded-md px-3 py-1 font-medium ${
                  filterType === 'income'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                รายรับ
              </button>
              <button
                type="button"
                onClick={() => setFilterType('expense')}
                className={`whitespace-nowrap rounded-md px-3 py-1 font-medium ${
                  filterType === 'expense'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                รายจ่าย
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารายการ / เลขที่เอกสาร"
                className="w-52 rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              ไม่มีรายการรับ-จ่ายในเดือนที่เลือก
            </p>
            <p className="mt-1 text-xs text-slate-500">
              กรอกข้อมูลจากแบบฟอร์มด้านบน หรือใช้ AI ช่วยอ่านใบเสร็จเพื่อเพิ่มรายการแรกของเดือน
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-2.5 font-semibold">วันที่</th>
                  <th className="px-4 py-2.5 font-semibold">เลขที่เอกสาร</th>
                  <th className="px-4 py-2.5 font-semibold">หมวดหมู่ / โครงการ</th>
                  <th className="px-4 py-2.5 font-semibold">รายการ</th>
                  <th className="px-4 py-2.5 font-semibold">ช่องทาง / บัญชี</th>
                  <th className="px-4 py-2.5 text-right font-semibold">รายรับ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">รายจ่าย</th>
                  <th className="px-4 py-2.5 text-right font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const bank = settings.bankAccounts.find(
                    (b) => b.id === tx.bankAccountId
                  );
                  const payLabel =
                    tx.paymentMethod === 'cash'
                      ? 'เงินสด'
                      : tx.paymentMethod === 'cheque'
                      ? `เช็ค ${tx.chequeNo || ''}`
                      : 'โอน/e-Pay';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                        {formatThaiDateShort(tx.date)}
                      </td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {tx.docNo || '—'}
                      </td>
                      <td className="max-w-[230px] truncate px-4 py-2.5 text-slate-600">
                        {getCategoryLabel(
                          tx.type,
                          tx.categoryCode,
                          tx.subCategoryCode
                        )}
                        {tx.projectCode ? ` · ${tx.projectCode}` : ''}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {tx.description}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                        {payLabel} · ธ.{bank?.order || 1}
                      </td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-right font-medium text-emerald-700 tabular-nums">
                        {tx.type === 'income' ? formatMoney(tx.amount) : ''}
                      </td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-right font-medium text-rose-700 tabular-nums">
                        {tx.type === 'expense' ? formatMoney(tx.amount) : ''}
                        {tx.type === 'transfer' ? (
                          <span className="text-slate-600">
                            ({formatMoney(tx.amount)})
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tx)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="แก้ไข"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteTx(tx)}
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="ลบรายการ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(pendingDeleteTx)}
        title="ยืนยันการลบรายการบัญชี"
        description={`คุณต้องการลบรายการ "${pendingDeleteTx?.description || ''}" จำนวน ${
          pendingDeleteTx ? formatMoney(pendingDeleteTx.amount) : '0.00'
        } บาท ออกจากสมุดรายวันใช่หรือไม่?`}
        details={
          pendingDeleteTx
            ? [
                `วันที่: ${formatThaiDateShort(pendingDeleteTx.date)}`,
                `เลขที่เอกสาร: ${pendingDeleteTx.docNo || 'ไม่ระบุ'}`,
                'ยอดคงเหลือในแบบ 401, 404, 407, หน้างบใบสำคัญ และงบเดือนจะถูกคำนวณใหม่ทันที',
              ]
            : undefined
        }
        confirmLabel="ลบรายการ"
        variant="danger"
        onCancel={() => setPendingDeleteTx(null)}
        onConfirm={() => {
          if (pendingDeleteTx) {
            onDeleteTransaction(pendingDeleteTx.id);
            setPendingDeleteTx(null);
          }
        }}
      />
    </div>
  );
};
