import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../services/api";

interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  modified: string;
}

interface DriveStatus {
  ok: boolean;
  client_configured: boolean;
  folder_configured: boolean;
  connected: boolean;
  connected_at: string | null;
  files: DriveFile[];
  list_error: string | null;
  message?: string;
  setting_key?: string;
  deployment?: string;
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const BackupDriveStatusPage: React.FC = () => {
  const [data, setData] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("backup_drive.php?action=status")
      .then((res) => {
        if (res?.ok) setData(res as DriveStatus);
        else setError(res?.message || "โหลดสถานะไม่สำเร็จ");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("backup_drive.php?action=oauth_start");
      if (res?.ok && res.url) {
        window.open(String(res.url), "gdrive_oauth", "width=520,height=640");
      } else {
        setError(res?.message || "เริ่มเชื่อม Drive ไม่ได้");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "เริ่มเชื่อม Drive ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await apiFetch("backup_drive.php?action=disconnect", { method: "POST" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยกเลิกการเชื่อมไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return <div className="p-6 text-sm text-slate-500">กำลังโหลดสถานะสำรอง…</div>;
  }

  return (
    <div className="h-full w-full p-6">
      <h1 className="text-xl font-semibold text-slate-900">สำรองฐานข้อมูล</h1>
      <p className="mt-1 text-sm text-slate-600">
        หน้านี้ดูไฟล์บน Google Drive เท่านั้น ไม่มีปุ่ม dump บนโฮสต์
        การ dump จริงรันที่เครื่องออฟฟิศ — กดปุ่มด้านล่างเพื่อเปิดเครื่องมือบนเครื่องนี้
        (ต้องลงทะเบียน protocol ครั้งเดียวด้วย{" "}
        <code className="text-xs">scripts/backup/Register-BackupProtocol.ps1</code>)
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="mt-6 space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>Client ID: {data?.client_configured ? "ตั้งแล้ว" : "ยังไม่มี GOOGLE_DRIVE_CLIENT_ID บนโฮสต์"}</p>
        <p>โฟลเดอร์ Drive: {data?.folder_configured ? "ตั้งแล้ว" : "ยังไม่มี GOOGLE_DRIVE_FOLDER_ID"}</p>
        <p>บัญชี: {data?.connected ? `เชื่อมแล้ว${data.connected_at ? ` (${data.connected_at})` : ""}` : "ยังไม่เชื่อม"}</p>
        {data?.setting_key && <p className="text-xs text-slate-400">setting key: {data.setting_key}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href="primaerp-backup://open"
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white"
        >
          เปิดเครื่องมือ dump บนเครื่องนี้
        </a>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={connect}
          disabled={busy || !data?.client_configured}
        >
          เชื่อม Google Drive
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          onClick={disconnect}
          disabled={busy || !data?.connected}
        >
          ยกเลิกการเชื่อม
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          onClick={load}
        >
          รีเฟรช
        </button>
      </div>

      {data?.list_error && (
        <p className="mt-4 text-sm text-amber-700">{data.list_error}</p>
      )}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="py-2 font-medium">ไฟล์</th>
            <th className="py-2 font-medium">ขนาด</th>
            <th className="py-2 font-medium">แก้ไข</th>
          </tr>
        </thead>
        <tbody>
          {(data?.files ?? []).length === 0 ? (
            data?.list_error ? null : (
            <tr>
              <td className="py-4 text-slate-400" colSpan={3}>
                ยังไม่มีไฟล์ในโฟลเดอร์ — อัปจากเครื่องออฟฟิศตามขั้นตอน dump
              </td>
            </tr>
            )
          ) : (
            (data?.files ?? []).map((f) => (
              <tr key={f.id} className="border-b border-slate-100">
                <td className="py-2">{f.name}</td>
                <td className="py-2">{formatBytes(f.size)}</td>
                <td className="py-2">{f.modified ? new Date(f.modified).toLocaleString("th-TH") : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BackupDriveStatusPage;
