"use client";

import { useState } from "react";

export default function ERPLoginPage() {
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMe(null);
    try {
      const r = await fetch("/api/erpnext/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usr, pwd }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Login failed");

      const meRes = await fetch("/api/erpnext/me");
      const meJson = await meRes.json();
      if (!meRes.ok) throw new Error(meJson?.error || "Could not verify session");
      setMe(meJson?.user || null);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/erpnext/logout", { method: "POST" });
      setMe(null);
    } catch (e) {
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur shadow-xl rounded-2xl p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to ERPNext</h1>
            <p className="text-sm text-slate-500 mt-1">Using server-side proxy (no CORS hassle)</p>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Username or Email</label>
              <input
                autoComplete="username"
                value={usr}
                onChange={(e) => setUsr(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 px-3 py-2"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>
            ) : null}

            {me ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3">
                Logged in as <b>{me}</b>. You can now call your own <code>/api/erpnext/*</code> routes to work with ERP data.
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-4 py-2.5 font-medium shadow hover:shadow-lg active:scale-[.99] disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={busy || !me}
                className="px-4 py-2.5 rounded-2xl border border-slate-300 text-slate-700 bg-white hover:shadow disabled:opacity-60"
              >
                Sign Out
              </button>
            </div>
          </form>

          <div className="mt-6 text-xs text-slate-500 leading-relaxed">
            <p>
              This page keeps the ERP session (<code>sid</code>) as an HttpOnly cookie on <i>your</i> domain and proxies all requests.
              If you need to open the ERPNext Desk UI in a new tab, you still log in there separately (its cookie is scoped to the ERP domain).
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>ERPNext Login • Next.js App Router • © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
