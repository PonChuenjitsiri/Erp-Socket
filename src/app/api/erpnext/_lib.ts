import { cookies } from "next/headers";

export const ERP_BASE = process.env.ERP_BASE_URL || "";
export function extractSidFromSetCookie(setCookieValues: string[] | undefined): string | null {
    if (!setCookieValues || setCookieValues.length === 0) return null;
    for (const v of setCookieValues) {
        const m = /(?:^|;)\s*sid=([^;]+)/i.exec(v);
        if (m?.[1]) return m[1];
    }
    return null;
}
export function requireEnv() {
    if (!ERP_BASE) throw new Error("ERP_BASE_URL is not set");
}

function isFormDataBody(body: any) {
    return typeof FormData !== "undefined" && body instanceof FormData;
}
function isBlobBody(body: any) {
    return typeof Blob !== "undefined" && body instanceof Blob;
}
function isStreamBody(body: any) {
    return typeof ReadableStream !== "undefined" && body instanceof ReadableStream;
}

export async function erpFetch(path: string, init: RequestInit = {}) {
    requireEnv();
    const c = cookies();
    const sid = (await c).get("erp_sid")?.value;
    const csrf = (await c).get("erp_csrf")?.value;

    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");

    const body: any = (init as any).body;
    const method = (init.method || "GET").toUpperCase();

    const needsJsonHeader =
        body &&
        typeof body === "string" &&
        !headers.has("Content-Type");

    if (needsJsonHeader) {
        headers.set("Content-Type", "application/json");
    }

    if (sid) headers.set("Cookie", `sid=${sid}`);

    if (method !== "GET" && csrf && !isFormDataBody(body) && !isBlobBody(body) && !isStreamBody(body)) {
        headers.set("X-Frappe-CSRF-Token", csrf);
    }

    const res = await fetch(`${ERP_BASE}${path}`, { ...init, headers });
    return res;
}

