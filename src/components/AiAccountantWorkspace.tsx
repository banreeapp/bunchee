import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  ImagePlus,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  buildCategoriesPromptText,
  EXPENSE_CATEGORIES,
  FISCAL_MONTHS,
  INCOME_CATEGORIES,
} from '../data/pcuCatalog';
import {
  AuditResult,
  LedgerTransaction,
  ParsedEntryDraft,
  PcuSettings,
} from '../types/accounting';
import {
  computeAccountBalances,
  computeMonthlyStatement,
  formatMoney,
  getCategoryLabel,
  getMonthKey,
} from '../utils/accountingMath';

interface AiAccountantWorkspaceProps {
  settings: PcuSettings;
  transactions: LedgerTransaction[];
  selectedMonthKey: string;
  onAddTransaction: (tx: Omit<LedgerTransaction, 'id' | 'createdAt'>) => void;
}

type AiSubTab = 'parse' | 'audit' | 'chat';

export const AiAccountantWorkspace: React.FC<AiAccountantWorkspaceProps> = ({
  settings,
  transactions,
  selectedMonthKey,
  onAddTransaction,
}) => {
  const [subTab, setSubTab] = useState<AiSubTab>('parse');

  // Parse Entry State
  const [inputText, setInputText] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [draft, setDraft] = useState<ParsedEntryDraft | null>(null);
  const [commitSuccess, setCommitSuccess] = useState('');

  // Audit State
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'model'; text: string }>
  >([]);

  const monthInfo =
    FISCAL_MONTHS.find((m) => m.key === selectedMonthKey) || FISCAL_MONTHS[0];

  const monthly = useMemo(
    () => computeMonthlyStatement(settings, transactions, selectedMonthKey),
    [settings, transactions, selectedMonthKey]
  );

  const accountBalances = useMemo(
    () => computeAccountBalances(settings, transactions),
    [settings, transactions]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const parts = dataUrl.split(',');
      setImagePreviewUrl(dataUrl);
      setImageBase64(parts[1] || '');
      setImageMimeType(file.type || 'image/png');
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !imageBase64) {
      setParseError('กรุณาพิมพ์รายละเอียดรายการหรือแนบภาพใบเสร็จ/สลิป');
      return;
    }
    setParsing(true);
    setParseError('');
    setCommitSuccess('');
    try {
      const res = await fetch('/api/ai/parse-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          imageBase64: imageBase64 || undefined,
          mimeType: imageMimeType || undefined,
          bankAccounts: settings.bankAccounts.map((b) => ({
            id: b.id,
            name: b.name,
            accountNo: b.accountNo,
          })),
          docPrefixes: settings.docPrefixes,
          categoriesPrompt: buildCategoriesPromptText(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการวิเคราะห์');
      setDraft(data);
    } catch (err: unknown) {
      setParseError(
        err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์ข้อมูลได้'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleCommitDraft = () => {
    if (!draft) return;
    onAddTransaction({
      date: draft.date,
      type: draft.type,
      docNo: draft.docNo || '',
      categoryCode: draft.categoryCode,
      subCategoryCode: draft.subCategoryCode || '',
      description: draft.description,
      amount: Number(draft.amount),
      paymentMethod: draft.paymentMethod,
      bankAccountId: draft.bankAccountId || settings.bankAccounts[0]?.id || 'bank-1',
      chequeNo: draft.chequeNo || '',
      projectCode: draft.projectCode || '',
      issuerName: settings.officers.financeOfficer,
    });
    setCommitSuccess('บันทึกรายการลงสมุดรายวันเรียบร้อยแล้ว');
    setDraft(null);
    setInputText('');
    setImagePreviewUrl('');
    setImageBase64('');
  };

  const handleRunAudit = async () => {
    setAuditing(true);
    setAuditError('');
    try {
      const monthTxs = transactions.filter(
        (t) => getMonthKey(t.date) === selectedMonthKey
      );
      const res = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitName: `${settings.unitName} ${settings.address}`,
          fiscalYear: settings.fiscalYearBE,
          selectedMonthLabel: monthInfo.label,
          transactions: monthTxs.map((t) => ({
            ...t,
            categoryLabel: getCategoryLabel(
              t.type,
              t.categoryCode,
              t.subCategoryCode
            ),
          })),
          summaryStats: {
            totalMonthIncome: monthly.totalMonthIncome,
            totalMonthExpense: monthly.totalMonthExpense,
            openingFromPrevMonth: monthly.openingFromPrevMonth,
            closingMonthBalance: monthly.closingMonthBalance,
            accounts: accountBalances.map((a) => ({
              name: a.account.name,
              bankBalance: a.bankBalance,
              cashInHand: a.cashInHand,
              totalBalance: a.totalBalance,
            })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถตรวจสอบบัญชีได้');
      setAuditResult(data);
    } catch (err: unknown) {
      setAuditError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตรวจสอบบัญชี'
      );
    } finally {
      setAuditing(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q || chatLoading) return;

    const nextHistory = [...chatHistory, { role: 'user' as const, text: q }];
    setChatHistory(nextHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const contextSummary = `หน่วยงาน: ${settings.unitName} (${settings.affiliation === 'pao' ? 'สังกัด อบจ.' : 'สังกัด สธ.'}) ปีงบประมาณ ${settings.fiscalYearBE}
เดือนปัจจุบัน: ${monthInfo.label}
รายรับเดือนนี้: ${formatMoney(monthly.totalMonthIncome)} บาท | รายจ่ายเดือนนี้: ${formatMoney(monthly.totalMonthExpense)} บาท
ยอดยกมาจากเดือนก่อน: ${formatMoney(monthly.openingFromPrevMonth)} บาท | คงเหลือยกไป: ${formatMoney(monthly.closingMonthBalance)} บาท`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          contextSummary,
          history: chatHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI ไม่สามารถตอบคำถามได้');
      setChatHistory([
        ...nextHistory,
        { role: 'model', text: data.reply || '' },
      ]);
    } catch (err: unknown) {
      setChatHistory([
        ...nextHistory,
        {
          role: 'model',
          text: `เกิดข้อผิดพลาด: ${
            err instanceof Error ? err.message : 'ไม่สามารถติดต่อ AI ได้'
          }`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('parse')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'parse'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSearch className="h-3.5 w-3.5" />
            <span>อ่านใบเสร็จ/สลิปลงบัญชี</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('audit')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ตรวจสอบความถูกต้องทางบัญชี</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('chat')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>ปรึกษาผู้เชี่ยวชาญบัญชี รพ.สต.</span>
          </button>
        </div>

        <span className="text-xs text-slate-500">
          มาตรฐาน PCU Money · {monthInfo.label}
        </span>
      </div>

      {/* 1. Smart Slip / Receipt Parser */}
      {subTab === 'parse' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
            <h2 className="text-base font-semibold text-slate-900">
              วิเคราะห์ใบเสร็จ สลิป หรือข้อความเพื่อลงบัญชี
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              อัปโหลดภาพใบเสร็จ/บิลค่าน้ำค่าไฟ หรือพิมพ์รายละเอียดเป็นภาษาไทย AI จะจัดหมวดหมู่ตามผัง 13 หมวดรับ / 14 หมวดจ่ายให้อัตโนมัติ
            </p>

            <form onSubmit={handleAnalyzeEntry} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  รายละเอียดรายการรับ-จ่าย
                </label>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="ตัวอย่าง: จ่ายค่าไฟฟ้าเดือนพฤศจิกายน 2569 ของ รพ.สต.บ้านรี จำนวน 1,436.80 บาท โดยจ่ายเช็คเลขที่ 61438795 จากบัญชีเงินบำรุง สอ.บ้านรี เลขที่เอกสาร สบ1133.6.2/102"
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  แนบภาพใบเสร็จรับเงิน / บิล / สลิปโอนเงิน (ไม่บังคับ)
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs font-medium text-slate-600 transition-colors hover:border-teal-500 hover:bg-teal-50/40">
                  <ImagePlus className="h-4 w-4 text-teal-700" />
                  <span>
                    {imagePreviewUrl
                      ? 'เปลี่ยนไฟล์ภาพใบเสร็จ'
                      : 'เลือกภาพใบเสร็จ หรือสลิป (PNG / JPG)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {imagePreviewUrl && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <img
                      src={imagePreviewUrl}
                      alt="ตัวอย่างใบเสร็จที่อัปโหลด"
                      className="max-h-48 w-full object-contain"
                    />
                  </div>
                )}
              </div>

              {parseError && (
                <p className="text-xs font-medium text-red-600">{parseError}</p>
              )}

              {commitSuccess && (
                <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{commitSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={parsing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {parsing
                    ? 'กำลังวิเคราะห์และจัดหมวดหมู่...'
                    : 'ให้ AI วิเคราะห์และจัดหมวดหมู่บัญชี'}
                </span>
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
            <h2 className="text-base font-semibold text-slate-900">
              ผลการจัดหมวดหมู่ก่อนบันทึกลงสมุดรายวัน
            </h2>
            {!draft ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-slate-500">
                <FileSearch className="mb-2 h-8 w-8 text-slate-300" />
                <p>ยังไม่มีข้อมูลผลการวิเคราะห์</p>
                <p className="mt-1">
                  กรอกข้อความหรืออัปโหลดสลิปทางด้านซ้ายเพื่อให้ AI แนะนำหมวดหมู่บัญชี
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-teal-900">
                  <p className="font-semibold">เหตุผลทางบัญชีจาก AI:</p>
                  <p className="mt-1 leading-relaxed">{draft.reasoning}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      ประเภท
                    </label>
                    <select
                      value={draft.type}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          type: e.target.value as ParsedEntryDraft['type'],
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                    >
                      <option value="income">รายรับ</option>
                      <option value="expense">รายจ่าย</option>
                      <option value="transfer">ฝาก-ถอนเงินสด</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      วันที่
                    </label>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) =>
                        setDraft({ ...draft, date: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-600">
                    หมวดหมู่หลัก
                  </label>
                  <select
                    value={draft.categoryCode}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        categoryCode: e.target.value,
                        subCategoryCode: '',
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                  >
                    {(draft.type === 'income'
                      ? INCOME_CATEGORIES
                      : EXPENSE_CATEGORIES
                    ).map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-600">
                    รายละเอียดรายการ
                  </label>
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      เลขที่เอกสาร
                    </label>
                    <input
                      type="text"
                      value={draft.docNo}
                      onChange={(e) =>
                        setDraft({ ...draft, docNo: e.target.value })
                      }
                      className="font-mono-num w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      ช่องทาง
                    </label>
                    <select
                      value={draft.paymentMethod}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          paymentMethod: e.target
                            .value as ParsedEntryDraft['paymentMethod'],
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                    >
                      <option value="cash">เงินสด</option>
                      <option value="bank">โอน/e-Pay</option>
                      <option value="cheque">เช็ค</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      จำนวนเงิน (บาท)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) =>
                        setDraft({ ...draft, amount: Number(e.target.value) })
                      }
                      className="font-mono-num w-full rounded-lg border border-slate-200 px-2.5 py-2 text-right text-xs font-semibold"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCommitDraft}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  <span>ยืนยันบันทึกลงสมุดรายวัน</span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 2. AI Audit & Reconciliation */}
      {subTab === 'audit' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                ตรวจสอบความถูกต้องทางบัญชีและกระทบยอดประจำเดือน{monthInfo.label}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                AI จะตรวจเช็กเลขที่ใบเสร็จซ้ำ ความสอดคล้องของภาษีหัก ณ ที่จ่าย การลงหมวดรายรับ-จ่าย และยอดคงเหลือแบบ 401/404/407
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunAudit}
              disabled={auditing}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {auditing ? 'กำลังตรวจสอบบัญชี...' : 'เริ่มตรวจสอบบัญชีเดือนนี้'}
              </span>
            </button>
          </div>

          {auditError && (
            <p className="mt-4 text-xs font-medium text-red-600">{auditError}</p>
          )}

          {!auditResult ? (
            <div className="py-12 text-center text-xs text-slate-500">
              กดปุ่ม &ldquo;เริ่มตรวจสอบบัญชีเดือนนี้&rdquo; เพื่อให้ AI ผู้เชี่ยวชาญตรวจสอบรายการบัญชีและสรุปจุดที่ควรระวังก่อนส่งงบเดือน
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  สรุปผลการตรวจสอบ:{' '}
                  <span
                    className={
                      auditResult.overallStatus === 'warning'
                        ? 'text-rose-700'
                        : auditResult.overallStatus === 'attention'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }
                  >
                    {auditResult.overallStatus === 'normal'
                      ? 'ถูกต้องเรียบร้อย'
                      : auditResult.overallStatus === 'attention'
                      ? 'ควรตรวจสอบเพิ่มเติม'
                      : 'พบประเด็นที่ต้องแก้ไข'}
                  </span>
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                  {auditResult.summary}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  หมายเหตุการกระทบยอด: {auditResult.reconciliationNote}
                </p>
              </div>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {auditResult.findings.map((f, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-start gap-2.5">
                      {f.severity === 'ok' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            f.severity === 'critical'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {f.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {f.detail}
                        </p>
                        <p className="mt-1.5 text-xs font-medium text-teal-800">
                          คำแนะนำ: {f.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. Interactive Chat */}
      {subTab === 'chat' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              ปรึกษา AI ผู้เชี่ยวชาญด้านบัญชี รพ.สต.
            </h2>
            <p className="text-xs text-slate-500">
              สอบถามระเบียบเงินบำรุง การลงบัญชีภาษีหัก ณ ที่จ่าย เงินรับฝาก สปสช. อปท. และการกระทบยอดแบบ 401/404/407
            </p>
          </div>

          <div className="my-4 h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
            {chatHistory.length === 0 && (
              <div className="space-y-2 text-xs text-slate-500">
                <p className="font-medium text-slate-700">
                  ตัวอย่างคำถามที่ถามได้ทันที:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'เวลาจ่ายค่าไฟฟ้าผ่าน e-Pay แล้วมีภาษีหัก ณ ที่จ่าย 1% ต้องลงบัญชีรับฝากยังไงให้ยอด 404 ตรง?',
                    'งบเดือน รพ.สต. ต้องส่งเอกสารประกอบอะไรบ้าง (401, 404, 407)?',
                    'รับเงินค่าบริการทันตกรรมจากประกันสังคม ต้องจัดเข้าหมวดไหนในงบเดือน?',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setChatInput(q)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:border-teal-400 hover:text-teal-800"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((item, idx) => (
              <div
                key={idx}
                className={`flex ${
                  item.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[82%] rounded-xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    item.role === 'user'
                      ? 'bg-teal-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {item.text}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="text-xs text-slate-500">กำลังเรียบเรียงคำตอบทางบัญชี...</div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="พิมพ์คำถามด้านบัญชี รพ.สต. ที่นี่..."
              className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>ส่งคำถาม</span>
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
