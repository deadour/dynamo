import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, Camera, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, Copy, Dumbbell, Flame, History, Home, ListChecks, LogOut, Pencil, Plus, Save, Scale, Search, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Timer, Trash2, TrendingDown, TrendingUp, Trophy, UserRound, Users, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

// En producción, sin VITE_API_URL la API se sirve en el mismo dominio (el sitio estático reenvía /api/* al backend),
// así la cookie de sesión es propia y los navegadores que bloquean cookies de terceros no la descartan.
const API = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : "http://localhost:8000");
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
declare global { interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } } } } }
// Sesión por token (header Authorization): funciona aunque el navegador bloquee cookies de terceros (Safari/iOS).
const TOKEN_KEY = "dynamo.token";
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (value: string | null) => { try { if (value) localStorage.setItem(TOKEN_KEY, value); else localStorage.removeItem(TOKEN_KEY); } catch { /* sin storage: queda la cookie */ } };
const authHeaders = (): Record<string, string> => { const token = getToken(); return token ? { Authorization: `Token ${token}` } : {}; };
export async function api(path: string, options: RequestInit = {}) {
  const method = options.method || "GET"; let csrf: string | undefined;
  // Con token no hace falta CSRF; sin token (primer login) se pide por si hay sesión por cookie.
  if (method !== "GET" && !getToken()) { try { csrf = (await (await fetch(`${API}/csrf/`, { credentials: "include" })).json()).csrfToken; } catch { /* seguimos sin CSRF */ } }
  const isJson = !(options.body instanceof Blob);
  const response = await fetch(`${API}${path}`, { ...options, credentials: "include", headers: { ...(isJson ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-CSRFToken": csrf } : {}), ...authHeaders(), ...(options.headers as Record<string, string> | undefined) } });
  // Sesión vencida o bloqueada: se vuelve al login en vez de dejar pantallas vacías.
  if ((response.status === 401 || response.status === 403) && !path.startsWith("/api/auth/") && !path.startsWith("/api/admin/")) { setToken(null); window.dispatchEvent(new Event("dynamo:unauthorized")); }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "No se pudo completar la operación");
  const data = response.status === 204 ? null : await response.json();
  if (data && typeof data === "object" && typeof data.token === "string") setToken(data.token);
  return data;
}

// ---------- helpers de formato ----------
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const kg = (value: number | string | null | undefined) => value === null || value === undefined || value === "" ? "—" : nf.format(Number(value));
const parseDate = (value: string) => { const [y, m, d] = value.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const shortDate = (value: string) => parseDate(value).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
const longDate = (value: string) => parseDate(value).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const LEVELS: Record<string, string> = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado", expert: "Experto" };
const CATEGORIES: Record<string, string> = { strength: "Fuerza", stretching: "Estiramiento", plyometrics: "Pliometría", powerlifting: "Powerlifting", "olympic weightlifting": "Halterofilia", strongman: "Strongman", cardio: "Cardio" };
const FORCES: Record<string, string> = { push: "Empuje", pull: "Tracción", static: "Estático" };
const MECHANICS: Record<string, string> = { compound: "Multiarticular", isolation: "Aislamiento" };
const label = (map: Record<string, string>, value?: string) => value ? map[value.toLowerCase()] || value : "";
const EQUIPMENT: Record<string, string> = { barbell: "Barra", dumbbell: "Mancuernas", cable: "Polea", machine: "Máquina", "body only": "Peso corporal", "e-z curl bar": "Barra Z", kettlebells: "Kettlebell", bands: "Bandas elásticas", "exercise ball": "Pelota suiza", "medicine ball": "Balón medicinal", "foam roll": "Rodillo de espuma", other: "Otro" };
const equipmentLabel = (value?: string) => value ? EQUIPMENT[value.toLowerCase()] || value : "Sin equipamiento";
const MUSCLES: Record<string, string> = { abdominals: "Abdominales", abductors: "Abductores", adductors: "Aductores", biceps: "Bíceps", calves: "Gemelos", chest: "Pecho", forearms: "Antebrazos", glutes: "Glúteos", hamstrings: "Isquiotibiales", lats: "Dorsales", "lower back": "Lumbares", "middle back": "Espalda media", neck: "Cuello", quadriceps: "Cuádriceps", shoulders: "Hombros", traps: "Trapecios", triceps: "Tríceps" };
const muscleLabel = (value: string) => MUSCLES[value] || value;
const GROUPS = [
  { key: "pecho", label: "Pecho", muscles: ["chest"] },
  { key: "espalda", label: "Espalda", muscles: ["lats", "middle back", "lower back", "traps"] },
  { key: "hombros", label: "Hombros", muscles: ["shoulders"] },
  { key: "biceps", label: "Bíceps", muscles: ["biceps", "forearms"] },
  { key: "triceps", label: "Tríceps", muscles: ["triceps"] },
  { key: "piernas", label: "Piernas", muscles: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { key: "abdomen", label: "Abdomen", muscles: ["abdominals"] },
];
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const daysSince = (iso?: string) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)) : null;
const agoLabel = (days: number | null) => days === null ? "Sin registros" : days === 0 ? "Hoy" : days === 1 ? "Ayer" : `Hace ${days} días`;
const exerciseName = (item: any) => item.name_es || item.name;

// Achica la foto en el navegador antes de subirla (~1280px, JPEG) para no llenar la base.
async function compressImage(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo procesar la foto")), "image/jpeg", 0.8));
}
function usePhoto(id: string | null, version = 0) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (!id) return; let objectUrl: string | undefined; void fetch(`${API}/api/body-weight/${id}/photo/?v=${version}`, { credentials: "include", headers: authHeaders() }).then((r) => r.ok ? r.blob() : null).then((blob) => { if (blob?.type.startsWith("image/")) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [id, version]);
  return url;
}

const UserContext = createContext<any>(null);
const useIdParam = () => useSearchParams()[0].get("id") || "";
const SetUserContext = createContext<(user: any) => void>(() => undefined);

// ---------- piezas visuales ----------
function Logo({ size = 32 }: { size?: number }) { return <img className="logo-mark" src="/logo-icon.png" alt="" width={size} height={size} />; }
function Wordmark({ height = 26 }: { height?: number }) { return <img className="wordmark" src="/logo-wordmark.png" alt="Dynamo" height={height} style={{ height }} />; }
function Loading({ label = "Cargando…" }: { label?: string }) { return <div className="loading"><Logo size={44} /><span>{label}</span></div>; }
function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) { return <div className="empty"><div className="empty-icon">{icon}</div><strong>{title}</strong>{children}</div>; }
function PageHead({ title, eyebrow, back, action }: { title: React.ReactNode; eyebrow?: React.ReactNode; back?: string; action?: React.ReactNode }) {
  return <div className="page-head">
    <div>
      {back && <Link to={back} className="back"><ArrowLeft size={16} /> Volver</Link>}
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
    </div>
    {action}
  </div>;
}
function Stat({ label, value, unit, icon, tone = "accent", children }: { label: string; value: React.ReactNode; unit?: string; icon: React.ReactNode; tone?: "accent" | "blue" | "orange"; children?: React.ReactNode }) {
  return <div className={`stat tone-${tone}`}>
    <div className="stat-top"><span className="stat-icon">{icon}</span><small>{label}</small></div>
    <div className="stat-value">{value}{unit && value !== "—" && <span>{unit}</span>}</div>
    {children}
  </div>;
}

function ConfirmButton({ onConfirm, label = "Borrar", confirmLabel = "¿Seguro?", className = "", iconOnly = false }: { onConfirm: () => void; label?: string; confirmLabel?: string; className?: string; iconOnly?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className={`btn danger ${armed ? "armed" : ""} ${iconOnly && !armed ? "icon-only" : ""} ${className}`} aria-label={label} title={label} onClick={() => armed ? (setArmed(false), onConfirm()) : setArmed(true)}><Trash2 size={15} />{armed ? confirmLabel : iconOnly ? null : label}</button>;
}
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" className="icon-btn sm" aria-label={label} title={label} onClick={onClick}>{children}</button>; }

const AXIS = { stroke: "transparent", tick: { fontSize: 11, fill: "#6b7789" }, tickLine: false, axisLine: false } as const;
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tip"><small>{typeof label === "string" ? shortDate(label) : label}</small>{payload.map((p: any) => <div key={p.dataKey}><i style={{ background: p.color }} />{p.name}<b>{kg(p.value)} kg</b></div>)}</div>;
}
function Gradient({ id, color }: { id: string; color: string }) { return <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>; }
function Sparkline({ data, dataKey }: { data: any[]; dataKey: string }) {
  return <div className="sparkline"><ResponsiveContainer width="100%" height={44}><AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}><Gradient id="spark" color="#b6f36a" /><YAxis hide domain={["dataMin - 1", "dataMax + 1"]} /><Area type="monotone" dataKey={dataKey} stroke="#b6f36a" strokeWidth={2} fill="url(#spark)" dot={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>;
}

// ---------- auth ----------
function AuthBackground() {
  return <div className="auth-bg" aria-hidden="true">
    <div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" />
    <div className="auth-grid" />
    <svg className="auth-line" viewBox="0 0 1200 400" preserveAspectRatio="none"><defs><linearGradient id="authLine" x1="0" x2="1"><stop offset="0%" stopColor="#b6f36a" stopOpacity="0" /><stop offset="40%" stopColor="#b6f36a" /><stop offset="100%" stopColor="#7aa7ff" /></linearGradient></defs><path d="M0 330 C 120 320, 180 290, 260 300 S 400 250, 480 240 S 620 260, 700 200 S 860 170, 940 130 S 1100 90, 1200 40" fill="none" stroke="url(#authLine)" strokeWidth="3" strokeLinecap="round" /></svg>
  </div>;
}
export function Login({ onLogin }: { onLogin?: (user: any) => void }) {
  const navigate = useNavigate(); const [searchParams] = useSearchParams(); const next = searchParams.get("next"); const [error, setError] = useState(""); const googleButton = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"login" | "register">("login"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  const done = (user: any) => void api("/api/auth/me/").then(() => { onLogin?.(user); navigate(next || "/inicio"); }).catch(() => setError("No pudimos mantener la sesión iniciada. Probá de nuevo."));
  const submit = () => void api("/api/auth/dev_login/", { method: "POST", body: JSON.stringify({ email: "demo@dynamo.local" }) }).then(done).catch((e: Error) => setError(e.message));
  const submitForm = (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    const body = mode === "login" ? { email, password } : { email, password, name };
    void api(`/api/auth/${mode === "login" ? "login" : "register"}/`, { method: "POST", body: JSON.stringify(body) }).then(done).catch((err: Error) => setError(err.message)).finally(() => setBusy(false));
  };
  useEffect(() => { if (!GOOGLE_CLIENT_ID || !googleButton.current) return; const render = () => { if (!window.google || !googleButton.current) return; window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (response) => { void api("/api/auth/google/", { method: "POST", body: JSON.stringify({ credential: response.credential }) }).then(done).catch((e: Error) => setError(e.message)); } }); window.google.accounts.id.renderButton(googleButton.current, { theme: "filled_black", size: "large", shape: "pill", width: "320", text: "continue_with" }); }; if (window.google) render(); else { const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.onload = render; script.onerror = () => setError("No se pudo cargar Google Identity Services."); document.head.appendChild(script); } }, [navigate]);
  return <div className="auth-page">
    <AuthBackground />
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="brand"><Logo size={52} /><Wordmark height={40} /></div>
        <h1>Cada serie <span className="accent">cuenta.</span></h1>
        <p>Registrá tus entrenamientos, seguí tus récords y mirá cómo evolucionás semana a semana.</p>
        <div className="float-cards">
          <div className="float-card fc-1"><span className="stat-icon tone-accent"><Trophy size={16} /></span><div><small>Nuevo récord</small><b>Press de banca · 100 kg</b></div></div>
          <div className="float-card fc-2"><span className="stat-icon tone-orange"><Flame size={16} /></span><div><small>Volumen semanal</small><b>+18% vs. anterior</b></div></div>
          <div className="float-card fc-3"><span className="stat-icon tone-blue"><TrendingDown size={16} /></span><div><small>Peso corporal</small><b>−3,4 kg en 30 días</b></div></div>
        </div>
      </section>
      <section className="auth">
        <div className="auth-mobile-brand"><Logo size={72} /><Wordmark height={38} /><p>Entrená con intención. Medí tu progreso.</p></div>
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Ingresar</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear cuenta</button>
          <span className="tab-indicator" style={{ transform: `translateX(${mode === "login" ? 0 : 100}%)` }} />
        </div>
        <form className="form auth-form" onSubmit={submitForm}>
          {mode === "register" && <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te llamás" autoComplete="name" /></label>}
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" autoComplete="email" /></label>
          <label>Contraseña<input type="password" required minLength={mode === "register" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"} autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
          <button className="btn primary wide lg" disabled={busy}>{busy ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>
        </form>
        {GOOGLE_CLIENT_ID ? <><div className="divider"><span>o continuá con</span></div><div ref={googleButton} className="google-button" /></> : null}
        {import.meta.env.DEV && import.meta.env.MODE === "test" && <button className="btn secondary wide" onClick={submit}>Continuar en modo desarrollo</button>}
        {error && <div className="error">{error}</div>}
      </section>
    </div>
  </div>;
}
export function ProtectedRoute({ children }: { children: React.ReactNode }) { const [user, setUser] = useState<unknown>(); useEffect(() => { void api("/api/auth/me/").then(setUser).catch(() => { setToken(null); setUser(null); }); const expire = () => setUser(null); window.addEventListener("dynamo:unauthorized", expire); return () => window.removeEventListener("dynamo:unauthorized", expire); }, []); if (user === undefined) return <Loading label="Cargando Dynamo…" />; return user ? <SetUserContext.Provider value={setUser}><UserContext.Provider value={user}>{children}</UserContext.Provider></SetUserContext.Provider> : <Login onLogin={setUser} />; }

// ---------- layout ----------
const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/ejercicios", label: "Ejercicios", icon: Search },
  { to: "/entrenar", label: "Entrenar", icon: Dumbbell, main: true },
  { to: "/rutinas", label: "Rutinas", icon: ListChecks, desktopOnly: true },
  { to: "/peso", label: "Peso", icon: Scale },
  { to: "/perfil", label: "Perfil", icon: UserRound },
];
function Avatar({ user, size = 34 }: { user: any; size?: number }) {
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  return user?.avatar_url ? <img className="avatar" src={user.avatar_url} alt="" style={{ width: size, height: size }} /> : <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</span>;
}
function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const user = useContext(UserContext);
  const logout = () => void api("/api/auth/logout/", { method: "POST" }).catch(() => undefined).finally(() => { setToken(null); navigate("/ingresar"); });
  return <>
    <header className="topbar">
      <Link to="/inicio" className="brand" aria-label="Dynamo, inicio"><Logo size={34} /><Wordmark height={22} /></Link>
      <nav className="top-nav">{NAV.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end><Icon size={16} />{label}</NavLink>)}</nav>
      <div className="header-actions">
        {user?.is_staff && <NavLink to="/admin" className="icon-btn admin-link" aria-label="Administración" title="Administración"><ShieldCheck size={18} /></NavLink>}
        <Link to="/perfil" aria-label="Mi perfil"><Avatar user={user} /></Link>
        <button className="icon-btn header-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}><LogOut size={18} /></button>
      </div>
    </header>
    <main>{children}</main>
    <nav className="bottom-nav">{NAV.filter((n) => !n.desktopOnly).map(({ to, label, icon: Icon, main }) => <NavLink key={to} to={to} end className={main ? "main" : undefined}><span className="nav-icon"><Icon size={main ? 22 : 20} /></span>{label}</NavLink>)}</nav>
  </>;
}

// ---------- pantallas ----------
function Dashboard() {
  const [data, setData] = useState<any>(); const user = useContext(UserContext);
  useEffect(() => { void api("/api/dashboard/summary/").then(setData); }, []);
  const hour = new Date().getHours(); const greeting = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const firstName = (user?.name || "").split(" ")[0];
  const history = data?.weight_history || [];
  const delta = history.length > 1 ? history[history.length - 1].weight_kg - history[0].weight_kg : null;
  return <>
    <PageHead eyebrow={new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} title={<>{greeting}{firstName && <>, <span className="accent">{firstName}</span></>}</>} action={<Link className="btn primary" to="/entrenar"><Plus size={18} /> Entrenar</Link>} />
    <div className="stats">
      <Stat label="Peso actual" icon={<Scale size={16} />} value={kg(data?.weight_current)} unit="kg">
        {delta !== null && <div className={`delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>{delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta > 0 ? "+" : ""}{kg(delta)} kg en 30 días</div>}
        {history.length > 1 && <Sparkline data={history} dataKey="weight_kg" />}
      </Stat>
      <Stat label="Sesiones · 30 días" icon={<CalendarDays size={16} />} tone="blue" value={data?.workouts_30d ?? "—"}>
        <div className="meter"><i style={{ width: `${Math.min(100, ((data?.workouts_30d || 0) / 12) * 100)}%` }} /></div>
        <div className="hint">Objetivo sugerido: 12 sesiones</div>
      </Stat>
      <Stat label="Volumen · 30 días" icon={<Flame size={16} />} tone="orange" value={data ? kg(Math.round(data.volume_30d)) : "—"} unit="kg">
        <div className="hint">Peso total movido</div>
      </Stat>
    </div>
    {data?.prs && (data.prs.best_weight > 0 || data.prs.best_1rm > 0) && <section className="pr-strip">
      <Trophy size={20} />
      <div><small>Mejor peso</small><b>{kg(data.prs.best_weight)} kg</b></div>
      <div><small>Mejor 1RM estimado</small><b>{kg(data.prs.best_1rm)} kg</b></div>
    </section>}
    <section className="panel">
      <div className="section-head"><h3>Entrenamientos recientes</h3><Link to="/entrenamientos">Ver todos <ChevronRight size={15} /></Link></div>
      {data?.recent_workouts?.length ? <div className="list">{data.recent_workouts.map((w: any) => <Link className="row link-row" to={`/entrenamiento?id=${w.id}`} key={w.id}><span className="row-icon"><Dumbbell size={17} /></span><span className="row-main">{w.name}<small>{longDate(w.date)}</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className="chev" /></Link>)}</div> : <Empty icon={<Dumbbell />} title="Todavía no hay entrenamientos"><Link to="/entrenar" className="btn ghost">Registrar el primero</Link></Empty>}
    </section>
  </>;
}

function Exercises() {
  const [items, setItems] = useState<any[]>([]); const [loaded, setLoaded] = useState(false); const [query, setQuery] = useState(""); const [equipment, setEquipment] = useState(""); const [difficulty, setDifficulty] = useState(""); const [group, setGroup] = useState(""); const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", name_es: "", muscle: "", equipment: "", difficulty: "beginner", image: "", instructions: "" }); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState("");
  const load = () => { const params = new URLSearchParams({ search: query.trim() }); const muscles = GROUPS.find((g) => g.key === group)?.muscles; if (muscles) params.set("muscle", muscles.join(",")); if (equipment) params.set("equipment", equipment); if (difficulty) params.set("difficulty", difficulty); void api(`/api/exercises/?${params}`).then((d) => { setItems(d.results || d); setLoaded(true); }); };
  useEffect(load, []);
  const updateForm = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const saveCustom = () => {
    if (!form.name.trim()) return setFormError("Poné un nombre para el ejercicio.");
    setSaving(true); setFormError("");
    const slug = form.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const instructions = form.instructions.split("\n").map((line) => line.trim()).filter(Boolean);
    const body = { name: form.name.trim(), name_es: (form.name_es || form.name).trim(), slug: slug || `ejercicio-${Date.now()}`, category: "strength", primary_muscles: form.muscle ? [form.muscle] : [], equipment: form.equipment, difficulty: form.difficulty, instructions, instructions_es: instructions, image_1: form.image.trim() };
    void api("/api/exercises/", { method: "POST", body: JSON.stringify(body) }).then((item) => { setItems((old) => [item, ...old]); setForm({ name: "", name_es: "", muscle: "", equipment: "", difficulty: "beginner", image: "", instructions: "" }); setCreating(false); }).catch((e: Error) => setFormError(e.message)).finally(() => setSaving(false));
  };
  return <>
    <PageHead eyebrow="Catálogo" title="Ejercicios" action={<button className="btn primary" onClick={() => { setCreating((old) => !old); setFormError(""); }}><Plus size={17} /> {creating ? "Cerrar" : "Crear ejercicio"}</button>} />
    {creating && <section className="panel custom-exercise-form"><div><small>Ejercicio personalizado</small><h3>Agregá uno que no está en el catálogo</h3><p className="hint">Solo vos vas a poder verlo y usarlo.</p></div><div className="grid two"><label>Nombre<input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Press unilateral en polea" /></label><label>Nombre corto<input value={form.name_es} onChange={(e) => updateForm("name_es", e.target.value)} placeholder="Se muestra en la app" /></label><label>Músculo principal<select value={form.muscle} onChange={(e) => updateForm("muscle", e.target.value)}><option value="">Elegí uno</option>{Object.entries(MUSCLES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><label>Equipamiento<select value={form.equipment} onChange={(e) => updateForm("equipment", e.target.value)}><option value="">Sin equipamiento</option>{Object.entries(EQUIPMENT).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><label>Dificultad<select value={form.difficulty} onChange={(e) => updateForm("difficulty", e.target.value)}><option value="beginner">Principiante</option><option value="intermediate">Intermedio</option><option value="advanced">Avanzado</option></select></label><label>URL de foto<input type="url" value={form.image} onChange={(e) => updateForm("image", e.target.value)} placeholder="Opcional, por ahora" /></label></div><label>Instrucciones<textarea rows={4} value={form.instructions} onChange={(e) => updateForm("instructions", e.target.value)} placeholder="Una indicación por línea" /></label>{formError && <div className="error inline">{formError}</div>}<button className="btn primary" onClick={saveCustom} disabled={saving}><Save size={17} /> {saving ? "Guardando…" : "Guardar ejercicio"}</button></section>}
    <div className="toolbar">
      <div className="search"><Search size={18} /><input aria-label="Buscar ejercicio" placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></div>
      <div className="filters">
        <select aria-label="Grupo muscular" value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Todos los músculos</option>{GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>
        <select aria-label="Equipamiento" value={equipment} onChange={(e) => setEquipment(e.target.value)}><option value="">Todo el equipamiento</option>{Object.entries(EQUIPMENT).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
        <select aria-label="Dificultad" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Toda dificultad</option><option value="beginner">Principiante</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select>
        <button className="btn secondary" onClick={load}><SlidersHorizontal size={16} /> Filtrar</button>
      </div>
    </div>
    <div className="exercise-grid">{items.map((item) => <Link className="exercise" to={`/ejercicio?id=${item.id}`} key={item.id}>
      <div className="exercise-media">{item.image_1 ? <img src={item.image_1} alt="" loading="lazy" /> : <div className="image-placeholder"><Dumbbell /></div>}{item.difficulty && <span className={`badge lvl-${item.difficulty.toLowerCase()}`}>{LEVELS[item.difficulty.toLowerCase()] || item.difficulty}</span>}</div>
      <div className="exercise-body">
        <b>{item.name_es || item.name}</b>
        {item.name_es && item.name_es !== item.name && <small className="original-name">{item.name}</small>}
        <div className="tags">{item.primary_muscles?.slice(0, 2).map((m: string) => <span key={m}>{muscleLabel(m)}</span>)}<span className="muted-tag">{equipmentLabel(item.equipment)}</span>{item.category && item.category !== "strength" && <span className="muted-tag">{label(CATEGORIES, item.category)}</span>}</div>
      </div>
    </Link>)}</div>
    {loaded && !items.length && <Empty icon={<Search />} title="No encontramos ejercicios">Probá con otro nombre o quitá los filtros.</Empty>}
  </>;
}

function useElapsed(since?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!since) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [since]);
  if (!since) return "00:00"; const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; const pad = (n: number) => String(n).padStart(2, "0");
  return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}
const ACTIVE_KEY = "dynamo.activeWorkout";
const toBlocks = (workout: any) => (workout?.exercises || []).map((e: any) => ({ weId: e.id, exerciseId: e.exercise, name: e.exercise_name, sets: e.sets }));
function ExerciseThumb({ src, size = 44 }: { src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? <img className="ex-thumb" src={src} alt="" loading="lazy" style={{ width: size, height: size }} onError={() => setBroken(true)} /> : <span className="ex-thumb empty" style={{ width: size, height: size }}><Dumbbell size={size * 0.4} /></span>;
}
function ExerciseOption({ item, onPick, action = <Plus size={16} /> }: { item: any; onPick: () => void; action?: React.ReactNode }) {
  return <button type="button" className="picker-option" onClick={onPick}>
    <ExerciseThumb src={item.image_1 || item.image} />
    <span>{exerciseName(item)}<small>{[item.primary_muscles?.map(muscleLabel).join(", "), item.equipment ? equipmentLabel(item.equipment) : ""].filter(Boolean).join(" · ")}</small></span>
    {action}
  </button>;
}
// Buscador de ejercicios con grupos musculares, habituales, recientes y resultados con foto.
function ExercisePicker({ onPick, suggestions, excludeIds = [] }: { onPick: (item: any) => void; suggestions: any; excludeIds?: string[] }) {
  const [group, setGroup] = useState(""); const [query, setQuery] = useState(""); const [options, setOptions] = useState<any[]>([]);
  const groupMuscles = GROUPS.find((g) => g.key === group)?.muscles; const groupLabel = GROUPS.find((g) => g.key === group)?.label.toLowerCase();
  useEffect(() => {
    if (!groupMuscles && query.trim().length < 2) { setOptions([]); return; }
    const params = new URLSearchParams({ search: query.trim(), exclude_category: "stretching,cardio" }); if (groupMuscles) params.set("muscle", groupMuscles.join(","));
    const t = setTimeout(() => void api(`/api/exercises/?${params}`).then((d) => setOptions((d.results || d).slice(0, 12))), 250); return () => clearTimeout(t);
  }, [group, query]);
  const lastByGroup = GROUPS.map((g) => { const dates = g.muscles.map((m) => suggestions.muscles_last_trained?.[m]).filter(Boolean).sort(); return { ...g, days: daysSince(dates[dates.length - 1]) }; });
  // "Te toca": el grupo que ya entrenás y hace más tiempo que no trabajás.
  const trained = lastByGroup.filter((g) => g.days !== null && g.days >= 2);
  const due = trained.length ? trained.reduce((a, b) => b.days! > a.days! ? b : a).key : "";
  const inGroup = (e: any) => !groupMuscles || e.primary_muscles?.some((m: string) => groupMuscles.includes(m));
  const frequent = (suggestions.frequent || []).filter(inGroup).filter((e: any) => !excludeIds.includes(e.id));
  const frequentIds = frequent.map((e: any) => e.id);
  const recent = (suggestions.recent || []).filter(inGroup).filter((e: any) => !excludeIds.includes(e.id) && !frequentIds.includes(e.id));
  const pick = (item: any) => { onPick(item); setQuery(""); };
  return <div className="picker">
    <div>
      <h3 className="block-title">¿Qué entrenás hoy?</h3>
      <div className="chip-row">{lastByGroup.map((g) => <button type="button" key={g.key} className={`group-chip ${group === g.key ? "active" : ""}`} onClick={() => setGroup(group === g.key ? "" : g.key)}>
        <span>{g.label}{g.key === due && <em>Te toca</em>}</span><small>{agoLabel(g.days)}</small>
      </button>)}</div>
    </div>
    {frequent.length > 0 && <div><h3 className="block-title"><History size={15} /> Tus habituales</h3><div className="chip-row">{frequent.map((e: any) => <button type="button" key={e.id} className="pick-chip" onClick={() => pick(e)}><ExerciseThumb src={e.image_1} size={26} />{exerciseName(e)}<small>{e.times}×</small></button>)}</div></div>}
    {recent.length > 0 && <div><h3 className="block-title"><Timer size={15} /> Lo último que hiciste</h3><div className="chip-row">{recent.map((e: any) => <button type="button" key={e.id} className="pick-chip" onClick={() => pick(e)}><ExerciseThumb src={e.image_1} size={26} />{exerciseName(e)}</button>)}</div></div>}
    <div className="input-icon"><Search size={16} /><input aria-label="Buscar ejercicio" type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={group ? `Buscar en ${groupLabel}…` : "Buscar ejercicio"} /></div>
    {options.length > 0 && <div className="picker-results">{group && !query && <div className="picker-head"><Sparkles size={13} /> Sugeridos para {groupLabel}</div>}{options.map((item) => <ExerciseOption key={item.id} item={item} onPick={() => pick(item)} />)}</div>}
  </div>;
}
function useSuggestions() {
  const [suggestions, setSuggestions] = useState<any>({ frequent: [], recent: [], muscles_last_trained: {} });
  useEffect(() => { void api("/api/exercises/suggestions/").then(setSuggestions).catch(() => undefined); }, []);
  return suggestions;
}
const targetLabel = (item: any) => [item.target_sets ? `${item.target_sets} series` : "", item.target_reps ? `${item.target_reps} reps` : ""].filter(Boolean).join(" × ");

function WorkoutRecorder() {
  const navState = (useLocation().state as any) || {}; const presetExercise = navState.exercise; const presetRoutine = navState.routine;
  const [workout, setWorkout] = useState<any>(() => JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null"));
  const [blocks, setBlocks] = useState<any[]>([]); const [current, setCurrent] = useState<any>(presetExercise || null);
  const [routines, setRoutines] = useState<any[]>([]); const [picking, setPicking] = useState(false);
  const suggestions = useSuggestions();
  const [weight, setWeight] = useState(""); const [reps, setReps] = useState(""); const [error, setError] = useState(""); const [added, setAdded] = useState("");
  const elapsed = useElapsed(workout?.started_at);
  const routine = workout?.routine;
  const clearActive = () => { localStorage.removeItem(ACTIVE_KEY); setWorkout(null); setBlocks([]); setCurrent(null); };
  useEffect(() => { if (!workout) void api("/api/routines/").then((d) => setRoutines(d.results || d)).catch(() => undefined); }, [workout?.id]);
  useEffect(() => { if (workout) void api(`/api/workouts/${workout.id}/`).then((d) => setBlocks(toBlocks(d))).catch((e: Error) => { if (/no encontrado|not found/i.test(e.message)) clearActive(); }); }, [workout?.id]);
  // Con rutina: arranca en el primer ejercicio que todavía no tiene series
  useEffect(() => { if (routine && !current && blocks) { const next = routine.items.find((it: any) => !blocks.some((b) => b.exerciseId === it.exercise)); if (next) setCurrent({ id: next.exercise, name: next.exercise_name }); } }, [routine?.id, blocks.length]);
  const pick = (item: any) => { setCurrent({ id: item.id, name: exerciseName(item) }); setPicking(false); setError(""); };
  const start = (withRoutine?: any) => void api("/api/workouts/", { method: "POST", body: JSON.stringify({ name: withRoutine?.name || "Entrenamiento", started_at: new Date().toISOString() }) }).then((d) => {
    const active = { ...d, routine: withRoutine ? { id: withRoutine.id, name: withRoutine.name, items: withRoutine.items } : null };
    setWorkout(active); localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    if (withRoutine?.items?.length && !presetExercise) setCurrent({ id: withRoutine.items[0].exercise, name: withRoutine.items[0].exercise_name });
  });
  const add = async () => {
    if (!current) return setError("Elegí un ejercicio primero.");
    if (!(Number(reps) > 0) || weight === "" || Number(weight) < 0) return setError("Completá peso y repeticiones.");
    setError("");
    try {
      let block = blocks.find((b) => b.exerciseId === current.id);
      if (!block) { const we = await api(`/api/workouts/${workout.id}/exercises/`, { method: "POST", body: JSON.stringify({ exercise: current.id }) }); block = { weId: we.id, exerciseId: current.id, name: current.name, sets: [] }; }
      const set = await api(`/api/workout-exercises/${block.weId}/sets/`, { method: "POST", body: JSON.stringify({ reps: Number(reps), weight_kg: Number(weight), set_number: block.sets.length + 1, completed: true }) });
      const updated = { ...block, sets: [...block.sets, set] };
      setBlocks((old) => old.some((b) => b.weId === updated.weId) ? old.map((b) => b.weId === updated.weId ? updated : b) : [...old, updated]);
      setAdded(`Serie ${updated.sets.length} guardada`); setTimeout(() => setAdded(""), 2500);
    } catch (e) { setError((e as Error).message); }
  };
  const removeSet = async (block: any, setId: string) => {
    await api(`/api/workout-sets/${setId}/`, { method: "DELETE" });
    const rest = block.sets.filter((s: any) => s.id !== setId);
    if (!rest.length) await api(`/api/workout-exercises/${block.weId}/`, { method: "DELETE" });
    setBlocks((old) => rest.length ? old.map((b) => b.weId === block.weId ? { ...b, sets: rest } : b) : old.filter((b) => b.weId !== block.weId));
  };
  const finish = () => void api(`/api/workouts/${workout.id}/finish/`, { method: "POST" }).then(clearActive);
  const discard = () => void api(`/api/workouts/${workout.id}/`, { method: "DELETE" }).then(clearActive);
  const allSets = blocks.flatMap((b) => b.sets); const volume = allSets.reduce((sum, s) => sum + Number(s.weight_kg) * Number(s.reps), 0);
  const setsOf = (exerciseId: string) => blocks.find((b) => b.exerciseId === exerciseId)?.sets.length || 0;

  if (!workout) {
    const featured = presetRoutine ? [presetRoutine, ...routines.filter((r) => r.id !== presetRoutine.id)] : routines;
    return <>
      <PageHead eyebrow="Nueva sesión" title="Entrenar" />
      <div className="start-grid">
        <section className="panel start-card">
          <div className="start-icon"><Dumbbell size={30} /></div>
          <h3>Entrenamiento libre</h3>
          <p>{presetExercise ? <>Arrancás con <b>{presetExercise.name}</b>. </> : null}Elegí los ejercicios sobre la marcha. El cronómetro arranca solo.</p>
          <button className="btn primary wide lg" onClick={() => start()}>Empezar</button>
        </section>
        <section className="panel">
          <div className="section-head"><h3>Tus rutinas</h3><Link to="/rutinas">Gestionar <ChevronRight size={15} /></Link></div>
          {featured.length ? <div className="list">{featured.map((r) => <div className={`row routine-row ${presetRoutine?.id === r.id ? "highlight" : ""}`} key={r.id}>
            <div className="thumb-stack">{r.items.slice(0, 3).map((it: any) => <ExerciseThumb key={it.id} src={it.image} size={34} />)}</div>
            <span className="row-main">{r.name}<small>{r.items.length} {r.items.length === 1 ? "ejercicio" : "ejercicios"}</small></span>
            <button className="btn primary" onClick={() => start(r)} disabled={!r.items.length}>Empezar</button>
          </div>)}</div> : <Empty icon={<ListChecks />} title="Todavía no tenés rutinas">Armá tus rutinas y entrená siguiendo tus ejercicios, sin buscarlos cada vez.<Link to="/rutina?id=nueva" className="btn ghost"><Plus size={16} /> Crear rutina</Link></Empty>}
        </section>
      </div>
    </>;
  }
  return <>
    <PageHead eyebrow={<><span className="live-dot" /> En curso{routine ? ` · ${routine.name}` : ""}</>} title="Entrenamiento" action={<ConfirmButton label="Descartar" confirmLabel="¿Descartar todo?" onConfirm={discard} />} />
    <div className="session-bar">
      <div><Timer size={16} /><b>{elapsed}</b><small>Duración</small></div>
      <div><Activity size={16} /><b>{allSets.length}</b><small>Series</small></div>
      <div><Flame size={16} /><b>{kg(volume)}</b><small>kg volumen</small></div>
    </div>
    <div className="recorder">
      <section className="panel form">
        {routine && !picking && <div className="routine-steps">
          <h3 className="block-title"><ListChecks size={15} /> {routine.name}</h3>
          {routine.items.map((it: any, i: number) => { const done = setsOf(it.exercise); const target = it.target_sets || 0; return <button type="button" key={it.id} className={`routine-step ${current?.id === it.exercise ? "active" : ""} ${target && done >= target ? "done" : ""}`} onClick={() => { setCurrent({ id: it.exercise, name: it.exercise_name }); setError(""); }}>
            <span className="step-num">{target && done >= target ? <Check size={14} /> : i + 1}</span>
            <ExerciseThumb src={it.image} size={38} />
            <span className="step-main">{it.exercise_name}<small>{targetLabel(it) || "Sin objetivo"}</small></span>
            <span className="step-count">{done}{target ? `/${target}` : ""}</span>
          </button>; })}
        </div>}
        {current && !picking ? <div className="current-exercise"><span className="row-icon"><Dumbbell size={17} /></span><div><small>Ejercicio</small><b>{current.name}</b></div><button type="button" className="btn secondary" onClick={() => setPicking(true)}>{routine ? "Otro" : "Cambiar"}</button></div>
          : <>{picking && <button type="button" className="link-btn back-link" onClick={() => setPicking(false)}><ArrowLeft size={14} /> Volver{routine ? " a la rutina" : ""}</button>}<ExercisePicker suggestions={suggestions} onPick={pick} /></>}
        <div className="grid two">
          <label>Peso<div className="input-suffix"><input inputMode="decimal" enterKeyHint="next" value={weight} onChange={(e) => setWeight(e.target.value.replace(",", "."))} placeholder="0" /><span>kg</span></div></label>
          <label>Repeticiones<div className="input-suffix"><input inputMode="numeric" enterKeyHint="done" value={reps} onChange={(e) => setReps(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} placeholder="0" /><span>reps</span></div></label>
        </div>
        {current && setsOf(current.id) > 0 && <div className="done-sets"><small>Hoy</small>{blocks.find((b) => b.exerciseId === current.id).sets.map((s: any, i: number) => <span key={s.id}><b>{i + 1}</b>{kg(s.weight_kg)}×{s.reps}</span>)}</div>}
        {error && <div className="error inline">{error}</div>}
        <button className="btn primary wide lg" onClick={() => void add()} disabled={!current}>{added ? <><Check size={18} /> {added}</> : <><Plus size={18} /> Agregar serie</>}</button>
      </section>
      <section className="panel">
        <div className="section-head"><h3>Series de hoy</h3><span className="pill">{allSets.length}</span></div>
        {blocks.length ? <div className="stack tight">{blocks.map((b) => <div className="set-block" key={b.weId}>
          <button type="button" className="set-block-head" onClick={() => { setCurrent({ id: b.exerciseId, name: b.name }); setPicking(false); }}>{b.name}<small>{b.sets.length} {b.sets.length === 1 ? "serie" : "series"}</small></button>
          {b.sets.map((s: any, i: number) => <div className="set-line" key={s.id}><span className="set-num">{i + 1}</span><span>{kg(s.weight_kg)} <small>kg</small></span><span>{s.reps} <small>reps</small></span><ConfirmButton iconOnly label="Borrar serie" confirmLabel="Borrar" onConfirm={() => void removeSet(b, s.id)} /></div>)}
        </div>)}</div> : <Empty icon={<Activity />} title="Sin series todavía">Elegí un ejercicio y cargá tu primera serie.</Empty>}
        <button className="btn secondary wide" onClick={finish}><Check size={17} /> Finalizar entrenamiento</button>
      </section>
    </div>
  </>;
}

function Routines() {
  const navigate = useNavigate(); const [rows, setRows] = useState<any[]>([]); const [loaded, setLoaded] = useState(false); const [shareUrl, setShareUrl] = useState(""); const [shareName, setShareName] = useState(""); const [shareBusy, setShareBusy] = useState(false); const [copied, setCopied] = useState(false); const [shareError, setShareError] = useState("");
  useEffect(() => { void api("/api/routines/").then((d) => { setRows(d.results || d); setLoaded(true); }); }, []);
  const share = async (routine: any) => {
    setShareBusy(true); setCopied(false); setShareError("");
    try { const data = await api(`/api/routines/${routine.id}/share/`, { method: "POST" }); setShareUrl(`${window.location.origin}/rutina-compartida/${data.token}`); setShareName(routine.name); }
    catch (e) { setShareError(e instanceof Error ? e.message : "No se pudo generar el enlace."); }
    finally { setShareBusy(false); }
  };
  const copy = async () => { if (!navigator.clipboard) return; await navigator.clipboard.writeText(shareUrl); setCopied(true); };
  return <>
    <PageHead eyebrow="Entrenar" title="Rutinas" action={<Link className="btn primary" to="/rutina?id=nueva"><Plus size={18} /> Nueva</Link>} />
    {(shareUrl || shareError) && <section className="panel share-box">{shareError ? <div className="error inline">{shareError}</div> : <><div><small>Compartir rutina</small><h3>{shareName}</h3><p className="hint">Cualquiera con este enlace puede verla y guardarla en su cuenta.</p></div><input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} /><div className="share-actions"><button className="btn secondary" onClick={copy}><Copy size={16} /> {copied ? "Copiado" : "Copiar enlace"}</button><a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(`Te comparto mi rutina de Dynamo: ${shareUrl}`)}`} target="_blank" rel="noreferrer"><Share2 size={16} /> WhatsApp</a></div></>}</section>}
    {rows.length ? <div className="routine-grid">{rows.map((r) => <section className="panel routine-card" key={r.id}>
      <div className="section-head"><h3>{r.name}</h3><span className="pill">{r.items.length}</span></div>
      <div className="routine-preview">{r.items.slice(0, 5).map((it: any) => <span key={it.id}><ExerciseThumb src={it.image} size={30} />{it.exercise_name}</span>)}{r.items.length > 5 && <small>+{r.items.length - 5} más</small>}</div>
      <div className="routine-actions"><Link className="btn secondary" to={`/rutina?id=${r.id}`}><Pencil size={15} /> Editar</Link><button className="btn secondary" disabled={!r.items.length || shareBusy} onClick={() => void share(r)}><Share2 size={15} /> Compartir</button><button className="btn primary" disabled={!r.items.length} onClick={() => navigate("/entrenar", { state: { routine: r } })}><Dumbbell size={16} /> Empezar</button></div>
    </section>)}</div> : loaded && <section className="panel"><Empty icon={<ListChecks />} title="Todavía no tenés rutinas">Por ejemplo "Pecho y tríceps" o "Piernas". Después entrenás siguiendo esa lista.<Link to="/rutina?id=nueva" className="btn ghost"><Plus size={16} /> Crear mi primera rutina</Link></Empty></section>}
  </>;
}
function RoutineEditor() {
  const id = useIdParam(); const isNew = !id || id === "nueva"; const navigate = useNavigate(); const suggestions = useSuggestions();
  const [name, setName] = useState(""); const [items, setItems] = useState<any[]>([]); const [loaded, setLoaded] = useState(isNew); const [adding, setAdding] = useState(isNew); const [error, setError] = useState("");
  useEffect(() => { if (!isNew) void api(`/api/routines/${id}/`).then((r) => { setName(r.name); setItems(r.items); setLoaded(true); }); }, [id]);
  if (!loaded) return <Loading />;
  const addItem = (ex: any) => { if (items.some((it) => it.exercise === ex.id)) return; setItems((old) => [...old, { key: ex.id, exercise: ex.id, exercise_name: exerciseName(ex), image: ex.image_1, primary_muscles: ex.primary_muscles, target_sets: 3, target_reps: "10" }]); };
  const update = (i: number, patch: any) => setItems((old) => old.map((it, j) => j === i ? { ...it, ...patch } : it));
  const move = (i: number, dir: number) => setItems((old) => { const next = old.slice(); const [it] = next.splice(i, 1); next.splice(i + dir, 0, it); return next; });
  const save = () => {
    if (!name.trim()) return setError("Ponele un nombre a la rutina.");
    if (!items.length) return setError("Agregá al menos un ejercicio.");
    const body = JSON.stringify({ name: name.trim(), items: items.map((it) => ({ exercise: it.exercise, target_sets: it.target_sets ? Number(it.target_sets) : null, target_reps: String(it.target_reps || "") })) });
    void api(isNew ? "/api/routines/" : `/api/routines/${id}/`, { method: isNew ? "POST" : "PUT", body }).then(() => navigate("/rutinas")).catch((e: Error) => setError(e.message));
  };
  const remove = () => void api(`/api/routines/${id}/`, { method: "DELETE" }).then(() => navigate("/rutinas"));
  return <>
    <PageHead back="/rutinas" eyebrow={isNew ? "Nueva rutina" : "Editar rutina"} title={name || "Sin nombre"} action={!isNew ? <ConfirmButton label="Borrar" confirmLabel="¿Borrar rutina?" onConfirm={remove} /> : undefined} />
    <div className="recorder">
      <section className="panel form">
        <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pecho y tríceps" /></label>
        <div className="section-head"><h3>Ejercicios</h3><span className="pill">{items.length}</span></div>
        {items.length ? <div className="routine-items">{items.map((it, i) => <div className="routine-item" key={it.key || it.id || it.exercise}>
          <ExerciseThumb src={it.image} size={40} />
          <div className="routine-item-main"><b>{it.exercise_name}</b>
            <div className="targets"><input inputMode="numeric" aria-label="Series" value={it.target_sets ?? ""} onChange={(e) => update(i, { target_sets: e.target.value })} /><span>×</span><input aria-label="Repeticiones" value={it.target_reps ?? ""} onChange={(e) => update(i, { target_reps: e.target.value })} placeholder="8-10" /><span>reps</span></div>
          </div>
          <div className="line-actions vertical"><IconButton label="Subir" onClick={() => i > 0 && move(i, -1)}><ChevronUp size={15} /></IconButton><IconButton label="Bajar" onClick={() => i < items.length - 1 && move(i, 1)}><ChevronDown size={15} /></IconButton></div>
          <button type="button" className="remove-item" aria-label="Quitar" title="Quitar" onClick={() => setItems((old) => old.filter((_, j) => j !== i))}><X size={14} /></button>
        </div>)}</div> : <p className="hint">Todavía no agregaste ejercicios.</p>}
        {error && <div className="error inline">{error}</div>}
        <button className="btn primary wide lg" onClick={save}><Save size={18} /> Guardar rutina</button>
      </section>
      <section className="panel form">
        {adding ? <><h3>Agregar ejercicios</h3><ExercisePicker suggestions={suggestions} onPick={addItem} excludeIds={items.map((it) => it.exercise)} /></> : <button className="btn secondary wide" onClick={() => setAdding(true)}><Plus size={17} /> Agregar ejercicios</button>}
      </section>
    </div>
  </>;
}

function Workouts() {
  const [rows, setRows] = useState<any[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => { void api("/api/workouts/").then((d) => { setRows(d.results || d); setLoaded(true); }); }, []);
  return <>
    <PageHead eyebrow="Historial" title="Tus entrenamientos" action={<Link className="btn primary" to="/entrenar" aria-label="Nuevo entrenamiento"><Plus size={18} /> Nuevo</Link>} />
    <section className="panel">{rows.length ? <div className="list">{rows.map((w) => { const d = new Date(w.started_at); return <Link className="row link-row" to={`/entrenamiento?id=${w.id}`} key={w.id}><span className="date-tile"><b>{d.getDate()}</b><small>{d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}</small></span><span className="row-main">{w.name}<small>{d.toLocaleDateString("es-AR", { weekday: "long" })} · {d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className="chev" /></Link>; })}</div> : loaded && <Empty icon={<CalendarDays />} title="Aún no registraste entrenamientos"><Link to="/entrenar" className="btn ghost">Empezar ahora</Link></Empty>}</section>
  </>;
}

function EditableSet({ set, index, onSaved, onDelete }: { set: any; index: number; onSaved: (s: any) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false); const [weight, setWeight] = useState(String(set.weight_kg)); const [reps, setReps] = useState(String(set.reps));
  const save = () => void api(`/api/workout-sets/${set.id}/`, { method: "PATCH", body: JSON.stringify({ weight_kg: Number(weight), reps: Number(reps) }) }).then((s) => { onSaved(s); setEditing(false); });
  if (editing) return <div className="set-line editing"><span className="set-num">{index + 1}</span><input inputMode="decimal" aria-label="Peso" value={weight} onChange={(e) => setWeight(e.target.value.replace(",", "."))} /><input inputMode="numeric" aria-label="Repeticiones" value={reps} onChange={(e) => setReps(e.target.value)} /><div className="line-actions"><IconButton label="Guardar" onClick={save}><Check size={15} /></IconButton><IconButton label="Cancelar" onClick={() => setEditing(false)}><X size={15} /></IconButton></div></div>;
  return <div className="set-line"><span className="set-num">{index + 1}</span><span>{kg(set.weight_kg)} <small>kg</small></span><span>{set.reps} <small>reps</small></span><div className="line-actions"><IconButton label="Editar serie" onClick={() => setEditing(true)}><Pencil size={14} /></IconButton><ConfirmButton iconOnly label="Borrar serie" confirmLabel="Borrar" onConfirm={onDelete} /></div></div>;
}
function WorkoutDetail() {
  const id = useIdParam(); const navigate = useNavigate(); const [data, setData] = useState<any>(); const [renaming, setRenaming] = useState(false); const [name, setName] = useState("");
  useEffect(() => { void api(`/api/workouts/${id}/`).then((d) => { setData(d); setName(d.name); }); }, [id]);
  if (!data) return <Loading />;
  const allSets = data.exercises.flatMap((e: any) => e.sets); const volume = allSets.reduce((sum: number, s: any) => sum + Number(s.weight_kg) * Number(s.reps), 0);
  const updateExercise = (exId: string, fn: (e: any) => any) => setData((d: any) => ({ ...d, exercises: d.exercises.map((e: any) => e.id === exId ? fn(e) : e) }));
  const rename = () => void api(`/api/workouts/${id}/`, { method: "PATCH", body: JSON.stringify({ name }) }).then((d) => { setData((old: any) => ({ ...old, name: d.name })); setRenaming(false); });
  const remove = () => void api(`/api/workouts/${id}/`, { method: "DELETE" }).then(() => { if (JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null")?.id === id) localStorage.removeItem(ACTIVE_KEY); navigate("/entrenamientos"); });
  const removeExercise = (exId: string) => void api(`/api/workout-exercises/${exId}/`, { method: "DELETE" }).then(() => setData((d: any) => ({ ...d, exercises: d.exercises.filter((e: any) => e.id !== exId) })));
  const removeSet = (exId: string, setId: string) => void api(`/api/workout-sets/${setId}/`, { method: "DELETE" }).then(() => updateExercise(exId, (e) => ({ ...e, sets: e.sets.filter((s: any) => s.id !== setId) })));
  const title = renaming ? <span className="rename"><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename()} autoFocus /><IconButton label="Guardar nombre" onClick={rename}><Check size={16} /></IconButton><IconButton label="Cancelar" onClick={() => { setName(data.name); setRenaming(false); }}><X size={16} /></IconButton></span> : <span className="title-edit">{data.name}<IconButton label="Renombrar" onClick={() => setRenaming(true)}><Pencil size={15} /></IconButton></span>;
  return <>
    <PageHead back="/entrenamientos" eyebrow={data.started_at ? new Date(data.started_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) : undefined} title={title} action={<ConfirmButton label="Borrar" confirmLabel="¿Borrar entrenamiento?" onConfirm={remove} />} />
    <div className="session-bar">
      <div><Dumbbell size={16} /><b>{data.exercises.length}</b><small>Ejercicios</small></div>
      <div><Activity size={16} /><b>{allSets.length}</b><small>Series</small></div>
      <div><Flame size={16} /><b>{kg(Math.round(volume))}</b><small>kg volumen</small></div>
    </div>
    {data.exercises.length ? <div className="stack">{data.exercises.map((e: any) => <section className="panel" key={e.id}>
      <div className="section-head"><h3>{e.exercise_name}</h3><div className="line-actions"><span className="pill">{e.sets.length} {e.sets.length === 1 ? "serie" : "series"}</span><ConfirmButton iconOnly label="Quitar ejercicio" confirmLabel="Quitar" onConfirm={() => removeExercise(e.id)} /></div></div>
      <div className="set-table">{e.sets.map((s: any, i: number) => <EditableSet key={s.id} set={s} index={i} onSaved={(saved) => updateExercise(e.id, (ex) => ({ ...ex, sets: ex.sets.map((x: any) => x.id === saved.id ? saved : x) }))} onDelete={() => removeSet(e.id, s.id)} />)}</div>
    </section>)}</div> : <section className="panel"><Empty icon={<Dumbbell />} title="Este entrenamiento quedó vacío">Podés borrarlo desde el botón de arriba.</Empty></section>}
  </>;
}

function Photo({ id, version, className, onClick }: { id: string; version: number; className?: string; onClick?: () => void }) {
  const url = usePhoto(id, version);
  return url ? <img src={url} alt="Foto de progreso" className={className} onClick={onClick} /> : <span className={`${className} photo-loading`} />;
}
function WeightRow({ row, prev, version, onChanged, onDeleted, onOpenPhoto, onUpload }: { row: any; prev?: any; version: number; onChanged: () => void; onDeleted: () => void; onOpenPhoto: () => void; onUpload: (file: File) => void }) {
  const [editing, setEditing] = useState(false); const [weight, setWeight] = useState(String(row.weight_kg)); const [date, setDate] = useState(row.date); const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const diff = prev ? Number(row.weight_kg) - Number(prev.weight_kg) : 0;
  const save = () => void api(`/api/body-weight/${row.id}/`, { method: "PATCH", body: JSON.stringify({ weight_kg: Number(weight), date }) }).then(() => { onChanged(); setEditing(false); setError(""); }).catch(() => setError("Ya hay un registro en esa fecha."));
  if (editing) return <div className="row weight-row editing">
    <input type="date" aria-label="Fecha" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
    <div className="input-suffix"><input inputMode="decimal" aria-label="Peso" value={weight} onChange={(e) => setWeight(e.target.value.replace(",", "."))} /><span>kg</span></div>
    <div className="line-actions"><IconButton label="Guardar" onClick={save}><Check size={15} /></IconButton><IconButton label="Cancelar" onClick={() => setEditing(false)}><X size={15} /></IconButton></div>
    {error && <div className="error inline full">{error}</div>}
  </div>;
  return <div className="row weight-row">
    {row.has_photo ? <Photo id={row.id} version={version} className="thumb" onClick={onOpenPhoto} /> : <button type="button" className="thumb add-photo" aria-label="Agregar foto" title="Agregar foto de progreso" onClick={() => fileInput.current?.click()}><Camera size={16} /></button>}
    <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
    <span className="row-main">{longDate(row.date)}</span>
    {prev && diff !== 0 && <span className={`chip ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? "+" : ""}{kg(diff)}</span>}
    <strong>{kg(row.weight_kg)} <span>kg</span></strong>
    <div className="line-actions"><IconButton label="Editar registro" onClick={() => setEditing(true)}><Pencil size={14} /></IconButton><ConfirmButton iconOnly label="Borrar registro" confirmLabel="Borrar" onConfirm={() => void api(`/api/body-weight/${row.id}/`, { method: "DELETE" }).then(onDeleted)} /></div>
  </div>;
}
function BodyWeight() {
  const [rows, setRows] = useState<any[]>([]); const [value, setValue] = useState(""); const [date, setDate] = useState(todayISO()); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Record<string, number>>({}); const [viewer, setViewer] = useState<any>(null);
  const load = () => void api("/api/body-weight/").then((d) => setRows((d.results || d).slice().sort((a: any, b: any) => a.date.localeCompare(b.date)))); useEffect(load, []);
  const save = () => {
    if (!(Number(value) > 0)) return setError("Ingresá un peso válido.");
    const existing = rows.find((r) => r.date === date);
    const request = existing ? api(`/api/body-weight/${existing.id}/`, { method: "PATCH", body: JSON.stringify({ weight_kg: Number(value) }) }) : api("/api/body-weight/", { method: "POST", body: JSON.stringify({ date, weight_kg: Number(value) }) });
    void request.then(() => { setValue(""); setError(""); load(); }).catch((e: Error) => setError(e.message));
  };
  const upload = async (row: any, file: File) => {
    setBusy(true); setError("");
    try { await api(`/api/body-weight/${row.id}/photo/`, { method: "PUT", body: await compressImage(file) }); setVersions((v) => ({ ...v, [row.id]: (v[row.id] || 0) + 1 })); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const removePhoto = (row: any) => void api(`/api/body-weight/${row.id}/photo/`, { method: "DELETE" }).then(() => { setViewer(null); load(); });
  const latest = rows[rows.length - 1]; const first = rows[0]; const change = latest && first && rows.length > 1 ? Number(latest.weight_kg) - Number(first.weight_kg) : null;
  const withPhotos = rows.filter((r) => r.has_photo).reverse();
  const newestFirst = rows.slice().reverse();
  return <>
    <PageHead eyebrow="Seguimiento" title="Peso corporal" />
    <div className="weight-top">
      <section className="panel weight-hero">
        <small>Último registro</small>
        <div className="big-number">{latest ? kg(latest.weight_kg) : "—"}<span>kg</span></div>
        {change !== null && <div className={`delta ${change > 0 ? "up" : change < 0 ? "down" : ""}`}>{change > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{change > 0 ? "+" : ""}{kg(change)} kg desde {shortDate(first.date)}</div>}
      </section>
      <section className="panel form weight-form">
        <div className="grid two">
          <label>Peso<div className="input-suffix"><input inputMode="decimal" aria-label="Peso en kg" placeholder="Ej: 78,5" value={value} onChange={(e) => setValue(e.target.value.replace(",", "."))} onKeyDown={(e) => e.key === "Enter" && value && save()} /><span>kg</span></div></label>
          <label>Fecha<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <button className="btn primary wide" onClick={save}><Plus size={17} /> {rows.some((r) => r.date === date) ? "Actualizar peso" : "Registrar peso"}</button>
        {error && <div className="error inline">{error}</div>}
      </section>
    </div>
    {withPhotos.length > 0 && <section className="panel chart-panel"><div className="section-head"><h3>Fotos de progreso</h3><span className="pill">{withPhotos.length}</span></div><div className="photo-strip">{withPhotos.map((r) => <button type="button" key={r.id} className="photo-card" onClick={() => setViewer(r)}><Photo id={r.id} version={versions[r.id] || 0} className="photo-img" /><span><b>{kg(r.weight_kg)} kg</b><small>{shortDate(r.date)}</small></span></button>)}</div></section>}
    {rows.length > 1 && <section className="panel chart-panel"><div className="section-head"><h3>Evolución</h3></div><ResponsiveContainer width="100%" height={240}><AreaChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}><Gradient id="weight" color="#b6f36a" /><CartesianGrid stroke="#1c2430" vertical={false} /><XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={24} /><YAxis {...AXIS} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} tickFormatter={(v) => nf.format(v)} /><Tooltip content={<ChartTip />} cursor={{ stroke: "#2b3646" }} /><Area type="monotone" dataKey="weight_kg" name="Peso" stroke="#b6f36a" strokeWidth={2.5} fill="url(#weight)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} /></AreaChart></ResponsiveContainer></section>}
    {rows.length > 0 && <section className="panel"><div className="section-head"><h3>Registros</h3>{busy ? <span className="pill">Subiendo foto…</span> : <span className="pill">{rows.length}</span>}</div><p className="hint">Tocá la cámara para sumar una foto de progreso a cada registro.</p><div className="list">{newestFirst.map((r, i) => <WeightRow key={`${r.id}-${r.date}-${r.weight_kg}`} row={r} prev={newestFirst[i + 1]} version={versions[r.id] || 0} onChanged={load} onDeleted={load} onOpenPhoto={() => setViewer(r)} onUpload={(f) => void upload(r, f)} />)}</div></section>}
    {!rows.length && <section className="panel"><Empty icon={<Scale />} title="Sin registros de peso">Cargá tu peso de hoy para empezar a ver la evolución.</Empty></section>}
    {viewer && <div className="lightbox" onClick={() => setViewer(null)}><div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
      <Photo id={viewer.id} version={versions[viewer.id] || 0} className="lightbox-img" />
      <div className="lightbox-bar"><div><b>{kg(viewer.weight_kg)} kg</b><small>{longDate(viewer.date)}</small></div><div className="line-actions"><ConfirmButton label="Quitar foto" confirmLabel="¿Quitar foto?" onConfirm={() => removePhoto(viewer)} /><IconButton label="Cerrar" onClick={() => setViewer(null)}><X size={16} /></IconButton></div></div>
    </div></div>}
  </>;
}

function ExerciseImages({ images, name }: { images: string[]; name: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => { if (images.length < 2) return; const t = setInterval(() => setFrame((f) => (f + 1) % images.length), 1100); return () => clearInterval(t); }, [images.length]);
  if (!images.length) return <div className="exercise-hero placeholder"><Dumbbell size={40} /></div>;
  return <div className="exercise-hero">{images.map((src, i) => <img key={src} src={src} alt={i === 0 ? name : ""} className={i === frame ? "on" : ""} />)}{images.length > 1 && <span className="hero-hint"><Activity size={13} /> Inicio y final del movimiento</span>}</div>;
}
function Progress() {
  const id = useIdParam(); const navigate = useNavigate(); const [data, setData] = useState<any>(); const [info, setInfo] = useState<any>(); const [showEnglish, setShowEnglish] = useState(false);
  useEffect(() => { void api(`/api/progress/exercises/${id}/`).then(setData); void api(`/api/exercises/${id}/`).then(setInfo).catch(() => undefined); }, [id]);
  if (!data) return <Loading label="Cargando ejercicio…" />;
  const name = data.exercise.name; const images = [info?.image_1 || data.exercise.image_1, info?.image_2].filter(Boolean);
  const facts = info ? [label(CATEGORIES, info.category), info.equipment ? equipmentLabel(info.equipment) : "", label(LEVELS, info.difficulty), label(FORCES, info.force), label(MECHANICS, info.mechanic)].filter(Boolean) : [];
  const steps: string[] = info?.instructions_es?.length ? info.instructions_es : info?.instructions || [];
  const inEnglish = !!info && !info.instructions_es?.length && steps.length > 0;
  return <>
    <PageHead back="/ejercicios" eyebrow="Ejercicio" title={name} />
    {data.exercise.name_original && data.exercise.name_original !== name && <p className="original-title">{data.exercise.name_original}</p>}
    <div className="exercise-detail">
      <ExerciseImages images={images} name={name} />
      <section className="panel exercise-facts">
        {facts.length > 0 && <div className="fact-chips">{facts.map((f) => <span key={f}>{f}</span>)}</div>}
        {info?.primary_muscles?.length > 0 && <div className="muscles"><small>Músculos principales</small><div className="tags">{info.primary_muscles.map((m: string) => <span key={m}>{muscleLabel(m)}</span>)}</div></div>}
        {info?.secondary_muscles?.length > 0 && <div className="muscles"><small>Secundarios</small><div className="tags">{info.secondary_muscles.map((m: string) => <span key={m} className="muted-tag">{muscleLabel(m)}</span>)}</div></div>}
        <button className="btn primary wide lg" onClick={() => navigate("/entrenar", { state: { exercise: { id: data.exercise.id, name } } })}><Dumbbell size={18} /> Entrenar este ejercicio</button>
      </section>
    </div>
    {steps.length > 0 && <section className="panel chart-panel">
      <div className="section-head"><h3>Cómo se hace</h3>{inEnglish && <span className="pill">En inglés</span>}</div>
      {inEnglish && !showEnglish ? <div className="english-note"><p className="hint">Todavía no tenemos las instrucciones de este ejercicio en español.</p><button type="button" className="btn secondary" onClick={() => setShowEnglish(true)}>Ver en inglés</button></div>
        : <ol className="steps">{steps.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}</ol>}
    </section>}
    <h2 className="section-title">Tu progreso</h2>
    <div className="stats">
      <Stat label="Mejor peso" icon={<Trophy size={16} />} value={kg(data.summary.best_weight)} unit="kg" />
      <Stat label="1RM estimado" icon={<TrendingUp size={16} />} tone="blue" value={kg(data.summary.best_1rm)} unit="kg" />
      <Stat label="Sesiones" icon={<CalendarDays size={16} />} tone="orange" value={data.summary.sessions} />
    </div>
    <section className="panel chart-panel">
      <div className="section-head"><h3>Progreso por sesión</h3>{data.sessions.length > 0 && <div className="legend"><span><i className="lg-accent" />Mejor peso</span><span><i className="lg-blue" />1RM estimado</span></div>}</div>
      {data.sessions.length ? <ResponsiveContainer width="100%" height={260}><AreaChart data={data.sessions} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}><Gradient id="best" color="#b6f36a" /><CartesianGrid stroke="#1c2430" vertical={false} /><XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={24} /><YAxis {...AXIS} tickFormatter={(v) => nf.format(v)} /><Tooltip content={<ChartTip />} cursor={{ stroke: "#2b3646" }} /><Area type="monotone" dataKey="best_weight" name="Mejor peso" stroke="#b6f36a" strokeWidth={2.5} fill="url(#best)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} /><Line type="monotone" dataKey="best_1rm" name="1RM estimado" stroke="#7aa7ff" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} /></AreaChart></ResponsiveContainer> : <Empty icon={<TrendingUp />} title="Todavía no hay datos para graficar">Registrá este ejercicio en un entrenamiento para ver tu evolución.</Empty>}
    </section>
    {data.sessions.length > 0 && <section className="panel"><div className="section-head"><h3>Sesiones</h3></div><div className="list">{data.sessions.slice().reverse().map((s: any) => <div className="row" key={s.date}><span className="row-main">{longDate(s.date)}<small>Volumen {kg(Math.round(s.volume))} kg</small></span><strong>{kg(s.best_weight)} <span>kg</span></strong></div>)}</div></section>}
  </>;
}
function Notice({ state }: { state: { ok: boolean; text: string } | null }) {
  if (!state) return null;
  return state.ok ? <div className="toast"><Check size={15} /> {state.text}</div> : <div className="error inline">{state.text}</div>;
}
function Profile() {
  const setGlobalUser = useContext(SetUserContext); const navigate = useNavigate();
  const logout = () => void api("/api/auth/logout/", { method: "POST" }).catch(() => undefined).finally(() => { setToken(null); navigate("/ingresar"); });
  const [user, setUser] = useState<any>(); const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [emailPassword, setEmailPassword] = useState("");
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null); const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null); const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const apply = (data: any) => { setUser(data); setName(data.name || ""); setEmail(data.email); setGlobalUser(data); };
  useEffect(() => { void api("/api/auth/me/").then(apply); }, []);
  if (!user) return <Loading label="Cargando perfil…" />;
  const emailChanged = email.trim().toLowerCase() !== user.email;
  const save = () => void api("/api/auth/me/", { method: "PATCH", body: JSON.stringify({ name, ...(emailChanged ? { email, current_password: emailPassword } : {}) }) }).then((data) => { apply(data); setEmailPassword(""); setProfileMsg({ ok: true, text: "Perfil actualizado" }); }).catch((e: Error) => setProfileMsg({ ok: false, text: e.message }));
  const uploadAvatar = async (file: File) => {
    setPhotoBusy(true); setProfileMsg(null);
    try { apply(await api("/api/auth/avatar/", { method: "PUT", body: await compressImage(file, 400) })); setProfileMsg({ ok: true, text: "Foto actualizada" }); }
    catch (e) { setProfileMsg({ ok: false, text: (e as Error).message }); } finally { setPhotoBusy(false); }
  };
  const removeAvatar = () => void api("/api/auth/avatar/", { method: "DELETE" }).then((data) => { apply(data); setProfileMsg({ ok: true, text: "Foto eliminada" }); });
  const changePassword = () => {
    if (next !== confirm) return setPasswordMsg({ ok: false, text: "Las contraseñas nuevas no coinciden." });
    void api("/api/auth/password/", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) }).then((data) => { apply(data); setCurrent(""); setNext(""); setConfirm(""); setPasswordMsg({ ok: true, text: user.has_password ? "Contraseña actualizada" : "Contraseña creada: ya podés entrar también con tu email" }); }).catch((e: Error) => setPasswordMsg({ ok: false, text: e.message }));
  };
  return <>
    <PageHead eyebrow="Cuenta" title="Mi perfil" />
    <div className="profile-grid">
      <section className="panel profile-card">
        <button type="button" className="avatar-edit" onClick={() => fileInput.current?.click()} aria-label="Cambiar foto de perfil" disabled={photoBusy}>
          <Avatar user={user} size={112} />
          <span className="avatar-overlay"><Camera size={20} />{photoBusy ? "Subiendo…" : "Cambiar"}</span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ""; }} />
        {user.avatar_url && <button type="button" className="link-btn" onClick={removeAvatar}>Quitar foto</button>}
        <strong>{user.name || "Sin nombre"}</strong>
        <small>{user.email}</small>
        <div className="admin-badges center">
          <span className="chip muted">{user.has_google ? "Google" : "Email y contraseña"}</span>
          {user.is_staff && <span className="chip down">Admin</span>}
        </div>
        {user.created_at && <div className="member-since"><CalendarDays size={14} /> Miembro desde {new Date(user.created_at).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</div>}
        {user.is_staff && <Link to="/admin" className="btn secondary wide"><ShieldCheck size={17} /> Panel de administración</Link>}
        <button type="button" className="btn ghost-danger wide" onClick={logout}><LogOut size={17} /> Cerrar sesión</button>
      </section>
      <div className="stack">
        <section className="panel form">
          <h3>Datos personales</h3>
          <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={user.has_google} autoComplete="email" /></label>
          {user.has_google && <p className="hint">El email de tu cuenta lo administra Google.</p>}
          {emailChanged && <label>Contraseña actual<input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Para confirmar el cambio de email" autoComplete="current-password" /></label>}
          <button className="btn primary wide" onClick={save}><Save size={17} /> Guardar cambios</button>
          <Notice state={profileMsg} />
        </section>
        <section className="panel form">
          <h3>{user.has_password ? "Cambiar contraseña" : "Crear contraseña"}</h3>
          {!user.has_password && <p className="hint">Creá una contraseña para poder entrar también con tu email, sin Google.</p>}
          {user.has_password && <label>Contraseña actual<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></label>}
          <div className="grid two">
            <label>Nueva contraseña<input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" /></label>
            <label>Repetila<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
          </div>
          <button className="btn secondary wide" onClick={changePassword} disabled={!next}>{user.has_password ? "Actualizar contraseña" : "Crear contraseña"}</button>
          <Notice state={passwordMsg} />
        </section>
      </div>
    </div>
  </>;
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const user = useContext(UserContext);
  return user?.is_staff ? <>{children}</> : <section className="panel"><Empty icon={<ShieldCheck />} title="Sin permisos">Esta sección es solo para administradores.</Empty></section>;
}
const dateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "—";
function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]); const [count, setCount] = useState(0); const [query, setQuery] = useState(""); const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => void api(`/api/admin/users/?search=${encodeURIComponent(query)}`).then((d) => { setRows(d.results); setCount(d.count); setLoaded(true); }), 250); return () => clearTimeout(t); }, [query]);
  const active30 = rows.filter((u) => daysSince(u.last_workout) !== null && daysSince(u.last_workout)! <= 30).length;
  return <AdminOnly>
    <PageHead eyebrow="Administración" title="Usuarios" />
    <div className="stats">
      <Stat label="Usuarios" icon={<Users size={16} />} value={count} />
      <Stat label="Activos · 30 días" icon={<Activity size={16} />} tone="blue" value={active30}><div className="hint">Con al menos un entrenamiento</div></Stat>
      <Stat label="Entrenamientos" icon={<Dumbbell size={16} />} tone="orange" value={rows.reduce((sum, u) => sum + (u.workouts || 0), 0)}><div className="hint">En esta página</div></Stat>
    </div>
    <div className="search"><Search size={18} /><input aria-label="Buscar usuario" placeholder="Buscar por nombre o email…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    <section className="panel chart-panel">{rows.length ? <div className="list">{rows.map((u) => <Link to={`/admin/usuario?id=${u.id}`} className="row link-row" key={u.id}>
      <Avatar user={u} size={40} />
      <span className="row-main">{u.name || "Sin nombre"}<small className="no-cap">{u.email}</small></span>
      <span className="admin-badges">{u.is_staff && <span className="chip down">Admin</span>}{!u.is_active && <span className="chip up">Bloqueado</span>}<span className="chip muted">{u.auth === "google" ? "Google" : "Email"}</span></span>
      <strong className="admin-count">{u.workouts} <span>entrenos</span><small>{u.last_workout ? agoLabel(daysSince(u.last_workout)) : "Nunca entrenó"}</small></strong>
      <ChevronRight size={16} className="chev" />
    </Link>)}</div> : loaded && <Empty icon={<Users />} title="No hay usuarios que coincidan" />}</section>
  </AdminOnly>;
}
function AdminUserDetail() {
  const id = useIdParam(); const me = useContext(UserContext); const [data, setData] = useState<any>(); const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState("");
  useEffect(() => { if (me?.is_staff) void api(`/api/admin/users/${id}/`).then(setData); }, [id]);
  const toggle = () => void api(`/api/admin/users/${id}/`, { method: "PATCH", body: JSON.stringify({ is_active: !data.is_active }) }).then(setData).catch((e: Error) => setError(e.message));
  if (!me?.is_staff) return <AdminOnly>{null}</AdminOnly>;
  if (!data) return <Loading />;
  const weights = data.body_weights.slice().sort((a: any, b: any) => a.date.localeCompare(b.date));
  const volume = data.workouts_list.reduce((sum: number, w: any) => sum + Number(w.volume), 0);
  return <>
    <PageHead back="/admin" eyebrow="Usuario" title={data.name || data.email} action={data.id !== me.id ? (data.is_active ? <ConfirmButton label="Bloquear" confirmLabel="¿Bloquear cuenta?" onConfirm={toggle} /> : <button className="btn secondary" onClick={toggle}><Check size={16} /> Desbloquear</button>) : undefined} />
    <section className="panel admin-profile">
      <Avatar user={data} size={64} />
      <div><strong>{data.email}</strong><small>Alta: {dateTime(data.created_at)} · Último ingreso: {dateTime(data.last_login)}</small>
        <span className="admin-badges">{data.is_staff && <span className="chip down">Admin</span>}<span className={`chip ${data.is_active ? "down" : "up"}`}>{data.is_active ? "Activo" : "Bloqueado"}</span><span className="chip muted">{data.auth === "google" ? "Cuenta Google" : "Email y contraseña"}</span></span>
      </div>
    </section>
    {error && <div className="error">{error}</div>}
    <div className="stats">
      <Stat label="Entrenamientos" icon={<Dumbbell size={16} />} value={data.workouts} />
      <Stat label="Volumen (últimos 30)" icon={<Flame size={16} />} tone="orange" value={kg(Math.round(volume))} unit="kg" />
      <Stat label="Peso actual" icon={<Scale size={16} />} tone="blue" value={weights.length ? kg(weights[weights.length - 1].weight_kg) : "—"} unit="kg">{weights.length > 1 && <Sparkline data={weights} dataKey="weight_kg" />}</Stat>
    </div>
    <section className="panel">
      <div className="section-head"><h3>Entrenamientos</h3><span className="pill">{data.workouts_list.length}</span></div>
      {data.workouts_list.length ? <div className="list">{data.workouts_list.map((w: any) => { const d = new Date(w.started_at); const isOpen = open === w.id; return <div key={w.id}>
        <button type="button" className="row link-row as-button" onClick={() => setOpen(isOpen ? null : w.id)}><span className="date-tile"><b>{d.getDate()}</b><small>{d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}</small></span><span className="row-main">{w.name}<small>{w.exercises.length} ejercicios</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className={`chev ${isOpen ? "open" : ""}`} /></button>
        {isOpen && <div className="admin-workout">{w.exercises.map((e: any) => <div key={e.id}><b>{e.exercise_name}</b><span>{e.sets.map((s: any) => `${kg(s.weight_kg)}×${s.reps}`).join(" · ") || "Sin series"}</span></div>)}</div>}
      </div>; })}</div> : <Empty icon={<Dumbbell />} title="Todavía no registró entrenamientos" />}
    </section>
    <section className="panel">
      <div className="section-head"><h3>Peso corporal</h3><span className="pill">{weights.length}</span></div>
      <p className="hint">Las fotos de progreso son privadas y no se muestran en el panel.</p>
      {weights.length ? <div className="list">{weights.slice().reverse().map((r: any) => <div className="row" key={r.id}><span className="row-main">{longDate(r.date)}</span><strong>{kg(r.weight_kg)} <span>kg</span></strong></div>)}</div> : <Empty icon={<Scale />} title="Sin registros de peso" />}
    </section>
  </>;
}

function SharedRoutine() {
  const { token = "" } = useParams(); const navigate = useNavigate(); const [routine, setRoutine] = useState<any>(); const [user, setUser] = useState<any>(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void api(`/api/shared-routines/${token}/`).then(setRoutine).catch((e: Error) => setError(e.message)); void api("/api/auth/me/").then(setUser).catch(() => setUser(null)); }, [token]);
  const importRoutine = () => { setBusy(true); setError(""); void api(`/api/shared-routines/${token}/import/`, { method: "POST" }).then(() => navigate("/rutinas")).catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); };
  if (error) return <div className="shared-routine-page"><section className="panel shared-card"><h1>No encontramos esa rutina</h1><p className="hint">El enlace puede estar vencido o ser incorrecto.</p><Link className="btn primary" to="/inicio">Ir a Dynamo</Link></section></div>;
  if (!routine) return <Loading label="Cargando rutina…" />;
  return <div className="shared-routine-page"><section className="panel shared-card"><small>Rutina compartida</small><h1>{routine.name}</h1><p className="hint">Creada por {routine.owner_name}. Podés verla y guardarla en tu cuenta para empezar a entrenar.</p><div className="routine-items">{routine.items.map((it: any) => <div className="routine-item" key={it.id}><ExerciseThumb src={it.image} size={42} /><div className="routine-item-main"><b>{it.exercise_name}</b><small>{it.target_sets || "—"} series · {it.target_reps || "Repeticiones libres"}</small></div></div>)}</div>{error && <div className="error inline">{error}</div>}{user ? <button className="btn primary wide lg" onClick={importRoutine} disabled={busy}>{busy ? "Guardando…" : "Guardar en mis rutinas"}</button> : <Link className="btn primary wide lg" to={`/ingresar?next=${encodeURIComponent(`/rutina-compartida/${token}`)}`}>Ingresar para usar esta rutina</Link>}<Link className="shared-back" to="/inicio">Dynamo</Link></section></div>;
}
function LegacyRedirect({ to }: { to: string }) { const { id } = useParams(); return <Navigate replace to={id ? `${to}?id=${id}` : to} />; }
function App() {
  return <Routes>
    <Route path="/ingresar" element={<Login />} />
    <Route path="/rutina-compartida/:token" element={<SharedRoutine />} />
    <Route path="/login" element={<Navigate replace to="/ingresar" />} />
    <Route path="*" element={<ProtectedRoute><Layout><Routes>
      <Route path="/inicio" element={<Dashboard />} />
      <Route path="/ejercicios" element={<Exercises />} />
      <Route path="/ejercicio" element={<Progress />} />
      <Route path="/entrenar" element={<WorkoutRecorder />} />
      <Route path="/rutinas" element={<Routines />} />
      <Route path="/rutina" element={<RoutineEditor />} />
      <Route path="/entrenamientos" element={<Workouts />} />
      <Route path="/entrenamiento" element={<WorkoutDetail />} />
      <Route path="/peso" element={<BodyWeight />} />
      <Route path="/perfil" element={<Profile />} />
      <Route path="/admin" element={<AdminUsers />} />
      <Route path="/admin/usuario" element={<AdminUserDetail />} />
      {/* URLs viejas en inglés: redirigen para no romper links guardados */}
      <Route path="/dashboard" element={<Navigate replace to="/inicio" />} />
      <Route path="/exercises" element={<Navigate replace to="/ejercicios" />} />
      <Route path="/progress/:id" element={<LegacyRedirect to="/ejercicio" />} />
      <Route path="/workouts/new" element={<Navigate replace to="/entrenar" />} />
      <Route path="/workouts" element={<Navigate replace to="/entrenamientos" />} />
      <Route path="/workouts/:id" element={<LegacyRedirect to="/entrenamiento" />} />
      <Route path="/body-weight" element={<Navigate replace to="/peso" />} />
      <Route path="/profile" element={<Navigate replace to="/perfil" />} />
      <Route path="/admin/users/:id" element={<LegacyRedirect to="/admin/usuario" />} />
      <Route path="*" element={<Navigate replace to="/inicio" />} />
    </Routes></Layout></ProtectedRoute>} />
  </Routes>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><App /></BrowserRouter>);
