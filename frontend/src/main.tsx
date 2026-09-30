import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, CalendarDays, Check, ChevronRight, Dumbbell, Flame, Home, LogOut, Plus, Save, Scale, Search, SlidersHorizontal, Timer, TrendingDown, TrendingUp, Trophy, UserRound } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
declare global { interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } } } } }
export async function api(path: string, options: RequestInit = {}) {
  const method = options.method || "GET"; let token: string | undefined;
  if (method !== "GET") { const csrfResponse = await fetch(`${API}/csrf/`, { credentials: "include" }); const csrfData = await csrfResponse.json(); token = csrfData.csrfToken; }
  const response = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json", ...(token ? { "X-CSRFToken": token } : {}) }, ...options });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "No se pudo completar la operación");
  return response.status === 204 ? null : response.json();
}

// ---------- helpers de formato ----------
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const kg = (value: number | string | null | undefined) => value === null || value === undefined || value === "" ? "—" : nf.format(Number(value));
const parseDate = (value: string) => { const [y, m, d] = value.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const shortDate = (value: string) => parseDate(value).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
const longDate = (value: string) => parseDate(value).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const LEVELS: Record<string, string> = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado", expert: "Avanzado" };
const EQUIPMENT: Record<string, string> = { barbell: "Barra", dumbbell: "Mancuernas", cable: "Polea", "body only": "Peso corporal", machine: "Máquina", kettlebells: "Kettlebell", bands: "Bandas", "e-z curl bar": "Barra Z" };
const equipmentLabel = (value?: string) => value ? EQUIPMENT[value.toLowerCase()] || value : "Sin equipamiento";

const UserContext = createContext<any>(null);

// ---------- piezas visuales ----------
function Logo({ size = 32 }: { size?: number }) { return <span className="logo-mark" style={{ width: size, height: size, fontSize: size * 0.5 }}>D</span>; }
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
export function Login() {
  const navigate = useNavigate(); const [error, setError] = useState(""); const googleButton = useRef<HTMLDivElement>(null);
  const submit = () => void api("/api/auth/dev_login/", { method: "POST", body: JSON.stringify({ email: "demo@dynamo.local" }) }).then(() => navigate("/dashboard")).catch((e: Error) => setError(e.message));
  useEffect(() => { if (!GOOGLE_CLIENT_ID || !googleButton.current) return; const render = () => { if (!window.google || !googleButton.current) return; window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (response) => { void api("/api/auth/google/", { method: "POST", body: JSON.stringify({ credential: response.credential }) }).then(() => navigate("/dashboard")).catch((e: Error) => setError(e.message)); } }); window.google.accounts.id.renderButton(googleButton.current, { theme: "filled_black", size: "large", shape: "pill", width: "300" }); }; if (window.google) render(); else { const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.onload = render; script.onerror = () => setError("No se pudo cargar Google Identity Services."); document.head.appendChild(script); } }, [navigate]);
  return <div className="auth-page">
    <div className="auth">
      <Logo size={56} />
      <h1>Dynamo</h1>
      <p>Entrená con intención. Medí tu progreso.</p>
      <ul className="auth-features">
        <li><Dumbbell size={16} /> Registrá series en segundos</li>
        <li><TrendingUp size={16} /> Seguí tu 1RM y tus récords</li>
        <li><Scale size={16} /> Controlá tu peso corporal</li>
      </ul>
      {GOOGLE_CLIENT_ID ? <div ref={googleButton} className="google-button" /> : null}
      {import.meta.env.DEV && import.meta.env.MODE === "test" && <button className="btn primary wide" onClick={submit}>Continuar en modo desarrollo</button>}
      {error && <div className="error">{error}</div>}
    </div>
  </div>;
}
export function ProtectedRoute({ children }: { children: React.ReactNode }) { const [user, setUser] = useState<unknown>(); useEffect(() => { void api("/api/auth/me/").then(setUser).catch(() => setUser(null)); }, []); if (user === undefined) return <Loading label="Cargando Dynamo…" />; return user ? <UserContext.Provider value={user}>{children}</UserContext.Provider> : <Login />; }

// ---------- layout ----------
const NAV = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/exercises", label: "Ejercicios", icon: Search },
  { to: "/workouts/new", label: "Entrenar", icon: Dumbbell, main: true },
  { to: "/body-weight", label: "Peso", icon: Scale },
  { to: "/profile", label: "Perfil", icon: UserRound },
];
function Avatar({ user, size = 34 }: { user: any; size?: number }) {
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  return user?.avatar_url ? <img className="avatar" src={user.avatar_url} alt="" style={{ width: size, height: size }} /> : <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</span>;
}
function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const user = useContext(UserContext);
  const logout = () => void api("/api/auth/logout/", { method: "POST" }).then(() => navigate("/login"));
  return <>
    <header className="topbar">
      <Link to="/dashboard" className="brand"><Logo size={30} /><span>Dynamo</span></Link>
      <nav className="top-nav">{NAV.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end><Icon size={16} />{label}</NavLink>)}</nav>
      <div className="header-actions">
        <Link to="/profile" aria-label="Mi perfil"><Avatar user={user} /></Link>
        <button className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}><LogOut size={18} /></button>
      </div>
    </header>
    <main>{children}</main>
    <nav className="bottom-nav">{NAV.map(({ to, label, icon: Icon, main }) => <NavLink key={to} to={to} end className={main ? "main" : undefined}><span className="nav-icon"><Icon size={main ? 22 : 20} /></span>{label}</NavLink>)}</nav>
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
    <PageHead eyebrow={new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} title={<>{greeting}{firstName && <>, <span className="accent">{firstName}</span></>}</>} action={<Link className="btn primary" to="/workouts/new"><Plus size={18} /> Entrenar</Link>} />
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
      <div className="section-head"><h3>Entrenamientos recientes</h3><Link to="/workouts">Ver todos <ChevronRight size={15} /></Link></div>
      {data?.recent_workouts?.length ? <div className="list">{data.recent_workouts.map((w: any) => <Link className="row link-row" to={`/workouts/${w.id}`} key={w.id}><span className="row-icon"><Dumbbell size={17} /></span><span className="row-main">{w.name}<small>{longDate(w.date)}</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className="chev" /></Link>)}</div> : <Empty icon={<Dumbbell />} title="Todavía no hay entrenamientos"><Link to="/workouts/new" className="btn ghost">Registrar el primero</Link></Empty>}
    </section>
  </>;
}

function Exercises() {
  const [items, setItems] = useState<any[]>([]); const [loaded, setLoaded] = useState(false); const [query, setQuery] = useState(""); const [equipment, setEquipment] = useState(""); const [difficulty, setDifficulty] = useState("");
  const load = () => { const params = new URLSearchParams({ search: query }); if (equipment) params.set("equipment", equipment); if (difficulty) params.set("difficulty", difficulty); void api(`/api/exercises/?${params}`).then((d) => { setItems(d.results || d); setLoaded(true); }); };
  useEffect(load, []);
  return <>
    <PageHead eyebrow="Catálogo" title="Ejercicios" />
    <div className="toolbar">
      <div className="search"><Search size={18} /><input aria-label="Buscar ejercicio" placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></div>
      <div className="filters">
        <select aria-label="Equipamiento" value={equipment} onChange={(e) => setEquipment(e.target.value)}><option value="">Todo el equipamiento</option><option value="barbell">Barra</option><option value="dumbbell">Mancuernas</option><option value="cable">Polea</option><option value="body only">Peso corporal</option></select>
        <select aria-label="Dificultad" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Toda dificultad</option><option value="beginner">Principiante</option><option value="intermediate">Intermedio</option><option value="advanced">Avanzado</option></select>
        <button className="btn secondary" onClick={load}><SlidersHorizontal size={16} /> Filtrar</button>
      </div>
    </div>
    <div className="exercise-grid">{items.map((item) => <Link className="exercise" to={`/progress/${item.id}`} key={item.id}>
      <div className="exercise-media">{item.image_1 ? <img src={item.image_1} alt="" loading="lazy" /> : <div className="image-placeholder"><Dumbbell /></div>}{item.difficulty && <span className={`badge lvl-${item.difficulty.toLowerCase()}`}>{LEVELS[item.difficulty.toLowerCase()] || item.difficulty}</span>}</div>
      <div className="exercise-body">
        <b>{item.name_es || item.name}</b>
        {item.name_es && item.name_es !== item.name && <small className="original-name">{item.name}</small>}
        <div className="tags">{item.primary_muscles?.slice(0, 2).map((m: string) => <span key={m}>{m}</span>)}<span className="muted-tag">{equipmentLabel(item.equipment)}</span></div>
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
function WorkoutRecorder() {
  const [workout, setWorkout] = useState<any>(() => JSON.parse(localStorage.getItem("dynamo.activeWorkout") || "null")); const [exercise, setExercise] = useState(""); const [exerciseLabel, setExerciseLabel] = useState(""); const [exerciseOptions, setExerciseOptions] = useState<any[]>([]); const [weight, setWeight] = useState(""); const [reps, setReps] = useState(""); const [sets, setSets] = useState<any[]>([]);
  const elapsed = useElapsed(workout?.started_at);
  const start = () => void api("/api/workouts/", { method: "POST", body: JSON.stringify({ name: "Entrenamiento", started_at: new Date().toISOString() }) }).then((d) => { setWorkout(d); localStorage.setItem("dynamo.activeWorkout", JSON.stringify(d)); });
  const findExercises = (value: string) => { setExercise(value); setExerciseLabel(value); if (value.length < 2) return setExerciseOptions([]); void api(`/api/exercises/?search=${encodeURIComponent(value)}`).then((d) => setExerciseOptions((d.results || d).slice(0, 6))); };
  const add = () => void api(`/api/workouts/${workout.id}/exercises/`, { method: "POST", body: JSON.stringify({ exercise }) }).then((item) => api(`/api/workout-exercises/${item.id}/sets/`, { method: "POST", body: JSON.stringify({ reps: Number(reps), weight_kg: Number(weight), set_number: sets.length + 1, completed: true }) })).then((s) => { setSets((old) => [...old, { ...s, exercise_label: exerciseLabel }]); setWeight(""); setReps(""); });
  const finish = () => void api(`/api/workouts/${workout.id}/finish/`, { method: "POST" }).then(() => { localStorage.removeItem("dynamo.activeWorkout"); setWorkout(null); setSets([]); });
  const volume = sets.reduce((sum, s) => sum + Number(s.weight_kg) * Number(s.reps), 0);
  if (!workout) return <>
    <PageHead eyebrow="Nueva sesión" title="Registrar entrenamiento" />
    <section className="panel start-card">
      <div className="start-icon"><Dumbbell size={30} /></div>
      <h3>¿Listo para entrenar?</h3>
      <p>Iniciá la sesión y cargá cada serie a medida que la completás. El cronómetro arranca solo.</p>
      <button className="btn primary wide lg" onClick={start}>Iniciar entrenamiento</button>
    </section>
  </>;
  return <>
    <PageHead eyebrow={<><span className="live-dot" /> En curso</>} title="Entrenamiento" />
    <div className="session-bar">
      <div><Timer size={16} /><b>{elapsed}</b><small>Duración</small></div>
      <div><Activity size={16} /><b>{sets.length}</b><small>Series</small></div>
      <div><Flame size={16} /><b>{kg(volume)}</b><small>kg volumen</small></div>
    </div>
    <div className="recorder">
      <section className="panel form">
        <h3>Agregar serie</h3>
        <label>Ejercicio
          <div className="input-icon"><Search size={16} /><input value={exerciseLabel} onChange={(e) => findExercises(e.target.value)} placeholder="Buscar ejercicio" /></div>
          {exerciseOptions.length > 0 && <div className="picker-results">{exerciseOptions.map((item) => <button type="button" className="picker-option" key={item.id} onClick={() => { setExercise(item.id); setExerciseLabel(item.name_es || item.name); setExerciseOptions([]); }}><span>{item.name_es || item.name}<small>{equipmentLabel(item.equipment)}</small></span><Plus size={16} /></button>)}</div>}
        </label>
        <div className="grid two">
          <label>Peso<div className="input-suffix"><input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" /><span>kg</span></div></label>
          <label>Repeticiones<div className="input-suffix"><input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" /><span>reps</span></div></label>
        </div>
        <button className="btn primary wide lg" onClick={add}><Plus size={18} /> Agregar serie</button>
      </section>
      <section className="panel">
        <div className="section-head"><h3>Series de hoy</h3><span className="pill">{sets.length}</span></div>
        {sets.length ? <div className="list">{sets.map((s, i) => <div className="row set-row" key={s.id}><span className="set-num">{i + 1}</span><span className="row-main">{s.exercise_label || "Serie"}</span><strong>{kg(s.weight_kg)} kg <span>× {s.reps}</span></strong><Check size={16} className="ok" /></div>)}</div> : <Empty icon={<Activity />} title="Sin series todavía">Las series que agregues aparecen acá.</Empty>}
        <button className="btn secondary wide" onClick={finish}><Check size={17} /> Finalizar entrenamiento</button>
      </section>
    </div>
  </>;
}

function Workouts() {
  const [rows, setRows] = useState<any[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => { void api("/api/workouts/").then((d) => { setRows(d.results || d); setLoaded(true); }); }, []);
  return <>
    <PageHead eyebrow="Historial" title="Tus entrenamientos" action={<Link className="btn primary" to="/workouts/new" aria-label="Nuevo entrenamiento"><Plus size={18} /> Nuevo</Link>} />
    <section className="panel">{rows.length ? <div className="list">{rows.map((w) => { const d = new Date(w.started_at); return <Link className="row link-row" to={`/workouts/${w.id}`} key={w.id}><span className="date-tile"><b>{d.getDate()}</b><small>{d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}</small></span><span className="row-main">{w.name}<small>{d.toLocaleDateString("es-AR", { weekday: "long" })} · {d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span><strong>{kg(Math.round(w.volume))} <span>kg</span></strong><ChevronRight size={16} className="chev" /></Link>; })}</div> : loaded && <Empty icon={<CalendarDays />} title="Aún no registraste entrenamientos"><Link to="/workouts/new" className="btn ghost">Empezar ahora</Link></Empty>}</section>
  </>;
}

function WorkoutDetail() {
  const { id } = useParams(); const [data, setData] = useState<any>();
  useEffect(() => { void api(`/api/workouts/${id}/`).then(setData); }, [id]);
  if (!data) return <Loading />;
  const allSets = data.exercises.flatMap((e: any) => e.sets); const volume = allSets.reduce((sum: number, s: any) => sum + Number(s.weight_kg) * Number(s.reps), 0);
  return <>
    <PageHead back="/workouts" eyebrow={data.started_at ? new Date(data.started_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) : undefined} title={data.name} />
    <div className="session-bar">
      <div><Dumbbell size={16} /><b>{data.exercises.length}</b><small>Ejercicios</small></div>
      <div><Activity size={16} /><b>{allSets.length}</b><small>Series</small></div>
      <div><Flame size={16} /><b>{kg(Math.round(volume))}</b><small>kg volumen</small></div>
    </div>
    <div className="stack">{data.exercises.map((e: any) => <section className="panel" key={e.id}>
      <div className="section-head"><h3>{e.exercise_name}</h3><span className="pill">{e.sets.length} {e.sets.length === 1 ? "serie" : "series"}</span></div>
      <div className="set-table">{e.sets.map((s: any) => <div className="set-line" key={s.id}><span className="set-num">{s.set_number}</span><span>{kg(s.weight_kg)} <small>kg</small></span><span>{s.reps} <small>reps</small></span></div>)}</div>
    </section>)}</div>
  </>;
}

function BodyWeight() {
  const [rows, setRows] = useState<any[]>([]); const [value, setValue] = useState("");
  const load = () => void api("/api/body-weight/").then((d) => setRows((d.results || d).slice().reverse())); useEffect(load, []);
  const save = () => void api("/api/body-weight/", { method: "POST", body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), weight_kg: Number(value) }) }).then(() => { setValue(""); load(); });
  const latest = rows[rows.length - 1]; const first = rows[0]; const change = latest && first && rows.length > 1 ? Number(latest.weight_kg) - Number(first.weight_kg) : null;
  return <>
    <PageHead eyebrow="Seguimiento" title="Peso corporal" />
    <div className="weight-top">
      <section className="panel weight-hero">
        <small>Último registro</small>
        <div className="big-number">{latest ? kg(latest.weight_kg) : "—"}<span>kg</span></div>
        {change !== null && <div className={`delta ${change > 0 ? "up" : change < 0 ? "down" : ""}`}>{change > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{change > 0 ? "+" : ""}{kg(change)} kg desde {shortDate(first.date)}</div>}
      </section>
      <section className="panel form weight-form">
        <label>Registrar peso de hoy<div className="input-suffix"><input inputMode="decimal" aria-label="Peso en kg" placeholder="Ej: 78,5" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && value && save()} /><span>kg</span></div></label>
        <button className="btn primary wide" onClick={save}><Plus size={17} /> Registrar peso</button>
      </section>
    </div>
    {rows.length > 1 && <section className="panel chart-panel"><div className="section-head"><h3>Evolución</h3></div><ResponsiveContainer width="100%" height={240}><AreaChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}><Gradient id="weight" color="#b6f36a" /><CartesianGrid stroke="#1c2430" vertical={false} /><XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={24} /><YAxis {...AXIS} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} tickFormatter={(v) => nf.format(v)} /><Tooltip content={<ChartTip />} cursor={{ stroke: "#2b3646" }} /><Area type="monotone" dataKey="weight_kg" name="Peso" stroke="#b6f36a" strokeWidth={2.5} fill="url(#weight)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} /></AreaChart></ResponsiveContainer></section>}
    {rows.length > 0 && <section className="panel"><div className="section-head"><h3>Registros</h3><span className="pill">{rows.length}</span></div><div className="list">{rows.slice().reverse().map((r, i, arr) => { const prev = arr[i + 1]; const diff = prev ? Number(r.weight_kg) - Number(prev.weight_kg) : 0; return <div className="row" key={r.id}><span className="row-main">{longDate(r.date)}</span>{prev && diff !== 0 && <span className={`chip ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? "+" : ""}{kg(diff)}</span>}<strong>{kg(r.weight_kg)} <span>kg</span></strong></div>; })}</div></section>}
    {!rows.length && <section className="panel"><Empty icon={<Scale />} title="Sin registros de peso">Cargá tu peso de hoy para empezar a ver la evolución.</Empty></section>}
  </>;
}

function Progress() {
  const { id } = useParams(); const [data, setData] = useState<any>();
  useEffect(() => { void api(`/api/progress/exercises/${id}/`).then(setData); }, [id]);
  if (!data) return <Loading label="Cargando progreso…" />;
  return <>
    <div className="progress-hero">
      {data.exercise.image_1 && <img src={data.exercise.image_1} alt="" />}
      <PageHead back="/exercises" eyebrow="Progreso del ejercicio" title={data.exercise.name} />
    </div>
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

function Profile() {
  const [user, setUser] = useState<any>(); const [name, setName] = useState(""); const [avatar, setAvatar] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { void api("/api/auth/me/").then((data) => { setUser(data); setName(data.name || ""); setAvatar(data.avatar_url || ""); }); }, []);
  if (!user) return <Loading label="Cargando perfil…" />;
  const save = () => void api("/api/auth/me/", { method: "PATCH", body: JSON.stringify({ name, avatar_url: avatar }) }).then((data) => { setUser(data); setMessage("Perfil actualizado"); }).catch((e: Error) => setMessage(e.message));
  return <>
    <PageHead eyebrow="Cuenta" title="Mi perfil" />
    <section className="panel profile">
      <div className="profile-head">
        <Avatar user={{ ...user, name, avatar_url: avatar }} size={72} />
        <div><strong>{name || "Sin nombre"}</strong><small>{user.email}</small><span className="pill google-pill">Cuenta conectada con Google</span></div>
      </div>
      <div className="form">
        <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" /></label>
        <label>URL del avatar<input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." /></label>
        <button className="btn primary wide" onClick={save}><Save size={17} /> Guardar cambios</button>
        {message && <div className="toast"><Check size={15} /> {message}</div>}
      </div>
    </section>
  </>;
}
function App() { return <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<ProtectedRoute><Layout><Routes><Route path="/dashboard" element={<Dashboard />} /><Route path="/exercises" element={<Exercises />} /><Route path="/workouts" element={<Workouts />} /><Route path="/workouts/:id" element={<WorkoutDetail />} /><Route path="/workouts/new" element={<WorkoutRecorder />} /><Route path="/body-weight" element={<BodyWeight />} /><Route path="/progress/:id" element={<Progress />} /><Route path="/profile" element={<Profile />} /><Route path="*" element={<Dashboard />} /></Routes></Layout></ProtectedRoute>} /></Routes>; }
const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><App /></BrowserRouter>);
