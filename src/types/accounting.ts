export type TransactionType = 'income' | 'expense' | 'transfer';

export type PaymentMethod = 'cash' | 'bank' | 'cheque';

export type TransferDirection = 'cash_to_bank' | 'bank_to_cash';

export type AffiliationType = 'moph' | 'pao'; // กระทรวงสาธารณสุข (สธ.) หรือ องค์การบริหารส่วนจังหวัด (อบจ.)

export type ProjectControlType =
  | 'pp_project'     // โครงการ งบ P & P
  | 'fund_project'   // โครงการ งบกองทุนฯ
  | 'budget_402'     // 402 เงินงบประมาณ
  | 'sub_404';       // 404 ย่อย เงินนอกงบประมาณ

export interface ProjectItem {
  id: string;
  order: number;
  type: ProjectControlType;
  shortName: string;
  fullName: string;
  openingBalance: number;
}

export interface BankAccount {
  id: string;
  order: number;
  name: string;
  fundType: 'นอกงบประมาณ' | 'งบประมาณ';
  accountNo: string;
  openingBank: number;
  openingCash: number;
  openingLoan: number;
  openingAdvance: number;
  openingCheque: number;
}

export interface OfficerSettings {
  cashCommittee1: string;
  cashCommittee2: string;
  cashCommittee3: string;
  cashReceiver407: string;
  financeOfficer: string;
  unitHead: string;
  chequeSigner1: string;
  chequeSigner2: string;
  chequeSigner3: string;
}

export interface DocPrefixes {
  expensePrefix: string;
  receiptBookMain: string;
  receiptBookSub1: string;
  receiptBookSub2: string;
}

export interface BackupSyncSettings {
  backupReminderEnabled: boolean;
  backupIntervalDays: number;
  lastBackupAt: string | null;
  warnBeforeClose: boolean;
  sheetsConnectionEnabled: boolean;
  autoSyncSheetsEnabled: boolean;
  autoSyncIntervalMinutes: number;
  lastAutoSyncAt: string | null;
  lockedGoogleEmail: string;
  sheetsSettingsLocked: boolean;
  sheetsLockPin: string;
}

export interface PcuSettings {
  unitName: string;
  address: string;
  affiliation: AffiliationType;
  affiliationLabel: string;
  fiscalYearBE: number;
  fiscalStartDate: string; // YYYY-MM-DD (e.g. 2026-10-01)
  fiscalEndDate: string;   // YYYY-MM-DD (e.g. 2027-09-30)
  bankAccounts: BankAccount[];
  projects: ProjectItem[];
  officers: OfficerSettings;
  docPrefixes: DocPrefixes;
  linkedSpreadsheetId: string;
  linkedSpreadsheetTitle: string;
  backupSync?: BackupSyncSettings;
}

export interface SubCategoryItem {
  code: string;
  name: string;
}

export interface CategoryGroup {
  code: string;
  number: number;
  name: string;
  shortLabel: string;
  subItems: SubCategoryItem[];
}

export interface AccrualExpenseNode {
  code: string;
  label: string;
  level: 1 | 2 | 3; // 1 = หมวดหลัก (1-11), 2 = หมวดย่อย (เช่น 3.1-3.5), 3 = รายการย่อย (- ...)
  voucherGroupName?: string; // ชื่อหมวดสำหรับหน้างบใบสำคัญ
}

export interface LedgerTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  docNo: string;
  categoryCode: string;
  subCategoryCode: string;
  accrualCode?: string; // รหัสหมวดย่อยระบบเกณฑ์คงค้าง (สำหรับรายจ่าย)
  isLowValueEquipment?: boolean; // ครุภัณฑ์ต่ำกว่า 10,000 บาท (หมายเหตุเกณฑ์คงค้าง)
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankAccountId: string;
  chequeNo?: string;
  transferDirection?: TransferDirection;
  projectId?: string;
  projectCode?: string; // เก็บชื่อย่อโครงการ/402/404 เพื่อแสดงผลและซิงก์
  issuerName: string;
  notes?: string;
  createdAt: string;
}

export interface AccountBalanceSnapshot {
  account: BankAccount;
  openingTotal: number;
  bankBalance: number;
  cashInHand: number;
  chequeInHand: number;
  loanAndAdvance: number;
  totalBalance: number;
}

export interface ProjectBalanceSnapshot {
  project: ProjectItem;
  receivedMonth: number;
  spentMonth: number;
  receivedYtd: number;
  spentYtd: number;
  remainingBalance: number;
  hasTransactions: boolean;
}

export interface ParsedEntryDraft {
  type: TransactionType;
  date: string;
  docNo: string;
  categoryCode: string;
  subCategoryCode: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankAccountId: string;
  chequeNo?: string;
  projectCode?: string;
  confidence?: string;
  reasoning: string;
}

export interface AuditFinding {
  severity: 'ok' | 'warning' | 'critical';
  title: string;
  detail: string;
  suggestion: string;
}

export interface AuditResult {
  overallStatus: 'normal' | 'attention' | 'warning';
  summary: string;
  reconciliationNote: string;
  findings: AuditFinding[];
}

export interface SpreadsheetSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}
