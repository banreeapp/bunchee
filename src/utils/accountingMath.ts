import {
  ACCRUAL_EXPENSE_NODES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  resolveAccrualExpenseCode,
} from '../data/pcuCatalog';
import {
  AccountBalanceSnapshot,
  LedgerTransaction,
  PcuSettings,
  ProjectBalanceSnapshot,
} from '../types/accounting';

const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const THAI_WEEKDAYS = [
  'อาทิตย์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
];

export function formatMoney(val: number): string {
  return val.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyOrDash(val: number): string {
  if (Math.abs(val) < 0.005) return '-';
  return formatMoney(val);
}

export function formatThaiDateFull(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

export function formatThaiDateWithWeekday(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  const weekday = THAI_WEEKDAYS[dt.getDay()];
  return `วัน${weekday} ที่ ${d} ${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

export function formatThaiDateShort(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const beShort = String(y + 543).slice(-2);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${beShort}`;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function getThaiMonthShort(dateStr: string): string {
  const m = Number(dateStr.slice(5, 7));
  return THAI_MONTHS_SHORT[m - 1] || '';
}

export function getThaiMonthFull(dateStr: string): string {
  const m = Number(dateStr.slice(5, 7));
  return THAI_MONTHS_FULL[m - 1] || '';
}

export function getThaiYearBE(dateStr: string): number {
  return Number(dateStr.slice(0, 4)) + 543;
}

export function getMonthDateRangeLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const lastDay = new Date(y, m, 0).getDate();
  const monthName = THAI_MONTHS_FULL[m - 1] || '';
  const beYear = y + 543;
  return `1 ${monthName} ${beYear} ถึง ${lastDay} ${monthName} ${beYear}`;
}

export function bahtText(num: number): string {
  if (isNaN(num)) return 'ศูนย์บาทถ้วน';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const [intPartStr, decPartStr] = absNum.toFixed(2).split('.');

  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const readGroup = (str: string): string => {
    let result = '';
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const n = Number(str[i]);
      const pos = len - i - 1;
      if (n === 0) continue;
      if (pos === 1 && n === 1) {
        result += 'สิบ';
      } else if (pos === 1 && n === 2) {
        result += 'ยี่สิบ';
      } else if (pos === 0 && n === 1 && len > 1 && str[len - 2] !== '0') {
        result += 'เอ็ด';
      } else {
        result += digits[n] + units[pos];
      }
    }
    return result;
  };

  let bahtStr = '';
  if (Number(intPartStr) === 0) {
    bahtStr = 'ศูนย์';
  } else {
    let remaining = intPartStr;
    const chunks: string[] = [];
    while (remaining.length > 0) {
      chunks.unshift(remaining.slice(-6));
      remaining = remaining.slice(0, -6);
    }
    bahtStr = chunks
      .map((chunk, idx) => {
        const text = readGroup(chunk);
        const isLast = idx === chunks.length - 1;
        return text + (!isLast && text ? 'ล้าน' : '');
      })
      .join('');
  }

  let satangStr = 'ถ้วน';
  if (Number(decPartStr) > 0) {
    satangStr = readGroup(decPartStr) + 'สตางค์';
  }

  return `${isNegative ? 'ลบ' : ''}${bahtStr}บาท${satangStr}`;
}

export function getCategoryLabel(
  type: LedgerTransaction['type'],
  categoryCode: string,
  subCategoryCode?: string
): string {
  if (type === 'transfer') return 'ฝาก-ถอนเงินสด';
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const cat = list.find((c) => c.code === categoryCode);
  if (!cat) return categoryCode || '-';
  if (subCategoryCode) {
    const sub = cat.subItems.find((s) => s.code === subCategoryCode);
    if (sub) return `${cat.shortLabel} · ${sub.name}`;
  }
  return cat.name;
}

export function sortTransactionsChronological(
  transactions: LedgerTransaction[]
): LedgerTransaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function computeAccountBalances(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  upToDate?: string
): AccountBalanceSnapshot[] {
  const filtered = upToDate
    ? transactions.filter((t) => t.date <= upToDate)
    : transactions;

  return settings.bankAccounts.map((acc) => {
    const openingTotal =
      acc.openingBank +
      acc.openingCash +
      acc.openingLoan +
      acc.openingAdvance +
      acc.openingCheque;

    let bankBalance = acc.openingBank;
    let cashInHand = acc.openingCash;
    const chequeInHand = acc.openingCheque;
    const loanAndAdvance = acc.openingLoan + acc.openingAdvance;

    for (const tx of filtered) {
      if (tx.bankAccountId !== acc.id) continue;
      if (tx.type === 'income') {
        if (tx.paymentMethod === 'cash') {
          cashInHand += tx.amount;
        } else {
          bankBalance += tx.amount;
        }
      } else if (tx.type === 'expense') {
        if (tx.paymentMethod === 'cash') {
          cashInHand -= tx.amount;
        } else {
          bankBalance -= tx.amount;
        }
      } else if (tx.type === 'transfer') {
        if (tx.transferDirection === 'cash_to_bank') {
          cashInHand -= tx.amount;
          bankBalance += tx.amount;
        } else if (tx.transferDirection === 'bank_to_cash') {
          bankBalance -= tx.amount;
          cashInHand += tx.amount;
        }
      }
    }

    const totalBalance = bankBalance + cashInHand + chequeInHand + loanAndAdvance;
    return {
      account: acc,
      openingTotal,
      bankBalance,
      cashInHand,
      chequeInHand,
      loanAndAdvance,
      totalBalance,
    };
  });
}

export function getOpeningTotalAllAccounts(settings: PcuSettings): number {
  return settings.bankAccounts.reduce(
    (sum, acc) =>
      sum +
      acc.openingBank +
      acc.openingCash +
      acc.openingLoan +
      acc.openingAdvance +
      acc.openingCheque,
    0
  );
}

// Compute Project / 402 / 404 Balances
export function computeProjectBalances(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey?: string
): ProjectBalanceSnapshot[] {
  const projects = settings.projects || [];
  return projects.map((project) => {
    const related = transactions.filter(
      (tx) =>
        tx.type !== 'transfer' &&
        (tx.projectId === project.id ||
          (tx.projectCode && tx.projectCode === project.shortName))
    );

    const monthTxs = monthKey
      ? related.filter((tx) => getMonthKey(tx.date) === monthKey)
      : related;
    const ytdTxs = monthKey
      ? related.filter((tx) => getMonthKey(tx.date) <= monthKey)
      : related;

    const receivedMonth = monthTxs
      .filter((tx) => tx.type === 'income')
      .reduce((s, tx) => s + tx.amount, 0);
    const spentMonth = monthTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((s, tx) => s + tx.amount, 0);

    const receivedYtd = ytdTxs
      .filter((tx) => tx.type === 'income')
      .reduce((s, tx) => s + tx.amount, 0);
    const spentYtd = ytdTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((s, tx) => s + tx.amount, 0);

    return {
      project,
      receivedMonth,
      spentMonth,
      receivedYtd,
      spentYtd,
      remainingBalance: project.openingBalance + receivedYtd - spentYtd,
      hasTransactions: related.length > 0,
    };
  });
}

// Compute Form 404
export interface Form404Row {
  tx: LedgerTransaction;
  incomeAmount: number;
  expenseAmount: number;
  runningBalance: number;
}

export interface Form404Report {
  openingFromPrevMonth: number;
  openingFiscalYear: number;
  rows: Form404Row[];
  monthIncome: number;
  monthExpense: number;
  monthClosing: number;
  ytdIncome: number;
  ytdExpense: number;
  ytdClosing: number;
}

export function computeForm404(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey: string
): Form404Report {
  const sorted = sortTransactionsChronological(transactions).filter(
    (t) => t.type !== 'transfer'
  );
  const openingFiscalYear = getOpeningTotalAllAccounts(settings);

  const beforeMonth = sorted.filter((t) => getMonthKey(t.date) < monthKey);
  const inMonth = sorted.filter((t) => getMonthKey(t.date) === monthKey);
  const upToMonth = sorted.filter((t) => getMonthKey(t.date) <= monthKey);

  const priorNet = beforeMonth.reduce(
    (acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount),
    0
  );
  const openingFromPrevMonth = openingFiscalYear + priorNet;

  let running = openingFromPrevMonth;
  const rows: Form404Row[] = inMonth.map((tx) => {
    const incomeAmount = tx.type === 'income' ? tx.amount : 0;
    const expenseAmount = tx.type === 'expense' ? tx.amount : 0;
    running += incomeAmount - expenseAmount;
    return {
      tx,
      incomeAmount,
      expenseAmount,
      runningBalance: running,
    };
  });

  const monthIncome = rows.reduce((s, r) => s + r.incomeAmount, 0);
  const monthExpense = rows.reduce((s, r) => s + r.expenseAmount, 0);
  const monthClosing = openingFromPrevMonth + monthIncome - monthExpense;

  const ytdIncome = upToMonth
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const ytdExpense = upToMonth
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const ytdClosing = openingFiscalYear + ytdIncome - ytdExpense;

  return {
    openingFromPrevMonth,
    openingFiscalYear,
    rows,
    monthIncome,
    monthExpense,
    monthClosing,
    ytdIncome,
    ytdExpense,
    ytdClosing,
  };
}

// Compute Form 401
export interface Form401DayBlock {
  date: string;
  openingBalance: number;
  incomes: LedgerTransaction[];
  expenses: LedgerTransaction[];
  closingBalance: number;
  totalSide: number;
}

export function computeForm401(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey: string
): Form401DayBlock[] {
  const sorted = sortTransactionsChronological(transactions).filter(
    (t) => t.type !== 'transfer'
  );
  const openingFiscalYear = getOpeningTotalAllAccounts(settings);

  const beforeMonth = sorted.filter((t) => getMonthKey(t.date) < monthKey);
  let runningBalance =
    openingFiscalYear +
    beforeMonth.reduce(
      (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
      0
    );

  const inMonth = sorted.filter((t) => getMonthKey(t.date) === monthKey);
  const uniqueDates = Array.from(new Set(inMonth.map((t) => t.date))).sort();

  return uniqueDates.map((date) => {
    const dayTxs = inMonth.filter((t) => t.date === date);
    const incomes = dayTxs.filter((t) => t.type === 'income');
    const expenses = dayTxs.filter((t) => t.type === 'expense');

    const dayIncomeSum = incomes.reduce((s, t) => s + t.amount, 0);
    const dayExpenseSum = expenses.reduce((s, t) => s + t.amount, 0);
    const opening = runningBalance;
    const closing = opening + dayIncomeSum - dayExpenseSum;
    runningBalance = closing;

    return {
      date,
      openingBalance: opening,
      incomes,
      expenses,
      closingBalance: closing,
      totalSide: opening + dayIncomeSum,
    };
  });
}

// Standard Monthly Income & Expense Statement (13 หมวดรับ / 14 หมวดจ่าย)
export interface MonthlyCategoryRow {
  code: string;
  label: string;
  isSubItem: boolean;
  monthAmount: number;
  ytdAmount: number;
}

export interface MonthlyStatementReport {
  incomeRows: MonthlyCategoryRow[];
  expenseRows: MonthlyCategoryRow[];
  totalMonthIncome: number;
  totalYtdIncome: number;
  totalMonthExpense: number;
  totalYtdExpense: number;
  monthNetDiff: number;
  ytdNetDiff: number;
  openingFromPrevMonth: number;
  openingFiscalYear: number;
  closingMonthBalance: number;
  closingYtdBalance: number;
}

export function computeMonthlyStatement(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey: string
): MonthlyStatementReport {
  const validTxs = transactions.filter((t) => t.type !== 'transfer');
  const inMonth = validTxs.filter((t) => getMonthKey(t.date) === monthKey);
  const upToMonth = validTxs.filter((t) => getMonthKey(t.date) <= monthKey);
  const beforeMonth = validTxs.filter((t) => getMonthKey(t.date) < monthKey);

  const sumBy = (
    list: LedgerTransaction[],
    type: 'income' | 'expense',
    catCode: string,
    subCode?: string
  ) =>
    list
      .filter(
        (t) =>
          t.type === type &&
          t.categoryCode === catCode &&
          (subCode ? t.subCategoryCode === subCode : true)
      )
      .reduce((s, t) => s + t.amount, 0);

  const incomeRows: MonthlyCategoryRow[] = [];
  for (const cat of INCOME_CATEGORIES) {
    incomeRows.push({
      code: cat.code,
      label: cat.name,
      isSubItem: false,
      monthAmount: sumBy(inMonth, 'income', cat.code),
      ytdAmount: sumBy(upToMonth, 'income', cat.code),
    });
    for (const sub of cat.subItems) {
      incomeRows.push({
        code: sub.code,
        label: sub.name,
        isSubItem: true,
        monthAmount: sumBy(inMonth, 'income', cat.code, sub.code),
        ytdAmount: sumBy(upToMonth, 'income', cat.code, sub.code),
      });
    }
  }

  const expenseRows: MonthlyCategoryRow[] = [];
  for (const cat of EXPENSE_CATEGORIES) {
    expenseRows.push({
      code: cat.code,
      label: cat.name,
      isSubItem: false,
      monthAmount: sumBy(inMonth, 'expense', cat.code),
      ytdAmount: sumBy(upToMonth, 'expense', cat.code),
    });
    for (const sub of cat.subItems) {
      expenseRows.push({
        code: sub.code,
        label: sub.name,
        isSubItem: true,
        monthAmount: sumBy(inMonth, 'expense', cat.code, sub.code),
        ytdAmount: sumBy(upToMonth, 'expense', cat.code, sub.code),
      });
    }
  }

  const totalMonthIncome = inMonth
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const totalYtdIncome = upToMonth
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalMonthExpense = inMonth
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalYtdExpense = upToMonth
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const openingFiscalYear = getOpeningTotalAllAccounts(settings);
  const priorNet = beforeMonth.reduce(
    (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
    0
  );
  const openingFromPrevMonth = openingFiscalYear + priorNet;

  const monthNetDiff = totalMonthIncome - totalMonthExpense;
  const ytdNetDiff = totalYtdIncome - totalYtdExpense;
  const closingMonthBalance = openingFromPrevMonth + monthNetDiff;
  const closingYtdBalance = openingFiscalYear + ytdNetDiff;

  return {
    incomeRows,
    expenseRows,
    totalMonthIncome,
    totalYtdIncome,
    totalMonthExpense,
    totalYtdExpense,
    monthNetDiff,
    ytdNetDiff,
    openingFromPrevMonth,
    openingFiscalYear,
    closingMonthBalance,
    closingYtdBalance,
  };
}

// Accrual-Basis Income & Expense Report (ระบบเกณฑ์คงค้าง)
export interface AccrualExpenseRow {
  code: string;
  label: string;
  level: 1 | 2 | 3;
  monthAmount: number | null; // null สำหรับหัวข้อหมวด 3. หมวดค่าใช้สอย ที่ไม่ใส่ยอดบรรทัดหัวข้อ
  ytdAmount: number | null;
}

export interface AccrualStatementReport {
  incomeRows: MonthlyCategoryRow[];
  expenseRows: AccrualExpenseRow[];
  totalMonthIncome: number;
  totalYtdIncome: number;
  totalMonthExpense: number;
  totalYtdExpense: number;
  monthNetDiff: number;
  ytdNetDiff: number;
  openingFromPrevMonth: number;
  openingFiscalYear: number;
  closingMonthBalance: number;
  closingYtdBalance: number;
  projectRemainingTotal: number;
  nonProjectRemainingTotal: number;
  lowValueEquipmentMonth: number;
  lowValueEquipmentYtd: number;
}

export function computeAccrualStatement(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey: string
): AccrualStatementReport {
  const std = computeMonthlyStatement(settings, transactions, monthKey);
  const validExpenses = transactions.filter((t) => t.type === 'expense');
  const inMonthExp = validExpenses.filter((t) => getMonthKey(t.date) === monthKey);
  const upToMonthExp = validExpenses.filter((t) => getMonthKey(t.date) <= monthKey);

  const monthByLeaf = new Map<string, number>();
  const ytdByLeaf = new Map<string, number>();

  for (const tx of inMonthExp) {
    const code = resolveAccrualExpenseCode(tx);
    monthByLeaf.set(code, (monthByLeaf.get(code) || 0) + tx.amount);
  }
  for (const tx of upToMonthExp) {
    const code = resolveAccrualExpenseCode(tx);
    ytdByLeaf.set(code, (ytdByLeaf.get(code) || 0) + tx.amount);
  }

  const sumPrefix = (map: Map<string, number>, prefix: string) => {
    let total = 0;
    for (const [k, v] of map.entries()) {
      if (k === prefix || k.startsWith(`${prefix}_`)) {
        total += v;
      }
    }
    return total;
  };

  const expenseRows: AccrualExpenseRow[] = ACCRUAL_EXPENSE_NODES.map((node) => {
    // หมวด 3. หมวดค่าใช้สอย และ 11. ค่าใช้จ่ายอื่น ๆ (ในตัวอย่างภาพแสดงช่องยอดว่างตรงหัวหมวดหลักแล้วแตกย่อยด้านล่าง)
    if (node.code === 'ACC_EXP_03' || node.code === 'ACC_EXP_11') {
      return {
        code: node.code,
        label: node.label,
        level: node.level,
        monthAmount: null,
        ytdAmount: null,
      };
    }
    return {
      code: node.code,
      label: node.label,
      level: node.level,
      monthAmount: sumPrefix(monthByLeaf, node.code),
      ytdAmount: sumPrefix(ytdByLeaf, node.code),
    };
  });

  const projectSnapshots = computeProjectBalances(settings, transactions, monthKey);
  const projectRemainingTotal = projectSnapshots.reduce(
    (s, p) => s + p.remainingBalance,
    0
  );
  const nonProjectRemainingTotal = std.closingMonthBalance - projectRemainingTotal;

  const lowValueEquipmentMonth = inMonthExp
    .filter((t) => t.isLowValueEquipment)
    .reduce((s, t) => s + t.amount, 0);
  const lowValueEquipmentYtd = upToMonthExp
    .filter((t) => t.isLowValueEquipment)
    .reduce((s, t) => s + t.amount, 0);

  return {
    incomeRows: std.incomeRows,
    expenseRows,
    totalMonthIncome: std.totalMonthIncome,
    totalYtdIncome: std.totalYtdIncome,
    totalMonthExpense: std.totalMonthExpense,
    totalYtdExpense: std.totalYtdExpense,
    monthNetDiff: std.monthNetDiff,
    ytdNetDiff: std.ytdNetDiff,
    openingFromPrevMonth: std.openingFromPrevMonth,
    openingFiscalYear: std.openingFiscalYear,
    closingMonthBalance: std.closingMonthBalance,
    closingYtdBalance: std.closingYtdBalance,
    projectRemainingTotal,
    nonProjectRemainingTotal,
    lowValueEquipmentMonth,
    lowValueEquipmentYtd,
  };
}

// Voucher Cover Summary (หน้างบใบสำคัญ)
export interface VoucherSummaryGroup {
  groupTitle: string;
  items: Array<{
    id: string;
    docNo: string;
    description: string;
    amount: number;
  }>;
  subtotal: number;
}

export interface VoucherSummaryReport {
  groups: VoucherSummaryGroup[];
  grandTotal: number;
}

function getVoucherGroupName(tx: LedgerTransaction): string {
  switch (tx.categoryCode) {
    case 'EXP_01':
      return 'ค่าจ้าง';
    case 'EXP_02':
      return 'ค่าตอบแทน';
    case 'EXP_03':
    case 'EXP_04':
    case 'EXP_06':
    case 'EXP_07':
      return 'ค่าใช้สอย';
    case 'EXP_05':
      return 'ค่าใช้จ่ายตามโครงการ';
    case 'EXP_08':
      return 'ค่าวัสดุ';
    case 'EXP_09':
      return 'ค่าสาธารณูปโภค';
    case 'EXP_10':
      return 'ค่าครุภัณฑ์';
    case 'EXP_11':
      return 'เงินสมทบประกันสังคม / กองทุน';
    case 'EXP_12':
      return 'เงินโอนระหว่าง รพ.สต. / สสอ.';
    case 'EXP_13':
      return 'นำส่งสรรพากร';
    default:
      return 'ค่าใช้จ่ายอื่น ๆ';
  }
}

export function computeVoucherSummary(
  transactions: LedgerTransaction[],
  monthKey: string
): VoucherSummaryReport {
  const expenses = sortTransactionsChronological(transactions).filter(
    (t) => t.type === 'expense' && getMonthKey(t.date) === monthKey
  );

  const groupMap = new Map<string, VoucherSummaryGroup>();
  for (const tx of expenses) {
    const groupTitle = getVoucherGroupName(tx);
    if (!groupMap.has(groupTitle)) {
      groupMap.set(groupTitle, {
        groupTitle,
        items: [],
        subtotal: 0,
      });
    }
    const g = groupMap.get(groupTitle)!;
    g.items.push({
      id: tx.id,
      docNo: tx.docNo || '-',
      description: tx.description,
      amount: tx.amount,
    });
    g.subtotal += tx.amount;
  }

  const groups = Array.from(groupMap.values());
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  return { groups, grandTotal };
}

// Compute Form 407
export interface Form407Snapshot {
  date: string;
  cashInHand: number;
  chequeInHand: number;
  advanceReceipt: number;
  loanContract: number;
  accountSnapshots: AccountBalanceSnapshot[];
  grandTotal: number;
  grandTotalThaiText: string;
  dayCashIncome: number;
  dayBankIncome: number;
  dayWithholdingDeposit: number;
  dayCashExpense: number;
  dayChequeExpense: number;
  dayBankExpense: number;
  dayCashDeposit: number;
  dayCashWithdraw: number;
}

export function computeForm407(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  date: string
): Form407Snapshot {
  const accountSnapshots = computeAccountBalances(settings, transactions, date);

  const cashInHand = accountSnapshots.reduce((s, a) => s + a.cashInHand, 0);
  const chequeInHand = accountSnapshots.reduce((s, a) => s + a.chequeInHand, 0);
  const advanceReceipt = settings.bankAccounts.reduce(
    (s, a) => s + a.openingAdvance,
    0
  );
  const loanContract = settings.bankAccounts.reduce(
    (s, a) => s + a.openingLoan,
    0
  );
  const grandTotal = accountSnapshots.reduce((s, a) => s + a.totalBalance, 0);

  const dayTxs = transactions.filter((t) => t.date === date);
  const dayCashIncome = dayTxs
    .filter((t) => t.type === 'income' && t.paymentMethod === 'cash')
    .reduce((s, t) => s + t.amount, 0);
  const dayBankIncome = dayTxs
    .filter(
      (t) =>
        t.type === 'income' &&
        t.paymentMethod !== 'cash' &&
        t.categoryCode !== 'INC_08' &&
        t.categoryCode !== 'INC_07'
    )
    .reduce((s, t) => s + t.amount, 0);
  const dayWithholdingDeposit = dayTxs
    .filter(
      (t) =>
        t.type === 'income' &&
        t.paymentMethod !== 'cash' &&
        (t.categoryCode === 'INC_08' || t.categoryCode === 'INC_07')
    )
    .reduce((s, t) => s + t.amount, 0);

  const dayCashExpense = dayTxs
    .filter((t) => t.type === 'expense' && t.paymentMethod === 'cash')
    .reduce((s, t) => s + t.amount, 0);
  const dayChequeExpense = dayTxs
    .filter((t) => t.type === 'expense' && t.paymentMethod === 'cheque')
    .reduce((s, t) => s + t.amount, 0);
  const dayBankExpense = dayTxs
    .filter((t) => t.type === 'expense' && t.paymentMethod === 'bank')
    .reduce((s, t) => s + t.amount, 0);

  const dayCashDeposit = dayTxs
    .filter(
      (t) => t.type === 'transfer' && t.transferDirection === 'cash_to_bank'
    )
    .reduce((s, t) => s + t.amount, 0);
  const dayCashWithdraw = dayTxs
    .filter(
      (t) => t.type === 'transfer' && t.transferDirection === 'bank_to_cash'
    )
    .reduce((s, t) => s + t.amount, 0);

  return {
    date,
    cashInHand,
    chequeInHand,
    advanceReceipt,
    loanContract,
    accountSnapshots,
    grandTotal,
    grandTotalThaiText: bahtText(grandTotal),
    dayCashIncome,
    dayBankIncome,
    dayWithholdingDeposit,
    dayCashExpense,
    dayChequeExpense,
    dayBankExpense,
    dayCashDeposit,
    dayCashWithdraw,
  };
}

export function findDuplicateReceiptDocs(
  transactions: LedgerTransaction[]
): string[] {
  const seen = new Map<string, number>();
  for (const tx of transactions) {
    const doc = tx.docNo.trim();
    if (!doc || tx.type !== 'income') continue;
    seen.set(doc, (seen.get(doc) || 0) + 1);
  }
  return Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([doc]) => doc);
}

// ==========================================
// สรุปรายรับ - รายจ่าย (Summary & Pivot Reports)
// ==========================================

export type ProjectScopeFilter = 'all' | 'exclude_project' | 'only_project';

export const MAJOR_EXPENSE_BUCKETS = [
  { key: 'temp_wage', label: 'ค่าจ้างชั่วคราว', codes: ['EXP_01'] },
  { key: 'compensation', label: 'ค่าตอบแทน', codes: ['EXP_02'] },
  {
    key: 'services',
    label: 'ค่าใช้สอย',
    codes: ['EXP_03', 'EXP_04', 'EXP_06', 'EXP_07'],
  },
  { key: 'materials', label: 'ค่าวัสดุ', codes: ['EXP_08'] },
  { key: 'utilities', label: 'ค่าสาธารณูปโภค', codes: ['EXP_09'] },
  { key: 'equipment', label: 'ค่าครุภัณฑ์', codes: ['EXP_10'] },
  {
    key: 'others',
    label: 'จ่ายอื่นๆ',
    codes: ['EXP_05', 'EXP_11', 'EXP_12', 'EXP_13', 'EXP_14'],
  },
] as const;

export type MajorExpenseBucketKey =
  (typeof MAJOR_EXPENSE_BUCKETS)[number]['key'];

export const INCOME_SUMMARY_BUCKETS = [
  { key: 'medical', label: 'ค่ารักษาฯ', codes: ['INC_01'] },
  { key: 'fee', label: 'ธรรมเนียม/บำรุง', codes: ['INC_02'] },
  { key: 'donation', label: 'บริจาค', codes: ['INC_03'] },
  { key: 'interest', label: 'ดอกเบี้ย', codes: ['INC_04'] },
  { key: 'uc', label: 'งบ UC', codes: ['INC_05'] },
  { key: 'lgo', label: 'อปท.', codes: ['INC_06', 'INC_09'] },
  { key: 'deposit', label: 'รับฝาก/ภาษี', codes: ['INC_07', 'INC_08'] },
  {
    key: 'other',
    label: 'อื่นๆ',
    codes: ['INC_10', 'INC_11', 'INC_12', 'INC_13'],
  },
] as const;

export function filterTransactionsByProjectScope(
  transactions: LedgerTransaction[],
  scope: ProjectScopeFilter
): LedgerTransaction[] {
  if (scope === 'all') return transactions;
  if (scope === 'only_project') {
    return transactions.filter((t) => Boolean(t.projectId || t.projectCode));
  }
  return transactions.filter((t) => !t.projectId && !t.projectCode);
}

export interface DailyIncomeBucketRow {
  date: string;
  buckets: Record<string, number>;
  total: number;
}

export function computeIncomeDailyByCategory(
  transactions: LedgerTransaction[],
  monthKey: string
): { rows: DailyIncomeBucketRow[]; totals: Record<string, number>; grandTotal: number } {
  const incomes = sortTransactionsChronological(transactions).filter(
    (t) => t.type === 'income' && getMonthKey(t.date) === monthKey
  );
  const dates = Array.from(new Set(incomes.map((t) => t.date))).sort();
  const totals: Record<string, number> = {};
  for (const b of INCOME_SUMMARY_BUCKETS) totals[b.key] = 0;

  let grandTotal = 0;
  const rows: DailyIncomeBucketRow[] = dates.map((date) => {
    const dayTxs = incomes.filter((t) => t.date === date);
    const buckets: Record<string, number> = {};
    let dayTotal = 0;
    for (const b of INCOME_SUMMARY_BUCKETS) {
      const sum = dayTxs
        .filter((t) => (b.codes as readonly string[]).includes(t.categoryCode))
        .reduce((s, t) => s + t.amount, 0);
      buckets[b.key] = sum;
      totals[b.key] += sum;
      dayTotal += sum;
    }
    grandTotal += dayTotal;
    return { date, buckets, total: dayTotal };
  });

  return { rows, totals, grandTotal };
}

export function computeIncomeMonthlyByBucket(
  transactions: LedgerTransaction[],
  fiscalMonths: Array<{ key: string; shortLabel: string; label: string }>
): {
  rows: Array<{ monthKey: string; label: string; buckets: Record<string, number>; total: number }>;
  totals: Record<string, number>;
  grandTotal: number;
} {
  const incomes = transactions.filter((t) => t.type === 'income');
  const totals: Record<string, number> = {};
  for (const b of INCOME_SUMMARY_BUCKETS) totals[b.key] = 0;
  let grandTotal = 0;

  const rows = fiscalMonths.map((m) => {
    const mTxs = incomes.filter((t) => getMonthKey(t.date) === m.key);
    const buckets: Record<string, number> = {};
    let mTotal = 0;
    for (const b of INCOME_SUMMARY_BUCKETS) {
      const sum = mTxs
        .filter((t) => (b.codes as readonly string[]).includes(t.categoryCode))
        .reduce((s, t) => s + t.amount, 0);
      buckets[b.key] = sum;
      totals[b.key] += sum;
      mTotal += sum;
    }
    grandTotal += mTotal;
    return { monthKey: m.key, label: m.shortLabel, buckets, total: mTotal };
  });

  return { rows, totals, grandTotal };
}

export function computeIncomeCategoryByMonthMatrix(
  transactions: LedgerTransaction[],
  fiscalMonths: Array<{ key: string; shortLabel: string }>
): {
  rows: Array<{ code: string; name: string; byMonth: Record<string, number>; total: number }>;
  monthTotals: Record<string, number>;
  grandTotal: number;
} {
  const incomes = transactions.filter((t) => t.type === 'income');
  const monthTotals: Record<string, number> = {};
  for (const m of fiscalMonths) monthTotals[m.key] = 0;
  let grandTotal = 0;

  const rows = INCOME_CATEGORIES.map((cat) => {
    const byMonth: Record<string, number> = {};
    let rowTotal = 0;
    for (const m of fiscalMonths) {
      const sum = incomes
        .filter(
          (t) => getMonthKey(t.date) === m.key && t.categoryCode === cat.code
        )
        .reduce((s, t) => s + t.amount, 0);
      byMonth[m.key] = sum;
      monthTotals[m.key] += sum;
      rowTotal += sum;
    }
    grandTotal += rowTotal;
    return { code: cat.code, name: cat.name, byMonth, total: rowTotal };
  });

  return { rows, monthTotals, grandTotal };
}

export function computeExpenseMonthlyByBucket(
  transactions: LedgerTransaction[],
  fiscalMonths: Array<{ key: string; shortLabel: string }>,
  scope: ProjectScopeFilter
): {
  rows: Array<{ monthKey: string; label: string; buckets: Record<string, number>; total: number }>;
  totals: Record<string, number>;
  grandTotal: number;
} {
  const expenses = filterTransactionsByProjectScope(
    transactions.filter((t) => t.type === 'expense'),
    scope
  );
  const totals: Record<string, number> = {};
  for (const b of MAJOR_EXPENSE_BUCKETS) totals[b.key] = 0;
  let grandTotal = 0;

  const rows = fiscalMonths.map((m) => {
    const mTxs = expenses.filter((t) => getMonthKey(t.date) === m.key);
    const buckets: Record<string, number> = {};
    let mTotal = 0;
    for (const b of MAJOR_EXPENSE_BUCKETS) {
      const sum = mTxs
        .filter((t) => (b.codes as readonly string[]).includes(t.categoryCode))
        .reduce((s, t) => s + t.amount, 0);
      buckets[b.key] = sum;
      totals[b.key] += sum;
      mTotal += sum;
    }
    grandTotal += mTotal;
    return { monthKey: m.key, label: m.shortLabel, buckets, total: mTotal };
  });

  return { rows, totals, grandTotal };
}

export function computeExpenseCategoryByMonthMatrix(
  transactions: LedgerTransaction[],
  fiscalMonths: Array<{ key: string; shortLabel: string }>,
  scope: ProjectScopeFilter
): {
  rows: Array<{ code: string; name: string; byMonth: Record<string, number>; total: number }>;
  monthTotals: Record<string, number>;
  grandTotal: number;
} {
  const expenses = filterTransactionsByProjectScope(
    transactions.filter((t) => t.type === 'expense'),
    scope
  );
  const monthTotals: Record<string, number> = {};
  for (const m of fiscalMonths) monthTotals[m.key] = 0;
  let grandTotal = 0;

  const rows = EXPENSE_CATEGORIES.map((cat) => {
    const byMonth: Record<string, number> = {};
    let rowTotal = 0;
    for (const m of fiscalMonths) {
      const sum = expenses
        .filter(
          (t) => getMonthKey(t.date) === m.key && t.categoryCode === cat.code
        )
        .reduce((s, t) => s + t.amount, 0);
      byMonth[m.key] = sum;
      monthTotals[m.key] += sum;
      rowTotal += sum;
    }
    grandTotal += rowTotal;
    return { code: cat.code, name: cat.name, byMonth, total: rowTotal };
  });

  return { rows, monthTotals, grandTotal };
}

export function computeExpenseByDetailType(
  transactions: LedgerTransaction[],
  monthKey: string,
  period: 'month' | 'ytd',
  scope: ProjectScopeFilter
): {
  items: Array<{
    key: string;
    categoryLabel: string;
    accrualLabel: string;
    count: number;
    amount: number;
  }>;
  total: number;
} {
  let expenses = filterTransactionsByProjectScope(
    transactions.filter((t) => t.type === 'expense'),
    scope
  );
  if (period === 'month') {
    expenses = expenses.filter((t) => getMonthKey(t.date) === monthKey);
  } else {
    expenses = expenses.filter((t) => getMonthKey(t.date) <= monthKey);
  }

  const map = new Map<
    string,
    {
      key: string;
      categoryLabel: string;
      accrualLabel: string;
      count: number;
      amount: number;
    }
  >();

  for (const tx of expenses) {
    const accCode = resolveAccrualExpenseCode(tx);
    const accNode = ACCRUAL_EXPENSE_NODES.find((n) => n.code === accCode);
    const catLabel = getCategoryLabel(
      'expense',
      tx.categoryCode,
      tx.subCategoryCode
    );
    const key = `${tx.categoryCode}__${accCode}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.amount += tx.amount;
    } else {
      map.set(key, {
        key,
        categoryLabel: catLabel,
        accrualLabel: accNode?.label || catLabel,
        count: 1,
        amount: tx.amount,
      });
    }
  }

  const items = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  const total = items.reduce((s, i) => s + i.amount, 0);
  return { items, total };
}

export function computeExpenseGroupDrilldown(
  transactions: LedgerTransaction[],
  bucketKey: MajorExpenseBucketKey,
  monthKey: string,
  period: 'month' | 'ytd',
  scope: ProjectScopeFilter
): {
  bucketLabel: string;
  txs: LedgerTransaction[];
  subBreakdown: Array<{ label: string; count: number; amount: number }>;
  total: number;
} {
  const bucket =
    MAJOR_EXPENSE_BUCKETS.find((b) => b.key === bucketKey) ||
    MAJOR_EXPENSE_BUCKETS[0];
  let expenses = filterTransactionsByProjectScope(
    transactions.filter(
      (t) =>
        t.type === 'expense' &&
        (bucket.codes as readonly string[]).includes(t.categoryCode)
    ),
    scope
  );
  if (period === 'month') {
    expenses = expenses.filter((t) => getMonthKey(t.date) === monthKey);
  } else {
    expenses = expenses.filter((t) => getMonthKey(t.date) <= monthKey);
  }

  const sorted = sortTransactionsChronological(expenses);
  const subMap = new Map<
    string,
    { label: string; count: number; amount: number }
  >();
  for (const tx of sorted) {
    const accCode = resolveAccrualExpenseCode(tx);
    const accNode = ACCRUAL_EXPENSE_NODES.find((n) => n.code === accCode);
    const label =
      accNode?.label ||
      getCategoryLabel('expense', tx.categoryCode, tx.subCategoryCode);
    const cur = subMap.get(label);
    if (cur) {
      cur.count += 1;
      cur.amount += tx.amount;
    } else {
      subMap.set(label, { label, count: 1, amount: tx.amount });
    }
  }

  const total = sorted.reduce((s, t) => s + t.amount, 0);
  return {
    bucketLabel: bucket.label,
    txs: sorted,
    subBreakdown: Array.from(subMap.values()).sort(
      (a, b) => b.amount - a.amount
    ),
    total,
  };
}

