import React from 'react';
import { AlertTriangle, Clock, Download, X } from 'lucide-react';
import { BackupScheduleStatus } from '../utils/backupJson';
import { formatThaiDateTime } from '../utils/backupJson';

interface BackupReminderModalProps {
  open: boolean;
  triggerReason: 'scheduled_15d' | 'before_close';
  scheduleStatus: BackupScheduleStatus;
  intervalDays: number;
  lastBackupAt: string | null;
  hasUnsavedChanges: boolean;
  transactionCount: number;
  onBackupNow: () => void;
  onRemindLater: () => void;
  onDismissWithoutBackup: () => void;
}

export const BackupReminderModal: React.FC<BackupReminderModalProps> = ({
  open,
  triggerReason,
  scheduleStatus,
  intervalDays,
  lastBackupAt,
  hasUnsavedChanges,
  transactionCount,
  onBackupNow,
  onRemindLater,
  onDismissWithoutBackup,
}) => {
  if (!open) return null;

  const isScheduled = triggerReason === 'scheduled_15d' || scheduleStatus.isDue;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-reminder-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              {isScheduled ? (
                <Clock className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3
                id="backup-reminder-title"
                className="text-base font-bold text-slate-900"
              >
                {isScheduled
                  ? `แจ้งเตือนครบกำหนดสำรองข้อมูลทุก ${intervalDays} วัน`
                  : 'แจ้งเตือนให้สำรองไฟล์ JSON ก่อนปิดงาน'}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {isScheduled
                  ? `ถึงกำหนดรอบสำรองข้อมูล (.json) ทุก ${intervalDays} วันแล้ว กรุณาดาวน์โหลดไฟล์สำรองเก็บไว้ในเครื่องก่อนปิดไฟล์ เพื่อป้องกันข้อมูลสูญหาย`
                  : 'คุณมีการแก้ไขข้อมูลบัญชีเพิ่มเติมหลังจากการสำรองไฟล์ล่าสุด แนะนำให้ดาวน์โหลดไฟล์สำรอง (.json) เก็บไว้ก่อนปิดโปรแกรม'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemindLater}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="text-slate-500">สำรองข้อมูลล่าสุด:</span>
              <p className="mt-0.5 font-semibold text-slate-900">
                {formatThaiDateTime(lastBackupAt)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">ระยะเวลาที่ผ่านไป:</span>
              <p className="mt-0.5 font-semibold text-amber-700">
                {scheduleStatus.daysSinceLastBackup === null
                  ? 'ยังไม่เคยสำรองไฟล์ JSON'
                  : `${scheduleStatus.daysSinceLastBackup} วัน (ตั้งรอบทุก ${intervalDays} วัน)`}
              </p>
            </div>
            <div>
              <span className="text-slate-500">ข้อมูลในสมุดรายวัน:</span>
              <p className="font-mono-num mt-0.5 font-semibold text-slate-900">
                {transactionCount} รายการ
              </p>
            </div>
            <div>
              <span className="text-slate-500">สถานะการแก้ไขล่าสุด:</span>
              <p className="mt-0.5 font-semibold text-slate-900">
                {hasUnsavedChanges
                  ? 'มีการแก้ไขที่ยังไม่ได้สำรอง JSON'
                  : 'ตรงกับไฟล์สำรองล่าสุด'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onDismissWithoutBackup}
            className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ปิดงานโดยไม่สำรอง
          </button>
          <button
            type="button"
            onClick={onRemindLater}
            className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            เตือนภายหลัง
          </button>
          <button
            type="button"
            onClick={onBackupNow}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <Download className="h-4 w-4" />
            <span>สำรองไฟล์ JSON ทันที</span>
          </button>
        </div>
      </div>
    </div>
  );
};
