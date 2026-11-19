import {
  LedgerTransaction,
  PcuSettings,
  ProjectControlType,
  ProjectItem,
  SpreadsheetSummary,
} from '../types/accounting';
import {
  computeAccrualStatement,
  computeExpenseCategoryByMonthMatrix,
  computeForm401,
  computeForm404,
  computeForm407,
  computeIncomeCategoryByMonthMatrix,
  computeMonthlyStatement,
  computeProjectBalances,
  computeVoucherSummary,
  formatThaiDateFull,
  getCategoryLabel,
  getMonthDateRangeLabel,
  getThaiMonthFull,
  getThaiYearBE,
  sortTransactionsChronological,
} from '../utils/accountingMath';
import { FISCAL_MONTHS } from '../data/pcuCatalog';

export const PCU_SHEET_TABS = {
  SETTINGS: 'ตั้งค่าเริ่มต้น',
  PROJECTS: 'โครงการ_402_404',
  LEDGER: 'บันทึกรายวัน',
  FORM_401: 'แบบ401_บัญชีเงินสด',
  FORM_404: 'แบบ404_คุมเงินนอกงบ',
  FORM_407: 'แบบ407_คงเหลือประจำวัน',
  MONTHLY: 'งบเดือน_รับจ่าย',
  ACCRUAL: 'งบเดือน_เกณฑ์คงค้าง',
  VOUCHER: 'หน้างบใบสำคัญ',
  SUMMARY_INCOME: 'สรุปรายรับ_รายเดือน',
  SUMMARY_EXPENSE: 'สรุปรายจ่าย_รายเดือน',
};

interface GoogleSheetTabMeta {
  properties: {
    sheetId: number;
    title: string;
    index: number;
  };
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  sheets: GoogleSheetTabMeta[];
}

async function parseGoogleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Google API error (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function listAppSpreadsheets(
  accessToken: string
): Promise<SpreadsheetSummary[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=25`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await parseGoogleResponse<{ files?: SpreadsheetSummary[] }>(res);
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title,index)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return parseGoogleResponse<SpreadsheetMetadata>(res);
}

export function extractSpreadsheetIdFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export async function createPcuSpreadsheet(
  accessToken: string,
  title: string
): Promise<SpreadsheetMetadata> {
  const tabTitles = Object.values(PCU_SHEET_TABS);
  const body = {
    properties: {
      title,
      locale: 'th_TH',
    },
    sheets: tabTitles.map((tabTitle, index) => ({
      properties: {
        title: tabTitle,
        index,
        gridProperties: {
          frozenRowCount: index <= 2 ? 1 : 3,
        },
      },
    })),
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseGoogleResponse<SpreadsheetMetadata>(res);
}

async function ensureRequiredTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.properties.title));
  const requiredTitles = Object.values(PCU_SHEET_TABS);
  const missingTitles = requiredTitles.filter((t) => !existingTitles.has(t));

  if (missingTitles.length > 0) {
    const requests = missingTitles.map((title) => ({
      addSheet: {
        properties: { title },
      },
    }));
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );
    await parseGoogleResponse(res);
    return getSpreadsheetMetadata(accessToken, spreadsheetId);
  }

  return meta;
}

function escapeSheetRange(title: string, range: string): string {
  const safeTitle = title.replace(/'/g, "''");
  return `'${safeTitle}'!${range}`;
}

function projectTypeToLabel(type: ProjectControlType): string {
  switch (type) {
    case 'pp_project':
      return 'โครงการ งบ P & P';
    case 'fund_project':
      return 'โครงการ งบกองทุนฯ';
    case 'budget_402':
      return '402 เงินงบประมาณ';
    case 'sub_404':
      return '404 ย่อย เงินนอกงบประมาณ';
  }
}

function labelToProjectType(label: string): ProjectControlType {
  if (label.includes('P & P')) return 'pp_project';
  if (label.includes('402')) return 'budget_402';
  if (label.includes('404')) return 'sub_404';
  return 'fund_project';
}

export async function syncAllToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  selectedMonthKey: string,
  selectedDate407: string
): Promise<{ updatedTabs: string[]; totalRows: number }> {
  const meta = await ensureRequiredTabs(accessToken, spreadsheetId);
  const sortedTxs = sortTransactionsChronological(transactions);

  const monthInfo =
    FISCAL_MONTHS.find((m) => m.key === selectedMonthKey) || FISCAL_MONTHS[0];
  const dateRangeLabel = getMonthDateRangeLabel(selectedMonthKey);

  // 1. ตั้งค่าเริ่มต้น
  const settingsRows: (string | number)[][] = [
    ['หัวข้อตั้งค่า', 'ค่าที่บันทึก', 'หมายเหตุ'],
    ['ชื่อหน่วยงาน', settings.unitName, ''],
    ['ที่อยู่', settings.address, ''],
    ['สังกัด', settings.affiliation === 'pao' ? 'อบจ.' : 'กระทรวงสาธารณสุข', settings.affiliationLabel],
    ['ปีงบประมาณ (พ.ศ.)', settings.fiscalYearBE, ''],
    ['วันที่เริ่มปีงบประมาณ', settings.fiscalStartDate, formatThaiDateFull(settings.fiscalStartDate)],
    ['วันที่สิ้นสุดปีงบประมาณ', settings.fiscalEndDate, formatThaiDateFull(settings.fiscalEndDate)],
    ['คำนำหน้าเอกสารรายจ่าย', settings.docPrefixes.expensePrefix, ''],
    ['ใบเสร็จรับเงิน เล่มหลัก', settings.docPrefixes.receiptBookMain, ''],
    ['กรรมการเก็บเงิน คนที่ 1', settings.officers.cashCommittee1, ''],
    ['กรรมการเก็บเงิน คนที่ 2', settings.officers.cashCommittee2, ''],
    ['กรรมการเก็บเงิน คนที่ 3', settings.officers.cashCommittee3, ''],
    ['ผู้รับเงิน (รง.407)', settings.officers.cashReceiver407, ''],
    ['เจ้าหน้าที่การเงิน', settings.officers.financeOfficer, ''],
    ['หัวหน้าหน่วยงานย่อย', settings.officers.unitHead, ''],
    ['ผู้สั่งจ่ายเช็ค 1', settings.officers.chequeSigner1, ''],
    ['ผู้สั่งจ่ายเช็ค 2', settings.officers.chequeSigner2, ''],
    ['ผู้สั่งจ่ายเช็ค 3', settings.officers.chequeSigner3, ''],
    ['---', '---', '---'],
    ['ลำดับบัญชี', 'ชื่อบัญชีธนาคาร', 'ประเภทเงิน / เลขที่บัญชี', 'เงินฝากยกมา', 'เงินสดยกมา', 'สัญญายืมเงิน', 'สำรองจ่าย', 'เช็ครอนำฝาก'],
    ...settings.bankAccounts.map((b) => [
      b.order,
      b.name,
      `${b.fundType} | ${b.accountNo}`,
      b.openingBank,
      b.openingCash,
      b.openingLoan,
      b.openingAdvance,
      b.openingCheque,
    ]),
  ];

  // 2. โครงการ_402_404
  const projSnaps = computeProjectBalances(settings, transactions, selectedMonthKey);
  const projectRows: (string | number)[][] = [
    [
      'รหัสโครงการ',
      'ลำดับ',
      'ประเภททะเบียน',
      'ชื่อย่อโครงการ / 402 / 404',
      'ชื่อเต็มโครงการ / 402 / 404',
      'เงินเหลือยกมาจากปีก่อน',
      'รับสะสมตั้งแต่ต้นปี',
      'จ่ายสะสมตั้งแต่ต้นปี',
      'คงเหลือ',
    ],
    ...projSnaps.map((snap) => [
      snap.project.id,
      snap.project.order,
      projectTypeToLabel(snap.project.type),
      snap.project.shortName,
      snap.project.fullName,
      snap.project.openingBalance,
      snap.receivedYtd,
      snap.spentYtd,
      snap.remainingBalance,
    ]),
  ];

  // 3. บันทึกรายวัน
  const ledgerRows: (string | number)[][] = [
    [
      'รหัสรายการ',
      'วันที่ (ค.ศ.)',
      'วันที่ (ไทย)',
      'ประเภท',
      'เลขที่เอกสาร',
      'รหัสหมวดหลัก',
      'รหัสหมวดย่อย',
      'ชื่อหมวดหมู่',
      'รายการ / คำอธิบาย',
      'จำนวนเงิน (บาท)',
      'ช่องทางรับ-จ่าย',
      'รหัสบัญชีธนาคาร',
      'เลขที่เช็ค',
      'โครงการ / 402 / 404 ย่อย',
      'ผู้ออกใบเสร็จ/ผู้บันทึก',
      'ทิศทางฝาก-ถอน',
      'รหัสเกณฑ์คงค้าง',
      'ครุภัณฑ์ต่ำกว่า10000',
      'เวลาบันทึก',
    ],
    ...sortedTxs.map((tx) => [
      tx.id,
      tx.date,
      formatThaiDateFull(tx.date),
      tx.type === 'income' ? 'รายรับ' : tx.type === 'expense' ? 'รายจ่าย' : 'ฝาก-ถอน',
      tx.docNo || '',
      tx.categoryCode || '',
      tx.subCategoryCode || '',
      getCategoryLabel(tx.type, tx.categoryCode, tx.subCategoryCode),
      tx.description,
      tx.amount,
      tx.paymentMethod === 'cash' ? 'เงินสด' : tx.paymentMethod === 'cheque' ? 'เช็ค' : 'ธนาคาร/e-Pay',
      tx.bankAccountId,
      tx.chequeNo || '',
      tx.projectCode || '',
      tx.issuerName || '',
      tx.transferDirection || '',
      tx.accrualCode || '',
      tx.isLowValueEquipment ? 'ใช่' : '',
      tx.createdAt,
    ]),
  ];

  // 4. แบบ401_บัญชีเงินสด
  const form401Days = computeForm401(settings, transactions, selectedMonthKey);
  const form401Rows: (string | number)[][] = [
    [`บัญชีเงินสด แบบ 401 - ${settings.unitName} ${settings.address}`],
    [`ประจำเดือน ${monthInfo.label}`],
    ['เดือน', 'วัน', 'เอกสารที่ (รับ)', 'รายการรับ', 'เงินสดเดบิต (รับ)', 'เดือน', 'วัน', 'เอกสารที่ (จ่าย)', 'รายการจ่าย', 'เงินสดเครดิต (จ่าย)'],
  ];

  for (const day of form401Days) {
    const dNum = Number(day.date.slice(8, 10));
    const mShort = getThaiMonthFull(day.date).slice(0, 3);
    const maxLen = Math.max(day.incomes.length, day.expenses.length, 1);

    form401Rows.push([
      mShort,
      dNum,
      '',
      'ยกมา',
      day.openingBalance,
      mShort,
      dNum,
      '',
      day.expenses.length === 0 ? 'ไม่มีจ่าย' : '',
      day.expenses.length === 0 ? 0 : '',
    ]);

    for (let i = 0; i < maxLen; i++) {
      const inc = day.incomes[i];
      const exp = day.expenses[i];
      if (!inc && !exp) continue;
      form401Rows.push([
        '',
        '',
        inc ? inc.docNo : '',
        inc ? inc.description : '',
        inc ? inc.amount : '',
        '',
        '',
        exp ? exp.docNo : '',
        exp ? exp.description : '',
        exp ? exp.amount : '',
      ]);
    }

    form401Rows.push(['', '', '', '', '', '', '', '', 'ยกไป', day.closingBalance]);
    form401Rows.push(['', '', '', 'รวม', day.totalSide, '', '', '', 'รวม', day.totalSide]);
  }

  // 5. แบบ404_คุมเงินนอกงบ
  const form404 = computeForm404(settings, transactions, selectedMonthKey);
  const form404Rows: (string | number)[][] = [
    [`ทะเบียนคุมเงินนอกงบประมาณ (แบบ 404 หน่วยงานย่อย) - ${settings.unitName} ${settings.address}`],
    [dateRangeLabel],
    ['พ.ศ.', 'เดือน', 'วัน', 'ที่เอกสาร', 'รายการ', 'รับ', 'จ่าย', 'คงเหลือ'],
    ['', '', '', '', 'ยอดยกมาจากเดือนก่อน', '', '', form404.openingFromPrevMonth],
    ...form404.rows.map((r) => [
      getThaiYearBE(r.tx.date),
      getThaiMonthFull(r.tx.date),
      Number(r.tx.date.slice(8, 10)),
      r.tx.docNo || '',
      r.tx.description,
      r.incomeAmount || '',
      r.expenseAmount || '',
      r.runningBalance,
    ]),
    ['', '', '', '', 'ยอดยกไป', '', '', form404.monthClosing],
    ['', '', '', '', '', '', '', ''],
    ['สรุป', 'ยอดยกมา', 'รับ', 'จ่าย', 'รับ - จ่าย', 'คงเหลือ'],
    ['เดือนนี้', form404.openingFromPrevMonth, form404.monthIncome, form404.monthExpense, form404.monthIncome - form404.monthExpense, form404.monthClosing],
    ['ตั้งแต่ต้นปี', form404.openingFiscalYear, form404.ytdIncome, form404.ytdExpense, form404.ytdIncome - form404.ytdExpense, form404.ytdClosing],
  ];

  // 6. แบบ407_คงเหลือประจำวัน
  const form407 = computeForm407(settings, transactions, selectedDate407);
  const form407Rows: (string | number)[][] = [
    [`รายงานเงินคงเหลือประจำวัน (แบบ 407) - ${settings.unitName} ${settings.address}`],
    [`ประจำวันที่ ${formatThaiDateFull(selectedDate407)}`],
    ['รายการ', 'จำนวนเงิน (บาท)', 'หมายเหตุ / สรุปความเคลื่อนไหวประจำวัน'],
    ['เงินสดในมือ', form407.cashInHand, `รับเงินสดในมือ: ${form407.dayCashIncome.toFixed(2)} บาท`],
    ['เช็คในมือ', form407.chequeInHand, `รับเงินเข้าธนาคาร: ${form407.dayBankIncome.toFixed(2)} บาท`],
    ['ใบสำคัญรองจ่าย', form407.advanceReceipt, `หักเช็ค/e-pay รับฝาก: ${form407.dayWithholdingDeposit.toFixed(2)} บาท`],
    ['สัญญารับรองการยืมเงิน', form407.loanContract, `จ่ายเงินสด: ${form407.dayCashExpense.toFixed(2)} บาท`],
    ...form407.accountSnapshots.map((snap, idx) => [
      `สมุดคู่ฝาก: ${snap.account.name} (${snap.account.accountNo})`,
      snap.bankBalance,
      idx === 0
        ? `จ่ายเช็คสุทธิ: ${form407.dayChequeExpense.toFixed(2)} บาท | จ่าย e-Pay: ${form407.dayBankExpense.toFixed(2)} บาท`
        : `ฝากเงินสด: ${form407.dayCashDeposit.toFixed(2)} บาท | ถอนเงินสด: ${form407.dayCashWithdraw.toFixed(2)} บาท`,
    ]),
    ['รวมเงินคงเหลือทั้งสิ้น', form407.grandTotal, form407.grandTotalThaiText],
    ['', '', ''],
    ['เจ้าหน้าที่การเงิน', settings.officers.financeOfficer, ''],
    ['หัวหน้าหน่วยงานย่อย', settings.officers.unitHead, ''],
    ['คณะกรรมการเก็บรักษาเงิน 1', settings.officers.cashCommittee1, ''],
    ['คณะกรรมการเก็บรักษาเงิน 2', settings.officers.cashCommittee2, ''],
    ['คณะกรรมการเก็บรักษาเงิน 3', settings.officers.cashCommittee3, ''],
    ['ผู้รับเงิน', settings.officers.cashReceiver407, ''],
  ];

  // 7. งบเดือน_รับจ่าย
  const monthly = computeMonthlyStatement(settings, transactions, selectedMonthKey);
  const monthlyRows: (string | number)[][] = [
    [`รายการรับ - รายการจ่ายเงินบำรุง - ${settings.unitName} ${settings.address}`],
    [dateRangeLabel],
    ['รายการ', 'รวมเดือนนี้ (บาท)', 'รวมต้นปี (บาท)'],
    ['--- รายรับ ---', '', ''],
    ...monthly.incomeRows.map((r) => [
      r.isSubItem ? `   - ${r.label}` : r.label,
      r.monthAmount,
      r.ytdAmount,
    ]),
    ['รวมรายรับ', monthly.totalMonthIncome, monthly.totalYtdIncome],
    ['--- รายจ่าย ---', '', ''],
    ...monthly.expenseRows.map((r) => [
      r.isSubItem ? `   - ${r.label}` : r.label,
      r.monthAmount,
      r.ytdAmount,
    ]),
    ['รวมรายจ่าย', monthly.totalMonthExpense, monthly.totalYtdExpense],
    ['รายรับ ต่ำ / สูง กว่ารายจ่าย', monthly.monthNetDiff, monthly.ytdNetDiff],
    ['เงินบำรุงคงเหลือ ยกมาจากเดือนก่อน', monthly.openingFromPrevMonth, monthly.openingFiscalYear],
    ['เงินบำรุงคงเหลือ ยกไป', monthly.closingMonthBalance, monthly.closingYtdBalance],
  ];

  // 8. งบเดือน_เกณฑ์คงค้าง
  const accrual = computeAccrualStatement(settings, transactions, selectedMonthKey);
  const accrualRows: (string | number)[][] = [
    [`รายการรับ - รายการจ่ายเงินบำรุง (ระบบเกณฑ์คงค้าง) - ${settings.unitName} ${settings.address}`],
    [dateRangeLabel],
    ['รายการ', 'รวมเดือนนี้ (บาท)', 'รวมต้นปี (บาท)'],
    ['--- รายรับ ---', '', ''],
    ...accrual.incomeRows.map((r) => [
      r.isSubItem ? `   - ${r.label}` : r.label,
      r.monthAmount,
      r.ytdAmount,
    ]),
    ['รวมรายรับ', accrual.totalMonthIncome, accrual.totalYtdIncome],
    ['--- รายจ่าย (ระบบเกณฑ์คงค้าง) ---', '', ''],
    ...accrual.expenseRows.map((r) => [
      r.level === 2 ? `  ${r.label}` : r.level === 3 ? `     . ${r.label}` : r.label,
      r.monthAmount === null ? '' : r.monthAmount,
      r.ytdAmount === null ? '' : r.ytdAmount,
    ]),
    ['รวมรายจ่าย', accrual.totalMonthExpense, accrual.totalYtdExpense],
    ['รายรับ ต่ำ / สูง กว่ารายจ่าย', accrual.monthNetDiff, accrual.ytdNetDiff],
    ['เงินบำรุงคงเหลือ ยกมาจากเดือนก่อน', accrual.openingFromPrevMonth, accrual.openingFiscalYear],
    ['เงินบำรุงคงเหลือ ยกไป', accrual.closingMonthBalance, accrual.closingYtdBalance],
    ['', '', ''],
    ['หมายเหตุ: เงินบำรุงคงเหลือ ไม่รวมเงินในโครงการต่างๆ', accrual.nonProjectRemainingTotal, ''],
    ['หมายเหตุ: เงินคงเหลือในโครงการต่างๆ', accrual.projectRemainingTotal, ''],
    ['หมายเหตุ: ค่าครุภัณฑ์ต่ำกว่า 10,000 บาท (เดือนนี้ / ต้นปี)', accrual.lowValueEquipmentMonth, accrual.lowValueEquipmentYtd],
  ];

  // 9. หน้างบใบสำคัญ
  const voucher = computeVoucherSummary(transactions, selectedMonthKey);
  const voucherRows: (string | number)[][] = [
    [`หน้างบใบสำคัญ - ${settings.unitName} ${settings.address}`],
    [dateRangeLabel],
    ['ใบสำคัญที่', 'หมวดประเภทรายจ่าย', 'จำนวนเงิน (บาท)'],
  ];
  for (const g of voucher.groups) {
    voucherRows.push(['', `[${g.groupTitle}]`, '']);
    for (const item of g.items) {
      voucherRows.push([item.docNo, item.description, item.amount]);
    }
    voucherRows.push(['', 'รวมเงิน', g.subtotal]);
  }
  voucherRows.push(['', 'รวมเงินทั้งหมด', voucher.grandTotal]);
  voucherRows.push(['', `เจ้าหน้าที่การเงิน: ${settings.officers.financeOfficer}`, '']);

  // 10. สรุปรายรับ_รายเดือน
  const incMatrix = computeIncomeCategoryByMonthMatrix(transactions, FISCAL_MONTHS);
  const summaryIncomeRows: (string | number)[][] = [
    [`สรุปรายรับ แยกประเภท / เดือน ปีงบประมาณ ${settings.fiscalYearBE} - ${settings.unitName}`],
    [''],
    ['หมวดรายรับ', ...FISCAL_MONTHS.map((m) => m.shortLabel), 'รวมทั้งปี'],
    ...incMatrix.rows.map((r) => [
      r.name,
      ...FISCAL_MONTHS.map((m) => r.byMonth[m.key] || 0),
      r.total,
    ]),
    [
      'รวมรายรับทั้งสิ้น',
      ...FISCAL_MONTHS.map((m) => incMatrix.monthTotals[m.key] || 0),
      incMatrix.grandTotal,
    ],
  ];

  // 11. สรุปรายจ่าย_รายเดือน
  const expMatrix = computeExpenseCategoryByMonthMatrix(
    transactions,
    FISCAL_MONTHS,
    'all'
  );
  const summaryExpenseRows: (string | number)[][] = [
    [`สรุปรายจ่าย หมวด แยกรายเดือน ปีงบประมาณ ${settings.fiscalYearBE} - ${settings.unitName}`],
    [''],
    ['หมวดรายจ่าย', ...FISCAL_MONTHS.map((m) => m.shortLabel), 'รวมทั้งปี'],
    ...expMatrix.rows.map((r) => [
      r.name,
      ...FISCAL_MONTHS.map((m) => r.byMonth[m.key] || 0),
      r.total,
    ]),
    [
      'รวมรายจ่ายทั้งสิ้น',
      ...FISCAL_MONTHS.map((m) => expMatrix.monthTotals[m.key] || 0),
      expMatrix.grandTotal,
    ],
  ];

  const tabPayloads: Array<{ title: string; values: (string | number)[][] }> = [
    { title: PCU_SHEET_TABS.SETTINGS, values: settingsRows },
    { title: PCU_SHEET_TABS.PROJECTS, values: projectRows },
    { title: PCU_SHEET_TABS.LEDGER, values: ledgerRows },
    { title: PCU_SHEET_TABS.FORM_401, values: form401Rows },
    { title: PCU_SHEET_TABS.FORM_404, values: form404Rows },
    { title: PCU_SHEET_TABS.FORM_407, values: form407Rows },
    { title: PCU_SHEET_TABS.MONTHLY, values: monthlyRows },
    { title: PCU_SHEET_TABS.ACCRUAL, values: accrualRows },
    { title: PCU_SHEET_TABS.VOUCHER, values: voucherRows },
    { title: PCU_SHEET_TABS.SUMMARY_INCOME, values: summaryIncomeRows },
    { title: PCU_SHEET_TABS.SUMMARY_EXPENSE, values: summaryExpenseRows },
  ];

  const clearRanges = tabPayloads.map((p) => escapeSheetRange(p.title, 'A1:Z2000'));
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ranges: clearRanges }),
    }
  );
  await parseGoogleResponse(clearRes);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: tabPayloads.map((p) => ({
          range: escapeSheetRange(p.title, 'A1'),
          majorDimension: 'ROWS',
          values: p.values,
        })),
      }),
    }
  );
  await parseGoogleResponse(updateRes);

  const sheetIdMap = new Map(
    meta.sheets.map((s) => [s.properties.title, s.properties.sheetId])
  );
  const formatRequests: Record<string, unknown>[] = [];
  for (const tab of tabPayloads) {
    const sheetId = sheetIdMap.get(tab.title);
    if (sheetId === undefined) continue;
    const headerRowIndex =
      tab.title === PCU_SHEET_TABS.SETTINGS ||
      tab.title === PCU_SHEET_TABS.PROJECTS ||
      tab.title === PCU_SHEET_TABS.LEDGER
        ? 0
        : 2;
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: headerRowIndex,
          endRowIndex: headerRowIndex + 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.06, green: 0.46, blue: 0.43 },
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 },
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  if (formatRequests.length > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: formatRequests }),
      }
    );
  }

  return {
    updatedTabs: tabPayloads.map((t) => t.title),
    totalRows: tabPayloads.reduce((sum, t) => sum + t.values.length, 0),
  };
}

export async function importFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  fallbackSettings: PcuSettings
): Promise<{
  title: string;
  transactions: LedgerTransaction[];
  settings: PcuSettings;
}> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const availableTabs = new Set(meta.sheets.map((s) => s.properties.title));

  if (!availableTabs.has(PCU_SHEET_TABS.LEDGER)) {
    throw new Error(
      `ไม่พบแท็บ "${PCU_SHEET_TABS.LEDGER}" ในไฟล์ "${meta.properties.title}"`
    );
  }

  const ledgerRange = encodeURIComponent(
    escapeSheetRange(PCU_SHEET_TABS.LEDGER, 'A1:S2000')
  );
  const ledgerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${ledgerRange}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const ledgerData = await parseGoogleResponse<{ values?: string[][] }>(ledgerRes);
  const rows = ledgerData.values || [];

  const transactions: LedgerTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || !r[8]) continue;
    const typeLabel = r[3] || '';
    const type: LedgerTransaction['type'] =
      typeLabel === 'รายรับ'
        ? 'income'
        : typeLabel === 'ฝาก-ถอน'
        ? 'transfer'
        : 'expense';

    const payLabel = r[10] || '';
    const paymentMethod: LedgerTransaction['paymentMethod'] =
      payLabel === 'เงินสด'
        ? 'cash'
        : payLabel === 'เช็ค'
        ? 'cheque'
        : 'bank';

    const amount = Number(String(r[9] || '0').replace(/,/g, ''));
    if (isNaN(amount)) continue;

    transactions.push({
      id: r[0] || `tx-sheet-${i}`,
      date: r[1],
      type,
      docNo: r[4] || '',
      categoryCode: r[5] || (type === 'income' ? 'INC_13' : 'EXP_14'),
      subCategoryCode: r[6] || '',
      description: r[8],
      amount,
      paymentMethod,
      bankAccountId: r[11] || fallbackSettings.bankAccounts[0]?.id || 'bank-1',
      chequeNo: r[12] || '',
      projectCode: r[13] || '',
      issuerName: r[14] || fallbackSettings.officers.financeOfficer,
      transferDirection:
        r[15] === 'cash_to_bank' || r[15] === 'bank_to_cash'
          ? r[15]
          : undefined,
      accrualCode: r[16] || undefined,
      isLowValueEquipment: r[17] === 'ใช่',
      createdAt: r[18] || r[17] || new Date().toISOString(),
    });
  }

  let updatedSettings: PcuSettings = {
    ...fallbackSettings,
    linkedSpreadsheetId: spreadsheetId,
    linkedSpreadsheetTitle: meta.properties.title,
  };

  if (availableTabs.has(PCU_SHEET_TABS.SETTINGS)) {
    const setRange = encodeURIComponent(
      escapeSheetRange(PCU_SHEET_TABS.SETTINGS, 'A1:H100')
    );
    const setRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${setRange}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const setData = await parseGoogleResponse<{ values?: string[][] }>(setRes);
    const sRows = setData.values || [];
    const kv = new Map<string, { val: string; note: string }>();
    let bankHeaderIdx = -1;
    sRows.forEach((row, idx) => {
      if (row[0] === 'ลำดับบัญชี') bankHeaderIdx = idx;
      if (row[0]) kv.set(row[0], { val: row[1] || '', note: row[2] || '' });
    });

    const parsedBanks = [];
    if (bankHeaderIdx !== -1) {
      for (let idx = bankHeaderIdx + 1; idx < sRows.length; idx++) {
        const br = sRows[idx];
        if (!br || !br[1]) continue;
        const [fundTypeRaw, accNoRaw] = (br[2] || '').split('|').map((s) => s.trim());
        parsedBanks.push({
          id: `bank-${br[0] || idx}`,
          order: Number(br[0]) || parsedBanks.length + 1,
          name: br[1],
          fundType: (fundTypeRaw === 'งบประมาณ' ? 'งบประมาณ' : 'นอกงบประมาณ') as
            | 'งบประมาณ'
            | 'นอกงบประมาณ',
          accountNo: accNoRaw || '',
          openingBank: Number(String(br[3] || '0').replace(/,/g, '')) || 0,
          openingCash: Number(String(br[4] || '0').replace(/,/g, '')) || 0,
          openingLoan: Number(String(br[5] || '0').replace(/,/g, '')) || 0,
          openingAdvance: Number(String(br[6] || '0').replace(/,/g, '')) || 0,
          openingCheque: Number(String(br[7] || '0').replace(/,/g, '')) || 0,
        });
      }
    }

    updatedSettings = {
      ...updatedSettings,
      unitName: kv.get('ชื่อหน่วยงาน')?.val || updatedSettings.unitName,
      address: kv.get('ที่อยู่')?.val || updatedSettings.address,
      affiliation: kv.get('สังกัด')?.val === 'อบจ.' ? 'pao' : 'moph',
      affiliationLabel:
        kv.get('สังกัด')?.note || updatedSettings.affiliationLabel,
      fiscalYearBE:
        Number(kv.get('ปีงบประมาณ (พ.ศ.)')?.val) ||
        updatedSettings.fiscalYearBE,
      fiscalStartDate:
        kv.get('วันที่เริ่มปีงบประมาณ')?.val || updatedSettings.fiscalStartDate,
      fiscalEndDate:
        kv.get('วันที่สิ้นสุดปีงบประมาณ')?.val || updatedSettings.fiscalEndDate,
      docPrefixes: {
        ...updatedSettings.docPrefixes,
        expensePrefix:
          kv.get('คำนำหน้าเอกสารรายจ่าย')?.val ||
          updatedSettings.docPrefixes.expensePrefix,
        receiptBookMain:
          kv.get('ใบเสร็จรับเงิน เล่มหลัก')?.val ||
          updatedSettings.docPrefixes.receiptBookMain,
      },
      officers: {
        ...updatedSettings.officers,
        cashCommittee1:
          kv.get('กรรมการเก็บเงิน คนที่ 1')?.val ??
          updatedSettings.officers.cashCommittee1,
        cashCommittee2:
          kv.get('กรรมการเก็บเงิน คนที่ 2')?.val ??
          updatedSettings.officers.cashCommittee2,
        cashCommittee3:
          kv.get('กรรมการเก็บเงิน คนที่ 3')?.val ??
          updatedSettings.officers.cashCommittee3,
        cashReceiver407:
          kv.get('ผู้รับเงิน (รง.407)')?.val ??
          updatedSettings.officers.cashReceiver407,
        financeOfficer:
          kv.get('เจ้าหน้าที่การเงิน')?.val ??
          updatedSettings.officers.financeOfficer,
        unitHead:
          kv.get('หัวหน้าหน่วยงานย่อย')?.val ??
          updatedSettings.officers.unitHead,
        chequeSigner1:
          kv.get('ผู้สั่งจ่ายเช็ค 1')?.val ??
          updatedSettings.officers.chequeSigner1,
        chequeSigner2:
          kv.get('ผู้สั่งจ่ายเช็ค 2')?.val ??
          updatedSettings.officers.chequeSigner2,
        chequeSigner3:
          kv.get('ผู้สั่งจ่ายเช็ค 3')?.val ??
          updatedSettings.officers.chequeSigner3,
      },
      bankAccounts:
        parsedBanks.length > 0 ? parsedBanks : updatedSettings.bankAccounts,
    };
  }

  if (availableTabs.has(PCU_SHEET_TABS.PROJECTS)) {
    const projRange = encodeURIComponent(
      escapeSheetRange(PCU_SHEET_TABS.PROJECTS, 'A1:I200')
    );
    const projRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${projRange}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const projData = await parseGoogleResponse<{ values?: string[][] }>(projRes);
    const pRows = projData.values || [];
    const parsedProjects: ProjectItem[] = [];
    for (let i = 1; i < pRows.length; i++) {
      const pr = pRows[i];
      if (!pr || !pr[3]) continue;
      parsedProjects.push({
        id: pr[0] || `proj-${i}`,
        order: Number(pr[1]) || i,
        type: labelToProjectType(pr[2] || ''),
        shortName: pr[3],
        fullName: pr[4] || '',
        openingBalance: Number(String(pr[5] || '0').replace(/,/g, '')) || 0,
      });
    }
    if (parsedProjects.length > 0) {
      updatedSettings.projects = parsedProjects;
    }
  }

  return {
    title: meta.properties.title,
    transactions,
    settings: updatedSettings,
  };
}
