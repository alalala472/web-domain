use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Model = {
  id: string;
  model_id: string;
  alias: string | null;
  enabled: boolean;
};

type Provider = {
  id: string;
  name: string;
  base_url: string;
  api_format: string;
  enabled: boolean;
  token_prefix?: string;
  models: Model[];
};

type Project = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  providers: Provider[];
};

const authHeader = () => {
  const password = window.prompt("Password dashboard:");
  if (password === null) return null;
  return "Basic " + btoa(`admin:${password}`);
};

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [newToken, setNewToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    projectName: "My AI App",
    provider: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-5.6",
    alias: ""
  });

  async function load() {
    setLoading(true);
    setError("");
    const auth = authHeader();
    if (!auth) return setLoading(false);
    localStorage.setItem("dashboard_auth", auth);
    const res = await fetch("/api/dashboard", {
      headers: { Authorization: auth },
      cache: "no-store"
    });
    if (!res.ok) {
      setError("Password salah atau dashboard belum dikonfigurasi.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProject(data.project);
    setLoading(false);
  }

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_auth");
    if (!saved) {
      setLoading(false);
      return;
    }
    fetch("/api/dashboard", { headers: { Authorization: saved }, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setProject(d.project))
      .catch(() => localStorage.removeItem("dashboard_auth"))
      .finally(() => setLoading(false));
  }, []);

  const providersCount = project?.providers.length ?? 0;
  const modelsCount = useMemo(
    () => project?.providers.reduce((n, p) => n + p.models.length, 0) ?? 0,
    [project]
  );

  async function addProvider(e: FormEvent) {
    e.preventDefault();
    setError("");
    const auth = localStorage.getItem("dashboard_auth") ?? authHeader();
    if (!auth) return;
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Gagal menyimpan provider.");
    if (data.proxyToken) setNewToken(data.proxyToken);
    setShowAdd(false);
    setForm({ ...form, apiKey: "", model: "", alias: "" });
    await loadWithAuth(auth);
  }

  async function loadWithAuth(auth: string) {
    const res = await fetch("/api/dashboard", {
      headers: { Authorization: auth },
      cache: "no-store"
    });
    if (res.ok) setProject((await res.json()).project);
  }

  async function removeProvider(id: string) {
    if (!confirm("Hapus provider dan semua modelnya?")) return;
    const auth = localStorage.getItem("dashboard_auth");
    if (!auth) return;
    const res = await fetch(`/api/providers/${id}`, {
      method: "DELETE",
      headers: { Authorization: auth }
    });
    if (!res.ok) return setError("Gagal menghapus provider.");
    await loadWithAuth(auth);
  }

  if (loading) return <main className="min-h-screen grid place-items-center muted">Memuat...</main>;

  if (!project) {
    return (
      <main className="min-h-screen px-5 py-10">
        <div className="mx-auto max-w-md card p-6">
          <div className="text-2xl font-black">🔐 AI API Proxy</div>
          <p className="muted mt-2">Dashboard mobile untuk mengelola API provider.</p>
          {error && <p className="mt-4 text-red-300">{error}</p>}
          <button className="btn btn-primary mt-6 w-full" onClick={load}>Masuk Dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#070b14]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <div className="text-lg font-black">AI API Proxy</div>
            <div className="text-xs muted">Satu dashboard • mobile first</div>
          </div>
          <button
            className="text-xs muted"
            onClick={() => { localStorage.removeItem("dashboard_auth"); setProject(null); }}
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-5">
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm muted">Project</div>
              <h1 className="mt-1 text-2xl font-black">{project.name}</h1>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">● Online</span>
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-[#090f1d] p-3">
            <div className="text-xs muted">Proxy endpoint</div>
            <div className="mt-1 break-all text-sm">POST {window.location.origin}/api/chat</div>
            <div className="mt-3 text-xs muted">Client token</div>
            <div className="mt-1 font-mono text-sm">{newToken || `${project.token_prefix}••••••••••••`}</div>
            {newToken && <p className="mt-2 text-xs text-amber-300">Simpan token ini. Token lengkap hanya ditampilkan sekali.</p>}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="card p-4"><div className="text-xs muted">Providers</div><div className="mt-1 text-2xl font-black">{providersCount}</div></div>
          <div className="card p-4"><div className="text-xs muted">Models</div><div className="mt-1 text-2xl font-black">{modelsCount}</div></div>
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Providers & Models</h2><p className="mt-1 text-xs muted">API key tersimpan terenkripsi di server.</p></div>
            <button className="btn btn-primary px-3 py-2 text-xs" onClick={() => setShowAdd(true)}>+ Tambah</button>
          </div>

          <div className="mt-4 space-y-3">
            {project.providers.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-800 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{p.name}</div>
                    <div className="mt-1 break-all text-xs muted">{p.base_url}</div>
                  </div>
                  <button className="text-xs text-red-300" onClick={() => removeProvider(p.id)}>Hapus</button>
                </div>
                <div className="mt-3 space-y-2">
                  {p.models.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2">
                      <div>
                        <div className="text-sm">{m.model_id}</div>
                        {m.alias && <div className="text-xs text-indigo-300">alias: {m.alias}</div>}
                      </div>
                      <span className="text-xs text-emerald-300">{m.enabled ? "Aktif" : "Off"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!project.providers.length && <div className="py-8 text-center text-sm muted">Belum ada provider.</div>}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-bold">Cara pakai dari aplikasi</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 text-[11px] leading-5 text-slate-300">{`POST ${typeof window !== "undefined" ? window.location.origin : "https://domain.vercel.app"}/api/chat
Authorization: Bearer ${newToken || "px_live_xxxxx"}

{
  "model": "gpt-5.6",
  "messages": [
    { "role": "user", "content": "Halo" }
  ]
}`}</pre>
          <p className="mt-3 text-xs muted">Model boleh berupa model asli atau alias yang kamu buat.</p>
        </section>

        {error && <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/70 p-4">
          <div className="mx-auto mt-6 max-w-md card max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Tambah Provider</h2>
              <button className="muted" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form className="mt-5 space-y-3" onSubmit={addProvider}>
              <label className="block text-xs muted">Nama provider<input className="input mt-1" required value={form.provider} onChange={e => setForm({...form, provider:e.target.value})} placeholder="OpenAI / xKiro / Cioro" /></label>
              <label className="block text-xs muted">Base URL<input className="input mt-1" required value={form.baseUrl} onChange={e => setForm({...form, baseUrl:e.target.value})} placeholder="https://api.example.com/v1" /></label>
              <label className="block text-xs muted">API Key<input className="input mt-1" required type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey:e.target.value})} placeholder="sk-..." /></label>
              <label className="block text-xs muted">Model pertama<input className="input mt-1" required value={form.model} onChange={e => setForm({...form, model:e.target.value})} placeholder="model-name" /></label>
              <label className="block text-xs muted">Alias (opsional)<input className="input mt-1" value={form.alias} onChange={e => setForm({...form, alias:e.target.value})} placeholder="smart" /></label>
              <p className="text-xs muted">Format saat ini: OpenAI-compatible. Untuk provider yang punya format request berbeda, adapter khusus perlu ditambahkan.</p>
              <button className="btn btn-primary w-full" type="submit">Simpan Provider</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
