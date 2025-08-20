"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * If your Next.js and ERPNext share the same origin, leave this blank.
 * Otherwise set NEXT_PUBLIC_FRAPPE_BASE_URL in .env.local
 *   e.g. NEXT_PUBLIC_FRAPPE_BASE_URL=https://erp.your-domain.com
 */
const API_BASE = process.env.NEXT_PUBLIC_FRAPPE_BASE_URL?.replace(/\/$/, "") || "";

const ENDPOINTS = {
  csrf: `${API_BASE}/api/method/rbiiot.api.utils.get_csrf`,
  login: API_BASE + "/api/method/login",
  whoami: API_BASE + "/api/method/frappe.auth.get_logged_user",
  logout: API_BASE + "/api/method/logout",
};

async function getCSRFToken(): Promise<string | null> {
  try {
    const res = await fetch(ENDPOINTS.csrf, { method: "GET", credentials: "include" });
    console.log("Fetching CSRF token from", res);
    if (!res.ok) return null;
    const payload = await res.json();
    const token = payload?.message || null;
    if (token) {
      try {
        localStorage.setItem("X-Frappe-CSRF-Token", token);
      } catch {}
    }
    return token;
  } catch {
    return null;
  }
}

async function postLogin(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  // ensure we have a CSRF token up front (important for some Frappe setups)
  let csrf = (typeof window !== "undefined" && localStorage.getItem("X-Frappe-CSRF-Token")) || null;
  if (!csrf) csrf = await getCSRFToken(); // your existing helper

  const makeForm = () => {
    const fd = new FormData();
    fd.append("usr", username);
    fd.append("pwd", password);
    return fd;
  };

  const unwrap = (raw: any) =>
    raw && typeof raw === "object" && "message" in raw ? raw.message : raw;

  const attempt = async (token?: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["X-Frappe-CSRF-Token"] = token;

    const res = await fetch(ENDPOINTS.login, {
      method: "POST",
      body: makeForm(),
      headers,
      credentials: "include",
    });

    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }

    const inner = unwrap(data) ?? text;

    // success cases seen in Frappe
    if (
      res.ok &&
      (inner === "Logged In" ||
        (typeof inner === "object" && inner?.home_page))
    ) {
      return { ok: true as const };
    }

    // CSRF / permission signals
    const lower = (typeof inner === "string" ? inner : JSON.stringify(inner || "")).toLowerCase();
    if (res.status === 403 || lower.includes("csrf")) {
      return { ok: false as const, error: "csrf" };
    }

    // Invalid creds
    if (res.status === 401 || lower.includes("invalid") || lower.includes("incorrect")) {
      return { ok: false as const, error: "Invalid username or password" };
    }

    return { ok: false as const, error: typeof inner === "string" ? inner : "Login failed" };
  };

  // first try (with current/guessed CSRF)
  let first = await attempt(csrf);
  if (first.ok) return first;

  // if CSRF flagged, fetch fresh token and retry once
  if (first.error === "csrf") {
    csrf = await getCSRFToken();
    return attempt(csrf);
  }

  return first;
}


async function whoAmI(): Promise<string | null> {
  try {
    const res = await fetch(ENDPOINTS.whoami, { credentials: "include" });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.message || null;
  } catch {
    return null;
  }
}

async function doLogout(): Promise<void> {
  try {
    await fetch(ENDPOINTS.logout, { method: "GET", credentials: "include" });
  } catch {}
}

export default function LoginPage() {
  const router = useRouter();

  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [me, setMe] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const checkSession = useCallback(async () => {
    const user = await whoAmI();
    setMe(user);
  }, []);

  useEffect(() => {
    // On page load, try to detect if already logged in (cookie session)
    checkSession();
  }, [checkSession]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setBusy(true);

      try {
        // optional: prefetch CSRF so subsequent requests work smoothly
        await getCSRFToken();

        const res = await postLogin(usr.trim(), pwd);
        if (!res.ok) {
          setError(res.error || "Login failed");
          setBusy(false);
          return;
        }

        const user = await whoAmI(); // verify session + get user id
        setMe(user);

        // Optionally redirect to your BOM page after login
        router.push("/preview-bom-upload");
      } catch (err: any) {
        setError(err?.message || "Login failed");
      } finally {
        setBusy(false);
      }
    },
    [usr, pwd, router]
  );

  const onLogout = useCallback(async () => {
    setBusy(true);
    await doLogout();
    setMe(null);
    setBusy(false);
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b1020", color: "#e5e7eb" }}>
      <div style={{ width: 420, maxWidth: "92vw", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 16, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>Sign in to ERPNext</h1>
        <p style={{ marginTop: 6, marginBottom: 18, color: "#9ca3af", fontSize: 13 }}>
          Enter your credentials to continue.
        </p>

        {me ? (
          <div style={{ background: "#052e16", border: "1px solid #065f46", color: "#d1fae5", padding: 12, borderRadius: 10, marginBottom: 12 }}>
            Logged in as <b>{me}</b>
          </div>
        ) : null}

        <form onSubmit={onSubmit}>
          <label style={{ fontSize: 12, color: "#9ca3af" }}>Username / Email</label>
          <input
            type="text"
            inputMode="email"
            autoComplete="username"
            value={usr}
            onChange={(e) => setUsr(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            style={{
              width: "100%",
              marginTop: 6,
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #374151",
              background: "#111827",
              color: "#e5e7eb",
              outline: "none",
            }}
          />

          <label style={{ fontSize: 12, color: "#9ca3af" }}>Password</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
              style={{
                flex: 1,
                marginTop: 6,
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#111827",
                color: "#e5e7eb",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              disabled={busy}
              style={{
                marginTop: 6,
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#0b1020",
                color: "#e5e7eb",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {showPwd ? "Hide" : "Show"}
            </button>
          </div>

          {error ? (
            <div style={{ color: "#fecaca", background: "#450a0a", border: "1px solid #7f1d1d", padding: 10, borderRadius: 10, marginBottom: 12 }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || !usr || !pwd}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #3b82f6",
              background: busy ? "#1d4ed8" : "#2563eb",
              color: "#fff",
              borderRadius: 10,
              cursor: busy || !usr || !pwd ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={checkSession}
            disabled={busy}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #374151",
              background: "#0b1020",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Check Session
          </button>
          <button
            type="button"
            onClick={onLogout}
            disabled={busy || !me}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: me ? "#7f1d1d" : "#3f3f46",
              color: "#fff",
              cursor: me ? "pointer" : "not-allowed",
            }}
          >
            Logout
          </button>
        </div>

        <p style={{ marginTop: 14, fontSize: 12, color: "#9ca3af" }}>
          After a successful login, you’ll be redirected to <code>/bom-preview</code>.
        </p>
      </div>
    </div>
  );
}
