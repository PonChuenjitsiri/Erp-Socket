"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import io, { Socket } from "socket.io-client";
import type { PreviewResult, StatusPayload } from "@/app/types/upload_bom_preview_type";
import { normalizePayload } from "@/app/utils/upload_preview_bom";

const SOCKET_PATH = "/socket.io"; 
const SOCKET_ORIGIN = process.env.NEXT_PUBLIC_FRAPPE_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin.replace(":8000", ":9000") : "http://localhost:9000");

const STATUS_ENDPOINT = (jobId: string) => `/api/rbiiot/preview/status?job_id=${encodeURIComponent(jobId)}`;
const RESULT_ENDPOINT = (jobId: string) => `/api/rbiiot/preview/result?job_id=${encodeURIComponent(jobId)}`;

export default function BomPreviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PreviewResult | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const progress = status?.progress ?? (status?.status === "finished" ? 100 : status?.status === "queued" ? 0 : 0);

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    setResult(null);
    setStatus(null);
    setJobId(null);
    setTopic(null);
    setBusy(false);
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const connectSocket = useCallback((theTopic: string, theJobId: string) => {
    if (socketRef.current?.connected) {
      try {
        socketRef.current.off(theTopic);
        socketRef.current.disconnect();
      } catch {}
    }

    const socket = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.debug("[socket] connected to", SOCKET_ORIGIN, "path", SOCKET_PATH);
    });

    socket.on("connect_error", (err) => {
      console.warn("[socket] connect_error", (err as any)?.message);
    });

    socket.on(theTopic, async (raw: any) => {
      const payload = normalizePayload(raw, theJobId);
      setStatus(payload);
      if (payload.status === "finished") {
        const r2 = await fetch(RESULT_ENDPOINT(theJobId), { credentials: "include" });
        const raw2 = await r2.json();
        const data = (raw2 as any)?.message ?? raw2;
        setResult(data);
        setBusy(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else if (payload.status === "error") {
        setBusy(false);
      }
    });

    socketRef.current = socket;
  }, []);

  const startPolling = useCallback((theJobId: string) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(STATUS_ENDPOINT(theJobId), { credentials: "include" });
        const raw = await res.json();
        const payload = (raw as any)?.message ?? raw;
        const norm = normalizePayload(payload, theJobId);
        setStatus(norm);

        if (norm.status === "finished") {
          const r2 = await fetch(RESULT_ENDPOINT(theJobId), { credentials: "include" });
          const raw2 = await r2.json();
          const data = (raw2 as any)?.message ?? raw2;
          setResult(data);
          setBusy(false);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (norm.status === "error") {
          setBusy(false);
        }
      } catch {
      }
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch {}
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const onUpload = useCallback(async () => {
    try {
      setError("");
      setBusy(true);
      setResult(null);
      setStatus(null);

      if (!file) {
        setBusy(false);
        setError("Please choose an Excel .xlsx file.");
        return;
      }

      const fd = new FormData();
      fd.set("file", file);
      fd.set("preview", "1");

      const r = await fetch("/api/rbiiot/preview/enqueue", {
        method: "POST",
        body: fd,
      });
      const raw = await r.json();
      const enq = (raw as any)?.message ?? raw;

      if (enq?.status !== "queued" || !enq?.job_id) {
        setBusy(false);
        setError(enq?.message || "Failed to enqueue job. Please check server logs.");
        return;
      }

      const { job_id, topic } = enq as { job_id: string; topic: string; status: "queued" };
      setJobId(job_id);
      setTopic(topic);
      setStatus({ job_id, status: "queued", progress: 0 });

      connectSocket(topic, job_id);
      startPolling(job_id);
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || "Upload failed.");
    }
  }, [file, connectSocket, startPolling]);

  const counts = useMemo(() => {
    if (!result) return null;
    return {
      rubber: result.rubber_validation?.length || 0,
      steel: result.steel_validation?.length || 0,
      rm: result.rm_validation?.length || 0,
      prod: result.prod_validation?.length || 0,
    };
  }, [result]);

  const downloadJSON = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bom_preview_${jobId || "result"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, jobId]);

  return (
    <div className="max-w-[860px] mx-[40px] my-auto py-[16px]">
      <h1 className="text-[24px] mb-[12px]">BOM Preview (Enqueue + Realtime)</h1>
      <p className="text-[#555] mb-[16px]">Upload your Excel file. We’ll enqueue the preview job, show progress, and display the final result here.</p>

      <div className="border border-[#e5e7eb] rounded-[10px] p-[16px] mb-[18px]">
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleSelect} disabled={busy} />
        <button onClick={onUpload} disabled={!file || busy} className="ml-[12px] px-[14px] py-[8px] rounded-[8px] border border-[#111827] bg-[#111827] text-[#fff] cursor-pointer disabled:cursor-not-allowed disabled:bg-[#f3f4f6] disabled:text-[#111827]">
          {busy ? "Processing..." : "Upload & Preview"}
        </button>

        {error ? <div className="text-[#b91c1c] mt-[12px]">{error}</div> : null}

        {status ? (
          <div className="mt-[16px]">
            <div className="flex justify-between mb-[6px]">
              <span>
                Status: <b>{status.status}</b>
                {status.stage ? ` · ${status.stage}` : ""}
              </span>
              <span>{typeof progress === "number" ? `${progress}%` : ""}</span>
            </div>
            <div className="h-[10px] bg-[#e5e7eb] rounded-full overflow-hidden">
              <div style={{ width: `${progress || 0}%` }} className={`h-full ${status.status === "error" ? "bg-[#ef4444]" : "bg-[#2563eb]"}`} />
            </div>
            {status.message ? (
              <div className={`text-sm ${status.status === "error" ? "text-red-600" : "text-gray-700"}`}>{status.message}</div>
            ) : null}
            {jobId ? (
              <div className="mt-[6px] text-[#6b7280] text-[12px]">
                job_id: <code>{jobId}</code> {topic ? (
                  <>· topic: <code>{topic}</code></>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="bg-[#fafafa] border-[10px] p-[16px] rounded-[10px] text-[#111827]">
          <div className="flex items-center gap-2 mb-[8px]">
            <h2 className="text-[18px] m-0">Result</h2>
            <button onClick={downloadJSON} className="text-[#111827] text-[14px] font-semibold">Download JSON</button>
          </div>

          {counts ? (
            <div className="grid grid-cols-4 gap-[12px] mb-[16px]">
              <Card title="Rubber" value={counts.rubber} />
              <Card title="Steel" value={counts.steel} />
              <Card title="RM" value={counts.rm} />
              <Card title="Production" value={counts.prod} />
            </div>
          ) : null}

          <details className="mb-[10px]"><summary style={{ cursor: "pointer" }}>rubber_validation</summary><JsonViewer data={result.rubber_validation} /></details>
          <details className="mb-[10px]"><summary style={{ cursor: "pointer" }}>steel_validation</summary><JsonViewer data={result.steel_validation} /></details>
          <details className="mb-[10px]"><summary style={{ cursor: "pointer" }}>rm_validation</summary><JsonViewer data={result.rm_validation} /></details>
          <details className="mb-[10px]"><summary style={{ cursor: "pointer" }}>prod_validation</summary><JsonViewer data={result.prod_validation} /></details>
        </div>
      ) : null}
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-[#fafafa] border-[1px] rounded-[10px] p-[12px]">
      <div className="text-[#6b7280] text-[12px]">{title}</div>
      <div className="text-[20px] font-semibold">{value}</div>
    </div>
  );
}

function JsonViewer({ data }: { data: any }) {
  return (
    <pre className="whitespace-pre-wrap break-words bg-[#0b1020] text-[#d1e7ff] p-[12px] rounded-[10px] overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
  );
}

