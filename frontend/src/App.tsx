import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import Workspace, { type WorkspaceModule } from "./Workspace";

type Membership = {
  organization_id: string;
  organizations: { id: string; name: string; slug: string }[];
  roles: { role_key: string; name_uz: string }[];
};

const navigation: { icon: string; label: string; module: WorkspaceModule }[] = [
  { icon: "⌂", label: "Bosh sahifa", module: "dashboard" },
  { icon: "◎", label: "CRM va sotuvlar", module: "crm" },
  { icon: "♙", label: "O‘quvchilar", module: "students" },
  { icon: "▦", label: "Akademiya", module: "academy" },
  { icon: "◷", label: "Moliya", module: "finance" },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [pageError, setPageError] = useState("");
  const [activeOrganization, setActiveOrganization] = useState<{ id: string; name: string } | null>(null);
  const [activeModule, setActiveModule] = useState<WorkspaceModule>("dashboard");

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setPageError(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (_event === "SIGNED_OUT") setMemberships([]);
      setPageError("");
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;

    let active = true;
    void supabase
      .from("organization_memberships")
      .select("organization_id, organizations(id, name, slug), roles(role_key, name_uz)")
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setPageError(`Markazlar yuklanmadi: ${error.message}`);
        else setMemberships((data ?? []) as Membership[]);
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (!supabaseConfigured || !supabase) return <SetupNotice />;
  if (loading) return <div className="loading-screen">EduSales AI yuklanmoqda…</div>;
  if (!session) return <AuthScreen />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="EduSales AI bosh sahifa">
          <span className="brand-mark">E</span>
          <span>edu<span className="brand-accent">sales</span><small>EDUCATION OS</small></span>
        </a>
        <div className="workspace-label">ISH JOYI</div>
        <button className="workspace-switcher" onClick={() => { setActiveOrganization(null); setActiveModule("dashboard"); }}>
          <span className="workspace-avatar">{session.user.email?.[0]?.toUpperCase() ?? "E"}</span>
          <span className="workspace-copy"><strong>{activeOrganization?.name ?? "Ish joyini tanlang"}</strong><small>{activeOrganization ? "Boshqaruv paneli" : "O‘quv markazi"}</small></span>
          <span className="chevron">⌄</span>
        </button>
        <div className="workspace-label nav-label">MENYU</div>
        <nav className="navigation" aria-label="Asosiy menyu">
          {navigation.map((item) => (
            <button className={`nav-item${activeOrganization && activeModule === item.module ? " active" : ""}`} key={item.module} onClick={() => {
              if (!activeOrganization && item.module !== "dashboard") setPageError("Modulni ochish uchun avval ish joyini tanlang.");
              else { setPageError(""); setActiveModule(item.module); }
            }}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card"><span className="support-icon">✳</span><strong>Yordam kerakmi?</strong><p>EduSales jamoasi yordam berishga tayyor.</p><span className="support-caption">Yordam markazi</span></div>
          <button className="profile-button" onClick={() => { if (supabase) void supabase.auth.signOut(); }}>
            <span className="profile-avatar">{session.user.email?.[0]?.toUpperCase() ?? "E"}</span>
            <span className="profile-copy"><strong>{session.user.email}</strong><small>Hisobdan chiqish</small></span>
            <span className="logout-icon">↗</span>
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">{activeOrganization?.name ?? "Bosh sahifa"} <span>/</span> {activeOrganization ? navigation.find((item) => item.module === activeModule)?.label : "Umumiy ko‘rinish"}</div>
          <div className="topbar-actions"><span className="secure-label"><span /> Xavfsiz ulanish</span><span className="icon-button" aria-label="Bildirishnomalar">♧</span><div className="topbar-avatar">{session.user.email?.[0]?.toUpperCase() ?? "E"}</div></div>
        </header>
        <div className="content">
          {activeOrganization ? <Workspace organizationId={activeOrganization.id} organizationName={activeOrganization.name} module={activeModule} /> : <>
          <div className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> BOSHQARUV MARKAZI</div><h1>Xush kelibsiz<span className="heading-period">.</span></h1><p className="welcome-copy">Markazingizni boshqarish uchun ish joyingizni tanlang yoki yangisini yarating.</p></div>
            <div className="date-chip"><span>◷</span> {new Intl.DateTimeFormat("uz-UZ", { dateStyle: "long" }).format(new Date())}</div>
          </div>

          {pageError && <div className="inline-error" role="alert">{pageError}</div>}
          <div className="section-heading"><div><h2>Sizning ish joylaringiz</h2><p>Ruxsatingiz bor markazlar ro‘yxati</p></div><span className="count-pill">{memberships.length} ta markaz</span></div>

          <div className="workspace-grid">
            {memberships.map((membership) => {
              const organization = membership.organizations?.[0];
              if (!organization) return null;
              const role = membership.roles?.[0];
              return <article className="organization-card" key={organization.id}>
                <div className="org-card-top"><span className="org-logo">{organization.name.slice(0, 1).toUpperCase()}</span><span className="org-status"><i /> Faol</span></div>
                <h3>{organization.name}</h3>
                <p className="org-role">{role?.name_uz ?? "Xodim"} <span>·</span> {organization.slug}</p>
                <button className="open-workspace" onClick={() => { setActiveOrganization({ id: organization.id, name: organization.name }); setActiveModule("dashboard"); setPageError(""); }}>Boshqaruvni ochish <span>→</span></button>
              </article>;
            })}
            <CreateOrganizationCard onCreated={() => {
              if (supabase) void supabase.from("organization_memberships").select("organization_id, organizations(id, name, slug), roles(role_key, name_uz)").eq("is_active", true).then(({ data, error }) => {
                if (error) setPageError(`Ish joyi yaratildi, lekin ro‘yxat yangilanmadi: ${error.message}`);
                else setMemberships((data ?? []) as Membership[]);
              });
            }} onError={setPageError} />
          </div>

          <div className="phase-banner"><div className="phase-icon">✳</div><div><strong>CRM, o‘quvchilar, akademiya va moliya</strong><p>Modullar faqat tanlangan markaz ma’lumotlarini ko‘rsatadi. Ruxsatlarni Supabase RLS tekshiradi.</p></div><span className="phase-tag">ISHGA TAYYOR</span></div>
          </>}
          <footer className="page-footer"><span>EduSales AI <span>·</span> O‘quv markazlari uchun Education OS</span><span>Versiya 0.1.0</span></footer>
        </div>
      </section>
    </main>
  );
}

function CreateOrganizationCard({ onCreated, onError }: { onCreated: () => void; onError: (message: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    onError("");
    const { error } = await supabase.rpc("create_organization", { p_name: name.trim() });
    setSaving(false);
    if (error) {
      onError(`Ish joyini yaratib bo‘lmadi: ${error.message}`);
      return;
    }
    setName("");
    setShowForm(false);
    onCreated();
  }

  return <article className={`create-card${showForm ? " create-card-open" : ""}`}>
    {!showForm ? <button className="create-trigger" onClick={() => setShowForm(true)}><span className="plus-icon">＋</span><strong>Yangi ish joyi</strong><span>Markazingiz uchun yangi boshqaruv maydoni yarating</span><span className="create-link">Markaz qo‘shish <b>→</b></span></button> :
      <form className="create-form" onSubmit={(event) => void submit(event)}><div className="create-form-title"><strong>Yangi markaz yaratish</strong><button type="button" className="close-button" onClick={() => setShowForm(false)} aria-label="Yopish">×</button></div><label htmlFor="organization-name">Markaz nomi</label><input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Masalan, Ziyo Academy" autoFocus /><button className="primary-button" disabled={saving}>{saving ? "Yaratilmoqda…" : "Markaz yaratish"}</button></form>}
  </article>;
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (mode === "signup") setMessage("Tasdiqlash havolasi emailingizga yuborildi. Emailni tasdiqlagach tizimga kiring.");
    else if (mode === "reset") setMessage("Agar bu email ro‘yxatdan o‘tgan bo‘lsa, parolni tiklash havolasi yuborildi.");
  }

  const title = mode === "signin" ? "Hisobingizga kiring" : mode === "signup" ? "Hisob yarating" : "Parolni tiklash";
  return <main className="auth-page"><div className="auth-decoration decoration-one" /><div className="auth-decoration decoration-two" />
    <a className="brand auth-brand" href="/"><span className="brand-mark">E</span><span>edu<span className="brand-accent">sales</span><small>EDUCATION OS</small></span></a>
    <section className="auth-card"><div className="auth-kicker"><span className="eyebrow-dot" /> MARKAZINGIZ UCHUN YANGI BOSQICH</div><h1>{title}<span className="heading-period">.</span></h1><p className="auth-description">O‘quv markazingizni bitta xavfsiz platformada boshqaring.</p>
      <form onSubmit={(event) => void submit(event)}><label htmlFor="email">Elektron pochta</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="siz@markaz.uz" />
        {mode !== "reset" && <><label htmlFor="password">Parol</label><input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Kamida 8 ta belgi" /></>}
        {mode === "signin" && <button className="forgot-link" type="button" onClick={() => { setMode("reset"); setMessage(""); setError(""); }}>Parolni unutdingizmi?</button>}
        {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-message" role="status">{message}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? "Kuting…" : mode === "signin" ? "Kirish" : mode === "signup" ? "Hisob yaratish" : "Tiklash havolasini yuborish"} <span>→</span></button>
      </form>
      <div className="auth-switch">{mode === "signin" ? "Hali hisobingiz yo‘qmi?" : "Hisobingiz bormi?"} <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setError(""); }}>{mode === "signin" ? "Ro‘yxatdan o‘ting" : "Tizimga kirish"}</button></div>
      {mode === "reset" && <button className="back-link" onClick={() => setMode("signin")}>← Kirishga qaytish</button>}
    </section><div className="auth-footer">© 2026 EduSales AI <span>·</span> O‘quv markazlari uchun yaratilgan</div></main>;
}

function SetupNotice() {
  return <main className="setup-page"><div className="setup-card"><span className="brand-mark">E</span><div className="eyebrow"><span className="eyebrow-dot" /> BOSHLANG‘ICH SOZLASH</div><h1>Supabase ulanishi kerak<span className="heading-period">.</span></h1><p>Frontendni ishga tushirish uchun Supabase loyiha manzili va ochiq kalitini muhit o‘zgaruvchilariga kiriting.</p><ol><li><code>frontend/.env.example</code> faylidan <code>frontend/.env.local</code> yarating.</li><li><code>VITE_SUPABASE_URL</code> va <code>VITE_SUPABASE_ANON_KEY</code> ni to‘ldiring.</li><li>Backend papkasidagi migratsiyani Supabase loyihangizga qo‘llang.</li></ol><div className="security-note">Faqat publishable/anon kalitdan foydalaning. <code>service_role</code> kalitini frontendga hech qachon joylamang.</div></div></main>;
}
