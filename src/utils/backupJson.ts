import { DEFAULT_PCU_SETTINGS, DEFAULT_PROJECTS } from '../data/pcuCatalog';
import {
  BackupSyncSettings,
  LedgerTransaction,
  PcuSettings,
} from '../types/accounting';

export interface PcuMonthlySummaryMeta {
  totalIncome: number;
  totalExpense: number;
  net: number;
  transferCount: number;
}

export interface PcuBackupPayload {
  app: 'PCU Ledger';
  schemaVersion: number;
  exportScope?: 'full' | 'monthly';
  monthKey?: string;
  monthLabel?: string;
  monthlySummary?: PcuMonthlySummaryMeta;
  exportedAt: string;
  unitName: string;
  fiscalYearBE: number;
  transactionCount: number;
  projectCount: number;
  settings: PcuSettings;
  transactions: LedgerTransaction[];
}

export interface BackupScheduleStatus {
  daysSinceLastBackup: number | null;
  isDue: boolean;
  daysRemaining: number;
  nextDueDate: Date | null;
}

export function normalizeBackupSyncSettings(
  raw?: Partial<BackupSyncSettings>
): BackupSyncSettings {
  const defaults = DEFAULT_PCU_SETTINGS.backupSync!;
  return {
    backupReminderEnabled:
      raw?.backupReminderEnabled ?? defaults.backupReminderEnabled,
    backupIntervalDays:
      raw?.backupIntervalDays && raw.backupIntervalDays >= 1
        ? raw.backupIntervalDays
        : defaults.backupIntervalDays,
    lastBackupAt: raw?.lastBackupAt ?? defaults.lastBackupAt,
    warnBeforeClose: raw?.warnBeforeClose ?? defaults.warnBeforeClose,
    sheetsConnectionEnabled:
      raw?.sheetsConnectionEnabled ?? defaults.sheetsConnectionEnabled,
    autoSyncSheetsEnabled:
      raw?.autoSyncSheetsEnabled ?? defaults.autoSyncSheetsEnabled,
    autoSyncIntervalMinutes:
      raw?.autoSyncIntervalMinutes && raw.autoSyncIntervalMinutes >= 1
        ? raw.autoSyncIntervalMinutes
        : defaults.autoSyncIntervalMinutes,
    lastAutoSyncAt: raw?.lastAutoSyncAt ?? defaults.lastAutoSyncAt,
    lockedGoogleEmail:
      typeof raw?.lockedGoogleEmail === 'string'
        ? raw.lockedGoogleEmail.trim()
        : defaults.lockedGoogleEmail,
    sheetsSettingsLocked:
      raw?.sheetsSettingsLocked ?? defaults.sheetsSettingsLocked,
    sheetsLockPin:
      typeof raw?.sheetsLockPin === 'string'
        ? raw.sheetsLockPin
        : defaults.sheetsLockPin,
  };
}

export function getBackupScheduleStatus(
  backupSync?: Partial<BackupSyncSettings>,
  nowMs: number = Date.now()
): BackupScheduleStatus {
  const cfg = normalizeBackupSyncSettings(backupSync);
  if (!cfg.lastBackupAt) {
    return {
      daysSinceLastBackup: null,
      isDue: cfg.backupReminderEnabled,
      daysRemaining: 0,
      nextDueDate: null,
    };
  }

  const lastMs = Date.parse(cfg.lastBackupAt);
  if (Number.isNaN(lastMs)) {
    return {
      daysSinceLastBackup: null,
      isDue: cfg.backupReminderEnabled,
      daysRemaining: 0,
      nextDueDate: null,
    };
  }

  const diffDays = Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24));
  const nextDueMs = lastMs + cfg.backupIntervalDays * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(
    0,
    Math.ceil((nextDueMs - nowMs) / (1000 * 60 * 60 * 24))
  );

  return {
    daysSinceLastBackup: Math.max(0, diffDays),
    isDue: cfg.backupReminderEnabled && diffDays >= cfg.backupIntervalDays,
    daysRemaining,
    nextDueDate: new Date(nextDueMs),
  };
}

export function buildBackupPayload(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  exportedAt: string = new Date().toISOString()
): PcuBackupPayload {
  const normalizedSettings: PcuSettings = {
    ...settings,
    backupSync: {
      ...normalizeBackupSyncSettings(settings.backupSync),
      lastBackupAt: exportedAt,
    },
  };

  return {
    app: 'PCU Ledger',
    schemaVersion: 1,
    exportedAt,
    unitName: settings.unitName,
    fiscalYearBE: settings.fiscalYearBE,
    transactionCount: transactions.length,
    projectCount: (settings.projects || []).length,
    settings: normalizedSettings,
    transactions,
  };
}

export function downloadBackupJson(
  settings: PcuSettings,
  transactions: LedgerTransaction[]
): { exportedAt: string; fileName: string } {
  const exportedAt = new Date().toISOString();
  const payload = buildBackupPayload(settings, transactions, exportedAt);
  const now = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const fileName = `pcu-ledger-backup-${settings.fiscalYearBE}-${stamp}.json`;

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { exportedAt, fileName };
}

export function buildMonthlyBackupPayload(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey: string,
  monthLabel: string,
  exportedAt: string = new Date().toISOString()
): PcuBackupPayload {
  const monthTxs = transactions
    .filter((t) => t.date.slice(0, 7) === monthKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const totalIncome = monthTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const transferCount = monthTxs.filter((t) => t.type === 'transfer').length;

  return {
    app: 'PCU Ledger',
    schemaVersion: 1,
    exportScope: 'monthly',
    monthKey,
    monthLabel,
    monthlySummary: {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      transferCount,
    },
    exportedAt,
    unitName: settings.unitName,
    fiscalYearBE: settings.fiscalYearBE,
    transactionCount: monthTxs.length,
    projectCount: (settings.projects || []).length,
    settings,
    transactions: monthTxs,
  };
}

export function downloadMonthlyBackupJson(
  settings: PcuSettings,
  transactions: LedgerTransaction[],
  monthKey: string,
  monthLabel: string
): { exportedAt: string; fileName: string; count: number } {
  const exportedAt = new Date().toISOString();
  const payload = buildMonthlyBackupPayload(
    settings,
    transactions,
    monthKey,
    monthLabel,
    exportedAt
  );
  const fileName = `pcu-ledger-monthly-${settings.fiscalYearBE}-${monthKey}.json`;

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { exportedAt, fileName, count: payload.transactionCount };
}

export function parseAndValidateBackupJson(rawText: string): PcuBackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('ไฟล์ที่เลือกไม่ใช่รูปแบบ JSON ที่ถูกต้อง');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('โครงสร้างไฟล์สำรองข้อมูลไม่ถูกต้อง');
  }

  const obj = parsed as Record<string, unknown>;
  const rawSettings = obj.settings as Partial<PcuSettings> | undefined;
  const rawTxs = obj.transactions;

  if (!rawSettings || typeof rawSettings !== 'object' || !rawSettings.unitName) {
    throw new Error('ไม่พบข้อมูลการตั้งค่าหน่วยงาน (settings) ในไฟล์สำรอง');
  }

  if (!Array.isArray(rawTxs)) {
    throw new Error('ไม่พบรายการสมุดรายวัน (transactions) ในไฟล์สำรอง');
  }

  const validTxs: LedgerTransaction[] = [];
  for (let i = 0; i < rawTxs.length; i++) {
    const item = rawTxs[i] as Partial<LedgerTransaction>;
    if (
      !item ||
      typeof item !== 'object' ||
      !item.date ||
      !item.type ||
      typeof item.amount !== 'number' ||
      Number.isNaN(item.amount)
    ) {
      throw new Error(`รายการที่ ${i + 1} ในไฟล์สำรองข้อมูลมีรูปแบบไม่สมบูรณ์`);
    }
    validTxs.push({
      id: item.id || `tx-restored-${Date.now()}-${i}`,
      date: String(item.date),
      type:
        item.type === 'income' || item.type === 'expense' || item.type === 'transfer'
          ? item.type
          : 'expense',
      docNo: String(item.docNo || ''),
      categoryCode: String(item.categoryCode || ''),
      subCategoryCode: String(item.subCategoryCode || ''),
      accrualCode: item.accrualCode ? String(item.accrualCode) : undefined,
      isLowValueEquipment: Boolean(item.isLowValueEquipment),
      description: String(item.description || ''),
      amount: Number(item.amount),
      paymentMethod:
        item.paymentMethod === 'cash' ||
        item.paymentMethod === 'bank' ||
        item.paymentMethod === 'cheque'
          ? item.paymentMethod
          : 'bank',
      bankAccountId: String(
        item.bankAccountId ||
          rawSettings.bankAccounts?.[0]?.id ||
          DEFAULT_PCU_SETTINGS.bankAccounts[0].id
      ),
      chequeNo: item.chequeNo ? String(item.chequeNo) : undefined,
      transferDirection: item.transferDirection,
      projectId: item.projectId ? String(item.projectId) : undefined,
      projectCode: item.projectCode ? String(item.projectCode) : undefined,
      issuerName: String(item.issuerName || ''),
      notes: item.notes ? String(item.notes) : undefined,
      createdAt: String(item.createdAt || new Date().toISOString()),
    });
  }

  const mergedSettings: PcuSettings = {
    ...DEFAULT_PCU_SETTINGS,
    ...rawSettings,
    bankAccounts:
      Array.isArray(rawSettings.bankAccounts) && rawSettings.bankAccounts.length > 0
        ? rawSettings.bankAccounts
        : DEFAULT_PCU_SETTINGS.bankAccounts,
    projects: Array.isArray(rawSettings.projects)
      ? rawSettings.projects
      : DEFAULT_PROJECTS,
    officers: {
      ...DEFAULT_PCU_SETTINGS.officers,
      ...(rawSettings.officers || {}),
    },
    docPrefixes: {
      ...DEFAULT_PCU_SETTINGS.docPrefixes,
      ...(rawSettings.docPrefixes || {}),
    },
    backupSync: normalizeBackupSyncSettings(rawSettings.backupSync),
  };

  const exportScope =
    obj.exportScope === 'monthly' ? 'monthly' : 'full';
  const monthKey =
    typeof obj.monthKey === 'string' && obj.monthKey.trim()
      ? obj.monthKey.trim()
      : undefined;
  const monthLabel =
    typeof obj.monthLabel === 'string' && obj.monthLabel.trim()
      ? obj.monthLabel.trim()
      : undefined;

  return {
    app: 'PCU Ledger',
    schemaVersion: Number(obj.schemaVersion) || 1,
    exportScope,
    monthKey,
    monthLabel,
    exportedAt: String(obj.exportedAt || new Date().toISOString()),
    unitName: mergedSettings.unitName,
    fiscalYearBE: mergedSettings.fiscalYearBE,
    transactionCount: validTxs.length,
    projectCount: mergedSettings.projects.length,
    settings: mergedSettings,
    transactions: validTxs,
  };
}

export function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return 'ยังไม่เคยสำรองข้อมูล';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ยังไม่เคยสำรองข้อมูล';
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
