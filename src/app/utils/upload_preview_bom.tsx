import { EnqueueQueued, EnqueueResponse, PreviewResult, StatusPayload } from "../types/upload_bom_preview_type";

const API_BASE =
    process.env.NEXT_PUBLIC_FRAPPE_BASE_URL?.replace(/\/$/, "") || ""; 

const TOKEN_ENDPOINT =
    API_BASE + "/api/method/frappe.sessions.get_csrf_token";

const ENQUEUE_ENDPOINT =
    API_BASE + "/api/method/rbiiot.api.import_bom_api.handle_file_preview";


export function normalizePayload(raw: any, jobId: string): StatusPayload {
    const inner = raw?.message ?? raw;  

    const looksLikeResult =
        inner && typeof inner === "object" &&
        "rubber_validation" in inner &&
        "steel_validation" in inner &&
        "rm_validation" in inner &&
        "prod_validation" in inner;

    if (looksLikeResult) {
        return { job_id: jobId, status: "finished", progress: 100, result: inner as PreviewResult };
    }

    const valid = new Set(["queued", "running", "finished", "error", "unknown"]);
    if (inner && typeof inner === "object" && valid.has(inner.status)) {
        return { job_id: inner.job_id || jobId, ...inner };
    }

    return { job_id: jobId, status: "unknown" };
}






export async function getCSRFToken(): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, { method: "GET", credentials: "include", });
    if (!res.ok) return null;
    const json = await res.json();
    const token = json?.message || null;
    if (token) localStorage.setItem("X-Frappe-CSRF-Token", token);
    return token;
  } catch {
    return null;
  }
}

/** Unwrap standard Frappe shape: { message: ... } */
function unwrap<T = any>(raw: any): T {
  return (raw && typeof raw === "object" && "message" in raw) ? (raw.message as T) : (raw as T);
}

/** Does the payload look like a proper enqueue response? */
function isQueuedShape(x: any): x is EnqueueQueued {
  return !!(x && typeof x === "object" && x.status === "queued" && x.job_id && x.topic);
}

/** Normalize any server payload into EnqueueResponse */
function normalizeEnqueue(raw: any): EnqueueResponse {
  const x = unwrap(raw);

  if (isQueuedShape(x)) return x;

  // Try to pull a readable message
  const msg =
    (typeof x?.message === "string" && x.message) ||
    (typeof raw === "string" && raw) ||
    (typeof x === "object" ? JSON.stringify(x) : String(x)) ||
    "Unknown enqueue response";

  return { status: "error", message: msg };
}

/** Heuristic check for CSRF problems */
function looksLikeCSRF(text: string, status: number): boolean {
  if (status === 403) return true;
  return /csrf/i.test(text);
}

export async function postFileWithCSRF(endpoint: string, file: File): Promise<EnqueueResponse> {
  const request = async (csrf?: string | null) => {
    const fd = new FormData();
    fd.append("file", file);

    const headers: Record<string, string> = {};
    if (csrf) headers["X-Frappe-CSRF-Token"] = csrf;


    console.log("Posting file to", endpoint, "with headers", headers, "csrf:", csrf);

    const res = await fetch(endpoint, {
      method: "POST",
      body: fd,
      credentials: "include",
      headers,
    });

    // Parse once
    const text = await res.text();
    let json: any = undefined;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }

    return { status: res.status, text, raw: json ?? text };
  };

  try {
    const cached = typeof window !== "undefined" ? localStorage.getItem("X-Frappe-CSRF-Token") : null;

    // First attempt
    let { status, text, raw } = await request(cached);

    // Retry once if CSRF likely
    if (looksLikeCSRF(text, status)) {
      const token = await getCSRFToken();
      ({ status, text, raw } = await request(token));
    }

    return normalizeEnqueue(raw);
  } catch (err: any) {
    return { status: "error", message: err?.message || "Network error" };
  }
}
