import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BackupSyncSettings,
  BankAccount,
  LedgerTransaction,
  PcuSettings,
  ProjectControlType,
  ProjectItem,
} from '../types/accounting';
import {
  computeProjectBalances,
  formatMoney,
  getOpeningTotalAllAccounts,
} from '../utils/accountingMath';
import {
  formatThaiDateTime,
  getBackupScheduleStatus,
  normalizeBackupSyncSettings,
  parseAndValidateBackupJson,
  PcuBackupPayload,
} from '../utils/backupJson';
import { ConfirmModal } from './ConfirmModal';

interface SettingsWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  hasUnsavedChanges: boolean;
  onSaveSettings: (next: PcuSettings) => void;
  onResetDemoData: () => void;
  onBackupJsonNow: () => { exportedAt: string; fileName: string };
  onRestoreJsonBackup: (
    nextSettings: PcuSettings,
    nextTxs: LedgerTransaction[]
  ) => void;
  onOpenPreCloseReminder: () => void;
  onUpdateBackupSync: (patch: Partial<BackupSyncSettings>) => void;
}

type SettingsTab = 'general' | 'projects' | 'backup';

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  settings,
  transactions,
  hasUnsavedChanges,
  onSaveSettings,
  onResetDemoData,
  onBackupJsonNow,
  onRestoreJsonBackup,
  onOpenPreCloseReminder,
  onUpdateBackupSync,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [draft, setDraft] = useState<PcuSettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // JSON Backup & Restore state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupNotice, setBackupNotice] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [pendingRestore, setPendingRestore] = useState<PcuBackupPayload | null>(
    null
  );
  const [confirmEnableAutoSync, setConfirmEnableAutoSync] = useState(false);

  const prevSettingsRef = useRef(settings);
  useEffect(() => {
    const prev = prevSettingsRef.current;
    if (
      prev.unitName !== settings.unitName ||
      prev.fiscalYearBE !== settings.fiscalYearBE ||
      prev.bankAccounts !== settings.bankAccounts ||
      prev.projects !== settings.projects ||
      prev.linkedSpreadsheetId !== settings.linkedSpreadsheetId
    ) {
      setDraft(settings);
    }
    prevSettingsRef.current = settings;
  }, [settings]);

  const backupSync = useMemo(
    () => normalizeBackupSyncSettings(settings.backupSync),
    [settings.backupSync]
  );
  const scheduleStatus = useMemo(
    () => getBackupScheduleStatus(backupSync),
    [backupSync]
  );

  const projectSnapshots = useMemo(
    () => computeProjectBalances(draft, transactions),
    [draft, transactions]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...draft,
      backupSync: settings.backupSync,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleBackupClick = () => {
    const result = onBackupJsonNow();
    setRestoreError('');
    setBackupNotice(`ดาวน์โหลดไฟล์สำรอง "${result.fileName}" เรียบร้อยแล้ว`);
    setTimeout(() => setBackupNotice(''), 5000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreError('');
    setBackupNotice('');
    try {
      const text = await file.text();
      const payload = parseAndValidateBackupJson(text);
      setPendingRestore(payload);
    } catch (err: unknown) {
      setRestoreError(
        err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ JSON ได้'
      );
    }
  };

  const handleToggleAutoSync = (nextEnabled: boolean) => {
    if (nextEnabled) {
      setConfirmEnableAutoSync(true);
    } else {
      onUpdateBackupSync({ autoSyncSheetsEnabled: false });
    }
  };

  const updateBank = (
    idx: number,
    field: keyof BankAccount,
    value: string | number
  ) => {
    setDraft((prev) => {
      const nextBanks = [...prev.bankAccounts];
      nextBanks[idx] = { ...nextBanks[idx], [field]: value };
      return { ...prev, bankAccounts: nextBanks };
    });
  };

  const addBankAccount = () => {
    setDraft((prev) => ({
      ...prev,
      bankAccounts: [
        ...prev.bankAccounts,
        {
          id: `bank-${Date.now()}`,
          order: prev.bankAccounts.length + 1,
          name: '',
          fundType: 'นอกงบประมาณ',
          accountNo: '',
          openingBank: 0,
          openingCash: 0,
          openingLoan: 0,
          openingAdvance: 0,
          openingCheque: 0,
        },
      ],
    }));
  };

  const removeBankAccount = (idx: number) => {
    if (draft.bankAccounts.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts
        .filter((_, i) => i !== idx)
        .map((b, i) => ({ ...b, order: i + 1 })),
    }));
  };

  // Project / 402 / 404 Management
  const updateProject = (
    idx: number,
    field: keyof ProjectItem,
    value: string | number | ProjectControlType
  ) => {
    setDraft((prev) => {
      const nextProjects = [...(prev.projects || [])];
      nextProjects[idx] = { ...nextProjects[idx], [field]: value };
      return { ...prev, projects: nextProjects };
    });
  };

  const addProject = () => {
    setDraft((prev) => {
      const existing = prev.projects || [];
      const maxOrder = existing.reduce((m, p) => Math.max(m, p.order), 0);
      return {
        ...prev,
        projects: [
          ...existing,
          {
            id: `proj-${Date.now()}`,
            order: maxOrder + 1,
            type: 'fund_project',
            shortName: '',
            fullName: '',
            openingBalance: 0,
          },
        ],
      };
    });
  };

  const removeProject = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((_, i) => i !== idx),
    }));
  };

  const totalOpening = getOpeningTotalAllAccounts(draft);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'general'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ตั้งค่าหน่วยงานและบัญชีธนาคาร
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'projects'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ตั้งค่าโครงการ / 402 / 404 ย่อย
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'backup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            สำรอง JSON &amp; ซิงก์อัตโนมัติ
          </button>
        </div>

        {activeTab !== 'backup' && (
          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                <CheckCircle2 className="h-4 w-4" />
                บันทึกการตั้งค่าเรียบร้อยแล้ว
              </span>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Save className="h-3.5 w-3.5" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'general' && (
        <>
          {/* Unit & Fiscal Year Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                ตั้งค่าเริ่มต้นหน่วยงานและปีงบประมาณ
              </h2>
              <p className="text-xs text-slate-500">
                ข้อมูลนี้จะปรากฏบนหัวรายงานแบบ 401, 404, 407, หน้างบใบสำคัญ และงบเดือนรับ-จ่าย รวมถึงแท็บตั้งค่าใน Google Sheets
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ชื่อหน่วยงาน (รพ.สต.)
                </label>
                <input
                  type="text"
                  value={draft.unitName}
                  onChange={(e) => setDraft({ ...draft, unitName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ที่อยู่ (อำเภอ / จังหวัด)
                </label>
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  สังกัดหน่วยงาน
                </label>
                <select
                  value={draft.affiliation}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      affiliation: e.target.value as 'moph' | 'pao',
                      affiliationLabel:
                        e.target.value === 'pao'
                          ? 'องค์การบริหารส่วนจังหวัดสระบุรี'
                          : 'สำนักงานสาธารณสุขอำเภอดอนพุด จ.สระบุรี',
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  <option value="moph">กระทรวงสาธารณสุข (สสอ. / สสจ.)</option>
                  <option value="pao">องค์การบริหารส่วนจังหวัด (สังกัด อบจ.)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  หน่วยงานต้นสังกัดที่ส่งงบเดือน
                </label>
                <input
                  type="text"
                  value={draft.affiliationLabel}
                  onChange={(e) =>
                    setDraft({ ...draft, affiliationLabel: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ปีงบประมาณ (พ.ศ.)
                </label>
                <input
                  type="number"
                  value={draft.fiscalYearBE}
                  onChange={(e) =>
                    setDraft({ ...draft, fiscalYearBE: Number(e.target.value) })
                  }
                  className="font-mono-num w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    วันเริ่มปีงบประมาณ
                  </label>
                  <input
                    type="date"
                    value={draft.fiscalStartDate}
                    onChange={(e) =>
                      setDraft({ ...draft, fiscalStartDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    วันสิ้นสุดปีงบประมาณ
                  </label>
                  <input
                    type="date"
                    value={draft.fiscalEndDate}
                    onChange={(e) =>
                      setDraft({ ...draft, fiscalEndDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Bank Accounts & Opening Balances */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  บัญชีธนาคารและยอดเงินคงเหลือยกมา (ณ วันสิ้นปีงบประมาณก่อน)
                </h2>
                <p className="text-xs text-slate-500">
                  รวมยอดยกมาทุกบัญชีปัจจุบัน:{' '}
                  <span className="font-mono-num font-semibold text-teal-800">
                    {formatMoney(totalOpening)} บาท
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={addBankAccount}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>เพิ่มบัญชีธนาคาร</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 font-semibold">ที่</th>
                    <th className="px-2 py-2 font-semibold">ชื่อบัญชีธนาคาร</th>
                    <th className="px-2 py-2 font-semibold">ประเภทเงิน</th>
                    <th className="px-2 py-2 font-semibold">เลขที่บัญชี</th>
                    <th className="px-2 py-2 text-right font-semibold">เงินฝากในบัญชี</th>
                    <th className="px-2 py-2 text-right font-semibold">เงินสดในมือ</th>
                    <th className="px-2 py-2 text-right font-semibold">สัญญายืม</th>
                    <th className="px-2 py-2 text-right font-semibold">สำรองจ่าย</th>
                    <th className="px-2 py-2 text-right font-semibold">เช็ครอฝาก</th>
                    <th className="px-2 py-2 text-center font-semibold">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {draft.bankAccounts.map((acc, idx) => (
                    <tr key={acc.id}>
                      <td className="px-2 py-2 font-semibold text-slate-700">
                        {acc.order}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => updateBank(idx, 'name', e.target.value)}
                          className="w-44 rounded border border-slate-200 px-2 py-1 text-xs"
                          required
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={acc.fundType}
                          onChange={(e) =>
                            updateBank(idx, 'fundType', e.target.value)
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="นอกงบประมาณ">นอกงบประมาณ</option>
                          <option value="งบประมาณ">งบประมาณ</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={acc.accountNo}
                          onChange={(e) =>
                            updateBank(idx, 'accountNo', e.target.value)
                          }
                          className="font-mono-num w-32 rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={acc.openingBank}
                          onChange={(e) =>
                            updateBank(idx, 'openingBank', Number(e.target.value))
                          }
                          className="font-mono-num w-28 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={acc.openingCash}
                          onChange={(e) =>
                            updateBank(idx, 'openingCash', Number(e.target.value))
                          }
                          className="font-mono-num w-24 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={acc.openingLoan}
                          onChange={(e) =>
                            updateBank(idx, 'openingLoan', Number(e.target.value))
                          }
                          className="font-mono-num w-20 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={acc.openingAdvance}
                          onChange={(e) =>
                            updateBank(
                              idx,
                              'openingAdvance',
                              Number(e.target.value)
                            )
                          }
                          className="font-mono-num w-20 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={acc.openingCheque}
                          onChange={(e) =>
                            updateBank(idx, 'openingCheque', Number(e.target.value))
                          }
                          className="font-mono-num w-20 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeBankAccount(idx)}
                          disabled={draft.bankAccounts.length <= 1}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Officers & Document Prefixes */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              รายชื่อเจ้าหน้าที่ออกรายงานและเลขที่เอกสารเริ่มต้น
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  กรรมการเก็บเงิน คนที่ 1
                </label>
                <input
                  type="text"
                  value={draft.officers.cashCommittee1}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      officers: { ...draft.officers, cashCommittee1: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  กรรมการเก็บเงิน คนที่ 2
                </label>
                <input
                  type="text"
                  value={draft.officers.cashCommittee2}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      officers: { ...draft.officers, cashCommittee2: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  กรรมการเก็บเงิน คนที่ 3
                </label>
                <input
                  type="text"
                  value={draft.officers.cashCommittee3}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      officers: { ...draft.officers, cashCommittee3: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ผู้รับเงิน (รง.407)
                </label>
                <input
                  type="text"
                  value={draft.officers.cashReceiver407}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      officers: { ...draft.officers, cashReceiver407: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  เจ้าหน้าที่การเงิน
                </label>
                <input
                  type="text"
                  value={draft.officers.financeOfficer}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      officers: { ...draft.officers, financeOfficer: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  หัวหน้าหน่วยงานย่อย
                </label>
                <input
                  type="text"
                  value={draft.officers.unitHead}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      officers: { ...draft.officers, unitHead: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  คำนำหน้าเอกสารรายจ่าย
                </label>
                <input
                  type="text"
                  value={draft.docPrefixes.expensePrefix}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      docPrefixes: {
                        ...draft.docPrefixes,
                        expensePrefix: e.target.value,
                      },
                    })
                  }
                  className="font-mono-num w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ใบเสร็จรับเงิน เล่มหลัก
                </label>
                <input
                  type="text"
                  value={draft.docPrefixes.receiptBookMain}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      docPrefixes: {
                        ...draft.docPrefixes,
                        receiptBookMain: e.target.value,
                      },
                    })
                  }
                  className="font-mono-num w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ผู้สั่งจ่ายเช็ค (คนที่ 1 - 2)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={draft.officers.chequeSigner1}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        officers: { ...draft.officers, chequeSigner1: e.target.value },
                      })
                    }
                    placeholder="คนที่ 1"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={draft.officers.chequeSigner2}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        officers: { ...draft.officers, chequeSigner2: e.target.value },
                      })
                    }
                    placeholder="คนที่ 2"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>คืนค่าเริ่มต้น รพ.สต.บ้านรี (ต.ค. 69)</span>
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <Save className="h-4 w-4" />
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* 3. Project / 402 / 404 Sub-Ledger Settings */}
      {activeTab === 'projects' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                ชื่อโครงการต่างๆ หรือ ทะเบียนที่ต้องการคุมเงินรับ-จ่าย 402 หรือ 404 ย่อย
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                จำนวนเงินที่ได้รับและจ่ายของแต่ละโครงการให้บันทึกผ่านหน้า &ldquo;บันทึกรายวัน&rdquo; โดยเลือกชื่อโครงการ/402/404 ที่กำหนดไว้ที่นี่
              </p>
            </div>
            <button
              type="button"
              onClick={addProject}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>เพิ่มโครงการ / 402 / 404 ย่อย</span>
            </button>
          </div>

          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="font-medium">
              คำเตือน !! โครงการ / 402 / 404 หากโครงการนั้นได้ลงข้อมูล รับ - จ่าย ไปแล้ว ห้ามแก้ไขเลขลำดับโดยเด็ดขาด (สามารถแก้ไขชื่อย่อ ชื่อเต็ม ประเภท และยอดยกมาได้)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th rowSpan={2} className="w-16 border border-slate-200 px-2 py-2 text-center font-semibold">
                    ลำดับ
                  </th>
                  <th colSpan={4} className="border border-slate-200 px-2 py-1.5 text-center font-semibold">
                    เลือกได้เพียง 1 ประเภทเท่านั้น
                  </th>
                  <th rowSpan={2} className="w-44 border border-slate-200 px-2 py-2 text-left font-semibold">
                    ชื่อย่อๆ โครงการ / 402 / 404
                  </th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-2 text-left font-semibold">
                    ชื่อเต็ม โครงการ / 402 / 404
                  </th>
                  <th rowSpan={2} className="w-32 border border-slate-200 px-2 py-2 text-right font-semibold">
                    เงินเหลือยกมาจากปีก่อน
                  </th>
                  <th rowSpan={2} className="w-28 border border-slate-200 px-2 py-2 text-right font-semibold">
                    คงเหลือปัจจุบัน
                  </th>
                  <th rowSpan={2} className="w-14 border border-slate-200 px-2 py-2 text-center font-semibold">
                    ลบ
                  </th>
                </tr>
                <tr className="bg-slate-50 text-[11px] text-slate-600">
                  <th className="w-20 border border-slate-200 px-1.5 py-1.5 text-center font-medium">
                    โครงการ งบ P &amp; P
                  </th>
                  <th className="w-20 border border-slate-200 px-1.5 py-1.5 text-center font-medium">
                    โครงการ งบกองทุนฯ
                  </th>
                  <th className="w-20 border border-slate-200 px-1.5 py-1.5 text-center font-medium">
                    402 เงินงบประมาณ
                  </th>
                  <th className="w-24 border border-slate-200 px-1.5 py-1.5 text-center font-medium">
                    404 ย่อย เงินนอกงบฯ
                  </th>
                </tr>
              </thead>
              <tbody>
                {(draft.projects || []).map((proj, idx) => {
                  const snap = projectSnapshots.find(
                    (s) => s.project.id === proj.id
                  );
                  const locked = Boolean(snap?.hasTransactions);
                  const types: ProjectControlType[] = [
                    'pp_project',
                    'fund_project',
                    'budget_402',
                    'sub_404',
                  ];

                  return (
                    <tr key={proj.id} className="hover:bg-slate-50/70">
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={proj.order}
                          disabled={locked}
                          onChange={(e) =>
                            updateProject(idx, 'order', Number(e.target.value))
                          }
                          title={
                            locked
                              ? 'มีการลงข้อมูลรับ-จ่ายแล้ว ห้ามแก้ไขเลขลำดับ'
                              : 'เลขลำดับ'
                          }
                          className="font-mono-num w-12 rounded border border-slate-200 px-1.5 py-1 text-center text-xs disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </td>

                      {types.map((t) => (
                        <td
                          key={t}
                          className="border border-slate-200 px-2 py-2 text-center"
                        >
                          <input
                            type="radio"
                            name={`proj-type-${proj.id}`}
                            checked={proj.type === t}
                            onChange={() => updateProject(idx, 'type', t)}
                            className="h-4 w-4 cursor-pointer accent-teal-700"
                          />
                        </td>
                      ))}

                      <td className="border border-slate-200 px-2 py-2">
                        <input
                          type="text"
                          value={proj.shortName}
                          onChange={(e) =>
                            updateProject(idx, 'shortName', e.target.value)
                          }
                          placeholder="เช่น เด็กอ้วน งบ 60,000"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          required
                        />
                      </td>

                      <td className="border border-slate-200 px-2 py-2">
                        <input
                          type="text"
                          value={proj.fullName}
                          onChange={(e) =>
                            updateProject(idx, 'fullName', e.target.value)
                          }
                          placeholder="ชื่อเต็มโครงการ..."
                          className="w-full min-w-[200px] rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>

                      <td className="border border-slate-200 px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={proj.openingBalance}
                          onChange={(e) =>
                            updateProject(
                              idx,
                              'openingBalance',
                              Number(e.target.value)
                            )
                          }
                          className="font-mono-num w-full rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </td>

                      <td className="font-mono-num border border-slate-200 px-2 py-2 text-right font-semibold text-teal-800 tabular-nums">
                        {formatMoney(
                          snap ? snap.remainingBalance : proj.openingBalance
                        )}
                      </td>

                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeProject(idx)}
                          disabled={locked}
                          title={
                            locked
                              ? 'ไม่สามารถลบโครงการที่มีรายการรับ-จ่ายแล้ว'
                              : 'ลบโครงการ'
                          }
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Save className="h-4 w-4" />
              <span>บันทึกการตั้งค่าโครงการ / 402 / 404</span>
            </button>
          </div>
        </section>
      )}

      {/* 4. JSON Backup / Restore & Scheduled Reminder & Google Sheets Toggle */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {backupNotice && (
            <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-medium text-teal-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{backupNotice}</span>
            </div>
          )}

          {restoreError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {restoreError}
            </div>
          )}

          {/* JSON Export & Import */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FileJson className="h-4 w-4 text-teal-700" />
                  <span>สำรองข้อมูลและนำกลับมาใช้ (ไฟล์ .json)</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  ส่งออกข้อมูลทั้งหมด (ตั้งค่าหน่วยงาน บัญชีธนาคาร โครงการ/402/404 และรายการรับ-จ่ายทั้งหมด) เป็นไฟล์ JSON เพื่อเก็บสำรองหรือย้ายเครื่อง
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>สำรองข้อมูลล่าสุด</p>
                <p className="font-semibold text-slate-900">
                  {formatThaiDateTime(backupSync.lastBackupAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  สำรองข้อมูลเป็นไฟล์ JSON
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  ข้อมูลปัจจุบัน: {transactions.length} รายการ ·{' '}
                  {(settings.projects || []).length} โครงการ/ทะเบียนคุม{' '}
                  {hasUnsavedChanges
                    ? '(มีการแก้ไขที่ยังไม่ได้สำรอง)'
                    : '(ตรงกับไฟล์สำรองล่าสุด)'}
                </p>
                <button
                  type="button"
                  onClick={handleBackupClick}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Download className="h-4 w-4" />
                  <span>ดาวน์โหลดไฟล์สำรอง (.json) ทันที</span>
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  นำเข้าไฟล์ JSON เพื่อกู้คืนข้อมูล
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  เลือกไฟล์สำรอง .json ที่เคยบันทึกไว้ ระบบจะตรวจสอบความถูกต้องและแสดงสรุปให้ยืนยันก่อนนำเข้า
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <Upload className="h-4 w-4" />
                  <span>เลือกไฟล์ JSON เพื่อนำกลับมาใช้</span>
                </button>
              </div>
            </div>
          </section>

          {/* 15-Day Schedule & Before Close Reminder */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>ตั้งเวลาแจ้งเตือนสำรองไฟล์ทุก 15 วัน และเตือนก่อนปิดไฟล์</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  เมื่อครบกำหนดรอบวันหรือมีการแก้ไขข้อมูลค้างอยู่ ระบบจะเด้งหน้าต่างแจ้งเตือนให้สำรองไฟล์ JSON ก่อนปิดโปรแกรม
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPreCloseReminder}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>ตรวจสอบ &amp; แสดงหน้าต่างเตือนก่อนปิดไฟล์</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={backupSync.backupReminderEnabled}
                  onChange={(e) =>
                    onUpdateBackupSync({
                      backupReminderEnabled: e.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-teal-700"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    เปิดแจ้งเตือนสำรองไฟล์ตามรอบเวลา
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    แสดงข้อความเตือนอัตโนมัติเมื่อครบกำหนดรอบวันที่ตั้งไว้
                  </p>
                </div>
              </label>

              <div className="rounded-lg border border-slate-200 p-4 text-xs">
                <label className="block font-semibold text-slate-900">
                  รอบกำหนดสำรองข้อมูล (วัน)
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={backupSync.backupIntervalDays}
                    onChange={(e) =>
                      onUpdateBackupSync({
                        backupIntervalDays: Math.max(
                          1,
                          Number(e.target.value) || 15
                        ),
                      })
                    }
                    className="font-mono-num w-20 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                  />
                  <span className="text-slate-600">วัน (ค่ามาตรฐาน 15 วัน)</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {scheduleStatus.daysSinceLastBackup === null
                    ? 'สถานะ: ยังไม่เคยสำรองไฟล์ JSON'
                    : scheduleStatus.isDue
                    ? `ครบกำหนดแล้ว (ผ่านมา ${scheduleStatus.daysSinceLastBackup} วัน)`
                    : `เหลืออีก ${scheduleStatus.daysRemaining} วันจะครบกำหนด`}
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={backupSync.warnBeforeClose}
                  onChange={(e) =>
                    onUpdateBackupSync({ warnBeforeClose: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 accent-teal-700"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    เด้งข้อความเตือนก่อนปิดไฟล์ / ปิดหน้าต่าง
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    แจ้งเตือนก่อนปิดแท็บเบราว์เซอร์หากครบกำหนด 15 วัน หรือมีรายการแก้ไขที่ยังไม่สำรอง
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* Google Sheets Toggle & 5-Minute Auto-Sync */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FileSpreadsheet className="h-4 w-4 text-teal-700" />
                  <span>เปิด-ปิดการเชื่อม Google Sheets และบันทึกอัตโนมัติทุก 5 นาที</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  ควบคุมการทำงานของระบบเชื่อมต่อ Google Sheets และกำหนดให้บันทึกลงไฟล์ Sheets ที่เชื่อมไว้โดยอัตโนมัติ
                </p>
              </div>
              {backupSync.sheetsSettingsLocked && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    ล็อคการตั้งค่าอยู่
                    {backupSync.lockedGoogleEmail
                      ? ` (${backupSync.lockedGoogleEmail})`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    เปิดใช้งานการเชื่อมต่อ Google Sheets
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {backupSync.sheetsSettingsLocked
                      ? 'ถูกล็อคไว้ — ไปที่เมนู Google Sheets เพื่อปลดล็อคก่อนแก้ไข'
                      : backupSync.sheetsConnectionEnabled
                      ? 'เปิดอยู่ — สามารถเข้าสู่ระบบ ซิงก์ และนำเข้า Google Sheets ได้'
                      : 'ปิดอยู่ — ระงับการเชื่อมต่อและซิงก์ Google Sheets ชั่วคราว'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={backupSync.sheetsConnectionEnabled}
                  disabled={backupSync.sheetsSettingsLocked}
                  onClick={() =>
                    onUpdateBackupSync({
                      sheetsConnectionEnabled: !backupSync.sheetsConnectionEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    backupSync.sheetsConnectionEnabled
                      ? 'bg-teal-700'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      backupSync.sheetsConnectionEnabled
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    บันทึกลง Google Sheets อัตโนมัติทุก{' '}
                    {backupSync.autoSyncIntervalMinutes} นาที
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {backupSync.sheetsSettingsLocked
                      ? 'ถูกล็อคไว้ — ไปที่เมนู Google Sheets เพื่อปลดล็อคก่อนแก้ไข'
                      : !backupSync.sheetsConnectionEnabled
                      ? 'ต้องเปิดใช้งานการเชื่อมต่อ Google Sheets ก่อน'
                      : backupSync.autoSyncSheetsEnabled
                      ? `เปิดอยู่ · ซิงก์อัตโนมัติล่าสุด: ${formatThaiDateTime(
                          backupSync.lastAutoSyncAt
                        )}`
                      : 'ปิดอยู่ — กดบันทึกขึ้น Google Sheets ด้วยตนเองเท่านั้น'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={backupSync.autoSyncSheetsEnabled}
                  disabled={
                    !backupSync.sheetsConnectionEnabled ||
                    backupSync.sheetsSettingsLocked
                  }
                  onClick={() =>
                    handleToggleAutoSync(!backupSync.autoSyncSheetsEnabled)
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    backupSync.autoSyncSheetsEnabled &&
                    backupSync.sheetsConnectionEnabled
                      ? 'bg-teal-700'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      backupSync.autoSyncSheetsEnabled &&
                      backupSync.sheetsConnectionEnabled
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <ConfirmModal
        open={confirmResetOpen}
        title="คืนค่าข้อมูลเริ่มต้น รพ.สต.บ้านรี"
        description="การคืนค่าเริ่มต้นจะแทนที่รายการและตั้งค่าในเครื่องปัจจุบันด้วยข้อมูลตั้งต้นปีงบประมาณ 2570 (เดือนตุลาคม 2569) โดยไม่กระทบไฟล์บน Google Sheets จนกว่าคุณจะกดซิงก์"
        confirmLabel="ยืนยันคืนค่าเริ่มต้น"
        variant="danger"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          onResetDemoData();
          setConfirmResetOpen(false);
        }}
      />

      <ConfirmModal
        open={Boolean(pendingRestore)}
        title="ยืนยันการนำเข้าข้อมูลจากไฟล์ JSON"
        description={`ระบบตรวจสอบไฟล์สำรองเรียบร้อยแล้ว ข้อมูลปัจจุบันในเครื่องจะถูกแทนที่ด้วยข้อมูลจากไฟล์สำรองของ "${
          pendingRestore?.unitName || ''
        }"`}
        details={
          pendingRestore
            ? [
                `ปีงบประมาณ: พ.ศ. ${pendingRestore.fiscalYearBE}`,
                `จำนวนรายการในสมุดรายวัน: ${pendingRestore.transactionCount} รายการ`,
                `จำนวนโครงการ / 402 / 404: ${pendingRestore.projectCount} รายการ`,
                `วันที่สำรองไฟล์: ${formatThaiDateTime(
                  pendingRestore.exportedAt
                )}`,
              ]
            : undefined
        }
        confirmLabel="ยืนยันนำเข้าข้อมูล"
        variant="danger"
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => {
          if (pendingRestore) {
            onRestoreJsonBackup(
              pendingRestore.settings,
              pendingRestore.transactions
            );
            setBackupNotice(
              `นำเข้าข้อมูลจากไฟล์สำรองสำเร็จ (${pendingRestore.transactionCount} รายการ)`
            );
            setPendingRestore(null);
          }
        }}
      />

      <ConfirmModal
        open={confirmEnableAutoSync}
        title="ยืนยันเปิดการบันทึกอัตโนมัติลง Google Sheets"
        description={`เมื่อเปิดใช้งาน ระบบจะเขียนอัปเดตข้อมูลและรายงานทั้งหมดลงในไฟล์ Google Sheets ที่เชื่อมไว้โดยอัตโนมัติทุก ๆ ${backupSync.autoSyncIntervalMinutes} นาที (เมื่อเข้าสู่ระบบ Google และเลือกไฟล์ปลายทางแล้ว)`}
        details={[
          `ไฟล์ปลายทางปัจจุบัน: ${
            settings.linkedSpreadsheetTitle ||
            settings.linkedSpreadsheetId ||
            'ยังไม่ได้เลือกไฟล์ (กรุณาเลือกที่เมนู Google Sheets)'
          }`,
          'คุณสามารถปิดการบันทึกอัตโนมัติหรือปิดการเชื่อมต่อ Google Sheets ได้ทุกเมื่อ',
        ]}
        confirmLabel="เปิดบันทึกอัตโนมัติ"
        onCancel={() => setConfirmEnableAutoSync(false)}
        onConfirm={() => {
          onUpdateBackupSync({
            sheetsConnectionEnabled: true,
            autoSyncSheetsEnabled: true,
          });
          setConfirmEnableAutoSync(false);
        }}
      />
    </form>
  );
};
