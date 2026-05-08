import React, { useState, useEffect, useRef } from "react";
import "./App.css";

/* ─────────────────────────────────────────
   CONFIG — une seule ligne à changer si
   le port ou la route Flask change
───────────────────────────────────────── */
const API_URL = "http://localhost:5000/scan";

/* ─────────────────────────────────────────
   SEVERITY CONFIG
   Correspond aux valeurs "severity" du JSON
───────────────────────────────────────── */
const SEV = {
  CRITICAL: { color: "#ff4d6d", bg: "rgba(255,77,109,0.1)",  glow: "rgba(255,77,109,0.3)",  label: "CRITICAL" },
  HIGH:     { color: "#ff8c42", bg: "rgba(255,140,66,0.1)",  glow: "rgba(255,140,66,0.25)", label: "HIGH"     },
  MEDIUM:   { color: "#ffd166", bg: "rgba(255,209,102,0.1)", glow: "rgba(255,209,102,0.2)", label: "MEDIUM"   },
  LOW:      { color: "#06d6a0", bg: "rgba(6,214,160,0.1)",   glow: "rgba(6,214,160,0.2)",   label: "LOW"      },
  INFO:     { color: "#4cc9f0", bg: "rgba(76,201,240,0.1)",  glow: "rgba(76,201,240,0.2)",  label: "INFO"     },
};

/* ─────────────────────────────────────────
   CALCUL DU SCORE (basé sur les patches)
───────────────────────────────────────── */
function computeScore(patches) {
  const pts = { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, INFO: 1 };
  const total = patches.reduce((acc, p) => acc + (pts[p.severity?.toUpperCase()] || 0), 0);
  return Math.max(0, 100 - total);
}

/* ─────────────────────────────────────────
   CALCUL DES STATS PAR SÉVÉRITÉ
───────────────────────────────────────── */
function computeStats(patches) {
  const stats = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  patches.forEach(p => {
    const k = p.severity?.toUpperCase();
    if (k in stats) stats[k]++;
  });
  return stats;
}

/* ─────────────────────────────────────────
   VALIDATION URL — React (avant Flask)
───────────────────────────────────────── */
function validateUrl(url) {
  if (!url.trim())
    return "Veuillez entrer une URL.";
  if (!url.startsWith("http://") && !url.startsWith("https://"))
    return "L'URL doit commencer par http:// ou https://";
  try {
    const p = new URL(url);
    if (!p.hostname || !p.hostname.includes("."))
      return "Domaine invalide — exemple : https://mon-site.com";
    if (["localhost","127.0.0.1","0.0.0.0","::1"].some(l => p.hostname.startsWith(l)))
      return "Les adresses locales ne sont pas autorisées.";
  } catch {
    return "URL invalide — vérifiez le format.";
  }
  return null;
}

/* ─────────────────────────────────────────
   HISTORIQUE — localStorage
───────────────────────────────────────── */
const LS_KEY = "vulnscan_history";
const loadHistory  = ()      => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } };
const saveHistory  = (list)  => localStorage.setItem(LS_KEY, JSON.stringify(list));
const addToHistory = (entry) => {
  const list = [entry, ...loadHistory().filter(h => h.scan_id !== entry.scan_id)].slice(0, 20);
  saveHistory(list);
};

/* ─────────────────────────────────────────
   SVG ICONS
───────────────────────────────────────── */
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" fill="url(#sg)"/>
    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <defs><linearGradient id="sg" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
      <stop stopColor="#3b82f6"/><stop offset="1" stopColor="#0ea5e9"/>
    </linearGradient></defs>
  </svg>
);
const IconBug = ({ size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 3h6M9 3a3 3 0 0 0-3 3v1M9 3a3 3 0 0 1 3 3m3-3a3 3 0 0 1 3 3v1M12 6a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V9a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M6 10H3M21 10h-3M6 14H3M21 14h-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
const IconCode = ({ size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <polyline points="16,18 22,12 16,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="8,6 2,12 8,18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconHistory = ({ size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
    <polyline points="12,7 12,12 15,15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
const IconTrash = ({ size=14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─────────────────────────────────────────
   COPY BUTTON
───────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={() => {
      navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }}>
      <IconCopy /> {copied ? "Copié !" : "Copier"}
    </button>
  );
}

/* ─────────────────────────────────────────
   DONUT CHART — données réelles
───────────────────────────────────────── */
function Donut({ stats }) {
  const total = Object.values(stats).reduce((a,b)=>a+b,0);
  const r=54, cx=70, cy=70, circ=2*Math.PI*r;
  let offset=0;
  const slices = Object.entries(stats).filter(([,v])=>v>0).map(([k,v])=>{
    const dash=(v/total)*circ-3;
    const sl={key:k, dash:Math.max(0,dash), offset, color:SEV[k]?.color||"#4cc9f0"};
    offset+=(v/total)*circ; return sl;
  });
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14"/>
      {slices.map(s=>(
        <circle key={s.key} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth="14"
          strokeDasharray={`${s.dash} ${circ-s.dash}`}
          strokeDashoffset={circ/4-s.offset}
          style={{transition:"stroke-dasharray 1.2s ease", filter:`drop-shadow(0 0 6px ${s.color}80)`}}
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────
   SCORE RING
───────────────────────────────────────── */
function ScoreRing({ score, color }) {
  const r=52, circ=2*Math.PI*r;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10"/>
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(score/100)*circ} ${circ}`} strokeDashoffset={circ/4}
        style={{transition:"stroke-dasharray 1.4s ease", filter:`drop-shadow(0 0 10px ${color})`}}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────
   VULN CARD — affiche les vraies données
───────────────────────────────────────── */
function VulnCard({ patch, index }) {
  const [open, setOpen] = useState(false);
  const sev = SEV[patch.severity?.toUpperCase()] || SEV.INFO;
  return (
    <div className={`vuln-card ${open?"open":""}`} style={{animationDelay:`${index*0.06}s`}}>
      <div className="vuln-header" onClick={()=>setOpen(o=>!o)}>
        <div className="vh-left">
          <div className="sev-dot-lg" style={{background:sev.color, boxShadow:`0 0 10px ${sev.glow}`}}/>
          <div>
            <div className="vuln-name">{patch.type}</div>
            <div className="vuln-ep">
              {patch.fichier && <span className="vuln-file">📄 {patch.fichier}</span>}
              {patch.champ   && <span className="vuln-champ"> — champ : <strong>{patch.champ}</strong></span>}
              {patch.url     && <span className="vuln-champ"> — {patch.url}</span>}
            </div>
          </div>
        </div>
        <div className="vh-right">
          <span className="sev-badge" style={{color:sev.color, borderColor:sev.color+"40", background:sev.bg}}>
            <span className="sev-pip" style={{background:sev.color}}/>{sev.label}
          </span>
          <span className={`chevron ${open?"up":""}`}><IconChevron/></span>
        </div>
      </div>

      {open && (
        <div className="vuln-body">

          {patch.explication && (
            <div className="vuln-section">
              <div className="section-label">⚠️ Explication</div>
              <p className="vuln-desc">{patch.explication}</p>
            </div>
          )}

          {patch.solution && (
            <div className="vuln-section">
              <div className="section-label">💡 Solution</div>
              <p className="vuln-desc">{patch.solution}</p>
            </div>
          )}

          {patch.code_vulnerable && (
            <div className="vuln-section">
              <div className="code-block-header danger-header">
                <span>❌ Code vulnérable</span>
                <CopyBtn text={patch.code_vulnerable}/>
              </div>
              <div className="code-window">
                <div className="code-titlebar">
                  <span className="dot r"/><span className="dot y"/><span className="dot g"/>
                  <span className="code-filename">{patch.fichier||"code_vulnerable"}</span>
                </div>
                <pre className="fix-code danger-code">{patch.code_vulnerable}</pre>
              </div>
            </div>
          )}

          {patch.code_corrige && (
            <div className="vuln-section">
              <div className="code-block-header success-header">
                <span>✅ Code corrigé — généré par IA</span>
                <CopyBtn text={patch.code_corrige}/>
              </div>
              <div className="code-window">
                <div className="code-titlebar">
                  <span className="dot r"/><span className="dot y"/><span className="dot g"/>
                  <span className="code-filename">{patch.fichier||"code_corrige"}</span>
                </div>
                <pre className="fix-code success-code">{patch.code_corrige}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   PAGE HISTORIQUE
───────────────────────────────────────── */
function HistoryPage({ onSelect, onBack }) {
  const [history, setHistory] = useState(loadHistory());
  const scoreColor = s => s < 40 ? "#ff4d6d" : s < 70 ? "#ff8c42" : "#06d6a0";

  const clearAll = () => { saveHistory([]); setHistory([]); };
  const deleteOne = id => {
    const updated = history.filter(h => h.scan_id !== id);
    saveHistory(updated); setHistory(updated);
  };

  return (
    <div className="history-page fade-in">
      <div className="history-header">
        <div>
          <h2 className="history-title">Historique des scans</h2>
          <p className="history-sub">{history.length} scan(s) sauvegardé(s)</p>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn-outline" onClick={onBack}>← Retour</button>
          {history.length > 0 && <button className="btn-danger" onClick={clearAll}>Tout effacer</button>}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconHistory size={32}/></div>
          <div className="empty-title">AUCUN HISTORIQUE</div>
          <p className="empty-sub">Vos scans apparaîtront ici après chaque analyse.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map(entry => (
            <div key={entry.scan_id} className="history-card">
              <div className="hc-left" onClick={()=>onSelect(entry)}>
                <div className="hc-score" style={{color:scoreColor(entry.score)}}>
                  {entry.score}<span>/100</span>
                </div>
                <div>
                  <div className="hc-url">{entry.url}</div>
                  <div className="hc-meta">
                    {entry.generated_at && <span>📅 {new Date(entry.generated_at).toLocaleString("fr-FR")}</span>}
                    <span>🐛 {entry.total_patches} vulnérabilité(s)</span>
                    <span className="hc-id">{entry.scan_id}</span>
                  </div>
                  <div className="hc-badges">
                    {Object.entries(entry.stats||{}).map(([k,v]) => v > 0 ? (
                      <span key={k} className="hc-badge" style={{color:SEV[k]?.color, borderColor:SEV[k]?.color+"40", background:SEV[k]?.bg}}>
                        {v} {k}
                      </span>
                    ) : null)}
                  </div>
                </div>
              </div>
              <button className="btn-icon" onClick={()=>deleteOne(entry.scan_id)}><IconTrash/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   HEADER
───────────────────────────────────────── */
function Header({ page, setPage }) {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-icon"><IconShield/></div>
        <div className="logo-text">SECURE<span>SCAN</span></div>
      </div>
      <nav className="nav">
        <button className={`nav-link ${page==="dashboard"?"active":""}`} onClick={()=>setPage("dashboard")}>
          Dashboard
        </button>
        <button className={`nav-link ${page==="history"?"active":""}`} onClick={()=>setPage("history")}>
          <IconHistory size={13}/> Historique
        </button>
      </nav>
      <div className="status-pill">
        <span className="status-dot"/>SYSTÈME OPÉRATIONNEL
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────
   APP PRINCIPALE
───────────────────────────────────────── */
export default function App() {
  const [page,     setPage]     = useState("dashboard");
  const [url,      setUrl]      = useState("");
  const [urlError, setUrlError] = useState("");
  const [apiError, setApiError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIdx,  setStepIdx]  = useState(0);
  const [report,   setReport]   = useState(null);
  const [tab,      setTab]      = useState("vulns");

  const STEPS = ["Connexion","Crawling","Détection","Analyse IA","Rapport"];

  const handleScan = async () => {
    // 1. Validation URL (React, avant Flask)
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setUrlError(""); setApiError(""); setReport(null);
    setScanning(true); setProgress(0); setStepIdx(0);

    // 2. Animation steps en parallèle
    const animSteps = async () => {
      const targets = [12, 30, 52, 74, 92];
      for (let i = 0; i < targets.length; i++) {
        setStepIdx(i);
        await new Promise(r=>setTimeout(r,700));
        setProgress(targets[i]);
      }
    };
    const anim = animSteps();

    try {
      // 3. Appel Flask réel
      const res  = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      await anim;
      setProgress(100);

      if (!res.ok) {
        setApiError(data.error || "Erreur lors du scan.");
        setScanning(false); return;
      }

      // 4. Traitement du vrai JSON de l'équipier
      const patches = data.patches || [];
      const score   = computeScore(patches);
      const stats   = computeStats(patches);

      const reportData = {
        scan_id:       data.scan_id,
        url:           url.trim(),
        generated_at:  data.generated_at,
        score,
        stats,
        total_patches: data.total_patches ?? patches.length,
        patches,
      };

      setReport(reportData);
      setTab("vulns");

      // 5. Sauvegarde historique
      addToHistory(reportData);

    } catch {
      await anim;
      setApiError(`Impossible de contacter Flask — vérifiez que le serveur tourne sur ${API_URL}`);
    }
    setScanning(false);
  };

  const loadFromHistory = (entry) => {
    setReport(entry);
    setUrl(entry.url);
    setPage("dashboard");
    setTab("vulns");
  };

  // Métriques calculées sur données réelles
  const scoreColor   = !report ? "#fff" : report.score<40 ? "#ff4d6d" : report.score<70 ? "#ff8c42" : "#06d6a0";
  const scoreVerdict = !report ? "" : report.score<40 ? "CRITIQUE" : report.score<70 ? "MODÉRÉ" : "BON";
  const total        = report ? Object.values(report.stats).reduce((a,b)=>a+b,0) : 0;
  const maxStat      = report ? Math.max(...Object.values(report.stats),1) : 1;

  /* ── Page Historique ── */
  if (page === "history") return (
    <div className="app">
      <div className="aurora"/><div className="mesh-grid"/>
      <Header page={page} setPage={setPage}/>
      <main className="main">
        <HistoryPage onSelect={loadFromHistory} onBack={()=>setPage("dashboard")}/>
      </main>
    </div>
  );

  /* ── Page Dashboard ── */
  return (
    <div className="app">
      <div className="aurora"/>
      <div className="mesh-grid"/>
      <div className="scanline"/>
      <Header page={page} setPage={setPage}/>

      <main className="main">

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-eyebrow">Outil d'audit de sécurité web · Powered by AI</div>
          <h1 className="hero-title">
            ANALYSE DE<span className="hl"> VULNÉRABILITÉS</span><br/>AUTOMATISÉE
          </h1>
          <p className="hero-sub">
            Entrez l'URL de votre site cible. Le scanner détecte les vulnérabilités
            et l'IA génère les correctifs en temps réel.
          </p>

          {/* URL INPUT */}
          <div className={`url-wrapper ${urlError?"has-error":""}`}>
            <div className="url-prefix">TARGET URL</div>
            <input
              className="url-input"
              type="text"
              placeholder="https://votre-site.com"
              value={url}
              onChange={e=>{ setUrl(e.target.value); setUrlError(""); setApiError(""); }}
              onKeyDown={e=>e.key==="Enter" && handleScan()}
              disabled={scanning}
            />
            <button className={`scan-btn ${scanning?"scanning":""}`} onClick={handleScan} disabled={scanning}>
              {scanning ? <><span className="spinner"/>ANALYSE...</> : <><IconBug size={17}/>LANCER LE SCAN</>}
            </button>
          </div>

          {/* Messages d'erreur */}
          {urlError && <div className="error-msg">⚠️ {urlError}</div>}
          {apiError && !scanning && <div className="error-msg error-api">🔴 {apiError}</div>}

          {/* PROGRESS BAR */}
          {scanning && (
            <div className="prog-wrap fade-in">
              <div className="prog-steps">
                {STEPS.map((s,i)=>(
                  <div key={s} className={`p-step ${i<stepIdx?"done":i===stepIdx?"active":""}`}>
                    <div className="ps-dot"/><span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{width:`${progress}%`}}>
                  <div className="prog-shine"/>
                </div>
              </div>
              <div className="prog-pct">{progress}% — Analyse en cours...</div>
            </div>
          )}
        </section>

        {/* ── EMPTY STATE ── */}
        {!report && !scanning && (
          <div className="empty-state">
            <div className="empty-icon"><IconShield/></div>
            <div className="empty-title">EN ATTENTE DE SCAN</div>
            <p className="empty-sub">
              Entrez une URL valide ci-dessus et lancez l'analyse pour voir le rapport complet.
            </p>
          </div>
        )}

        {/* ── RAPPORT RÉEL ── */}
        {report && (
          <section className="report fade-in">

            {/* Topbar */}
            <div className="report-topbar">
              <div>
                <div className="rtb-lbl">URL analysée · {report.scan_id}</div>
                <div className="rtb-url">{report.url}</div>
              </div>
              <div className="rtb-right">
                <div className="rtb-lbl">Généré le</div>
                <div className="rtb-time">
                  {report.generated_at
                    ? new Date(report.generated_at).toLocaleString("fr-FR")
                    : new Date().toLocaleString("fr-FR")}
                </div>
              </div>
            </div>

            {/* Score + Tiles */}
            <div className="metrics-row">
              <div className="score-panel">
                <div className="sp-label">SECURITY SCORE</div>
                <div className="score-ring-wrap">
                  <ScoreRing score={report.score} color={scoreColor}/>
                  <div className="score-center">
                    <div className="sp-num" style={{color:scoreColor}}>{report.score}</div>
                    <div className="sp-verdict" style={{color:scoreColor}}>{scoreVerdict}</div>
                  </div>
                </div>
                <div className="sp-bar-track">
                  <div className="sp-bar-fill" style={{width:`${report.score}%`,background:scoreColor}}/>
                </div>
              </div>

              <div className="sev-tiles">
                {Object.entries(report.stats).map(([k,v])=>(
                  <div className="sev-tile" key={k} style={{"--tc":SEV[k]?.color,"--tg":SEV[k]?.glow}}>
                    <div className="st-glow"/>
                    <div className="sev-count">{v}</div>
                    <div className="sev-name">{k}</div>
                    <div className="st-bar" style={{background:SEV[k]?.color}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="charts-row">
              <div className="chart-panel">
                <div className="panel-title">Répartition par sévérité</div>
                <div className="hbar-list">
                  {Object.entries(report.stats).map(([k,v])=>(
                    <div className="hbar-item" key={k}>
                      <div className="hbar-lbl">{k}</div>
                      <div className="hbar-track">
                        <div className="hbar-fill" style={{
                          width:`${(v/maxStat)*100}%`,
                          background:SEV[k]?.color||"#4cc9f0",
                          boxShadow:`0 0 8px ${SEV[k]?.glow}`
                        }}/>
                      </div>
                      <div className="hbar-val" style={{color:SEV[k]?.color}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="donut-panel">
                <div className="panel-title">Distribution</div>
                <div className="donut-wrap">
                  <Donut stats={report.stats}/>
                  <div className="donut-inner">
                    <div className="donut-total">{total}</div>
                    <div className="donut-sub">vulnérabilités</div>
                  </div>
                </div>
                <div className="donut-legend">
                  {Object.entries(report.stats).map(([k,v])=>(
                    <div className="dl-item" key={k}>
                      <div className="dl-left">
                        <div className="dl-dot" style={{background:SEV[k]?.color}}/>
                        <span className="dl-name">{k}</span>
                      </div>
                      <span className="dl-cnt" style={{color:SEV[k]?.color}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button className={`tab-btn ${tab==="vulns"?"active":""}`} onClick={()=>setTab("vulns")}>
                <IconBug/> Vulnérabilités ({report.total_patches})
              </button>
              <button className={`tab-btn ${tab==="fixes"?"active":""}`} onClick={()=>setTab("fixes")}>
                <IconCode/> Correctifs IA
              </button>
            </div>

            {/* Vulnérabilités */}
            {tab==="vulns" && (
              <div className="vuln-list">
                {report.patches.length===0
                  ? <div className="empty-state" style={{padding:"40px 0"}}>
                      <div className="empty-title" style={{fontSize:"1.2rem"}}>✅ Aucune vulnérabilité détectée</div>
                    </div>
                  : report.patches.map((p,i)=>(
                      <VulnCard key={p.vuln_id||i} patch={p} index={i}/>
                    ))
                }
              </div>
            )}

            {/* Correctifs IA */}
            {tab==="fixes" && (
              <div className="fixes-list">
                {report.patches.map((p,i)=>{
                  const sev=SEV[p.severity?.toUpperCase()]||SEV.INFO;
                  return (
                    <div key={p.vuln_id||i} className="fix-block fade-in" style={{animationDelay:`${i*0.06}s`}}>
                      <div className="fix-block-head" style={{borderLeft:`3px solid ${sev.color}`}}>
                        <div>
                          <div className="fb-title">{p.type}</div>
                          <div className="fb-ep">{p.fichier}{p.champ?` — ${p.champ}`:""}</div>
                        </div>
                        <span className="sev-badge" style={{color:sev.color,borderColor:sev.color+"40",background:sev.bg}}>
                          {sev.label}
                        </span>
                        {p.code_corrige && <CopyBtn text={p.code_corrige}/>}
                      </div>
                      {p.code_corrige
                        ? <div className="code-window">
                            <div className="code-titlebar">
                              <span className="dot r"/><span className="dot y"/><span className="dot g"/>
                              <span className="code-filename">{p.fichier||"fix"}</span>
                            </div>
                            <pre className="fix-code success-code">{p.code_corrige}</pre>
                          </div>
                        : <div style={{padding:"16px 20px",color:"var(--muted)",fontSize:"0.82rem"}}>
                            {p.solution||"Voir la description de la vulnérabilité."}
                          </div>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}