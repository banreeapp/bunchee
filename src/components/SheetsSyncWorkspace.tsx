import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Mail,
  Power,
  RefreshCw,
  ShieldCheck,
  Unlink,
  Unlock,
  UploadCloud,
} from 'lucide-react';
import { FISCAL_MONTHS } from '../data/pcuCatalog';
import {
  createPcuSpreadsheet,
  extractSpreadsheetIdFromInput,
  getSpreadsheetMetadata,
  importFromGoogleSheets,
  listAppSpreadsheets,
  PCU_SHEET_TABS,
  syncAllToGoogleSheets,
} from '../services/googleSheets';
import {
  BackupSyncSettings,
  LedgerTransaction,
  PcuSettings,
  SpreadsheetSummary,
} from '../types/accounting';
import {
  formatThaiDateTime,
  normalizeBackupSyncSettings,
} from '../utils/backupJson';
import { ConfirmModal } from './ConfirmModal';

interface SheetsSyncWorkspaceProps {
  user: User | null;
  accessToken: string | null;
  isLoggingIn: boolean;
  authError: string;
  onLogin: () => void;
  onLogout: () => void;
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  selectedDate407: string;
  autoSyncStatus: 'idle' | 'syncing' | 'error';
  autoSyncError: string;
  nextAutoSyncSeconds: number | null;
  onUpdateSettings: (next: PcuSettings) => void;
  onUpdateBackupSync: (patch: Partial<BackupSyncSettings>) => void;
  onReplaceAllData: (nextSettings: PcuSettings, nextTxs: LedgerTransaction[]) => void;
}

export const SheetsSyncWorkspace: React.FC<SheetsSyncWorkspaceProps> = ({
  user,
  accessToken,
  isLoggingIn,
  authError,
  onLogin,
  onLogout,
  settings,
  transactions,
  selectedMonthKey,
  selectedDate407,
  autoSyncStatus,
  autoSyncError,
  nextAutoSyncSeconds,
  onUpdateSettings,
  onUpdateBackupSync,
  onReplaceAllData,
}) => {
  const [newSheetTitle, setNewSheetTitle] = useState(
    `บัญชีการเงิน_${settings.unitName}_ปีงบ${settings.fiscalYearBE}`
  );
  const [linkInput, setLinkInput] = useState(settings.linkedSpreadsheetId || '');
  const [copiedId, setCopiedId] = useState(false);
  const [appSheets, setAppSheets] = useState<SpreadsheetSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [tabNames, setTabNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Mandatory explicit confirmation dialogs before mutating Google Sheets or local state
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [confirmEnableAutoSync, setConfirmEnableAutoSync] = useState(false);

  const backupSync = useMemo(
    () => normalizeBackupSyncSettings(settings.backupSync),
    [settings.backupSync]
  );
  const sheetsEnabled = backupSync.sheetsConnectionEnabled;
  const isLocked = backupSync.sheetsSettingsLocked;
  const totalTabCount = Object.keys(PCU_SHEET_TABS).length;

  // Lock settings & authorized email controls
  const [lockedEmailInput, setLockedEmailInput] = useState(
    backupSync.lockedGoogleEmail || user?.email || ''
  );
  const [lockPinInput, setLockPinInput] = useState(backupSync.sheetsLockPin || '');
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockPinAttempt, setUnlockPinAttempt] = useState('');
  const [unlockPinError, setUnlockPinError] = useState('');

  useEffect(() => {
    setLinkInput(settings.linkedSpreadsheetId || '');
  }, [settings.linkedSpreadsheetId]);

  useEffect(() => {
    setLockedEmailInput(backupSync.lockedGoogleEmail || user?.email || '');
    setLockPinInput(backupSync.sheetsLockPin || '');
  }, [backupSync.lockedGoogleEmail, backupSync.sheetsLockPin, user?.email]);

  const loadFilesAndMeta = async (token: string, currentSheetId: string) => {
    setLoadingList(true);
    try {
      const files = await listAppSpreadsheets(token);
      setAppSheets(files);
      if (currentSheetId) {
        const meta = await getSpreadsheetMetadata(token, currentSheetId);
        setTabNames(meta.sheets.map((s) => s.properties.title));
        if (meta.properties.title && meta.properties.title !== settings.linkedSpreadsheetTitle) {
          onUpdateSettings({
            ...settings,
            linkedSpreadsheetTitle: meta.properties.title,
          });
        }
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (accessToken && sheetsEnabled) {
      loadFilesAndMeta(accessToken, settings.linkedSpreadsheetId);
    } else {
      setAppSheets([]);
      setTabNames([]);
    }
  }, [accessToken, settings.linkedSpreadsheetId, sheetsEnabled]);

  const handleCreateSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || isLocked) return;
    setBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const meta = await createPcuSpreadsheet(
        accessToken,
        newSheetTitle.trim() || `PCU_Ledger_${settings.fiscalYearBE}`
      );
      const nextSettings: PcuSettings = {
        ...settings,
        linkedSpreadsheetId: meta.spreadsheetId,
        linkedSpreadsheetTitle: meta.properties.title,
      };
      onUpdateSettings(nextSettings);
      setLinkInput(meta.spreadsheetId);
      setTabNames(meta.sheets.map((s) => s.properties.title));
      setStatusMessage(
        `สร้างไฟล์ "${meta.properties.title}" พร้อมทั้ง ${totalTabCount} แท็บรายงานเรียบร้อยแล้ว`
      );
      await loadFilesAndMeta(accessToken, meta.spreadsheetId);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'ไม่สามารถสร้าง Google Sheets ได้'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleBindSpreadsheetId = async (rawIdOrUrl: string) => {
    if (isLocked) {
      setErrorMessage('การตั้งค่า Google Sheets ถูกล็อคอยู่ กรุณาปลดล็อคก่อนเปลี่ยนไฟล์');
      return;
    }
    const spreadsheetId = extractSpreadsheetIdFromInput(rawIdOrUrl);
    if (!spreadsheetId) {
      setErrorMessage('กรุณาระบุ URL ของ Google Sheets หรือ Spreadsheet ID');
      return;
    }
    setErrorMessage('');
    setStatusMessage('');

    // If not signed in yet, save the Spreadsheet ID locally so it is pre-bound when signing in
    if (!accessToken) {
      onUpdateSettings({
        ...settings,
        linkedSpreadsheetId: spreadsheetId,
        linkedSpreadsheetTitle: '',
      });
      setLinkInput(spreadsheetId);
      setStatusMessage(
        `ผูก Spreadsheet ID "${spreadsheetId}" เรียบร้อยแล้ว — กด Sign in with Google เพื่อตรวจสอบไฟล์และเริ่มซิงก์ข้อมูล`
      );
      return;
    }

    setBusy(true);
    try {
      const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
      onUpdateSettings({
        ...settings,
        linkedSpreadsheetId: meta.spreadsheetId,
        linkedSpreadsheetTitle: meta.properties.title,
      });
      setLinkInput(meta.spreadsheetId);
      setTabNames(meta.sheets.map((s) => s.properties.title));
      setStatusMessage(`ผูกและเชื่อมต่อไฟล์ "${meta.properties.title}" สำเร็จ`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'ไม่พบไฟล์ Google Sheets หรือไม่มีสิทธิ์เข้าถึงไฟล์นี้'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUnbindSpreadsheet = () => {
    if (isLocked) return;
    onUpdateSettings({
      ...settings,
      linkedSpreadsheetId: '',
      linkedSpreadsheetTitle: '',
    });
    setLinkInput('');
    setTabNames([]);
    setErrorMessage('');
    setStatusMessage('ยกเลิกการผูก Spreadsheet ID แล้ว');
  };

  const handleLockSettings = () => {
    const emailTrimmed = (lockedEmailInput.trim() || user?.email || '').trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setErrorMessage('รูปแบบอีเมล Google ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    if (
      user?.email &&
      emailTrimmed &&
      user.email.trim().toLowerCase() !== emailTrimmed.toLowerCase()
    ) {
      setErrorMessage(
        `บัญชีที่ล็อกอินอยู่ (${user.email}) ไม่ตรงกับอีเมลที่ต้องการล็อค (${emailTrimmed}) กรุณาออกจากระบบก่อน หรือกดใช้บัญชีปัจจุบัน`
      );
      return;
    }
    setErrorMessage('');
    onUpdateBackupSync({
      lockedGoogleEmail: emailTrimmed,
      sheetsLockPin: lockPinInput.trim(),
      sheetsSettingsLocked: true,
    });
    setLockedEmailInput(emailTrimmed);
    setStatusMessage(
      `ล็อคการตั้งค่าการเชื่อมต่อ Google Sheets${
        emailTrimmed ? ` และอีเมล ${emailTrimmed}` : ''
      } เรียบร้อยแล้ว`
    );
  };

  const handleOpenUnlockModal = () => {
    setUnlockPinAttempt('');
    setUnlockPinError('');
    setUnlockModalOpen(true);
  };

  const handleConfirmUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (backupSync.sheetsLockPin) {
      if (unlockPinAttempt.trim() !== backupSync.sheetsLockPin) {
        setUnlockPinError('รหัสปลดล็อคไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return;
      }
    }
    onUpdateBackupSync({ sheetsSettingsLocked: false });
    setUnlockModalOpen(false);
    setUnlockPinAttempt('');
    setUnlockPinError('');
    setErrorMessage('');
    setStatusMessage('ปลดล็อคการตั้งค่า Google Sheets และอีเมลแล้ว สามารถแก้ไขการตั้งค่าได้');
  };

  const handleCopyId = async () => {
    if (!settings.linkedSpreadsheetId) return;
    try {
      await navigator.clipboard.writeText(settings.linkedSpreadsheetId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const executeSyncToSheets = async () => {
    if (!accessToken || !settings.linkedSpreadsheetId) return;
    setBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const result = await syncAllToGoogleSheets(
        accessToken,
        settings.linkedSpreadsheetId,
        settings,
        transactions,
        selectedMonthKey,
        selectedDate407
      );
      const meta = await getSpreadsheetMetadata(
        accessToken,
        settings.linkedSpreadsheetId
      );
      setTabNames(meta.sheets.map((s) => s.properties.title));
      onUpdateBackupSync({ lastAutoSyncAt: new Date().toISOString() });
      setStatusMessage(
        `อัปเดตข้อมูลขึ้น Google Sheets สำเร็จ (${result.updatedTabs.length} แท็บ, รวม ${result.totalRows} แถว)`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'ไม่สามารถอัปเดต Google Sheets ได้'
      );
    } finally {
      setBusy(false);
      setConfirmSyncOpen(false);
    }
  };

  const executeImportFromSheets = async () => {
    if (!accessToken || !settings.linkedSpreadsheetId) return;
    setBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const imported = await importFromGoogleSheets(
        accessToken,
        settings.linkedSpreadsheetId,
        settings
      );
      onReplaceAllData(imported.settings, imported.transactions);
      setStatusMessage(
        `นำเข้าข้อมูลจาก "${imported.title}" สำเร็จ (${imported.transactions.length} รายการ)`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถอ่านข้อมูลจาก Google Sheets ได้'
      );
    } finally {
      setBusy(false);
      setConfirmImportOpen(false);
    }
  };

  const monthLabel =
    FISCAL_MONTHS.find((m) => m.key === selectedMonthKey)?.label || '';

  const formatCountdown = (sec: number | null) => {
    if (sec === null) return 'รอคำนวณรอบถัดไป';
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${mins} นาที ${String(remSec).padStart(2, '0')} วินาที`;
  };

  return (
    <div className="space-y-6">
      {/* Lock Google Sheets & Email Security Card */}
      <section
        className={`rounded-xl border p-5 ${
          isLocked
            ? 'border-amber-300 bg-amber-50/70'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isLocked
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {isLocked
                  ? 'ล็อคการตั้งค่าการเชื่อมต่อ Google Sheets และอีเมลไว้แล้ว'
                  : 'ล็อคการตั้งค่าการเชื่อมต่อ Google Sheets และอีเมล (ป้องกันการแก้ไข)'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {isLocked
                  ? 'ปิดการแก้ไข Spreadsheet ID, อีเมลบัญชี Google, สวิตช์เปิด-ปิดการเชื่อมต่อ และการสร้าง/เปลี่ยนไฟล์ใหม่ จนกว่าจะปลดล็อค'
                  : 'กำหนดอีเมลบัญชี Google ที่อนุญาต และล็อคการตั้งค่า Spreadsheet ID เพื่อป้องกันไม่ให้ผู้ใช้งานอื่นแก้ไขหรือสลับไฟล์โดยไม่ตั้งใจ'}
              </p>
            </div>
          </div>

          {isLocked && (
            <button
              type="button"
              onClick={handleOpenUnlockModal}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>ปลดล็อคการตั้งค่า</span>
            </button>
          )}
        </div>

        {isLocked ? (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-amber-200 bg-white/90 p-3.5 text-xs md:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                อีเมล Google ที่ล็อคไว้
              </p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {backupSync.lockedGoogleEmail || 'ไม่จำกัดอีเมล (ล็อคเฉพาะตั้งค่า Sheet)'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                Google Sheet ปลายทางที่ล็อคไว้
              </p>
              <p className="font-mono-num mt-0.5 truncate font-semibold text-slate-900">
                {settings.linkedSpreadsheetId
                  ? settings.linkedSpreadsheetTitle || settings.linkedSpreadsheetId
                  : 'ยังไม่ได้ผูก Spreadsheet ID'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                รูปแบบการล็อค
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-amber-800">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {backupSync.sheetsLockPin
                    ? 'ล็อคด้วยรหัสปลดล็อค (PIN)'
                    : 'ล็อคป้องกันการแก้ไข'}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span>อีเมลบัญชี Google ที่อนุญาตให้เชื่อมต่อ</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={lockedEmailInput}
                  onChange={(e) => setLockedEmailInput(e.target.value)}
                  placeholder="เช่น banreeapp@gmail.com"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
                {user?.email && (
                  <button
                    type="button"
                    onClick={() => setLockedEmailInput(user.email || '')}
                    className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                    title="ดึงอีเมลที่ล็อกอินอยู่มาใส่"
                  >
                    ใช้เมลปัจจุบัน
                  </button>
                )}
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                <span>รหัสปลดล็อค / PIN (ไม่บังคับ)</span>
              </label>
              <input
                type="password"
                value={lockPinInput}
                onChange={(e) => setLockPinInput(e.target.value)}
                placeholder="ตั้งรหัส เช่น 1234 (เว้นว่างได้)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex items-end md:col-span-3">
              <button
                type="button"
                onClick={handleLockSettings}
                className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>ล็อคการตั้งค่า &amp; อีเมล</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Master Enable/Disable & Auto-Sync Toggle Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <Power
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  sheetsEnabled ? 'text-teal-700' : 'text-slate-400'
                }`}
              />
              <div className="text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <span>เปิด/ปิด การตั้งค่าเชื่อม Google Sheets</span>
                  {isLocked && (
                    <Lock className="h-3 w-3 text-amber-700" />
                  )}
                </p>
                <p className="mt-0.5 text-slate-500">
                  {isLocked
                    ? 'ถูกล็อคการตั้งค่าอยู่ — ปลดล็อคด้านบนก่อนเปลี่ยนสถานะ'
                    : sheetsEnabled
                    ? 'เปิดใช้งาน — เชื่อมต่อและรับส่งข้อมูลกับ Google Sheets ได้ปกติ'
                    : 'ปิดใช้งานชั่วคราว — ข้อมูลบัญชีจะถูกจัดเก็บเฉพาะในเครื่อง'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sheetsEnabled}
              disabled={isLocked}
              onClick={() =>
                onUpdateBackupSync({
                  sheetsConnectionEnabled: !sheetsEnabled,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                sheetsEnabled ? 'bg-teal-700' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  sheetsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <Clock
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  backupSync.autoSyncSheetsEnabled && sheetsEnabled
                    ? 'text-teal-700'
                    : 'text-slate-400'
                }`}
              />
              <div className="text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <span>
                    บันทึกไฟล์ลง Google Sheets อัตโนมัติทุก{' '}
                    {backupSync.autoSyncIntervalMinutes} นาที
                  </span>
                  {isLocked && (
                    <Lock className="h-3 w-3 text-amber-700" />
                  )}
                </p>
                <p className="mt-0.5 text-slate-500">
                  {isLocked
                    ? backupSync.autoSyncSheetsEnabled
                      ? `ถูกล็อคให้ซิงก์อัตโนมัติทุก ${backupSync.autoSyncIntervalMinutes} นาที`
                      : 'ถูกล็อคไว้ในสถานะปิดซิงก์อัตโนมัติ'
                    : !sheetsEnabled
                    ? 'กรุณาเปิดใช้งานการเชื่อม Google Sheets ด้านซ้ายก่อน'
                    : !backupSync.autoSyncSheetsEnabled
                    ? 'ปิดอยู่ — กดปุ่มซิงก์ด้วยตนเองเท่านั้น'
                    : !accessToken || !settings.linkedSpreadsheetId
                    ? 'เปิดอยู่ — รอเข้าสู่ระบบ Google และเลือกไฟล์ปลายทาง'
                    : autoSyncStatus === 'syncing'
                    ? 'กำลังบันทึกข้อมูลขึ้น Google Sheets อัตโนมัติ...'
                    : `รอบถัดไปในอีก ${formatCountdown(
                        nextAutoSyncSeconds
                      )} · ล่าสุด: ${formatThaiDateTime(
                        backupSync.lastAutoSyncAt
                      )}`}
                </p>
                {autoSyncError &&
                  sheetsEnabled &&
                  backupSync.autoSyncSheetsEnabled && (
                    <p className="mt-1 font-medium text-red-600">
                      ข้อผิดพลาดซิงก์อัตโนมัติ: {autoSyncError}
                    </p>
                  )}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={backupSync.autoSyncSheetsEnabled}
              disabled={!sheetsEnabled || isLocked}
              onClick={() => {
                if (backupSync.autoSyncSheetsEnabled) {
                  onUpdateBackupSync({ autoSyncSheetsEnabled: false });
                } else {
                  setConfirmEnableAutoSync(true);
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                backupSync.autoSyncSheetsEnabled && sheetsEnabled
                  ? 'bg-teal-700'
                  : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  backupSync.autoSyncSheetsEnabled && sheetsEnabled
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {!sheetsEnabled ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-900">
            ปิดการตั้งค่าเชื่อม Google Sheets อยู่
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs text-slate-500">
            ข้อมูลการบันทึกบัญชีและรายงานยังคงทำงานและจัดเก็บในเครื่องตามปกติ{' '}
            {isLocked
              ? 'กรุณาปลดล็อคการตั้งค่าด้านบนหากต้องการเปิดใช้งาน Google Sheets'
              : 'คุณสามารถเปิดสวิตช์ด้านบนเมื่อต้องการเชื่อมหรือบันทึกขึ้น Google Sheets'}
          </p>
          {!isLocked && (
            <button
              type="button"
              onClick={() =>
                onUpdateBackupSync({ sheetsConnectionEnabled: true })
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Power className="h-3.5 w-3.5" />
              <span>เปิดใช้งานเชื่อม Google Sheets</span>
            </button>
          )}
        </section>
      ) : (
        <>
          {/* Google Account Connection Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  เชื่อมต่อบัญชี Google เพื่อจัดการไฟล์ Google Sheets
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  ระบบจะสร้างและอัปเดตไฟล์ Google Sheets แยก {totalTabCount} แท็บมาตรฐาน (ตั้งค่าเริ่มต้น, โครงการ 402/404, บันทึกรายวัน, แบบ 401/404/407, งบเดือนเกณฑ์เงินสด/คงค้าง, หน้างบใบสำคัญ, รายงานประเภทเงินคงเหลือ และสรุปรายรับ-รายจ่ายรายเดือน) ในบัญชี Google ของคุณโดยตรง
                </p>
              </div>

              {!accessToken ? (
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={onLogin}
                    disabled={isLoggingIn}
                    className="gsi-material-button shrink-0"
                  >
                    <div className="gsi-material-button-state" />
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          style={{ display: 'block' }}
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                  {isLocked && backupSync.lockedGoogleEmail && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
                      <Lock className="h-3 w-3" />
                      <span>อนุญาตเฉพาะบัญชี: {backupSync.lockedGoogleEmail}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <p className="font-semibold text-slate-900">
                      {user?.displayName || 'บัญชี Google ที่เชื่อมต่อ'}
                    </p>
                    <p className="text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={onLogout}
                    title={
                      isLocked
                        ? 'ปลดล็อคการตั้งค่าด้านบนก่อนออกจากระบบ/เปลี่ยนบัญชี'
                        : 'ออกจากระบบบัญชี Google'
                    }
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5 text-amber-700" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" />
                    )}
                    <span>{isLocked ? 'ล็อคบัญชีไว้' : 'ออกจากระบบ'}</span>
                  </button>
                </div>
              )}
            </div>

            {statusMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {(errorMessage || authError) && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {errorMessage || authError}
              </div>
            )}
          </section>

          {/* Always-visible Spreadsheet ID Binding Card (works before and after Google Sign-In) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span>
                    ผูก Spreadsheet ID ปลายทาง (วาง URL หรือ Spreadsheet ID ของ Google Sheets)
                  </span>
                  {isLocked && <Lock className="h-3.5 w-3.5 text-amber-700" />}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isLocked ? (
                    'Spreadsheet ID ถูกล็อคไว้แล้ว หากต้องการแก้ไขหรือเปลี่ยนไฟล์ปลายทาง กรุณากดปลดล็อคการตั้งค่าด้านบน'
                  ) : (
                    <>
                      สามารถผูกหรือเปลี่ยน Spreadsheet ID ไว้ล่วงหน้าได้ทันที ตัวอย่าง URL:{' '}
                      <span className="font-mono-num text-slate-600">
                        https://docs.google.com/spreadsheets/d/
                        <strong className="text-teal-700">SPREADSHEET_ID</strong>/edit
                      </span>
                    </>
                  )}
                </p>
              </div>
              {settings.linkedSpreadsheetId && !isLocked && (
                <button
                  type="button"
                  onClick={handleUnbindSpreadsheet}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>ยกเลิกการผูก ID</span>
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                type="text"
                value={linkInput}
                disabled={isLocked}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="วาง URL ของ Google Sheets หรือ Spreadsheet ID เช่น 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="font-mono-num min-w-[260px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              <button
                type="button"
                disabled={busy || isLocked}
                onClick={() => handleBindSpreadsheetId(linkInput)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {isLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>ล็อคไว้แล้ว</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" />
                    <span>ผูก Spreadsheet ID</span>
                  </>
                )}
              </button>
            </div>

            {settings.linkedSpreadsheetId && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-slate-900">
                    {settings.linkedSpreadsheetTitle ||
                      (accessToken
                        ? 'กำลังตรวจสอบชื่อไฟล์...'
                        : 'ผูก Spreadsheet ID แล้ว (กด Sign in with Google ด้านบนเพื่อเชื่อมซิงก์)')}
                  </p>
                  <p className="font-mono-num break-all text-slate-600">
                    Spreadsheet ID: {settings.linkedSpreadsheetId}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {copiedId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-teal-700" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>คัดลอก ID</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${settings.linkedSpreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-slate-100"
                  >
                    <span>เปิดไฟล์</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}
          </section>

          {accessToken && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Create or Pick Spreadsheet */}
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>1. สร้างไฟล์ Google Sheets ใหม่สำหรับปีงบประมาณ</span>
                {isLocked && <Lock className="h-3.5 w-3.5 text-amber-700" />}
              </h3>
              <form onSubmit={handleCreateSpreadsheet} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newSheetTitle}
                  disabled={isLocked}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
                <button
                  type="submit"
                  disabled={busy || isLocked}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span>{isLocked ? 'ล็อคไว้' : 'สร้างไฟล์ใหม่'}</span>
                </button>
              </form>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">
                  2. ไฟล์สเปรดชีตที่สร้างผ่านแอปนี้
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    loadFilesAndMeta(accessToken, settings.linkedSpreadsheetId)
                  }
                  className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>รีเฟรช</span>
                </button>
              </div>

              {loadingList ? (
                <p className="mt-3 text-xs text-slate-500">กำลังโหลดรายการไฟล์...</p>
              ) : appSheets.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  ยังไม่มีไฟล์สเปรดชีตที่สร้างจากแอปนี้ กด &ldquo;สร้างไฟล์ใหม่&rdquo; ด้านบนเพื่อเริ่มต้น หรือผูก Spreadsheet ID จากการ์ดด้านบน
                </p>
              ) : (
                <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {appSheets.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleBindSpreadsheetId(file.id)}
                        className="truncate text-left font-medium text-slate-800 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        {file.name}
                      </button>
                      <span className="font-mono-num shrink-0 text-[11px] text-slate-400">
                        {file.id === settings.linkedSpreadsheetId
                          ? 'กำลังเชื่อมต่อ'
                          : isLocked
                          ? 'ล็อคไว้'
                          : 'เลือกใช้'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Right: Active Spreadsheet Sync Controls */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <h3 className="text-sm font-semibold text-slate-900">
              สถานะการเชื่อมต่อและซิงก์ข้อมูลบัญชี
            </h3>

            {!settings.linkedSpreadsheetId ? (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                ยังไม่ได้ผูกไฟล์ Google Sheets ปลายทาง
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                  <p className="font-semibold text-slate-900">
                    {settings.linkedSpreadsheetTitle || 'ไฟล์ที่เชื่อมต่ออยู่'}
                  </p>
                  <p className="font-mono-num mt-1 break-all text-slate-500">
                    ID: {settings.linkedSpreadsheetId}
                  </p>
                  {tabNames.length > 0 && (
                    <p className="mt-2 text-slate-600">
                      แท็บในไฟล์ ({tabNames.length}): {tabNames.join(' · ')}
                    </p>
                  )}
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${settings.linkedSpreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:underline"
                  >
                    <span>เปิดดูไฟล์บน Google Sheets</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmSyncOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>บันทึกข้อมูลและรายงานทั้งหมดขึ้น Google Sheets</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmImportOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>ดึงข้อมูลจาก Google Sheets เข้าแอป</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
          )}
        </>
      )}

      {/* Mandatory Confirmation Dialogs for Google Sheets Mutations */}
      <ConfirmModal
        open={confirmSyncOpen}
        title="ยืนยันการอัปเดตข้อมูลขึ้น Google Sheets"
        description={`ระบบจะเขียนข้อมูลตั้งค่า รายการรับ-จ่าย และรายงานประจำเดือน${monthLabel} ลงในไฟล์ "${
          settings.linkedSpreadsheetTitle || settings.linkedSpreadsheetId
        }" โดยข้อมูลเดิมในแท็บมาตรฐานทั้ง ${totalTabCount} แท็บจะถูกแทนที่ด้วยข้อมูลล่าสุดจากแอป`}
        details={[
          `แท็บที่จะอัปเดต: ${Object.values(PCU_SHEET_TABS).join(', ')}`,
          `จำนวนรายการในสมุดรายวัน: ${transactions.length} รายการ`,
          `รายงานประจำเดือน: ${monthLabel} · แบบ 407 ณ วันที่ ${selectedDate407}`,
        ]}
        confirmLabel="ยืนยันอัปเดต Google Sheets"
        loading={busy}
        onCancel={() => setConfirmSyncOpen(false)}
        onConfirm={executeSyncToSheets}
      />

      <ConfirmModal
        open={confirmImportOpen}
        title="ยืนยันการดึงข้อมูลจาก Google Sheets"
        description={`ระบบจะอ่านข้อมูลจากแท็บ "${PCU_SHEET_TABS.SETTINGS}" และ "${PCU_SHEET_TABS.LEDGER}" ในไฟล์ "${
          settings.linkedSpreadsheetTitle || settings.linkedSpreadsheetId
        }" มาแทนที่ข้อมูลปัจจุบันในแอป`}
        details={[
          'ข้อมูลที่บันทึกไว้ในเครื่องที่ยังไม่ได้อัปเดตขึ้น Google Sheets จะถูกแทนที่',
        ]}
        confirmLabel="ยืนยันนำเข้าข้อมูล"
        variant="danger"
        loading={busy}
        onCancel={() => setConfirmImportOpen(false)}
        onConfirm={executeImportFromSheets}
      />

      <ConfirmModal
        open={confirmEnableAutoSync}
        title="ยืนยันเปิดการบันทึกอัตโนมัติลง Google Sheets"
        description={`เมื่อเปิดใช้งาน ระบบจะบันทึกข้อมูลและรายงานทั้ง ${totalTabCount} แท็บลงในไฟล์ Google Sheets ที่เชื่อมไว้โดยอัตโนมัติทุก ๆ ${backupSync.autoSyncIntervalMinutes} นาที`}
        details={[
          `ไฟล์ปลายทางปัจจุบัน: ${
            settings.linkedSpreadsheetTitle ||
            settings.linkedSpreadsheetId ||
            'ยังไม่ได้เลือกไฟล์'
          }`,
          'คุณสามารถปิดการบันทึกอัตโนมัติได้ตลอดเวลา',
        ]}
        confirmLabel="เปิดบันทึกอัตโนมัติทุก 5 นาที"
        onCancel={() => setConfirmEnableAutoSync(false)}
        onConfirm={() => {
          onUpdateBackupSync({
            sheetsConnectionEnabled: true,
            autoSyncSheetsEnabled: true,
          });
          setConfirmEnableAutoSync(false);
        }}
      />

      {/* Unlock Google Sheets & Email Settings Modal */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleConfirmUnlock}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Unlock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ปลดล็อคการตั้งค่า Google Sheets และอีเมล
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {backupSync.sheetsLockPin
                    ? 'กรุณากรอกรหัสปลดล็อค (PIN) ที่ตั้งไว้เพื่อแก้ไขการตั้งค่า Google Sheets และบัญชีอีเมล'
                    : 'ยืนยันการปลดล็อคเพื่อเปิดให้แก้ไข Spreadsheet ID, อีเมลบัญชี Google และการตั้งค่าการซิงก์'}
                </p>
              </div>
            </div>

            {backupSync.sheetsLockPin && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  รหัสปลดล็อค / PIN
                </label>
                <input
                  type="password"
                  autoFocus
                  value={unlockPinAttempt}
                  onChange={(e) => {
                    setUnlockPinAttempt(e.target.value);
                    setUnlockPinError('');
                  }}
                  placeholder="กรอกรหัสปลดล็อค"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                />
                {unlockPinError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {unlockPinError}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnlockModalOpen(false)}
                className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>ยืนยันปลดล็อค</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
