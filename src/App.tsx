import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  BarChart3,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileBarChart2,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
  Power,
  RefreshCw,
  Settings,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import {
  DEFAULT_PCU_SETTINGS,
  DEFAULT_PROJECTS,
  DEFAULT_TRANSACTIONS,
} from './data/pcuCatalog';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import { syncAllToGoogleSheets } from './services/googleSheets';
import {
  BackupSyncSettings,
  LedgerTransaction,
  PcuSettings,
} from './types/accounting';
import {
  downloadBackupJson,
  formatThaiDateTime,
  getBackupScheduleStatus,
  normalizeBackupSyncSettings,
} from './utils/backupJson';
import { DashboardWorkspace } from './components/DashboardWorkspace';
import { LedgerWorkspace } from './components/LedgerWorkspace';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { SummaryWorkspace } from './components/SummaryWorkspace';
import { AiAccountantWorkspace } from './components/AiAccountantWorkspace';
import { SheetsSyncWorkspace } from './components/SheetsSyncWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { InstallGuideWorkspace } from './components/InstallGuideWorkspace';
import { BackupReminderModal } from './components/BackupReminderModal';

type AppSection =
  | 'dashboard'
  | 'ledger'
  | 'reports'
  | 'summary'
  | 'ai'
  | 'sheets'
  | 'settings'
  | 'guide';

const STORAGE_SETTINGS_KEY = 'pcu_ledger_settings_v1';
const STORAGE_TXS_KEY = 'pcu_ledger_transactions_v1';

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-10');
  const [selectedDate407, setSelectedDate407] = useState<string>('2026-10-01');

  const [settings, setSettings] = useState<PcuSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PcuSettings>;
        return {
          ...DEFAULT_PCU_SETTINGS,
          ...parsed,
          projects: parsed.projects || DEFAULT_PROJECTS,
          backupSync: normalizeBackupSyncSettings(parsed.backupSync),
        };
      }
    } catch {
      // Fallback to default settings
    }
    return DEFAULT_PCU_SETTINGS;
  });

  const [transactions, setTransactions] = useState<LedgerTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TXS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback to baseline รพ.สต.บ้านรี transactions
    }
    return DEFAULT_TRANSACTIONS;
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Backup reminder modal state (15-day schedule + pre-close reminder)
  const [backupReminderOpen, setBackupReminderOpen] = useState(false);
  const [backupReminderReason, setBackupReminderReason] = useState<
    'scheduled_15d' | 'before_close'
  >('scheduled_15d');
  const dismissedScheduledInSessionRef = useRef(false);

  // Google Workspace Auth state (access token is kept strictly in memory via googleAuth.ts)
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    getAccessToken()
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  // 5-Minute Google Sheets Auto-Sync state
  const [autoSyncStatus, setAutoSyncStatus] = useState<
    'idle' | 'syncing' | 'error'
  >('idle');
  const [autoSyncError, setAutoSyncError] = useState('');
  const [nextAutoSyncSeconds, setNextAutoSyncSeconds] = useState<number | null>(
    null
  );
  const isAutoSyncingRef = useRef(false);

  const backupSync = useMemo(
    () => normalizeBackupSyncSettings(settings.backupSync),
    [settings.backupSync]
  );

  const scheduleStatus = useMemo(
    () => getBackupScheduleStatus(backupSync),
    [backupSync]
  );

  // Keep refs fresh for background intervals
  const latestSettingsRef = useRef(settings);
  const latestTxsRef = useRef(transactions);
  const latestMonthRef = useRef(selectedMonthKey);
  const latestDate407Ref = useRef(selectedDate407);
  const latestTokenRef = useRef(accessToken);

  latestSettingsRef.current = settings;
  latestTxsRef.current = transactions;
  latestMonthRef.current = selectedMonthKey;
  latestDate407Ref.current = selectedDate407;
  latestTokenRef.current = accessToken;

  useEffect(() => {
    const unsub = initAuth(
      (authedUser, token) => {
        const cfg = normalizeBackupSyncSettings(
          latestSettingsRef.current.backupSync
        );
        const lockedEmail = cfg.lockedGoogleEmail.trim().toLowerCase();
        const userEmail = (authedUser.email || '').trim().toLowerCase();
        if (cfg.sheetsSettingsLocked && lockedEmail && userEmail !== lockedEmail) {
          void logout();
          setUser(null);
          setAccessToken(null);
          setAuthError(
            `บัญชี ${authedUser.email || ''} ไม่ตรงกับอีเมลที่ล็อคไว้ (${cfg.lockedGoogleEmail}) กรุณาเข้าสู่ระบบด้วยอีเมลที่กำหนด หรือปลดล็อคการตั้งค่าก่อน`
          );
          return;
        }
        setUser(authedUser);
        setAccessToken(token);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setAccessToken(null);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TXS_KEY, JSON.stringify(transactions));
    } catch {
      // Ignore storage quota errors
    }
  }, [transactions]);

  // Check 15-day backup schedule on load and every 5 minutes
  useEffect(() => {
    const checkSchedule = () => {
      const cfg = normalizeBackupSyncSettings(
        latestSettingsRef.current.backupSync
      );
      if (!cfg.backupReminderEnabled) return;
      const status = getBackupScheduleStatus(cfg);
      if (
        cfg.lastBackupAt !== null &&
        status.isDue &&
        !dismissedScheduledInSessionRef.current
      ) {
        setBackupReminderReason('scheduled_15d');
        setBackupReminderOpen(true);
      }
    };

    checkSchedule();
    const timer = window.setInterval(checkSchedule, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Warn before closing tab/window if 15-day backup is due or unsaved edits exist
  useEffect(() => {
    if (!backupSync.warnBeforeClose) return;
    const shouldWarn = scheduleStatus.isDue || hasUnsavedChanges;
    if (!shouldWarn) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [backupSync.warnBeforeClose, scheduleStatus.isDue, hasUnsavedChanges]);

  // 5-Minute Google Sheets Auto-Save Timer
  useEffect(() => {
    const canAutoSync =
      backupSync.sheetsConnectionEnabled &&
      backupSync.autoSyncSheetsEnabled &&
      Boolean(accessToken) &&
      Boolean(settings.linkedSpreadsheetId);

    if (!canAutoSync) {
      setNextAutoSyncSeconds(null);
      return;
    }

    const intervalSeconds = Math.max(
      60,
      backupSync.autoSyncIntervalMinutes * 60
    );
    let remaining = intervalSeconds;
    setNextAutoSyncSeconds(remaining);

    const tick = window.setInterval(() => {
      if (isAutoSyncingRef.current) return;
      remaining -= 1;
      if (remaining <= 0) {
        const token = latestTokenRef.current;
        const currSettings = latestSettingsRef.current;
        if (!token || !currSettings.linkedSpreadsheetId) return;

        isAutoSyncingRef.current = true;
        setAutoSyncStatus('syncing');
        setAutoSyncError('');

        syncAllToGoogleSheets(
          token,
          currSettings.linkedSpreadsheetId,
          currSettings,
          latestTxsRef.current,
          latestMonthRef.current,
          latestDate407Ref.current
        )
          .then(() => {
            const syncedAt = new Date().toISOString();
            setSettings((prev) => ({
              ...prev,
              backupSync: {
                ...normalizeBackupSyncSettings(prev.backupSync),
                lastAutoSyncAt: syncedAt,
              },
            }));
            setAutoSyncStatus('idle');
          })
          .catch((err: unknown) => {
            setAutoSyncStatus('error');
            setAutoSyncError(
              err instanceof Error
                ? err.message
                : 'ซิงก์อัตโนมัติไม่สำเร็จ'
            );
          })
          .finally(() => {
            isAutoSyncingRef.current = false;
            remaining = intervalSeconds;
            setNextAutoSyncSeconds(remaining);
          });
      } else {
        setNextAutoSyncSeconds(remaining);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [
    backupSync.sheetsConnectionEnabled,
    backupSync.autoSyncSheetsEnabled,
    backupSync.autoSyncIntervalMinutes,
    accessToken,
    settings.linkedSpreadsheetId,
  ]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    const lockedEmailRaw = backupSync.lockedGoogleEmail.trim();
    const lockedEmailLower = lockedEmailRaw.toLowerCase();
    try {
      const res = await googleSignIn(lockedEmailRaw || undefined);
      const signedInEmail = (res.user.email || '').trim().toLowerCase();
      if (
        backupSync.sheetsSettingsLocked &&
        lockedEmailLower &&
        signedInEmail !== lockedEmailLower
      ) {
        await logout();
        setUser(null);
        setAccessToken(null);
        setAuthError(
          `บัญชี ${res.user.email || ''} ไม่ตรงกับอีเมลที่ล็อคไว้ (${lockedEmailRaw}) กรุณาเข้าสู่ระบบด้วย ${lockedEmailRaw} หรือปลดล็อคการตั้งค่าก่อน`
        );
        return;
      }
      setUser(res.user);
      setAccessToken(res.accessToken);
    } catch (err: unknown) {
      console.error('Google Sign-In failed:', err);
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `โดเมน ${window.location.hostname} ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ Google (auth/unauthorized-domain) — กรุณาเพิ่มโดเมนนี้ใน Firebase Authentication > Settings > Authorized domains หรือใช้งานผ่านลิงก์หลักของแอป`
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ (Pop-up) กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วกดลองใหม่อีกครั้ง'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('ปิดหน้าต่างเข้าสู่ระบบ Google ก่อนดำเนินการเสร็จสิ้น');
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเข้าสู่ระบบ Google ได้ กรุณาลองใหม่อีกครั้ง'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setAuthError('');
  };

  const handleUpdateBackupSync = (patch: Partial<BackupSyncSettings>) => {
    setSettings((prev) => ({
      ...prev,
      backupSync: {
        ...normalizeBackupSyncSettings(prev.backupSync),
        ...patch,
      },
    }));
  };

  const handleBackupJsonNow = () => {
    const result = downloadBackupJson(settings, transactions);
    handleUpdateBackupSync({ lastBackupAt: result.exportedAt });
    setHasUnsavedChanges(false);
    dismissedScheduledInSessionRef.current = true;
    return result;
  };

  const handleRestoreJsonBackup = (
    nextSettings: PcuSettings,
    nextTxs: LedgerTransaction[]
  ) => {
    setSettings({
      ...nextSettings,
      backupSync: normalizeBackupSyncSettings(nextSettings.backupSync),
    });
    setTransactions(nextTxs);
    setHasUnsavedChanges(false);
  };

  const handleSaveGeneralSettings = (nextSettings: PcuSettings) => {
    setSettings({
      ...nextSettings,
      backupSync: normalizeBackupSyncSettings(nextSettings.backupSync),
    });
    setHasUnsavedChanges(true);
  };

  const handleAddTransaction = (
    draft: Omit<LedgerTransaction, 'id' | 'createdAt'>
  ) => {
    const nextTx: LedgerTransaction = {
      ...draft,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [...prev, nextTx]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateTransaction = (updated: LedgerTransaction) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === updated.id ? updated : tx))
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    setHasUnsavedChanges(true);
  };

  const handleResetDemoData = () => {
    setSettings(DEFAULT_PCU_SETTINGS);
    setTransactions(DEFAULT_TRANSACTIONS);
    setSelectedMonthKey('2026-10');
    setSelectedDate407('2026-10-01');
    setHasUnsavedChanges(false);
  };

  const navItems: Array<{
    id: AppSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'ภาพรวมการเงิน', icon: LayoutDashboard },
    { id: 'ledger', label: 'บันทึกรายวัน', icon: BookOpen },
    { id: 'reports', label: 'รายงานการเงิน', icon: FileBarChart2 },
    { id: 'summary', label: 'สรุปรายรับ-รายจ่าย', icon: BarChart3 },
    { id: 'ai', label: 'AI ผู้เชี่ยวชาญบัญชี', icon: Sparkles },
    { id: 'sheets', label: 'Google Sheets', icon: FileSpreadsheet },
    { id: 'settings', label: 'ตั้งค่าเริ่มต้น', icon: Settings },
    { id: 'guide', label: 'คู่มือติดตั้ง & ใช้งาน', icon: BookMarked },
  ];

  const sectionTitles: Record<AppSection, string> = {
    dashboard: 'Dashboard ภาพรวมการเงินรายปีงบประมาณ',
    ledger: 'สมุดรายวันรับ - จ่ายเงินบำรุง',
    reports: 'รายงานการเงินมาตรฐาน รพ.สต.',
    summary: 'สรุปรายรับ - รายจ่าย แยกรายวัน รายเดือน และหมวดหมู่',
    ai: 'ผู้เชี่ยวชาญ AI ด้านบัญชี รพ.สต.',
    sheets: 'เชื่อมต่อและซิงก์ Google Sheets',
    settings: 'ตั้งค่าเริ่มต้นหน่วยงาน โครงการ / 402 / 404 และสำรองข้อมูล',
    guide: 'คู่มือการติดตั้งและนำไปใช้กับสถานบริการอื่น',
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-base font-bold tracking-tight text-slate-900">
            PCU Ledger
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {settings.unitName}
          </p>
          <p className="text-[11px] text-slate-400">
            ปีงบประมาณ {settings.fiscalYearBE} · {settings.address}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 font-semibold text-teal-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setActiveSection('sheets')}
            className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
              !backupSync.sheetsConnectionEnabled
                ? 'border-slate-200 bg-slate-50 text-slate-600'
                : autoSyncStatus === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : accessToken && settings.linkedSpreadsheetId
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : accessToken
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold">
                <span
                  className={`h-2 w-2 shrink-0 rounded-xs ${
                    !backupSync.sheetsConnectionEnabled
                      ? 'bg-slate-400'
                      : autoSyncStatus === 'error'
                      ? 'bg-red-600'
                      : accessToken && settings.linkedSpreadsheetId
                      ? 'bg-emerald-600'
                      : accessToken
                      ? 'bg-amber-500'
                      : 'bg-rose-600'
                  }`}
                />
                <span>
                  {!backupSync.sheetsConnectionEnabled
                    ? 'Sheets ปิดอยู่'
                    : autoSyncStatus === 'syncing'
                    ? 'กำลังซิงก์ Sheets...'
                    : autoSyncStatus === 'error'
                    ? 'ซิงก์ Sheets ขัดข้อง'
                    : accessToken
                    ? 'เชื่อมต่อ Google แล้ว'
                    : 'ยังไม่เชื่อมต่อ Google'}
                </span>
              </span>
              {backupSync.sheetsSettingsLocked && (
                <Lock className="h-3 w-3 shrink-0 text-amber-700" />
              )}
            </div>
            <p className="mt-1 truncate text-[11px] opacity-85">
              {!backupSync.sheetsConnectionEnabled
                ? 'บันทึกข้อมูลเฉพาะในเครื่อง'
                : accessToken
                ? user?.email || 'เชื่อมต่อแล้ว'
                : backupSync.lockedGoogleEmail
                ? `ล็อค: ${backupSync.lockedGoogleEmail}`
                : 'คลิกเพื่อเชื่อมต่อ Google Sheets'}
            </p>
            {backupSync.sheetsConnectionEnabled && settings.linkedSpreadsheetId && (
              <p className="mt-0.5 truncate text-[11px] font-medium opacity-90">
                ไฟล์: {settings.linkedSpreadsheetTitle || settings.linkedSpreadsheetId}
              </p>
            )}
          </button>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500">
              สำรอง JSON:{' '}
              <span
                className={
                  scheduleStatus.isDue
                    ? 'font-semibold text-amber-700'
                    : 'font-medium text-slate-700'
                }
              >
                {backupSync.lastBackupAt
                  ? formatThaiDateTime(backupSync.lastBackupAt)
                  : 'ยังไม่เคยสำรอง'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setBackupReminderReason('before_close');
                setBackupReminderOpen(true);
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              <span>สำรอง JSON ก่อนปิดไฟล์</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Top Bar (3-zone contract) */}
        <header className="no-print flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">
              {sectionTitles[activeSection]}
            </h1>
          </div>

          <nav className="flex items-center gap-4 overflow-x-auto text-xs font-medium text-slate-600 lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 ${
                  activeSection === item.id
                    ? 'border-b-2 border-teal-700 font-semibold text-teal-800'
                    : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setBackupReminderReason('before_close');
                setBackupReminderOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold ${
                scheduleStatus.isDue || hasUnsavedChanges
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>สำรอง JSON</span>
            </button>

            {!backupSync.sheetsConnectionEnabled ? (
              <button
                type="button"
                onClick={() => setActiveSection('sheets')}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Sheets ปิดอยู่</span>
              </button>
            ) : accessToken ? (
              <button
                type="button"
                onClick={() => setActiveSection('sheets')}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>
                  {autoSyncStatus === 'syncing'
                    ? 'กำลังซิงก์ Sheets...'
                    : 'ซิงก์ Google Sheets'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection('sheets')}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>เชื่อมต่อ Google Sheets</span>
              </button>
            )}
          </div>
        </header>

        {/* Prominent Global Connection Status Bar */}
        <div
          className={`no-print border-b px-6 py-2.5 text-xs ${
            !backupSync.sheetsConnectionEnabled
              ? 'border-slate-200 bg-slate-100 text-slate-700'
              : autoSyncStatus === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : accessToken && settings.linkedSpreadsheetId
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : accessToken
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-rose-200 bg-rose-50 text-rose-950'
          }`}
        >
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {!backupSync.sheetsConnectionEnabled ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <Power className="h-3.5 w-3.5 text-slate-500" />
                    <span>สถานะ: ปิดการเชื่อมต่อ Google Sheets ชั่วคราว</span>
                  </span>
                  <span className="text-slate-500">
                    ข้อมูลทั้งหมดจัดเก็บเฉพาะในเครื่อง
                  </span>
                </>
              ) : autoSyncStatus === 'error' ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-red-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    <span>สถานะ: ซิงก์ Google Sheets ขัดข้อง</span>
                  </span>
                  <span className="truncate text-red-700">
                    {autoSyncError || 'กรุณาตรวจสอบการเชื่อมต่อหรือเข้าสู่ระบบใหม่'}
                  </span>
                </>
              ) : accessToken && settings.linkedSpreadsheetId ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                    {autoSyncStatus === 'syncing' ? (
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-700" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    )}
                    <span>
                      {autoSyncStatus === 'syncing'
                        ? 'กำลังซิงก์ข้อมูลขึ้น Google Sheets...'
                        : 'เชื่อมต่อ Google Sheets พร้อมใช้งาน'}
                    </span>
                  </span>
                  <span className="text-emerald-800/80">|</span>
                  <span className="truncate font-medium">
                    บัญชี: <span className="font-semibold">{user?.email}</span>
                  </span>
                  <span className="text-emerald-800/80">|</span>
                  <span className="truncate font-medium">
                    ไฟล์:{' '}
                    <span className="font-semibold">
                      {settings.linkedSpreadsheetTitle ||
                        settings.linkedSpreadsheetId}
                    </span>
                  </span>
                  {backupSync.autoSyncSheetsEnabled && (
                    <>
                      <span className="text-emerald-800/80">|</span>
                      <span className="font-mono-num tabular-nums text-emerald-800">
                        ซิงก์อัตโนมัติทุก {backupSync.autoSyncIntervalMinutes} นาที
                        {nextAutoSyncSeconds !== null
                          ? ` (อีก ${Math.floor(
                              nextAutoSyncSeconds / 60
                            )}:${String(nextAutoSyncSeconds % 60).padStart(
                              2,
                              '0'
                            )})`
                          : ''}
                      </span>
                    </>
                  )}
                </>
              ) : accessToken ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>เชื่อมต่อบัญชี Google แล้ว แต่ยังไม่ได้ผูกไฟล์ Sheet</span>
                  </span>
                  <span className="text-amber-800">|</span>
                  <span className="truncate font-medium">
                    บัญชี: <span className="font-semibold">{user?.email}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-rose-800">
                    <WifiOff className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                    <span>สถานะ: ยังไม่ได้เชื่อมต่อบัญชี Google Sheets</span>
                  </span>
                  {backupSync.lockedGoogleEmail && (
                    <>
                      <span className="text-rose-300">|</span>
                      <span className="truncate font-medium text-rose-900">
                        อีเมลที่ล็อคไว้: {backupSync.lockedGoogleEmail}
                      </span>
                    </>
                  )}
                  {settings.linkedSpreadsheetId && (
                    <>
                      <span className="text-rose-300">|</span>
                      <span className="truncate font-medium text-rose-900">
                        ไฟล์ที่ผูกไว้:{' '}
                        {settings.linkedSpreadsheetTitle ||
                          settings.linkedSpreadsheetId}
                      </span>
                    </>
                  )}
                </>
              )}

              {backupSync.sheetsSettingsLocked && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  <Lock className="h-3 w-3" />
                  <span>ล็อคการตั้งค่า</span>
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {backupSync.sheetsConnectionEnabled &&
                settings.linkedSpreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${settings.linkedSpreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-current/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
                  >
                    <span>เปิดไฟล์ Sheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

              {backupSync.sheetsConnectionEnabled && !accessToken ? (
                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={handleLogin}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-rose-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>
                    {isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบ Google ทันที'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSection('sheets')}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-current/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
                >
                  <span>จัดการเชื่อมต่อ</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1320px] flex-1 p-5 lg:p-6">
          {activeSection === 'dashboard' && (
            <DashboardWorkspace
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              onChangeMonth={setSelectedMonthKey}
              onUpdateQuarterlyBudgets={(nextBudgets) =>
                handleSaveGeneralSettings({
                  ...settings,
                  quarterlyBudgets: nextBudgets,
                })
              }
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'ledger' && (
            <LedgerWorkspace
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              onChangeMonth={setSelectedMonthKey}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAiEntry={() => setActiveSection('ai')}
            />
          )}

          {activeSection === 'reports' && (
            <ReportsWorkspace
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              onChangeMonth={setSelectedMonthKey}
              selectedDate407={selectedDate407}
              onChangeDate407={setSelectedDate407}
              onGoToSheetsSync={() => setActiveSection('sheets')}
            />
          )}

          {activeSection === 'summary' && (
            <SummaryWorkspace
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              onChangeMonth={setSelectedMonthKey}
              onGoToSheetsSync={() => setActiveSection('sheets')}
            />
          )}

          {activeSection === 'ai' && (
            <AiAccountantWorkspace
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              onAddTransaction={handleAddTransaction}
            />
          )}

          {activeSection === 'sheets' && (
            <SheetsSyncWorkspace
              user={user}
              accessToken={accessToken}
              isLoggingIn={isLoggingIn}
              authError={authError}
              onLogin={handleLogin}
              onLogout={handleLogout}
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              selectedDate407={selectedDate407}
              autoSyncStatus={autoSyncStatus}
              autoSyncError={autoSyncError}
              nextAutoSyncSeconds={nextAutoSyncSeconds}
              onUpdateSettings={handleSaveGeneralSettings}
              onUpdateBackupSync={handleUpdateBackupSync}
              onReplaceAllData={(nextSettings, nextTxs) => {
                handleRestoreJsonBackup(nextSettings, nextTxs);
              }}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsWorkspace
              settings={settings}
              transactions={transactions}
              selectedMonthKey={selectedMonthKey}
              hasUnsavedChanges={hasUnsavedChanges}
              onSaveSettings={handleSaveGeneralSettings}
              onResetDemoData={handleResetDemoData}
              onBackupJsonNow={handleBackupJsonNow}
              onRestoreJsonBackup={handleRestoreJsonBackup}
              onOpenPreCloseReminder={() => {
                setBackupReminderReason('before_close');
                setBackupReminderOpen(true);
              }}
              onUpdateBackupSync={handleUpdateBackupSync}
            />
          )}

          {activeSection === 'guide' && (
            <InstallGuideWorkspace
              settings={settings}
              transactions={transactions}
              hasGoogleConnected={Boolean(accessToken)}
              onNavigate={setActiveSection}
            />
          )}
        </main>
      </div>

      {/* 15-Day Scheduled & Pre-Close JSON Backup Reminder Popup */}
      <BackupReminderModal
        open={backupReminderOpen}
        triggerReason={backupReminderReason}
        scheduleStatus={scheduleStatus}
        intervalDays={backupSync.backupIntervalDays}
        lastBackupAt={backupSync.lastBackupAt}
        hasUnsavedChanges={hasUnsavedChanges}
        transactionCount={transactions.length}
        onBackupNow={() => {
          handleBackupJsonNow();
          setBackupReminderOpen(false);
        }}
        onRemindLater={() => {
          dismissedScheduledInSessionRef.current = true;
          setBackupReminderOpen(false);
        }}
        onDismissWithoutBackup={() => {
          dismissedScheduledInSessionRef.current = true;
          setBackupReminderOpen(false);
        }}
      />
    </div>
  );
}
