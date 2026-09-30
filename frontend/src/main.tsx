import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, Bell, Camera, Lock, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, Copy, Dumbbell, Flame, Globe, Heart, History, Home, ImagePlus, ListChecks, ListPlus, LogOut, MessageCircle, Pencil, Plus, Save, Scale, Search, Send, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Timer, Trash2, TrendingDown, TrendingUp, Trophy, UserRound, Users, X } from "lucide-react";
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
  if (!response.ok) { const body = await response.json().catch(() => ({})); const first = body && typeof body === "object" && !body.detail ? Object.values(body).flat()[0] : null; throw new Error(body.detail || (typeof first === "string" ? first : "") || "No se pudo completar la operación"); }
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
  { to: "/rutinas", label: "Rutinas", icon: ListChecks },
  { to: "/entrenar", label: "Entrenar", icon: Dumbbell, main: true },
  { to: "/amigos", label: "Amigos", icon: Users },
  { to: "/perfil", label: "Perfil", icon: UserRound },
];
function Avatar({ user, size = 34 }: { user: any; size?: number }) {
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  return user?.avatar_url ? <img className="avatar" src={user.avatar_url} alt="" style={{ width: size, height: size }} /> : <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</span>;
}
function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const user = useContext(UserContext); const unread = useUnreadNotifications();
  const logout = () => void api("/api/auth/logout/", { method: "POST" }).catch(() => undefined).finally(() => { setToken(null); navigate("/ingresar"); });
  const { pathname } = useLocation(); const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo(0, 0); window.scrollTo(0, 0); }, [pathname]);
  return <>
    <div className="app-scroll" ref={scroller}>
    <header className="topbar">
      <Link to="/inicio" className="brand" aria-label="Dynamo, inicio"><Logo size={34} /><Wordmark height={22} /></Link>
      <nav className="top-nav">{NAV.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end><Icon size={16} />{label}</NavLink>)}</nav>
      <div className="header-actions">
        <NavLink to="/ejercicios" className="icon-btn" aria-label="Buscar ejercicios" title="Ejercicios"><Search size={18} /></NavLink>
        <NavLink to="/notificaciones" className="icon-btn msg-link" aria-label={unread ? `Notificaciones, ${unread} nuevas` : "Notificaciones"} title="Notificaciones"><Bell size={18} />{unread > 0 && <em className="dot-badge">{unread > 9 ? "9+" : unread}</em>}</NavLink>
        {user?.is_staff && <NavLink to="/admin" className="icon-btn admin-link" aria-label="Administración" title="Administración"><ShieldCheck size={18} /></NavLink>}
        <Link to="/perfil" aria-label="Mi perfil"><Avatar user={user} /></Link>
        <button className="icon-btn header-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}><LogOut size={18} /></button>
      </div>
    </header>
    <main key={pathname}>{children}</main>
    </div>
    <Toasts />
    <nav className="bottom-nav">{NAV.map(({ to, label, icon: Icon, main }) => <NavLink key={to} to={to} end className={main ? "main" : undefined}><span className="nav-icon"><Icon size={main ? 22 : 20} /></span>{label}</NavLink>)}</nav>
  </>;
}

// ---------- pantallas ----------
// Avisos cortos y tranquilos (logros, confirmaciones). Se disparan desde cualquier parte con toast().
const toast = (text: string, icon?: string) => window.dispatchEvent(new CustomEvent("dynamo:toast", { detail: { text, icon } }));
function Toasts() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    const on = (e: Event) => { const id = Math.random(); setItems((old) => [...old, { id, ...(e as CustomEvent).detail }]); setTimeout(() => setItems((old) => old.filter((t) => t.id !== id)), 4200); };
    window.addEventListener("dynamo:toast", on); return () => window.removeEventListener("dynamo:toast", on);
  }, []);
  return <div className="toasts" aria-live="polite">{items.map((t) => <div className="toast-item" key={t.id}>{t.icon && <span className="toast-icon">{t.icon}</span>}<span>{t.text}</span></div>)}</div>;
}
function useUnreadNotifications() {
  const [count, setCount] = useState(0); const location = useLocation();
  const refresh = () => void api("/api/notifications/unread/").then((d) => setCount(d.count)).catch(() => undefined);
  useEffect(refresh, [location.pathname, location.search]);
  useEffect(() => { const t = setInterval(refresh, 60000); window.addEventListener("dynamo:notifications-read", refresh); return () => { clearInterval(t); window.removeEventListener("dynamo:notifications-read", refresh); }; }, []);
  return count;
}
const NOTIF_ICONS: Record<string, React.ReactNode> = { follow: <UserRound size={16} />, message: <MessageCircle size={16} />, comment: <MessageCircle size={16} />, like: <Heart size={16} />, achievement: <Trophy size={16} />, routine: <ListChecks size={16} /> };
function Notifications() {
  const [rows, setRows] = useState<any[] | null>(null); const navigate = useNavigate();
  useEffect(() => { void api("/api/notifications/").then((d) => { setRows(d); if (d.some((n: any) => !n.read)) void api("/api/notifications/read-all/", { method: "POST" }).then(() => window.dispatchEvent(new Event("dynamo:notifications-read"))); }); }, []);
  if (!rows) return <Loading />;
  return <>
    <PageHead eyebrow="Novedades" title="Notificaciones" />
    {rows.length ? <section className="panel"><div className="list">{rows.map((n) => <button type="button" key={n.id} className={`row link-row as-button notif ${n.read ? "" : "unread"}`} onClick={() => n.link && navigate(n.link)}>
      <span className={`notif-icon kind-${n.kind}`}>{n.actor && n.kind !== "achievement" ? <Avatar user={n.actor} size={40} /> : n.icon ? <span className="notif-emoji">{n.icon}</span> : NOTIF_ICONS[n.kind]}{n.actor && <i>{NOTIF_ICONS[n.kind]}</i>}</span>
      <span className="row-main no-cap">{n.text}<small>{timeAgo(n.created_at)}</small></span>
      {!n.read && <span className="unread-dot" aria-label="Nueva" />}
    </button>)}</div></section> : <section className="panel"><Empty icon={<Bell />} title="Todo tranquilo por acá">Te avisamos cuando alguien te siga, te escriba o desbloquees un logro.</Empty></section>}
  </>;
}

function Dashboard() {
  const [data, setData] = useState<any>(); const [routines, setRoutines] = useState<any[]>([]); const user = useContext(UserContext); const navigate = useNavigate();
  const active = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null"); const elapsed = useElapsed(active?.started_at);
  useEffect(() => { void api("/api/dashboard/summary/").then(setData); void api("/api/routines/").then((d) => setRoutines((d.results || d).filter((r: any) => r.items.length).slice(0, 3))).catch(() => undefined); }, []);
  // Saludo según la hora del celu.
  const hour = new Date().getHours(); const greeting = hour >= 5 && hour < 13 ? "Buen día" : hour >= 13 && hour < 20 ? "Buenas tardes" : "Buenas noches";
  const firstName = (user?.name || "").split(" ")[0];
  const history = data?.weight_history || [];
  const delta = history.length > 1 ? history[history.length - 1].weight_kg - history[0].weight_kg : null;
  return <>
    <PageHead eyebrow={new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} title={<>{greeting}{firstName && <>, <span className="accent">{firstName}</span></>}</>} />
    <section className={`train-hero ${active ? "live" : ""}`}>
      {active ? <>
        <div><small><span className="live-dot" /> Entrenamiento en curso</small><h2>{active.routine?.name || "Entrenamiento libre"}</h2><p className="hero-timer">{elapsed}</p></div>
        <Link className="btn primary lg" to="/entrenar">Continuar <ChevronRight size={18} /></Link>
      </> : <>
        <div><small>Hoy</small><h2>¿Qué entrenamos?</h2></div>
        <div className="hero-actions">
          {routines.map((r) => <button type="button" key={r.id} className="hero-routine" onClick={() => navigate("/entrenar", { state: { routine: r } })}><span className="thumb-stack">{r.items.slice(0, 2).map((it: any) => <ExerciseThumb key={it.id} src={it.image} size={28} />)}</span><span className="hr-name">{r.name}<small>{r.items.length} ejercicios</small></span><ChevronRight size={16} /></button>)}
          <Link className="btn primary lg" to="/entrenar"><Dumbbell size={18} /> {routines.length ? "Entrenamiento libre" : "Empezar a entrenar"}</Link>
        </div>
      </>}
    </section>
    <div className="mini-stats">
      <Link to="/entrenamientos" className="mini-stat"><small>Sesiones</small><b>{data?.workouts_30d ?? "—"}</b><span>últimos 30 días</span></Link>
      <Link to="/entrenamientos" className="mini-stat"><small>Volumen</small><b>{data ? kg(Math.round(data.volume_30d / 1000 * 10) / 10) : "—"}<em>t</em></b><span>últimos 30 días</span></Link>
      <Link to="/peso" className="mini-stat"><small>Peso</small><b>{kg(data?.weight_current)}{data?.weight_current ? <em>kg</em> : null}</b>{delta !== null ? <span className={delta < 0 ? "down" : delta > 0 ? "up" : ""}>{delta > 0 ? "+" : ""}{kg(delta)} kg en 30 días</span> : <span>Registrar</span>}</Link>
    </div>
    <section className="panel">
      <div className="section-head"><h3>Últimos entrenamientos</h3><Link to="/entrenamientos">Ver todos <ChevronRight size={15} /></Link></div>
      {data?.recent_workouts?.length ? <div className="list">{data.recent_workouts.slice(0, 3).map((w: any) => <Link className="row link-row" to={`/entrenamiento?id=${w.id}`} key={w.id}><span className="row-icon"><Dumbbell size={17} /></span><span className="row-main">{w.name}<small>{longDate(w.date)}</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className="chev" /></Link>)}</div> : <Empty icon={<Dumbbell />} title="Todavía no entrenaste">Tu primer entrenamiento va a aparecer acá.</Empty>}
    </section>
  </>;
}

// ---------- social: amigos, feed, mensajes y logros ----------
const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "recién"; if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60); if (hours < 24) return `hace ${hours} h`;
  if (hours < 48) return "ayer";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};
const firstNameOf = (name = "") => name.split(" ")[0] || name;
function VisibilityToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="vis-toggle" role="radiogroup" aria-label="Quién puede verlo">
    <button type="button" role="radio" aria-checked={value === "friends"} className={value === "friends" ? "on" : ""} onClick={() => onChange("friends")}><Users size={14} /> Solo amigos</button>
    <button type="button" role="radio" aria-checked={value === "public"} className={value === "public" ? "on" : ""} onClick={() => onChange("public")}><Globe size={14} /> Público</button>
  </div>;
}
function Composer({ onPosted }: { onPosted: (post: any) => void }) {
  const user = useContext(UserContext); const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [visibility, setVisibility] = useState("friends");
  const [photo, setPhoto] = useState<File | null>(null); const [preview, setPreview] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const fileInput = useRef<HTMLInputElement>(null);
  const reset = () => { setOpen(false); setText(""); setPhoto(null); setPreview(""); setError(""); };
  const choose = (file?: File) => { if (!file) return; setPhoto(file); setPreview(URL.createObjectURL(file)); setOpen(true); };
  const publish = async () => {
    if (!text.trim() && !photo) return setError("Escribí algo o sumá una foto.");
    setBusy(true); setError("");
    try {
      let post = await api(`/api/posts/${photo ? "?with_photo=1" : ""}`, { method: "POST", body: JSON.stringify({ text: text.trim(), visibility }) });
      if (photo) post = await api(`/api/posts/${post.id}/photo/`, { method: "PUT", body: await compressImage(photo, 1400) });
      onPosted(post); reset();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className={`panel composer ${open ? "open" : ""}`}>
    <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
    {!open ? <div className="composer-trigger"><Avatar user={user} size={36} /><button type="button" onClick={() => setOpen(true)}>¿Cómo te fue hoy?</button><button type="button" className="icon-btn" aria-label="Sumar foto" onClick={() => fileInput.current?.click()}><ImagePlus size={18} /></button></div> : <>
      <textarea autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Contá cómo te fue, un récord, lo que quieras…" maxLength={1000} />
      {preview && <div className="composer-preview"><img src={preview} alt="" /><button type="button" className="icon-btn sm" aria-label="Quitar foto" onClick={() => { setPhoto(null); setPreview(""); }}><X size={14} /></button></div>}
      <div className="composer-bar">
        <button type="button" className="icon-btn" aria-label="Sumar foto" onClick={() => fileInput.current?.click()}><ImagePlus size={18} /></button>
        <VisibilityToggle value={visibility} onChange={setVisibility} />
        <span className="grow" />
        <button type="button" className="btn secondary" onClick={reset}>Cancelar</button>
        <button type="button" className="btn primary" onClick={() => void publish()} disabled={busy}>{busy ? "Publicando…" : "Publicar"}</button>
      </div>
      {error && <div className="error inline">{error}</div>}
    </>}
  </section>;
}
function WorkoutCard({ w }: { w: any }) {
  return <div className="post-workout">
    <div className="pw-head"><span className="row-icon"><Dumbbell size={17} /></span><div><b>{w.name}</b>{w.exercises?.length > 0 && <small>{w.exercises.join(" · ")}</small>}</div></div>
    <div className="pw-stats"><span><b>{w.duration_min ?? "—"}</b>min</span><span><b>{w.set_count}</b>series</span><span><b>{kg(w.volume)}</b>kg</span></div>
  </div>;
}
function PostCard({ post, onChange, onDelete, onFollowed }: { post: any; onChange: (p: any) => void; onDelete: () => void; onFollowed?: (authorId: string) => void }) {
  const [comments, setComments] = useState<any[] | null>(null); const [comment, setComment] = useState(""); const [pop, setPop] = useState(false); const [following, setFollowing] = useState(false);
  const follow = () => { setFollowing(true); void api(`/api/profiles/${post.author.id}/follow/`, { method: "POST" }).then((p) => { onFollowed?.(post.author.id); toast(p.is_friend ? `¡Ahora vos y ${firstNameOf(post.author.name)} son amigos!` : `Seguís a ${firstNameOf(post.author.name)}`, "👋"); }).catch((e: Error) => toast(e.message, "⚠️")).finally(() => setFollowing(false)); };
  const like = () => {
    setPop(true); setTimeout(() => setPop(false), 450);
    onChange({ ...post, liked: !post.liked, like_count: post.like_count + (post.liked ? -1 : 1) });
    void api(`/api/posts/${post.id}/like/`, { method: "POST" }).then((d) => onChange({ ...post, liked: d.liked, like_count: d.like_count }));
  };
  const toggleComments = () => comments ? setComments(null) : void api(`/api/posts/${post.id}/comments/`).then(setComments);
  const send = () => { if (!comment.trim()) return; void api(`/api/posts/${post.id}/comments/`, { method: "POST", body: JSON.stringify({ text: comment.trim() }) }).then((c) => { setComments((old) => [...(old || []), c]); setComment(""); onChange({ ...post, comment_count: post.comment_count + 1 }); }); };
  return <article className="panel post" id={`post-${post.id}`}>
    <header className="post-head">
      <Link to={`/usuario?id=${post.author.id}`} className="post-author"><Avatar user={post.author} size={40} /><span><b>{post.author.name}</b><small>{timeAgo(post.created_at)} · {post.visibility === "public" ? <><Globe size={11} /> Público</> : <><Users size={11} /> Amigos</>}</small></span></Link>
      {!post.is_mine && post.author.is_following === false && <button type="button" className="btn primary follow-btn post-follow" onClick={follow} disabled={following}>Seguir</button>}
      {post.is_mine && <ConfirmButton iconOnly label="Borrar publicación" confirmLabel="Borrar" onConfirm={() => void api(`/api/posts/${post.id}/`, { method: "DELETE" }).then(onDelete)} />}
    </header>
    {post.text && <p className="post-text">{post.text}</p>}
    {post.workout_summary && <WorkoutCard w={post.workout_summary} />}
    {post.achievement_info && <div className="post-achievement"><span>{post.achievement_info.icon}</span><div><small>Logro desbloqueado</small><b>{post.achievement_info.title}</b><p>{post.achievement_info.description}</p></div></div>}
    {post.image_url && <img className="post-image" src={post.image_url} alt="" loading="lazy" />}
    <footer className="post-actions">
      <button type="button" className={`like ${post.liked ? "on" : ""} ${pop ? "pop" : ""}`} aria-pressed={post.liked} aria-label="Me gusta" onClick={like}><Heart size={18} fill={post.liked ? "currentColor" : "none"} />{post.like_count > 0 && <span>{post.like_count}</span>}</button>
      <button type="button" className={comments ? "on" : ""} aria-label="Comentarios" onClick={toggleComments}><MessageCircle size={18} />{post.comment_count > 0 && <span>{post.comment_count}</span>}</button>
    </footer>
    {comments && <div className="comments">
      {comments.map((c) => <div className="comment" key={c.id}><Avatar user={c.author} size={28} /><p><b>{c.author.name}</b> {c.text}</p></div>)}
      <div className="comment-form"><input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribí un comentario…" enterKeyHint="send" /><button type="button" className="icon-btn" aria-label="Enviar" onClick={send}><Send size={16} /></button></div>
    </div>}
  </article>;
}
function PostList({ posts, setPosts }: { posts: any[]; setPosts: (fn: (old: any[]) => any[]) => void }) {
  const followed = (authorId: string) => setPosts((old) => old.map((x) => x.author.id === authorId ? { ...x, author: { ...x.author, is_following: true } } : x));
  return <>{posts.map((p) => <PostCard key={p.id} post={p} onFollowed={followed} onChange={(next) => setPosts((old) => old.map((x) => x.id === next.id ? next : x))} onDelete={() => setPosts((old) => old.filter((x) => x.id !== p.id))} />)}</>;
}
function FeedTab({ onFindPeople }: { onFindPeople: () => void }) {
  const [posts, setPosts] = useState<any[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => { void api("/api/posts/").then((d) => { setPosts(d.results || d); setLoaded(true); }); }, []);
  useEffect(() => { if (!loaded || !window.location.hash.startsWith("#post-")) return; const el = document.getElementById(window.location.hash.slice(1)); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); } }, [loaded]);
  return <div className="feed">
    <Composer onPosted={(p) => setPosts((old) => [p, ...old])} />
    <PostList posts={posts} setPosts={setPosts} />
    {loaded && !posts.length && <section className="panel"><Empty icon={<Users />} title="Todavía no hay actividad">Seguí a gente para ver cómo entrena, o compartí tu último entrenamiento.<button type="button" className="btn ghost" onClick={onFindPeople}><Search size={16} /> Buscar amigos</button></Empty></section>}
  </div>;
}
function PersonRow({ person, onChange }: { person: any; onChange: (p: any) => void }) {
  const [busy, setBusy] = useState(false);
  const follow = () => { setBusy(true); void api(`/api/profiles/${person.id}/follow/`, { method: person.is_following ? "DELETE" : "POST" }).then(onChange).finally(() => setBusy(false)); };
  const tag = person.reason && !person.is_following ? person.reason : person.is_friend ? "Amigos" : person.follows_you ? "Te sigue" : "";
  return <div className="row person-row">
    <Link to={`/usuario?id=${person.id}`} className="person-link"><Avatar user={person} size={42} /><span className="row-main">{person.name}{tag && <small className="no-cap">{tag}</small>}</span></Link>
    {!person.is_me && <button type="button" className={`btn ${person.is_following ? "secondary" : "primary"} follow-btn`} onClick={follow} disabled={busy}>{person.is_friend ? <><Check size={14} /> Amigos</> : person.is_following ? "Siguiendo" : person.follows_you ? "Seguir también" : "Seguir"}</button>}
  </div>;
}
function PeopleTab() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<any[]>([]); const [lists, setLists] = useState<any>(null);
  const loadLists = () => Promise.all([api("/api/profiles/"), api("/api/profiles/?tab=followers"), api("/api/profiles/?tab=following")]).then(([friends, followers, following]) => setLists({ friends, followers: followers.filter((p: any) => !p.is_following), following: following.filter((p: any) => !p.is_friend) }));
  const [suggested, setSuggested] = useState<any[]>([]);
  useEffect(() => { void loadLists(); void api("/api/profiles/?tab=suggested").then(setSuggested).catch(() => undefined); }, []);
  useEffect(() => { if (query.trim().length < 2) { setResults([]); return; } const t = setTimeout(() => void api(`/api/profiles/?search=${encodeURIComponent(query.trim())}`).then(setResults), 250); return () => clearTimeout(t); }, [query]);
  const changed = (p: any) => { setResults((old) => old.map((x) => x.id === p.id ? p : x)); setSuggested((old) => old.map((x) => x.id === p.id ? { ...p, reason: x.reason } : x)); void loadLists(); };
  const shownSuggested = lists ? suggested.filter((p) => !lists.followers.some((f: any) => f.id === p.id)) : [];
  const block = (title: string, rows: any[], hint?: string) => <section className="panel"><div className="section-head"><h3>{title}</h3><span className="pill">{rows.length}</span></div>{hint && <p className="hint">{hint}</p>}<div className="list">{rows.map((p) => <PersonRow key={p.id} person={p} onChange={changed} />)}</div></section>;
  return <div className="people">
    <div className="search"><Search size={18} /><input type="search" aria-label="Buscar personas" placeholder="Buscar por nombre o email…" value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="none" autoCorrect="off" /></div>
    {query.trim().length >= 2 ? <section className="panel">{results.length ? <div className="list">{results.map((p) => <PersonRow key={p.id} person={p} onChange={changed} />)}</div> : <p className="hint">No encontramos a nadie con ese nombre.</p>}</section> : lists && <>
      {lists.followers.length > 0 && block("Te siguen", lists.followers, "Seguilos también y quedan como amigos.")}
      {shownSuggested.length > 0 && <section className="panel"><div className="section-head"><h3><Sparkles size={15} className="accent" /> Sugeridos para vos</h3></div><div className="list">{shownSuggested.map((p) => <PersonRow key={p.id} person={p} onChange={changed} />)}</div></section>}
      {lists.friends.length ? block("Amigos", lists.friends) : <section className="panel"><Empty icon={<Users />} title="Todavía no tenés amigos acá">Buscá a alguien por su nombre. Cuando se siguen entre los dos, quedan como amigos.</Empty></section>}
      {lists.following.length > 0 && block("Siguiendo", lists.following, "Todavía no te siguen.")}
    </>}
  </div>;
}
function FollowListSheet({ person, initial, onClose }: { person: { id: string; name: string }; initial: "followers" | "following"; onClose: () => void }) {
  const [tab, setTab] = useState(initial); const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { setRows(null); void api(`/api/profiles/?user=${person.id}&tab=${tab}`).then(setRows).catch(() => setRows([])); }, [tab]);
  useEffect(() => { const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, []);
  return <div className="sheet-backdrop" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label={tab === "followers" ? "Seguidores" : "Siguiendo"} onClick={(e) => e.stopPropagation()}>
    <div className="sheet-head"><h3>{person.name}</h3><IconButton label="Cerrar" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="sheet-body">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "followers"} className={tab === "followers" ? "on" : ""} onClick={() => setTab("followers")}>Seguidores</button>
        <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "on" : ""} onClick={() => setTab("following")}>Siguiendo</button>
        <span className="seg-indicator" style={{ transform: `translateX(${tab === "followers" ? 0 : 100}%)` }} />
      </div>
      {rows === null ? <p className="hint">Cargando…</p> : rows.length ? <div className="list" onClick={(e) => (e.target as HTMLElement).closest("a") && onClose()}>{rows.map((p) => <PersonRow key={p.id} person={p} onChange={(next) => setRows((old) => (old || []).map((x) => x.id === next.id ? { ...next, is_me: x.is_me } : x))} />)}</div>
        : <p className="hint">{tab === "followers" ? "Todavía no tiene seguidores." : "Todavía no sigue a nadie."}</p>}
    </div>
  </div></div>;
}
function FollowCounts({ person, followers, following, children }: { person: { id: string; name: string }; followers: number; following: number; children?: React.ReactNode }) {
  const [open, setOpen] = useState<"followers" | "following" | null>(null);
  return <>
    <div className="user-counts">{children}
      <button type="button" onClick={() => setOpen("followers")}><b>{followers}</b>{followers === 1 ? "seguidor" : "seguidores"}</button>
      <button type="button" onClick={() => setOpen("following")}><b>{following}</b>siguiendo</button>
    </div>
    {open && <FollowListSheet person={person} initial={open} onClose={() => setOpen(null)} />}
  </>;
}
function Friends() {
  const [params, setParams] = useSearchParams(); const tab = params.get("tab") === "personas" ? "personas" : "actividad";
  return <>
    <PageHead eyebrow="Comunidad" title="Amigos" action={<Link to="/mensajes" className="btn secondary"><MessageCircle size={16} /> Mensajes</Link>} />
    <div className="segmented" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "actividad"} className={tab === "actividad" ? "on" : ""} onClick={() => setParams({})}>Actividad</button>
      <button type="button" role="tab" aria-selected={tab === "personas"} className={tab === "personas" ? "on" : ""} onClick={() => setParams({ tab: "personas" })}>Personas</button>
      <span className="seg-indicator" style={{ transform: `translateX(${tab === "actividad" ? 0 : 100}%)` }} />
    </div>
    {tab === "actividad" ? <FeedTab onFindPeople={() => setParams({ tab: "personas" })} /> : <PeopleTab />}
  </>;
}
function FriendRoutines({ person }: { person: any }) {
  const [saved, setSaved] = useState<Record<string, string | null>>(() => Object.fromEntries(person.routines.map((r: any) => [r.id, r.saved_id]))); const [busy, setBusy] = useState(""); const [open, setOpen] = useState("");
  const toggle = (r: any) => {
    setBusy(r.id); const undo = !!saved[r.id];
    void api(`/api/profiles/${person.id}/routines/${r.id}/save/`, { method: undo ? "DELETE" : "POST" })
      .then((d) => { setSaved((o) => ({ ...o, [r.id]: undo ? null : d.id })); toast(undo ? `Sacaste «${r.name}» de tus rutinas` : `«${r.name}» quedó en tus rutinas`, undo ? "↩️" : "✅"); })
      .catch((e: Error) => toast(e.message, "⚠️")).finally(() => setBusy(""));
  };
  return <section className="panel">
    <div className="section-head"><h3>{person.is_me ? "Tus rutinas" : `Rutinas de ${firstNameOf(person.name)}`}</h3><span className="pill">{person.routines.length}</span></div>
    {person.is_me && <p className="hint">Tus amigos las ven acá y pueden guardarse una copia.</p>}
    <div className="list">{person.routines.map((r: any) => { const expanded = open === r.id; return <div className={`friend-routine-wrap ${expanded ? "open" : ""}`} key={r.id}>
      <div className="row friend-routine">
        <button type="button" className="fr-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? "" : r.id)}>
          <span className="thumb-stack">{r.images.slice(0, 2).map((src: string) => <ExerciseThumb key={src} src={src} size={34} />)}{!r.images.length && <span className="rp-icon"><ListChecks size={16} /></span>}</span>
          <span className="row-main">{r.name}<small className="no-cap">{r.exercise_count} {r.exercise_count === 1 ? "ejercicio" : "ejercicios"}</small></span>
          <ChevronDown size={16} className="chev" />
        </button>
        {!person.is_me && <button type="button" className={`btn ${saved[r.id] ? "secondary" : "primary"} follow-btn`} disabled={busy === r.id} onClick={() => toggle(r)} aria-pressed={!!saved[r.id]} title={saved[r.id] ? "Tocá para sacarla de tus rutinas" : undefined}>{saved[r.id] ? <><Check size={14} /> Guardada</> : <><ListPlus size={14} /> Guardar</>}</button>}
      </div>
      {expanded && <div className="fr-items">
        {r.notes && <p className="hint">{r.notes}</p>}
        {(r.items || []).map((it: any, i: number) => <Link to={`/ejercicio?id=${it.exercise}`} className="fr-item" key={`${it.exercise}-${i}`}>
          <span className="fr-num">{i + 1}</span><ExerciseThumb src={it.image} size={38} />
          <span className="row-main">{it.name}<small className="no-cap">{it.target_sets} × {it.target_reps}</small></span><ChevronRight size={15} className="chev" />
        </Link>)}
      </div>}
    </div>; })}</div>
  </section>;
}
function UserProfile() {
  const id = useIdParam(); const [p, setP] = useState<any>(); const [posts, setPosts] = useState<any[]>([]); const [missing, setMissing] = useState(false);
  const load = () => { void api(`/api/profiles/${id}/`).then(setP).catch(() => setMissing(true)); void api(`/api/posts/?user=${id}`).then((d) => setPosts(d.results || d)).catch(() => undefined); };
  useEffect(load, [id]);
  if (missing) return <section className="panel"><Empty icon={<UserRound />} title="No encontramos ese perfil" /></section>;
  if (!p) return <Loading />;
  const follow = () => void api(`/api/profiles/${id}/follow/`, { method: p.is_following ? "DELETE" : "POST" }).then(load);
  const them = firstNameOf(p.name);
  const compare: [string, number, number, string][] = [["Entrenamientos", p.my_stats.workouts_30d, p.stats.workouts_30d, ""], ["Volumen", p.my_stats.volume_30d, p.stats.volume_30d, "kg"]];
  return <>
    <PageHead back="/amigos?tab=personas" eyebrow={p.is_me ? "Así te ven los demás" : p.is_friend ? "Amigos" : p.follows_you ? "Te sigue" : "Perfil"} title={p.name} />
    <section className="panel user-hero">
      <Avatar user={p} size={84} />
      <FollowCounts key={p.id} person={p} followers={p.followers} following={p.following}><span><b>{p.stats.workouts_total}</b>entrenos</span></FollowCounts>
      {!p.is_me && <div className="user-actions">
        <button type="button" className={`btn ${p.is_following ? "secondary" : "primary"}`} onClick={follow}>{p.is_friend ? <><Check size={16} /> Amigos</> : p.is_following ? "Siguiendo" : p.follows_you ? "Seguir también" : "Seguir"}</button>
        {p.is_friend && <Link className="btn secondary" to={`/mensajes?with=${p.id}`}><MessageCircle size={16} /> Mensaje</Link>}
      </div>}
    </section>
    {!p.is_me && <section className="panel">
      <div className="section-head"><h3>Vos vs {them} · 30 días</h3></div>
      <div className="versus">{compare.map(([label, mine, theirs, unit]) => { const max = Math.max(mine, theirs, 1); return <div className="vs-row" key={label}>
        <small>{label}</small>
        <div className={`vs-bar me ${mine >= theirs && mine > 0 ? "lead" : ""}`}><i style={{ width: `${(mine / max) * 100}%` }} /><span>Vos</span><b>{kg(mine)}{unit && ` ${unit}`}</b></div>
        <div className={`vs-bar them ${theirs > mine ? "lead" : ""}`}><i style={{ width: `${(theirs / max) * 100}%` }} /><span>{them}</span><b>{kg(theirs)}{unit && ` ${unit}`}</b></div>
      </div>; })}</div>
    </section>}
    {p.calendar && <TrainingHeatmap entries={p.calendar} title={p.is_me ? "Tus días de entreno" : `Días de entreno de ${them}`} />}
    {p.routines?.length > 0 && <FriendRoutines person={p} />}
    {p.achievements.length > 0 && <section className="panel"><div className="section-head"><h3>Logros</h3><span className="pill">{p.achievements.length}</span></div><div className="badge-row">{p.achievements.map((a: any) => <span className="ach-badge" key={a.title} title={`${a.title}: ${a.description}`}><span>{a.icon}</span><small>{a.title}</small></span>)}</div></section>}
    {p.recent_workouts ? p.recent_workouts.length > 0 && <section className="panel"><div className="section-head"><h3>Últimos entrenamientos</h3></div><div className="stack tight">{p.recent_workouts.map((w: any, i: number) => <div key={i}><small className="field-label">{timeAgo(w.date)}</small><WorkoutCard w={w} /></div>)}</div></section>
      : !p.is_me && <section className="panel"><p className="hint lock-hint"><Users size={15} /> Cuando se sigan entre los dos, vas a ver sus entrenamientos.</p></section>}
    {posts.length > 0 && <div className="feed"><h2 className="section-title">Publicaciones</h2><PostList posts={posts} setPosts={setPosts} /></div>}
  </>;
}
function Messages() {
  const withId = useSearchParams()[0].get("with");
  return withId ? <Thread id={withId} /> : <Conversations />;
}
function Conversations() {
  const [rows, setRows] = useState<any[] | null>(null); const [friends, setFriends] = useState<any[]>([]);
  useEffect(() => { void api("/api/messages/").then(setRows); void api("/api/profiles/").then(setFriends).catch(() => undefined); }, []);
  if (!rows) return <Loading />;
  const talked = new Set(rows.map((r) => r.with.id)); const others = friends.filter((f) => !talked.has(f.id));
  return <>
    <PageHead back="/amigos" eyebrow="Amigos" title="Mensajes" />
    {rows.length > 0 && <section className="panel"><div className="list">{rows.map((c) => <Link key={c.with.id} to={`/mensajes?with=${c.with.id}`} className="row link-row conversation">
      <Avatar user={c.with} size={44} /><span className="row-main">{c.with.name}<small className="no-cap">{c.last}</small></span>
      <span className="conv-meta"><small>{timeAgo(c.last_at)}</small>{c.unread > 0 && <em>{c.unread}</em>}</span>
    </Link>)}</div></section>}
    {others.length > 0 && <section className="panel"><div className="section-head"><h3>Escribile a un amigo</h3></div><div className="friend-strip">{others.map((f) => <Link key={f.id} to={`/mensajes?with=${f.id}`}><Avatar user={f} size={52} /><small>{firstNameOf(f.name)}</small></Link>)}</div></section>}
    {!rows.length && !others.length && <section className="panel"><Empty icon={<MessageCircle />} title="Sin mensajes">Podés escribirle a tus amigos: gente que te sigue y que vos seguís.<Link className="btn ghost" to="/amigos?tab=personas"><Search size={16} /> Buscar amigos</Link></Empty></section>}
  </>;
}
function Thread({ id }: { id: string }) {
  const [data, setData] = useState<any>(); const [text, setText] = useState(""); const [error, setError] = useState(""); const end = useRef<HTMLDivElement>(null);
  const load = () => void api(`/api/messages/?with=${id}`).then(setData).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [data?.messages?.length]);
  if (!data) return error ? <section className="panel"><Empty icon={<MessageCircle />} title="No se pudo abrir la conversación">{error}</Empty></section> : <Loading />;
  const send = () => { if (!text.trim()) return; const body = text.trim(); setText(""); void api("/api/messages/", { method: "POST", body: JSON.stringify({ recipient: id, text: body }) }).then((m) => setData((d: any) => ({ ...d, messages: [...d.messages, m] }))).catch((e: Error) => { setError(e.message); setText(body); }); };
  return <>
    <PageHead back="/mensajes" eyebrow="Mensajes" title={<Link to={`/usuario?id=${id}`} className="thread-title"><Avatar user={data.with} size={36} />{data.with.name}</Link>} />
    <section className="panel thread">
      <div className="bubbles">{data.messages.length ? data.messages.map((m: any, i: number) => { const prev = data.messages[i - 1]; return <div key={m.id} className={`bubble ${m.mine ? "mine" : ""} ${prev && prev.mine === m.mine ? "grouped" : ""}`}><p>{m.text}</p><small>{new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></div>; }) : <p className="hint center">Todavía no se escribieron. ¡Mandá el primero!</p>}<div ref={end} /></div>
      {data.can_write ? <div className="thread-input"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribí un mensaje…" enterKeyHint="send" /><button type="button" className="btn primary" aria-label="Enviar" onClick={send}><Send size={17} /></button></div>
        : <p className="hint lock-hint"><Users size={15} /> Solo pueden escribirse si se siguen entre los dos.</p>}
      {error && <div className="error inline">{error}</div>}
    </section>
  </>;
}
function MyAchievements() {
  const [rows, setRows] = useState<any[]>([]); const [all, setAll] = useState(false);
  useEffect(() => { void api("/api/achievements/").then(setRows).catch(() => undefined); }, []);
  if (!rows.length) return null;
  const unlocked = rows.filter((r) => r.unlocked_at); const ordered = [...unlocked, ...rows.filter((r) => !r.unlocked_at)];
  return <section className="panel achievements">
    <div className="section-head"><h3><Trophy size={16} /> Logros</h3><span className="pill">{unlocked.length}/{rows.length}</span></div>
    <div className="ach-grid">{(all ? ordered : ordered.slice(0, 8)).map((a) => <div key={a.code} className={`ach ${a.unlocked_at ? "" : "locked"}`} title={a.description}><span>{a.icon}</span><b>{a.title}</b><small>{a.unlocked_at ? shortDate(a.unlocked_at) : a.description}</small></div>)}</div>
    {rows.length > 8 && <button type="button" className="link-btn" onClick={() => setAll(!all)}>{all ? "Ver menos" : `Ver los ${rows.length}`}</button>}
  </section>;
}
function ShareWorkoutSheet({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const navigate = useNavigate(); const [text, setText] = useState(""); const [visibility, setVisibility] = useState("friends"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const share = () => { setBusy(true); void api("/api/posts/", { method: "POST", body: JSON.stringify({ workout: workoutId, text: text.trim(), visibility }) }).then(() => { toast("Publicado en tu actividad", "✅"); navigate("/amigos"); }).catch((e: Error) => { setError(e.message); setBusy(false); }); };
  return <div className="sheet-backdrop" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label="Compartir entrenamiento" onClick={(e) => e.stopPropagation()}>
    <div className="sheet-head"><h3>Compartir entrenamiento</h3><IconButton label="Cerrar" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="sheet-body form">
      <label>Mensaje (opcional)<textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej: ¡Nuevo récord en sentadilla!" /></label>
      <div><small className="field-label">Quién lo ve</small><VisibilityToggle value={visibility} onChange={setVisibility} /></div>
      {error && <div className="error inline">{error}</div>}
    </div>
    <div className="sheet-foot"><button className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={share} disabled={busy}><Share2 size={16} /> {busy ? "Compartiendo…" : "Compartir"}</button></div>
  </div></div>;
}

function Exercises() {
  const [items, setItems] = useState<any[]>([]); const [loaded, setLoaded] = useState(false); const [query, setQuery] = useState(""); const [equipment, setEquipment] = useState(""); const [difficulty, setDifficulty] = useState(""); const [group, setGroup] = useState(""); const [creating, setCreating] = useState(false); const navigate = useNavigate(); const [tab, setTab] = useState<"mine" | "all">("mine"); const [showFilters, setShowFilters] = useState(false); const [saveTarget, setSaveTarget] = useState<any>(null);
  const load = (which = tab) => { const params = new URLSearchParams({ search: query.trim() }); if (which === "mine") params.set("mine", "1"); const muscles = GROUPS.find((g) => g.key === group)?.muscles; if (muscles) params.set("muscle", muscles.join(",")); if (equipment) params.set("equipment", equipment); if (difficulty) params.set("difficulty", difficulty); void api(`/api/exercises/?${params}`).then((d) => { const rows = d.results || d; setItems(rows); setLoaded(true); if (which === "mine" && !rows.length && !query.trim() && !group && !equipment && !difficulty && !loaded) switchTab("all"); }); };
  const switchTab = (next: "mine" | "all") => { setTab(next); load(next); };
  useEffect(() => load(), []);
  // Búsqueda y filtros se aplican solos (sin botón "Filtrar").
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } const t = setTimeout(() => load(), 300); return () => clearTimeout(t); }, [query, group, equipment, difficulty]);
  const activeFilters = [group, equipment, difficulty].filter(Boolean).length;
  return <>
    <PageHead eyebrow={tab === "mine" ? "Lo que ya entrenaste" : "Catálogo"} title="Ejercicios" action={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={18} /> Crear</button>} />
    <div className="segmented" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => switchTab("mine")}>Tuyos</button>
      <button type="button" role="tab" aria-selected={tab === "all"} className={tab === "all" ? "on" : ""} onClick={() => switchTab("all")}>Catálogo</button>
      <span className="seg-indicator" style={{ transform: `translateX(${tab === "mine" ? 0 : 100}%)` }} />
    </div>
    {creating && <CustomExerciseSheet initialName={query.trim()} onClose={() => setCreating(false)} onSaved={(ex) => navigate(`/ejercicio?id=${ex.id}`)} />}
    <div className="toolbar">
      <div className="search-row"><div className="search"><Search size={18} /><input aria-label="Buscar ejercicio" type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <button type="button" className={`icon-btn filter-btn ${showFilters || activeFilters ? "active" : ""}`} aria-expanded={showFilters} aria-label="Filtros" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={18} />{activeFilters > 0 && <em className="dot-badge">{activeFilters}</em>}</button></div>
      {showFilters && <div className="filters">
        <select aria-label="Grupo muscular" value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Todos los músculos</option>{GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>
        <select aria-label="Equipamiento" value={equipment} onChange={(e) => setEquipment(e.target.value)}><option value="">Todo el equipamiento</option>{Object.entries(EQUIPMENT).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
        <select aria-label="Dificultad" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Toda dificultad</option><option value="beginner">Principiante</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select>
        {activeFilters > 0 && <button type="button" className="link-btn" onClick={() => { setGroup(""); setEquipment(""); setDifficulty(""); }}>Limpiar filtros</button>}
      </div>}
    </div>
    {saveTarget && <SaveToRoutineSheet exercise={saveTarget} onClose={() => setSaveTarget(null)} />}
    <div className="exercise-grid">{items.map((item) => <Link className="exercise" to={`/ejercicio?id=${item.id}`} key={item.id}>
      <div className="exercise-media">{item.image_1 ? <img src={item.image_1} alt="" loading="lazy" /> : <div className="image-placeholder"><Dumbbell /></div>}{item.times > 0 && <span className="badge times">{item.times}×</span>}<button type="button" className="save-ex" aria-label={`Guardar ${exerciseName(item)} en una rutina`} title="Guardar en rutina" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSaveTarget({ id: item.id, name: exerciseName(item) }); }}><ListPlus size={17} /></button>{item.is_custom && <span className="badge custom">Propio</span>}{!item.is_custom && item.difficulty && <span className={`badge lvl-${item.difficulty.toLowerCase()}`}>{LEVELS[item.difficulty.toLowerCase()] || item.difficulty}</span>}</div>
      <div className="exercise-body">
        <b>{item.name_es || item.name}</b>
        {item.name_es && item.name_es !== item.name && <small className="original-name">{item.name}</small>}
        <div className="tags">{item.primary_muscles?.slice(0, 2).map((m: string) => <span key={m}>{muscleLabel(m)}</span>)}<span className="muted-tag">{equipmentLabel(item.equipment)}</span>{item.category && item.category !== "strength" && <span className="muted-tag">{label(CATEGORIES, item.category)}</span>}</div>
      </div>
    </Link>)}</div>
    {loaded && !items.length && tab === "mine" && !query.trim() ? <Empty icon={<Dumbbell />} title="Todavía no registraste ejercicios">Cuando entrenes, acá vas a tener tus ejercicios ordenados por los que más hacés.<button type="button" className="btn ghost" onClick={() => switchTab("all")}>Ver el catálogo</button></Empty> : loaded && !items.length && <Empty icon={<Search />} title="No encontramos ejercicios">Probá con otro nombre o quitá los filtros.</Empty>}
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
const MUSCLE_ORDER = ["chest", "lats", "middle back", "lower back", "traps", "shoulders", "biceps", "triceps", "forearms", "quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors", "abdominals", "neck"];
// Formulario para crear o editar un ejercicio propio. Se abre como hoja desde abajo (cómodo en el celu).
function CustomExerciseSheet({ initial, initialName = "", onSaved, onClose }: { initial?: any; initialName?: string; onSaved: (exercise: any) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name_es || initial?.name || initialName);
  const [primary, setPrimary] = useState<string[]>(initial?.primary_muscles || []);
  const [secondary, setSecondary] = useState<string[]>(initial?.secondary_muscles || []);
  const [equipment, setEquipment] = useState(initial?.equipment || "");
  const [category, setCategory] = useState(initial?.category || "strength");
  const [steps, setSteps] = useState((initial?.instructions_es || []).join("\n"));
  const [photo, setPhoto] = useState<File | null>(null); const [preview, setPreview] = useState<string>(initial?.image_1 || "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, []);
  const toggle = (list: string[], set: (v: string[]) => void, m: string) => set(list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);
  const choosePhoto = (file?: File) => { if (!file) return; setPhoto(file); setPreview(URL.createObjectURL(file)); };
  const save = async () => {
    if (name.trim().length < 2) return setError("Poné un nombre para el ejercicio.");
    if (!primary.length) return setError("Elegí al menos un músculo principal.");
    setBusy(true); setError("");
    try {
      const body = JSON.stringify({ name: name.trim(), primary_muscles: primary, secondary_muscles: secondary.filter((m) => !primary.includes(m)), equipment, category, instructions_es: steps.split("\n").map((s: string) => s.trim()).filter(Boolean) });
      let saved = await api(initial ? `/api/exercises/${initial.id}/` : "/api/exercises/", { method: initial ? "PATCH" : "POST", body });
      if (photo) saved = await api(`/api/exercises/${saved.id}/photo/`, { method: "PUT", body: await compressImage(photo, 800) });
      onSaved(saved);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="sheet-backdrop" onClick={onClose}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label={initial ? "Editar ejercicio" : "Crear ejercicio"} onClick={(e) => e.stopPropagation()}>
      <div className="sheet-head"><h3>{initial ? "Editar ejercicio" : "Crear ejercicio"}</h3><IconButton label="Cerrar" onClick={onClose}><X size={16} /></IconButton></div>
      <div className="sheet-body form">
        <div className="photo-pick">
          <button type="button" className="photo-drop" onClick={() => fileInput.current?.click()}>{preview ? <img src={preview} alt="" /> : <><Camera size={22} /><span>Foto (opcional)</span></>}</button>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => choosePhoto(e.target.files?.[0])} />
          <label className="grow">Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Remo en máquina Hammer" autoFocus={!initial} /></label>
        </div>
        <div><small className="field-label">Músculos principales</small><div className="chip-wrap">{MUSCLE_ORDER.map((m) => <button type="button" key={m} className={`select-chip ${primary.includes(m) ? "on" : ""}`} onClick={() => toggle(primary, setPrimary, m)}>{muscleLabel(m)}</button>)}</div></div>
        <details className="more" open={secondary.length > 0}><summary>Músculos secundarios (opcional)</summary><div className="chip-wrap">{MUSCLE_ORDER.filter((m) => !primary.includes(m)).map((m) => <button type="button" key={m} className={`select-chip soft ${secondary.includes(m) ? "on" : ""}`} onClick={() => toggle(secondary, setSecondary, m)}>{muscleLabel(m)}</button>)}</div></details>
        <div className="grid two">
          <label>Equipamiento<select value={equipment} onChange={(e) => setEquipment(e.target.value)}><option value="">Sin equipamiento</option>{Object.entries(EQUIPMENT).map(([value, n]) => <option key={value} value={value}>{n}</option>)}</select></label>
          <label>Tipo<select value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORIES).map(([value, n]) => <option key={value} value={value}>{n}</option>)}</select></label>
        </div>
        <label>Cómo se hace (opcional)<textarea rows={3} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"Un paso por renglón.\nEj: Sentate con la espalda apoyada."} /></label>
        {error && <div className="error inline">{error}</div>}
      </div>
      <div className="sheet-foot"><button className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={() => void save()} disabled={busy}>{busy ? "Guardando…" : <><Check size={17} /> {initial ? "Guardar" : "Crear ejercicio"}</>}</button></div>
    </div>
  </div>;
}

function ExerciseThumb({ src, size = 44 }: { src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? <img className="ex-thumb" src={src} alt="" loading="lazy" style={{ width: size, height: size }} onError={() => setBroken(true)} /> : <span className="ex-thumb empty" style={{ width: size, height: size }}><Dumbbell size={size * 0.4} /></span>;
}
function ExerciseOption({ item, onPick, action = <Plus size={16} /> }: { item: any; onPick: () => void; action?: React.ReactNode }) {
  return <button type="button" className="picker-option" onClick={onPick}>
    <ExerciseThumb src={item.image_1 || item.image} />
    <span>{exerciseName(item)}<small>{[item.times > 0 ? `Lo hiciste ${item.times} ${item.times === 1 ? "vez" : "veces"}` : "", item.primary_muscles?.map(muscleLabel).join(", "), item.equipment ? equipmentLabel(item.equipment) : ""].filter(Boolean).join(" · ")}</small></span>
    {action}
  </button>;
}
// Buscador de ejercicios con grupos musculares, habituales, recientes y resultados con foto.
function ExercisePicker({ onPick, suggestions, excludeIds = [] }: { onPick: (item: any) => void; suggestions: any; excludeIds?: string[] }) {
  const [creating, setCreating] = useState(false);
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
    {query.trim().length >= 2 && options.length === 0 && <p className="hint">No encontramos "{query.trim()}".</p>}
    <button type="button" className="create-exercise" onClick={() => setCreating(true)}><Plus size={16} /><span>{query.trim().length >= 2 ? <>Crear "<b>{query.trim()}</b>" como ejercicio propio</> : "¿No está? Creá tu propio ejercicio"}</span></button>
    {creating && <CustomExerciseSheet initialName={query.trim()} onClose={() => setCreating(false)} onSaved={(ex) => { setCreating(false); pick(ex); }} />}
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
  const navigate = useNavigate();
  const finish = () => void api(`/api/workouts/${workout.id}/finish/`, { method: "POST" }).then((d) => { const id = workout.id; clearActive(); toast("Entrenamiento guardado", "💪"); (d?.unlocked_achievements || []).forEach((a: any) => toast(`Logro desbloqueado: ${a.title}`, a.icon)); navigate(`/entrenamiento?id=${id}`); });
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
          {b.sets.map((s: any, i: number) => <EditableSet key={s.id} set={s} index={i} onSaved={(saved) => setBlocks((old) => old.map((x) => x.weId === b.weId ? { ...x, sets: x.sets.map((y: any) => y.id === saved.id ? { ...y, ...saved } : y) } : x))} onDelete={() => void removeSet(b, s.id)} />)}
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
    try { const data = await api(`/api/routines/${routine.id}/share/`, { method: "POST" }); setShareUrl(`${window.location.origin}/rutina-compartida?token=${data.token}`); setShareName(routine.name); }
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

// Mapa de calor de los días entrenados (como el de GitHub): semanas en columnas, de lunes a domingo.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function TrainingHeatmap({ entries, title = "Tus días de entreno" }: { entries: { started_at: string; sets: number }[]; title?: string }) {
  const [picked, setPicked] = useState<{ date: Date; workouts: number; sets: number } | null>(null); const scroller = useRef<HTMLDivElement>(null);
  const byDay = new Map<string, { workouts: number; sets: number }>();
  for (const e of entries) { const k = dayKey(new Date(e.started_at)); const cur = byDay.get(k) || { workouts: 0, sets: 0 }; byDay.set(k, { workouts: cur.workouts + 1, sets: cur.sets + e.sets }); }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - 52 * 7); // lunes de hace 52 semanas
  const weeks: Date[][] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) { if (!weeks.length || weeks[weeks.length - 1].length === 7) weeks.push([]); weeks[weeks.length - 1].push(new Date(d)); }
  const level = (sets: number, workouts: number) => !workouts ? 0 : sets >= 26 ? 4 : sets >= 18 ? 3 : sets >= 10 ? 2 : 1;
  const trainedDays = [...byDay.keys()].filter((k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d) >= start; }).length;
  // racha: semanas seguidas (hasta esta o la anterior) con al menos un entreno
  const weekHas = weeks.map((w) => w.some((d) => byDay.has(dayKey(d))));
  let streak = 0; for (let i = weekHas.length - (weekHas[weekHas.length - 1] ? 1 : 2); i >= 0 && weekHas[i]; i--) streak++;
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [entries.length]);
  const fmt = (d: Date) => d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
  return <section className="panel heatmap-panel">
    <div className="section-head"><h3>{title}</h3><small className="hint">Último año</small></div>
    <div className="heat-stats"><span><b>{trainedDays}</b>{trainedDays === 1 ? "día entrenado" : "días entrenados"}</span><span><b>{streak}</b>{streak === 1 ? "semana seguida" : "semanas seguidas"}</span></div>
    <div className="heat-scroll" ref={scroller}>
      <div className="heat-grid" role="img" aria-label={`${trainedDays} días entrenados en el último año`}>
        {weeks.map((w, i) => <div className="heat-week" key={i}>
          <span className="heat-month">{w[0].getDate() <= 7 ? w[0].toLocaleDateString("es-AR", { month: "short" }).replace(".", "") : ""}</span>
          {w.map((d) => { const info = byDay.get(dayKey(d)) || { workouts: 0, sets: 0 }; const on = picked && dayKey(picked.date) === dayKey(d);
            return <button type="button" key={d.getTime()} className={`heat-cell l${level(info.sets, info.workouts)} ${on ? "picked" : ""}`} title={`${fmt(d)}: ${info.workouts ? `${info.sets} series` : "sin entreno"}`} onClick={() => setPicked(on ? null : { date: d, ...info })} />; })}
        </div>)}
      </div>
    </div>
    <div className="heat-foot">
      <small className="heat-picked">{picked ? <>{fmt(picked.date)} · {picked.workouts ? <b>{picked.workouts > 1 ? `${picked.workouts} entrenos, ` : ""}{picked.sets} series</b> : "sin entreno"}</> : "Tocá un día para ver el detalle"}</small>
      <span className="heat-legend">Menos{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`heat-cell l${l}`} />)}Más</span>
    </div>
  </section>;
}
function MyHeatmap() {
  const [entries, setEntries] = useState<any[] | null>(null);
  useEffect(() => { void api("/api/workouts/calendar/").then(setEntries).catch(() => setEntries([])); }, []);
  return entries ? <TrainingHeatmap entries={entries} /> : null;
}
function Workouts() {
  const [rows, setRows] = useState<any[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => { void api("/api/workouts/").then((d) => { setRows(d.results || d); setLoaded(true); }); }, []);
  return <>
    <PageHead eyebrow="Historial" title="Tus entrenamientos" action={<Link className="btn primary" to="/entrenar" aria-label="Nuevo entrenamiento"><Plus size={18} /> Nuevo</Link>} />
    <MyHeatmap />
    <section className="panel">{rows.length ? <div className="list">{rows.map((w) => { const d = new Date(w.started_at); return <Link className="row link-row" to={`/entrenamiento?id=${w.id}`} key={w.id}><span className="date-tile"><b>{d.getDate()}</b><small>{d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}</small></span><span className="row-main">{w.name}<small>{d.toLocaleDateString("es-AR", { weekday: "long" })} · {d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className="chev" /></Link>; })}</div> : loaded && <Empty icon={<CalendarDays />} title="Aún no registraste entrenamientos"><Link to="/entrenar" className="btn ghost">Empezar ahora</Link></Empty>}</section>
  </>;
}

function EditableSet({ set, index, onSaved, onDelete }: { set: any; index: number; onSaved: (s: any) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false); const [weight, setWeight] = useState(String(set.weight_kg)); const [reps, setReps] = useState(String(set.reps));
  const open = () => { setWeight(String(Number(set.weight_kg))); setReps(String(set.reps)); setEditing(true); };
  const save = () => {
    const w = Number(weight), r = Number(reps);
    if (!(w >= 0) || !(r > 0) || !Number.isInteger(r)) return toast("Revisá el peso y las repes.", "⚠️");
    void api(`/api/workout-sets/${set.id}/`, { method: "PATCH", body: JSON.stringify({ weight_kg: w, reps: r }) }).then((s) => { onSaved(s); setEditing(false); }).catch((e: Error) => toast(e.message, "⚠️"));
  };
  const keys = (e: React.KeyboardEvent) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); };
  if (editing) return <div className="set-line editing"><span className="set-num">{index + 1}</span><input autoFocus inputMode="decimal" aria-label="Peso (kg)" value={weight} onChange={(e) => setWeight(e.target.value.replace(",", "."))} onKeyDown={keys} onFocus={(e) => e.target.select()} /><input inputMode="numeric" aria-label="Repeticiones" value={reps} onChange={(e) => setReps(e.target.value)} onKeyDown={keys} onFocus={(e) => e.target.select()} /><div className="line-actions"><IconButton label="Guardar" onClick={save}><Check size={15} /></IconButton><IconButton label="Cancelar" onClick={() => setEditing(false)}><X size={15} /></IconButton></div></div>;
  return <div className="set-line tappable" onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) open(); }}><span className="set-num">{index + 1}</span><span>{kg(set.weight_kg)} <small>kg</small></span><span>{set.reps} <small>reps</small></span><div className="line-actions"><IconButton label="Editar serie" onClick={open}><Pencil size={14} /></IconButton><ConfirmButton iconOnly label="Borrar serie" confirmLabel="Borrar" onConfirm={onDelete} /></div></div>;
}
function WorkoutDetail() {
  const id = useIdParam(); const navigate = useNavigate(); const [data, setData] = useState<any>(); const [sharing, setSharing] = useState(false); const [renaming, setRenaming] = useState(false); const [name, setName] = useState("");
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
    <PageHead back="/entrenamientos" eyebrow={data.started_at ? new Date(data.started_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) : undefined} title={title} action={<div className="line-actions"><button type="button" className="btn secondary" onClick={() => setSharing(true)}><Share2 size={15} /> Compartir</button><ConfirmButton iconOnly label="Borrar entrenamiento" confirmLabel="¿Borrar?" onConfirm={remove} /></div>} />
    {sharing && <ShareWorkoutSheet workoutId={id} onClose={() => setSharing(false)} />}
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
    {withPhotos.length > 0 && <section className="panel chart-panel"><div className="section-head"><h3>Fotos de progreso</h3><span className="pill private"><Lock size={11} /> Solo vos</span></div><div className="photo-strip">{withPhotos.map((r) => <button type="button" key={r.id} className="photo-card" onClick={() => setViewer(r)}><Photo id={r.id} version={versions[r.id] || 0} className="photo-img" /><span><b>{kg(r.weight_kg)} kg</b><small>{shortDate(r.date)}</small></span></button>)}</div></section>}
    {rows.length > 1 && <section className="panel chart-panel"><div className="section-head"><h3>Evolución</h3></div><ResponsiveContainer width="100%" height={240}><AreaChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}><Gradient id="weight" color="#b6f36a" /><CartesianGrid stroke="#1c2430" vertical={false} /><XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={24} /><YAxis {...AXIS} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} tickFormatter={(v) => nf.format(v)} /><Tooltip content={<ChartTip />} cursor={{ stroke: "#2b3646" }} /><Area type="monotone" dataKey="weight_kg" name="Peso" stroke="#b6f36a" strokeWidth={2.5} fill="url(#weight)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} /></AreaChart></ResponsiveContainer></section>}
    {rows.length > 0 && <section className="panel"><div className="section-head"><h3>Registros</h3>{busy ? <span className="pill">Subiendo foto…</span> : <span className="pill">{rows.length}</span>}</div><p className="hint privacy-note"><Lock size={13} /> Tocá la cámara para sumar una foto de progreso. Son privadas: solo las ves vos.</p><div className="list">{newestFirst.map((r, i) => <WeightRow key={`${r.id}-${r.date}-${r.weight_kg}`} row={r} prev={newestFirst[i + 1]} version={versions[r.id] || 0} onChanged={load} onDeleted={load} onOpenPhoto={() => setViewer(r)} onUpload={(f) => void upload(r, f)} />)}</div></section>}
    {!rows.length && <section className="panel"><Empty icon={<Scale />} title="Sin registros de peso">Cargá tu peso de hoy para empezar a ver la evolución.</Empty></section>}
    {viewer && <div className="lightbox" onClick={() => setViewer(null)}><div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
      <Photo id={viewer.id} version={versions[viewer.id] || 0} className="lightbox-img" />
      <div className="lightbox-bar"><div><b>{kg(viewer.weight_kg)} kg</b><small>{longDate(viewer.date)}</small></div><div className="line-actions"><ConfirmButton label="Quitar foto" confirmLabel="¿Quitar foto?" onConfirm={() => removePhoto(viewer)} /><IconButton label="Cerrar" onClick={() => setViewer(null)}><X size={16} /></IconButton></div></div>
    </div></div>}
  </>;
}

// Guardar un ejercicio en rutinas, como sumar una canción a playlists: tildás o destildás.
function SaveToRoutineSheet({ exercise, onClose }: { exercise: { id: string; name: string }; onClose: () => void }) {
  const [routines, setRoutines] = useState<any[] | null>(null); const [busy, setBusy] = useState(""); const [newName, setNewName] = useState(""); const [creating, setCreating] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void api("/api/routines/").then((d) => setRoutines(d.results || d)); }, []);
  useEffect(() => { const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, []);
  const has = (r: any) => r.items.some((it: any) => it.exercise === exercise.id);
  const toggle = (r: any) => {
    setBusy(r.id); setError("");
    const req = has(r) ? api(`/api/routines/${r.id}/items/${exercise.id}/`, { method: "DELETE" }) : api(`/api/routines/${r.id}/items/`, { method: "POST", body: JSON.stringify({ exercise: exercise.id }) });
    void req.then((updated) => { setRoutines((old) => (old || []).map((x) => x.id === r.id ? updated : x)); if (!has(r)) toast(`Agregado a «${r.name}»`, "✅"); }).catch((e: Error) => setError(e.message)).finally(() => setBusy(""));
  };
  const create = () => {
    if (!newName.trim()) return setError("Ponele un nombre a la rutina.");
    void api("/api/routines/", { method: "POST", body: JSON.stringify({ name: newName.trim(), items: [{ exercise: exercise.id, target_sets: 3, target_reps: "10" }] }) })
      .then((r) => { setRoutines((old) => [r, ...(old || [])]); setNewName(""); setCreating(false); toast(`Creaste «${r.name}»`, "✅"); }).catch((e: Error) => setError(e.message));
  };
  return <div className="sheet-backdrop" onClick={onClose}><div className="sheet" role="dialog" aria-modal="true" aria-label="Guardar en rutina" onClick={(e) => e.stopPropagation()}>
    <div className="sheet-head"><div><h3>Guardar en rutina</h3><small className="sheet-sub">{exercise.name}</small></div><IconButton label="Cerrar" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="sheet-body">
      {creating ? <div className="new-routine"><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Nombre, ej: Pecho y tríceps" /><button type="button" className="btn primary" onClick={create}>Crear</button></div>
        : <button type="button" className="routine-pick new" onClick={() => setCreating(true)}><span className="rp-icon"><Plus size={18} /></span><span className="rp-main">Nueva rutina</span></button>}
      {routines === null ? <p className="hint">Cargando rutinas…</p> : routines.map((r) => { const on = has(r); return <button type="button" key={r.id} className={`routine-pick ${on ? "on" : ""}`} onClick={() => toggle(r)} disabled={busy === r.id} aria-pressed={on}>
        <span className="thumb-stack">{r.items.slice(0, 2).map((it: any) => <ExerciseThumb key={it.id} src={it.image} size={32} />)}{!r.items.length && <span className="rp-icon"><ListChecks size={16} /></span>}</span>
        <span className="rp-main">{r.name}<small>{r.items.length} {r.items.length === 1 ? "ejercicio" : "ejercicios"}</small></span>
        <span className="rp-check">{on ? <Check size={16} /> : <Plus size={16} />}</span>
      </button>; })}
      {routines?.length === 0 && !creating && <p className="hint">Todavía no tenés rutinas: creá la primera con este ejercicio.</p>}
      {error && <div className="error inline">{error}</div>}
    </div>
    <div className="sheet-foot single"><button className="btn primary" onClick={onClose}>Listo</button></div>
  </div></div>;
}

function ExerciseImages({ images, name }: { images: string[]; name: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => { if (images.length < 2) return; const t = setInterval(() => setFrame((f) => (f + 1) % images.length), 1100); return () => clearInterval(t); }, [images.length]);
  if (!images.length) return <div className="exercise-hero placeholder"><Dumbbell size={40} /></div>;
  return <div className="exercise-hero">{images.map((src, i) => <img key={src} src={src} alt={i === 0 ? name : ""} className={i === frame ? "on" : ""} />)}{images.length > 1 && <span className="hero-hint"><Activity size={13} /> Inicio y final del movimiento</span>}</div>;
}
function Progress() {
  const id = useIdParam(); const navigate = useNavigate(); const me = useContext(UserContext); const [data, setData] = useState<any>(); const [info, setInfo] = useState<any>(); const [showEnglish, setShowEnglish] = useState(false); const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false);
  const load = () => { void api(`/api/progress/exercises/${id}/`).then(setData); void api(`/api/exercises/${id}/`).then(setInfo).catch(() => undefined); };
  useEffect(load, [id]);
  if (!data) return <Loading label="Cargando ejercicio…" />;
  const name = data.exercise.name; const images = [info?.image_1 || data.exercise.image_1, info?.image_2].filter(Boolean);
  const facts = info ? [label(CATEGORIES, info.category), info.equipment ? equipmentLabel(info.equipment) : "", label(LEVELS, info.difficulty), label(FORCES, info.force), label(MECHANICS, info.mechanic)].filter(Boolean) : [];
  const steps: string[] = info?.instructions_es?.length ? info.instructions_es : info?.instructions || [];
  const inEnglish = !!info && !info.instructions_es?.length && steps.length > 0;
  return <>
    <PageHead back="/ejercicios" eyebrow={info?.is_custom ? "Ejercicio propio" : "Ejercicio"} title={name} action={info?.is_custom && info.created_by === me?.id ? <div className="line-actions"><IconButton label="Editar ejercicio" onClick={() => setEditing(true)}><Pencil size={15} /></IconButton><ConfirmButton iconOnly label="Borrar ejercicio" confirmLabel="¿Borrar?" onConfirm={() => void api(`/api/exercises/${id}/`, { method: "DELETE" }).then(() => navigate("/ejercicios"))} /></div> : undefined} />
    {saving && <SaveToRoutineSheet exercise={{ id: data.exercise.id, name }} onClose={() => setSaving(false)} />}
    {editing && <CustomExerciseSheet initial={info} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    {data.exercise.name_original && data.exercise.name_original !== name && <p className="original-title">{data.exercise.name_original}</p>}
    <div className="exercise-detail">
      <ExerciseImages images={images} name={name} />
      <section className="panel exercise-facts">
        {facts.length > 0 && <div className="fact-chips">{facts.map((f) => <span key={f}>{f}</span>)}</div>}
        {info?.primary_muscles?.length > 0 && <div className="muscles"><small>Músculos principales</small><div className="tags">{info.primary_muscles.map((m: string) => <span key={m}>{muscleLabel(m)}</span>)}</div></div>}
        {info?.secondary_muscles?.length > 0 && <div className="muscles"><small>Secundarios</small><div className="tags">{info.secondary_muscles.map((m: string) => <span key={m} className="muted-tag">{muscleLabel(m)}</span>)}</div></div>}
        <div className="detail-actions"><button className="btn primary lg" onClick={() => navigate("/entrenar", { state: { exercise: { id: data.exercise.id, name } } })}><Dumbbell size={18} /> Entrenar</button><button className="btn secondary lg" onClick={() => setSaving(true)}><ListPlus size={18} /> Guardar en rutina</button></div>
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
  const [social, setSocial] = useState<any>(null);
  useEffect(() => { void api("/api/auth/me/").then((data) => { apply(data); void api(`/api/profiles/${data.id}/`).then(setSocial).catch(() => undefined); }); }, []);
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
        {social?.stats && <FollowCounts person={{ id: user.id, name: user.name || "Vos" }} followers={social.followers} following={social.following}><span><b>{social.stats.workouts_total}</b>entrenos</span></FollowCounts>}
        <div className="profile-links">
          <Link to="/peso" className="row link-row"><span className="row-icon"><Scale size={17} /></span><span className="row-main">Peso y fotos de progreso<small className="no-cap"><Lock size={11} /> Tus datos son privados</small></span><ChevronRight size={16} className="chev" /></Link>
          <Link to="/entrenamientos" className="row link-row"><span className="row-icon"><CalendarDays size={17} /></span><span className="row-main">Historial de entrenamientos</span><ChevronRight size={16} className="chev" /></Link>
          <Link to={`/usuario?id=${user.id}`} className="row link-row"><span className="row-icon"><Globe size={17} /></span><span className="row-main">Cómo te ven tus amigos</span><ChevronRight size={16} className="chev" /></Link>
        </div>
        {user.is_staff && <Link to="/admin" className="btn secondary wide"><ShieldCheck size={17} /> Panel de administración</Link>}
        <button type="button" className="btn ghost-danger wide" onClick={logout}><LogOut size={17} /> Cerrar sesión</button>
      </section>
      <div className="stack">
        <MyHeatmap />
        <MyAchievements />
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
  const params = useParams(); const token = useSearchParams()[0].get("token") || params.token || ""; const navigate = useNavigate(); const [routine, setRoutine] = useState<any>(); const [user, setUser] = useState<any>(); const [busy, setBusy] = useState(false); const [notFound, setNotFound] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void api(`/api/shared-routines/${token}/`).then(setRoutine).catch(() => setNotFound(true)); void api("/api/auth/me/").then(setUser).catch(() => setUser(null)); }, [token]);
  const importRoutine = () => { setBusy(true); setError(""); void api(`/api/shared-routines/${token}/import/`, { method: "POST" }).then(() => navigate("/rutinas")).catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); };
  if (notFound || !token) return <div className="shared-routine-page"><section className="panel shared-card"><h1>No encontramos esa rutina</h1><p className="hint">El enlace puede estar vencido o ser incorrecto.</p><Link className="btn primary" to="/inicio">Ir a Dynamo</Link></section></div>;
  if (!routine) return <Loading label="Cargando rutina…" />;
  return <div className="shared-routine-page"><section className="panel shared-card"><small>Rutina compartida</small><h1>{routine.name}</h1><p className="hint">Creada por {routine.owner_name}. Podés verla y guardarla en tu cuenta para empezar a entrenar.</p><div className="routine-items">{routine.items.map((it: any) => <div className="routine-item" key={it.id}><ExerciseThumb src={it.image} size={42} /><div className="routine-item-main"><b>{it.exercise_name}</b><small>{it.target_sets || "—"} series · {it.target_reps || "Repeticiones libres"}</small></div></div>)}</div>{error && <div className="error inline">{error}</div>}{user ? <button className="btn primary wide lg" onClick={importRoutine} disabled={busy}>{busy ? "Guardando…" : "Guardar en mis rutinas"}</button> : <Link className="btn primary wide lg" to={`/ingresar?next=${encodeURIComponent(`/rutina-compartida?token=${token}`)}`}>Ingresar para usar esta rutina</Link>}<Link className="shared-back" to="/inicio">Dynamo</Link></section></div>;
}
function LegacyRedirect({ to }: { to: string }) { const { id } = useParams(); return <Navigate replace to={id ? `${to}?id=${id}` : to} />; }
function App() {
  return <Routes>
    <Route path="/ingresar" element={<Login />} />
    <Route path="/rutina-compartida" element={<SharedRoutine />} />
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
      <Route path="/amigos" element={<Friends />} />
      <Route path="/usuario" element={<UserProfile />} />
      <Route path="/mensajes" element={<Messages />} />
      <Route path="/notificaciones" element={<Notifications />} />
      <Route path="/comunidad" element={<Navigate replace to="/amigos" />} />
      <Route path="/logros" element={<Navigate replace to="/perfil" />} />
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
