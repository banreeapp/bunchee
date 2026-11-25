import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Printer,
  Settings,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { LedgerTransaction, PcuSettings } from '../types/accounting';
import {
  downloadBackupJson,
  normalizeBackupSyncSettings,
} from '../utils/backupJson';

interface InstallGuideWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  hasGoogleConnected: boolean;
  onNavigate: (
    section:
      | 'dashboard'
      | 'ledger'
      | 'reports'
      | 'summary'
      | 'sheets'
      | 'settings'
  ) => void;
}

type GuideTab = 'rollout' | 'oauth' | 'deploy' | 'checklist';

interface CopyBlockProps {
  label: string;
  code: string;
}

const CopyCommandBlock: React.FC<CopyBlockProps> = ({ label, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700/80 px-3.5 py-2 text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5 font-medium">
          <Terminal className="h-3.5 w-3.5 text-teal-400" />
          <span>{label}</span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="no-print inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span>คัดลอกแล้ว</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>คัดลอก</span>
            </>
          )}
        </button>
      </div>
      <pre className="font-mono-num overflow-x-auto px-3.5 py-3 text-xs leading-relaxed text-teal-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const InstallGuideWorkspace: React.FC<InstallGuideWorkspaceProps> = ({
  settings,
  transactions,
  hasGoogleConnected,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('rollout');
  const [templateUnitName, setTemplateUnitName] = useState(
    'รพ.สต. (ระบุชื่อสถานบริการใหม่)'
  );
  const [templateNotice, setTemplateNotice] = useState('');

  // Manual checklist items persisted in localStorage
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>(
    () => {
      try {
        const saved = localStorage.getItem('pcu_install_checklist_v1');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
  );

  const toggleManualCheck = (key: string) => {
    setManualChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('pcu_install_checklist_v1', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const backupSync = useMemo(
    () => normalizeBackupSyncSettings(settings.backupSync),
    [settings.backupSync]
  );

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.hostname : '';

  const handleDownloadCleanTemplate = () => {
    const cleanSettings: PcuSettings = {
      ...settings,
      unitName: templateUnitName.trim() || 'รพ.สต. แห่งใหม่',
      linkedSpreadsheetId: '',
      linkedSpreadsheetTitle: '',
      bankAccounts: settings.bankAccounts.map((b, idx) => ({
        ...b,
        id: `bank-${idx + 1}`,
        accountNo: '',
        openingBank: 0,
        openingCash: 0,
        openingLoan: 0,
        openingAdvance: 0,
        openingCheque: 0,
      })),
      projects: (settings.projects || []).map((p) => ({
        ...p,
        openingBalance: 0,
      })),
      backupSync: {
        ...backupSync,
        lastBackupAt: null,
        lastAutoSyncAt: null,
        lockedGoogleEmail: '',
        sheetsSettingsLocked: false,
        sheetsLockPin: '',
        autoSyncSheetsEnabled: false,
      },
    };
    const res = downloadBackupJson(cleanSettings, []);
    setTemplateNotice(
      `ดาวน์โหลดไฟล์แม่แบบเปล่า "${res.fileName}" แล้ว — นำไปเปิดที่เครื่องสถานบริการใหม่ผ่านเมนู ตั้งค่าเริ่มต้น > สำรอง & กู้คืนข้อมูล`
    );
    setTimeout(() => setTemplateNotice(''), 6000);
  };

  const liveChecks = [
    {
      id: 'unit',
      done: Boolean(settings.unitName.trim()),
      title: '1. ตั้งชื่อสถานบริการ สังกัด (สธ./อบจ.) และปีงบประมาณ',
      detail: `ปัจจุบัน: ${settings.unitName} · ปีงบประมาณ ${settings.fiscalYearBE}`,
      actionLabel: 'ไปหน้าตั้งค่าเริ่มต้น',
      target: 'settings' as const,
    },
    {
      id: 'banks',
      done: settings.bankAccounts.length > 0,
      title: '2. ตรวจสอบบัญชีธนาคารและยอดเงินยกมาต้นปีงบประมาณ',
      detail: `มีบัญชีธนาคารในระบบ ${settings.bankAccounts.length} บัญชี`,
      actionLabel: 'ตรวจสอบบัญชีธนาคาร',
      target: 'settings' as const,
    },
    {
      id: 'sheet',
      done: Boolean(settings.linkedSpreadsheetId),
      title: '3. สร้างหรือผูกไฟล์ Google Sheets ประจำสถานบริการ (12 แท็บ)',
      detail: settings.linkedSpreadsheetId
        ? `ผูกไฟล์แล้ว: ${settings.linkedSpreadsheetTitle || settings.linkedSpreadsheetId}`
        : 'ยังไม่ได้ผูก Spreadsheet ID',
      actionLabel: 'ไปหน้า Google Sheets',
      target: 'sheets' as const,
    },
    {
      id: 'google_auth',
      done: hasGoogleConnected,
      title: '4. ทดสอบเข้าสู่ระบบด้วยอีเมล Gmail ของสถานบริการและซิงก์ข้อมูล',
      detail: hasGoogleConnected
        ? 'เข้าสู่ระบบ Google สำเร็จ พร้อมรับส่งข้อมูลกับ Google Sheets'
        : 'ยังไม่ได้เข้าสู่ระบบ Google ในรอบการใช้งานนี้',
      actionLabel: 'เชื่อมต่อ Google',
      target: 'sheets' as const,
    },
    {
      id: 'lock',
      done: backupSync.sheetsSettingsLocked,
      title: '5. ล็อคการตั้งค่า Google Sheets และอีเมลป้องกันการแก้ไข',
      detail: backupSync.sheetsSettingsLocked
        ? `ล็อคไว้แล้ว${
            backupSync.lockedGoogleEmail
              ? ` (${backupSync.lockedGoogleEmail})`
              : ''
          }`
        : 'ยังไม่เปิดล็อค — แนะนำให้ล็อคหลังตั้งค่าเสร็จสำหรับเครื่องใช้งานจริง',
      actionLabel: 'ตั้งค่าล็อคบัญชี & Sheet',
      target: 'sheets' as const,
    },
    {
      id: 'backup',
      done: Boolean(backupSync.lastBackupAt),
      title: '6. สำรองข้อมูลชุดตั้งต้นเป็นไฟล์ .json เก็บไว้อย่างน้อย 1 ชุด',
      detail: backupSync.lastBackupAt
        ? 'มีประวัติการสำรองไฟล์ JSON แล้ว'
        : 'ยังไม่เคยดาวน์โหลดไฟล์สำรอง .json',
      actionLabel: 'ไปหน้าสำรอง JSON',
      target: 'settings' as const,
    },
  ];

  const manualChecklistItems = [
    {
      key: 'test_user_added',
      title: 'เพิ่มอีเมล Gmail ของสถานบริการใน Google Cloud Test users (หรือ Publish App แล้ว)',
      hint: 'ป้องกันข้อผิดพลาด 403: access_denied เมื่อสถานบริการอื่นกด Sign in with Google',
    },
    {
      key: 'firebase_domain',
      title: 'เพิ่มโดเมนเว็บจริง (เช่น *.pages.dev) ใน Firebase Authorized domains',
      hint: 'Firebase Console > Authentication > Settings > Authorized domains',
    },
    {
      key: 'gemini_secret',
      title: 'ตั้งค่า Environment Variable GEMINI_API_KEY บน Cloudflare / Server แล้ว',
      hint: 'จำเป็นเฉพาะหากต้องการเปิดใช้งานแท็บ AI ผู้เชี่ยวชาญบัญชี (ส่วนบัญชีและ Google Sheets ใช้งานได้โดยไม่ต้องใช้คีย์นี้)',
    },
    {
      key: 'officer_names',
      title: 'เปลี่ยนชื่อ-สกุล เจ้าหน้าที่การเงิน หัวหน้าหน่วย และคณะกรรมการเก็บรักษาเงินในหน้าตั้งค่า',
      hint: 'ชื่อเจ้าหน้าที่และคำนำหน้าเลขที่ใบสำคัญจะไปแสดงในแบบ 401, 404, 407 และหน้างบใบสำคัญอัตโนมัติ',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Navigation Tabs */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              คู่มือการติดตั้งและนำไปใช้งานกับสถานบริการอื่น (รพ.สต. / สสอ.)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              แนวทางแยกข้อมูลรายสถานบริการ การตั้งค่าสิทธิ์ Google Login, การติดตั้งขึ้น Cloudflare Pages / Server เอง และการส่งต่อไฟล์แม่แบบ
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>พิมพ์คู่มือแจกเจ้าหน้าที่</span>
          </button>
        </div>

        <div className="no-print mt-4 flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1">
          {[
            {
              id: 'rollout',
              label: '1. นำไปใช้กับ รพ.สต. อื่นทันที',
              icon: Building2,
            },
            {
              id: 'oauth',
              label: '2. แก้สิทธิ์ Google Login (403) & โดเมน',
              icon: KeyRound,
            },
            {
              id: 'deploy',
              label: '3. ติดตั้งขึ้น Cloudflare / Server เอง',
              icon: Cloud,
            },
            {
              id: 'checklist',
              label: '4. เช็กลิสต์พร้อมใช้งานจริง',
              icon: ShieldCheck,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as GuideTab)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: Multi-Unit Rollout Without Coding */}
      {activeTab === 'rollout' && (
        <div className="space-y-6">
          {/* Architecture Explanation */}
          <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-5">
            <h3 className="text-sm font-bold text-teal-950">
              หลักการแยกข้อมูลเมื่อใช้เว็บลิงก์เดียวกันหลายสถานบริการ (ไม่ต้องติดตั้งโปรแกรมใหม่ทุกแห่ง)
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-teal-900">
              แอป PCU Ledger ถูกออกแบบให้ <strong>ข้อมูลบัญชีของแต่ละสถานบริการแยกจากกันอย่างอิสระ 100%</strong> โดยจัดเก็บในเบราว์เซอร์ของเครื่องนั้น ๆ (localStorage) และซิงก์ขึ้นไฟล์ Google Sheets ของบัญชี Gmail ประจำ รพ.สต. นั้น ๆ โดยตรง จึงสามารถแจก URL เว็บเดียวให้หลาย รพ.สต. ในเครือข่ายใช้ร่วมกันได้โดยข้อมูลไม่ปะปนกัน
            </p>
          </section>

          {/* 5 Step Onboarding */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              ขั้นตอนเริ่มต้นใช้งานสำหรับสถานบริการแห่งใหม่ (5 ขั้นตอน)
            </h3>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-bold text-teal-800">
                  ขั้นตอนที่ 1 · ล้างข้อมูลตัวอย่างหรือนำเข้าแม่แบบเปล่า
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  เมื่อเปิดเว็บครั้งแรกบนเครื่องของ รพ.สต. ใหม่ ระบบจะมีข้อมูลตัวอย่างของ รพ.สต.บ้านรี ให้กดดาวน์โหลด <strong>ไฟล์แม่แบบเปล่า (.json)</strong> ด้านล่าง แล้วนำไปนำเข้าที่เมนู <strong>ตั้งค่าเริ่มต้น &gt; สำรอง &amp; กู้คืนข้อมูล</strong> เพื่อเคลียร์ยอดตัวอย่างเป็น 0.00 ทั้งหมดก่อนเริ่มบันทึกจริง
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-bold text-teal-800">
                  ขั้นตอนที่ 2 · ตั้งค่าหน่วยงาน บัญชีธนาคาร และยอดยกมา
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  เข้าไปที่ <strong>ตั้งค่าเริ่มต้น &gt; ข้อมูลหน่วยงาน &amp; บัญชี</strong> กรอกชื่อ รพ.สต., เลือกสังกัด (กระทรวงสาธารณสุข หรือ อบจ.), เลขที่บัญชีธนาคาร, ยอดเงินฝาก/เงินสดยกมาต้นปีงบประมาณ, ชื่อเจ้าหน้าที่ และคำนำหน้าเลขที่เอกสาร (เช่น รหัส 5 หลักของหน่วยบริการ)
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-bold text-teal-800">
                  ขั้นตอนที่ 3 · ตั้งค่าทะเบียนโครงการ / 402 / 404 ย่อย
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  ที่แท็บ <strong>โครงการ / 402 / 404 ย่อย</strong> กำหนดรายชื่อโครงการงบ P&amp;P, โครงการงบกองทุนฯ, ทะเบียน 402 หรือ 404 ย่อย พร้อมยอดเหลือยกมา เพื่อใช้แท็กในสมุดรายวันและออกรายงานแยกยอดคงเหลือรายโครงการ
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-bold text-teal-800">
                  ขั้นตอนที่ 4 · สร้างและผูก Google Sheets + ล็อคอีเมลประจำหน่วย
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  ไปที่เมนู <strong>Google Sheets</strong> กด <strong>Sign in with Google</strong> ด้วย Gmail ของสถานบริการ &gt; กด <strong>สร้างไฟล์ใหม่</strong> (ระบบจะสร้าง 12 แท็บให้อัตโนมัติ) &gt; เปิด <strong>บันทึกอัตโนมัติทุก 5 นาที</strong> และกด <strong>ล็อคการตั้งค่า &amp; อีเมล</strong> เพื่อกันเจ้าหน้าที่คนอื่นเผลอเปลี่ยนไฟล์หรือสลับบัญชี
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              <p className="font-bold">
                ขั้นตอนที่ 5 · การใช้งานข้ามเครื่องภายใน รพ.สต. เดียวกัน (ทำได้ 2 วิธี)
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-amber-900">
                <li>
                  <strong>วิธีที่ 1 (ผ่าน Google Sheets):</strong> เครื่องที่ 2 เปิดเว็บเดียวกัน &gt; Sign in ด้วย Gmail เดิม &gt; ผูก Spreadsheet ID เดิม &gt; กดปุ่ม <strong>ดึงข้อมูลจาก Google Sheets เข้าแอป</strong> เพื่ออัปเดตข้อมูลล่าสุดลงเครื่อง
                </li>
                <li>
                  <strong>วิธีที่ 2 (ผ่านไฟล์ JSON):</strong> กดปุ่ม <strong>สำรอง JSON</strong> จากเครื่องแรก แล้วนำไฟล์ไปกดเลือกนำเข้าที่เครื่องที่ 2 (ระบบจะเตือนให้สำรองไฟล์ JSON อัตโนมัติทุก 15 วัน)
                </li>
              </ul>
            </div>
          </section>

          {/* Clean Template JSON Generator for New Clinics */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <FileJson className="h-4 w-4 text-teal-700" />
                  <span>สร้างไฟล์แม่แบบเปล่า (.json) เพื่อส่งให้สถานบริการอื่นเริ่มใช้งาน</span>
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  ไฟล์แม่แบบนี้จะยังคงโครงสร้างบัญชีธนาคารและผังรายการไว้ แต่ล้างรายการรับ-จ่ายตัวอย่าง ({transactions.length} รายการ), ล้างยอดยกมาเป็น 0.00 และปลดล็อค Google Sheets ออกทั้งหมด
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ชื่อสถานบริการปลายทาง (ระบุไว้ล่วงหน้าในไฟล์แม่แบบ)
                </label>
                <input
                  type="text"
                  value={templateUnitName}
                  onChange={(e) => setTemplateUnitName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  placeholder="เช่น โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านหลวง"
                />
              </div>
              <button
                type="button"
                onClick={handleDownloadCleanTemplate}
                className="no-print inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <Download className="h-3.5 w-3.5" />
                <span>ดาวน์โหลดแม่แบบเปล่า (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="no-print inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>ไปหน้านำเข้าไฟล์ JSON</span>
              </button>
            </div>

            {templateNotice && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{templateNotice}</span>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Google Login / 403 Test Users / Firebase Domains */}
      {activeTab === 'oauth' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="text-xs leading-relaxed text-amber-950">
                <p className="text-sm font-bold">
                  การแก้ไขข้อผิดพลาด 403: access_denied เมื่อสถานบริการอื่นกด Sign in with Google
                </p>
                <p className="mt-1 text-amber-900">
                  สาเหตุเกิดจากโปรเจกต์ Google Cloud (<span className="font-mono-num font-semibold">gen-lang-client-0484087699</span>) อยู่ในสถานะ <strong>Testing</strong> ทำให้ Google อนุญาตเฉพาะอีเมลที่ผู้ดูแลระบบเพิ่มไว้ในรายชื่อ <strong>Test users</strong> เท่านั้น
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-bold text-slate-900">
                แนวทางที่ 1: เพิ่มอีเมลสถานบริการเป็น Test users (แนะนำ — สูงสุด 100 แห่ง)
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
                <li>
                  เข้า{' '}
                  <a
                    href="https://console.cloud.google.com/auth/audience"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                  >
                    <span>Google Cloud Console &gt; Google Auth platform &gt; Audience</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  ตรวจสอบมุมบนซ้ายว่าเลือกโปรเจกต์ <span className="font-mono-num font-semibold">gen-lang-client-0484087699</span> แล้ว
                </li>
                <li>
                  เลื่อนลงไปที่หัวข้อ <strong>Test users</strong> กด <strong>+ Add users</strong>
                </li>
                <li>
                  กรอกอีเมล Gmail ของสถานบริการที่จะใช้งาน (เช่น <span className="font-mono-num">banloung000174800@gmail.com</span>) แล้วกด <strong>Save</strong>
                </li>
                <li>
                  แจ้งให้สถานบริการนั้นกด <strong>Sign in with Google</strong> ใหม่ (และไปที่หน้า <strong>Google Sheets &gt; ล็อคการตั้งค่า &amp; อีเมล</strong> เพื่อล็อคอีเมลนั้นไว้บนเครื่องของหน่วย)
                </li>
              </ol>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-bold text-slate-900">
                แนวทางที่ 2: กด Publish App (เปิดให้ Gmail ทั่วไปเข้าใช้ได้ไม่จำกัด)
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
                <li>
                  ในหน้า <strong>Google Auth platform &gt; Audience</strong> กดปุ่ม <strong>Publish App</strong> เพื่อเปลี่ยนสถานะจาก <em>Testing</em> เป็น <em>In Production</em>
                </li>
                <li>
                  เนื่องจากแอปขอสิทธิ์เข้าถึง Google Sheets/Drive (Sensitive Scope) หากยังไม่ได้ส่งยืนยัน (App Verification) หน้าจอล็อกอินจะขึ้นคำเตือนว่า <em>&ldquo;Google ยังไม่ได้ยืนยันแอปนี้&rdquo;</em>
                </li>
                <li>
                  สถานบริการอื่นสามารถเข้าใช้งานได้ทันทีโดยกด{' '}
                  <strong>ขั้นสูง (Advanced)</strong> &gt;{' '}
                  <strong>ไปที่ ... (ไม่ปลอดภัย)</strong> &gt;{' '}
                  <strong>ดำเนินการต่อ</strong>
                </li>
              </ol>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="h-4 w-4 text-teal-700" />
              <span>เพิ่มโดเมนเว็บใน Firebase Authorized Domains (สำคัญเมื่อนำขึ้น Cloudflare / Vercel)</span>
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              หากนำแอปไปโฮสต์บนโดเมนใหม่และพบข้อผิดพลาด <span className="font-mono-num font-semibold text-rose-700">auth/unauthorized-domain</span> ให้เพิ่มโดเมนนั้นใน Firebase Console:
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-slate-700">
              <li>
                เปิด{' '}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                >
                  <span>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                กด <strong>Add domain</strong> แล้วกรอกโดเมนที่ใช้งานจริง (โดเมนที่เปิดอยู่ตอนนี้คือ:{' '}
                <span className="font-mono-num font-semibold text-slate-900">
                  {currentOrigin || 'your-project.pages.dev'}
                </span>
                )
              </li>
              <li>บันทึกแล้วลองกด Sign in with Google ใหม่อีกครั้ง</li>
            </ol>
          </section>
        </div>
      )}

      {/* TAB 3: Self-Hosting Deployment Guide (Cloudflare Pages / Node.js) */}
      {activeTab === 'deploy' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              โครงสร้างโปรเจกต์ที่รองรับการ Deploy ทันที
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">Frontend (Vite + React)</p>
                <p className="mt-1 text-slate-600">
                  คำสั่ง build คือ <span className="font-mono-num">npm run build</span> ได้ไฟล์สถิตในโฟลเดอร์ <span className="font-mono-num">dist/</span> พร้อมไฟล์ตั้งค่า <span className="font-mono-num">wrangler.toml</span>
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">Cloudflare Pages Functions</p>
                <p className="mt-1 text-slate-600">
                  โฟลเดอร์ <span className="font-mono-num">functions/api/*</span> รองรับ Route <span className="font-mono-num">/api/health</span> และ AI Endpoints บน Edge อัตโนมัติ
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">Server / Local (Node.js)</p>
                <p className="mt-1 text-slate-600">
                  รองรับการรันผ่าน Express ที่ <span className="font-mono-num">server.ts</span> ด้วยคำสั่ง <span className="font-mono-num">npm start</span> บนพอร์ต 3000
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              วิธีที่ 1 · ติดตั้งขึ้น Cloudflare Pages (แนะนำ — ฟรี รวดเร็ว มี HTTPS พร้อมโดเมน .pages.dev)
            </h3>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                <strong>ก. ผ่าน Cloudflare Dashboard (เชื่อมต่อ GitHub):</strong>
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  นำโค้ดขึ้น GitHub Repository ของหน่วยงาน หรือเครือข่าย สสอ.
                </li>
                <li>
                  เข้า <strong>Cloudflare Dashboard &gt; Workers &amp; Pages &gt; Create &gt; Pages &gt; Connect to Git</strong>
                </li>
                <li>
                  ตั้งค่า Build command: <span className="font-mono-num font-semibold">npm run build</span> และ Build output directory: <span className="font-mono-num font-semibold">dist</span>
                </li>
                <li>
                  ไปที่ <strong>Settings &gt; Environment variables</strong> แล้วเพิ่มตัวแปร <span className="font-mono-num font-semibold">GEMINI_API_KEY</span> (สำหรับฟีเจอร์ AI ผู้เชี่ยวชาญบัญชี) จากนั้นสั่ง Redeploy
                </li>
                <li>
                  นำโดเมนที่ได้ (เช่น <span className="font-mono-num">pcu-ledger.pages.dev</span>) ไปเพิ่มใน <strong>Firebase Authorized domains</strong>
                </li>
              </ul>

              <p className="pt-2">
                <strong>ข. ผ่านคำสั่ง Command Line (Wrangler CLI):</strong>
              </p>
              <CopyCommandBlock
                label="คำสั่ง Build และ Deploy ขึ้น Cloudflare Pages"
                code={`npm install
npm run build
npx wrangler pages deploy dist --project-name pcu-ledger`}
              />
              <CopyCommandBlock
                label="คำสั่งตั้งค่า GEMINI_API_KEY บน Cloudflare Pages"
                code={`npx wrangler pages secret put GEMINI_API_KEY --project-name pcu-ledger`}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              วิธีที่ 2 · ติดตั้งใช้งานในเครื่องแม่ข่ายภายใน (Windows / Linux Server / Docker)
            </h3>
            <p className="text-xs text-slate-600">
              เหมาะสำหรับหน่วยงานที่ต้องการรันเฉพาะภายในเครือข่าย LAN / Intranet (ต้องมี Node.js เวอร์ชัน 20 ขึ้นไป)
            </p>
            <CopyCommandBlock
              label="คำสั่งรันแอปด้วย Node.js (พอร์ต 3000)"
              code={`npm install
npm run build
# สร้างไฟล์ .env แล้วใส่ GEMINI_API_KEY=your_api_key
npm start`}
            />
            <p className="text-xs text-amber-800">
              หมายเหตุ: หากต้องการให้แต่ละสถานบริการใช้ฐาน Google Sheets และบัญชี Google ของตนเอง สามารถใช้โปรเจกต์ Firebase เดิมได้ทันที (เพียงเพิ่มโดเมน/IP หรือเพิ่ม Test users) หรือแก้ไขไฟล์ <span className="font-mono-num font-semibold">firebase-applet-config.json</span> เพื่อชี้ไปยังโปรเจกต์ Firebase ของหน่วยงานเอง
            </p>
          </section>
        </div>
      )}

      {/* TAB 4: Interactive Go-Live Checklist */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              1. ตรวจสอบความพร้อมการตั้งค่าในระบบปัจจุบัน (อัปเดตตามข้อมูลจริง)
            </h3>
            <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {liveChecks.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                        item.done
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="h-2 w-2 rounded-xs bg-amber-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-slate-500">{item.detail}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(item.target)}
                    className="no-print inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-teal-700 hover:bg-slate-50"
                  >
                    <span>{item.actionLabel}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              2. รายการตรวจสอบสำหรับผู้ติดตั้ง / เครือข่าย (ติ๊กบันทึกความคืบหน้าได้)
            </h3>
            <div className="mt-4 space-y-2.5">
              {manualChecklistItems.map((item) => {
                const checked = Boolean(manualChecks[item.key]);
                return (
                  <label
                    key={item.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-xs transition-colors ${
                      checked
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleManualCheck(item.key)}
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                    />
                    <div>
                      <p
                        className={`font-semibold ${
                          checked
                            ? 'text-emerald-950 line-through'
                            : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-slate-500">{item.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigate('sheets')}
                className="no-print inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>ไปหน้าเชื่อมต่อ Google Sheets</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('ledger')}
                className="no-print inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <span>เริ่มบันทึกรายวัน</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
