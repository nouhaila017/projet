import React, { useState, useEffect } from "react";
import "./App.css";
import { jsPDF } from "jspdf";

/* ════════════════════════════════════════════════════════════
   CONFIGURATION GLOBALE
   → Changer API_URL si Flask tourne sur un autre port/route
════════════════════════════════════════════════════════════ */
const API_URL = "http://localhost:5000/scan";

/* ════════════════════════════════════════════════════════════
   GÉNÉRATION PDF (jsPDF)
   → Rapport professionnel fond blanc
   → Page 1 : couverture + infos + score
   → Page 2 : résumé exécutif + tableau récapitulatif
   → Pages suivantes : une page par vulnérabilité avec
     code vulnérable (rouge) et code corrigé (vert)
════════════════════════════════════════════════════════════ */
function generatePDF(scan) {
  const doc     = new jsPDF();
  const patches = scan.patches || [];
  const W       = doc.internal.pageSize.getWidth();
  const MARGIN  = 18;
  const CW      = W - MARGIN * 2;

  const scoreCol = scan.score < 40 ? [192,0,0] : scan.score < 70 ? [180,95,0] : [0,128,80];
  const verdict  = scan.score < 40 ? "CRITIQUE" : scan.score < 70 ? "MODÉRÉ" : "BON";

  const sevMeta = {
    CRITICAL: { label: "Critique", col: [192,0,0]   },
    HIGH:     { label: "Élevé",    col: [180,95,0]  },
    MEDIUM:   { label: "Moyen",    col: [160,130,0] },
    LOW:      { label: "Faible",   col: [0,128,80]  },
    INFO:     { label: "Info",     col: [30,80,180] },
  };

  let pageNum = 0;

  const newPage = () => {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    doc.setFillColor(255,255,255); doc.rect(0, 0, W, 297, "F");
    doc.setFillColor(26,60,140);   doc.rect(0, 0, W, 10, "F");
    doc.setFontSize(8); doc.setTextColor(255,255,255); doc.setFont("helvetica","normal");
    doc.text(`Page ${pageNum}`, W - MARGIN, 7, { align: "right" });
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
    doc.line(MARGIN, 284, W - MARGIN, 284);
    doc.setFontSize(7.5); doc.setTextColor(150,150,150);
    doc.text("SecureScan AI — Rapport confidentiel d'analyse de sécurité", MARGIN, 290);
    doc.text(new Date().toLocaleDateString("fr-FR"), W - MARGIN, 290, { align: "right" });
    return 20;
  };

  const checkY = (y, needed = 20) => {
    if (y + needed > 278) {
      y = newPage();
      doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text("(suite)", MARGIN, y); y += 8;
    }
    return y;
  };

  const sectionTitle = (y, text) => {
    doc.setFillColor(240,244,255); doc.rect(MARGIN, y, CW, 8, "F");
    doc.setFillColor(26,60,140);   doc.rect(MARGIN, y, 3, 8, "F");
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(26,60,140);
    doc.text(text.toUpperCase(), MARGIN + 7, y + 5.5);
    return y + 14;
  };

  const labelVal = (y, key, value) => {
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(80,80,80);
    doc.text(key, MARGIN, y);
    doc.setFont("helvetica","normal"); doc.setTextColor(20,20,20);
    const lines = doc.splitTextToSize(value || "—", CW - 45);
    doc.text(lines, MARGIN + 45, y);
    return y + lines.length * 5 + 3;
  };

  const codeBlock = (y, code, borderCol) => {
    const lines = doc.splitTextToSize(code, CW - 10);
    const boxH  = lines.length * 4.8 + 8;
    y = checkY(y, boxH + 6);
    doc.setFillColor(248,249,250); doc.roundedRect(MARGIN, y, CW, boxH, 1, 1, "F");
    doc.setDrawColor(...borderCol); doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN, y + boxH);
    doc.setLineWidth(0.2); doc.setDrawColor(220,220,220);
    doc.roundedRect(MARGIN, y, CW, boxH, 1, 1, "S");
    doc.setFont("courier","normal"); doc.setFontSize(7.5); doc.setTextColor(40,40,40);
    doc.text(lines, MARGIN + 5, y + 6);
    return y + boxH + 6;
  };

  // PAGE 1 : COUVERTURE
  let y = newPage();
  doc.setFontSize(22); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20);
  doc.text("Rapport d'Analyse de Sécurité Web", MARGIN, y + 12);
  doc.setFontSize(11); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
  doc.text("Généré automatiquement par SecureScan AI", MARGIN, y + 20);
  doc.setDrawColor(26,60,140); doc.setLineWidth(1);
  doc.line(MARGIN, y + 26, W - MARGIN, y + 26);
  y += 34;

  const infoRows = [
    ["URL analysée",   scan.url || "—"],
    ["Date du scan",   scan.generated_at ? new Date(scan.generated_at).toLocaleString("fr-FR") : new Date().toLocaleString("fr-FR")],
    ["Identifiant",    scan.scan_id || "—"],
    ["Vulnérabilités", `${patches.length} détectée(s)`],
  ];
  infoRows.forEach(([k, v], i) => {
    if (i % 2 === 0) { doc.setFillColor(248,249,252); doc.rect(MARGIN, y - 3, CW, 11, "F"); }
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(80,80,80);
    doc.text(k, MARGIN + 3, y + 4);
    doc.setFont("helvetica","normal"); doc.setTextColor(20,20,20);
    doc.text(doc.splitTextToSize(v, CW - 60), MARGIN + 58, y + 4);
    y += 12;
  });
  y += 10;

  doc.setDrawColor(220,220,220); doc.setLineWidth(0.3); doc.rect(MARGIN, y, CW, 34, "S");
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(80,80,80);
  doc.text("SCORE DE SÉCURITÉ GLOBAL", MARGIN + 5, y + 8);
  doc.setFillColor(225,225,225); doc.roundedRect(MARGIN + 5, y + 12, 100, 7, 1, 1, "F");
  doc.setFillColor(...scoreCol); doc.roundedRect(MARGIN + 5, y + 12, scan.score, 7, 1, 1, "F");
  doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.setTextColor(...scoreCol);
  doc.text(`${scan.score} / 100`, MARGIN + 115, y + 18);
  doc.setFontSize(9); doc.setTextColor(...scoreCol);
  doc.text(`Niveau : ${verdict}`, MARGIN + 115, y + 27);
  y += 44;

  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20);
  doc.text("Répartition des vulnérabilités :", MARGIN, y); y += 8;
  Object.entries(sevMeta).forEach(([k, meta]) => {
    doc.setFillColor(...meta.col); doc.circle(MARGIN + 3, y + 2, 2.5, "F");
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
    doc.text(`${meta.label} :`, MARGIN + 9, y + 5);
    doc.setFont("helvetica","bold"); doc.setTextColor(...meta.col);
    doc.text(`${scan.stats?.[k] || 0}`, MARGIN + 48, y + 5);
    y += 9;
  });

  // PAGE 2 : RÉSUMÉ + TABLEAU
  y = newPage();
  y = sectionTitle(y, "Résumé exécutif");
  const reco = scan.score < 40
    ? "Des vulnérabilités critiques ont été détectées. Une correction immédiate est fortement recommandée avant toute exposition publique du site."
    : scan.score < 70
    ? "Des risques modérés ont été identifiés. Il est conseillé de traiter ces vulnérabilités rapidement afin de réduire la surface d'attaque."
    : "Le site présente un niveau de sécurité satisfaisant. Continuez à surveiller régulièrement et appliquez les bonnes pratiques.";
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
  const recoLines = doc.splitTextToSize(reco, CW);
  doc.text(recoLines, MARGIN, y); y += recoLines.length * 5 + 12;

  y = sectionTitle(y, "Tableau récapitulatif des vulnérabilités");
  doc.setFillColor(26,60,140); doc.rect(MARGIN, y, CW, 9, "F");
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
  doc.text("N°", MARGIN+2, y+6); doc.text("Type", MARGIN+14, y+6);
  doc.text("Fichier", MARGIN+68, y+6); doc.text("Champ", MARGIN+108, y+6);
  doc.text("Sévérité", MARGIN+146, y+6);
  y += 9;
  patches.forEach((p, i) => {
    y = checkY(y, 10);
    if (i % 2 === 0) { doc.setFillColor(248,249,252); doc.rect(MARGIN, y, CW, 9, "F"); }
    const meta = sevMeta[p.severity?.toUpperCase()] || sevMeta.INFO;
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
    doc.text(`${i+1}`, MARGIN+2, y+6);
    doc.text(doc.splitTextToSize(p.type||"—",52)[0], MARGIN+14, y+6);
    doc.text(doc.splitTextToSize(p.fichier||"—",36)[0], MARGIN+68, y+6);
    doc.text(doc.splitTextToSize(p.champ||"—",34)[0], MARGIN+108, y+6);
    doc.setFont("helvetica","bold"); doc.setTextColor(...meta.col);
    doc.text(meta.label, MARGIN+146, y+6);
    y += 9;
  });

  // PAGES DÉTAIL : une page par vulnérabilité
  patches.forEach((patch, idx) => {
    y = newPage();
    const meta = sevMeta[patch.severity?.toUpperCase()] || sevMeta.INFO;
    doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20);
    doc.text(`${idx+1}. ${patch.type || "Vulnérabilité"}`, MARGIN, y + 4);
    const bW = 26, bX = W - MARGIN - bW;
    doc.setFillColor(...meta.col); doc.roundedRect(bX, y - 4, bW, 10, 2, 2, "F");
    doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
    doc.text(meta.label.toUpperCase(), bX + bW/2, y + 3, { align: "center" });
    doc.setDrawColor(220,220,220); doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 8, W - MARGIN, y + 8);
    y += 15;

    if (patch.fichier || patch.champ || patch.url) {
      y = sectionTitle(y, "Localisation");
      if (patch.fichier) y = labelVal(y, "Fichier :", patch.fichier);
      if (patch.champ)   y = labelVal(y, "Champ :",   patch.champ);
      if (patch.url)     y = labelVal(y, "URL :",     patch.url);
      y += 4;
    }
    if (patch.explication) {
      y = checkY(y, 30); y = sectionTitle(y, "Description");
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
      const lines = doc.splitTextToSize(patch.explication, CW);
      doc.text(lines, MARGIN, y); y += lines.length * 5 + 8;
    }
    if (patch.solution) {
      y = checkY(y, 30); y = sectionTitle(y, "Correctif recommandé");
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
      const lines = doc.splitTextToSize(patch.solution, CW);
      doc.text(lines, MARGIN, y); y += lines.length * 5 + 8;
    }
    if (patch.code_vulnerable) {
      y = checkY(y, 35); y = sectionTitle(y, "Code vulnérable");
      y = codeBlock(y, patch.code_vulnerable, [192,0,0]);
    }
    if (patch.code_corrige) {
      y = checkY(y, 35); y = sectionTitle(y, "Code corrigé — généré par IA");
      y = codeBlock(y, patch.code_corrige, [0,128,80]);
    }
  });

  const site = (scan.url||"scan").replace(/https?:\/\//,"").replace(/[^a-zA-Z0-9]/g,"_").slice(0,30);
  doc.save(`SecureScan_${site}_${new Date().toISOString().slice(0,10)}.pdf`);
}

/* ════════════════════════════════════════════════════════════
   CONFIGURATION DES NIVEAUX DE SÉVÉRITÉ
   → Doivent correspondre au champ "severity" retourné par Flask
════════════════════════════════════════════════════════════ */
const SEV = {
  CRITICAL: { color: "#ff4d6d", bg: "rgba(255,77,109,0.1)",  glow: "rgba(255,77,109,0.3)",  label: "CRITICAL" },
  HIGH:     { color: "#ff8c42", bg: "rgba(255,140,66,0.1)",  glow: "rgba(255,140,66,0.25)", label: "HIGH"     },
  MEDIUM:   { color: "#ffd166", bg: "rgba(255,209,102,0.1)", glow: "rgba(255,209,102,0.2)", label: "MEDIUM"   },
  LOW:      { color: "#06d6a0", bg: "rgba(6,214,160,0.1)",   glow: "rgba(6,214,160,0.2)",   label: "LOW"      },
  INFO:     { color: "#4cc9f0", bg: "rgba(76,201,240,0.1)",  glow: "rgba(76,201,240,0.2)",  label: "INFO"     },
};

/* ════════════════════════════════════════════════════════════
   CALCUL DU SCORE — COMPTAGE DES STATS — VALIDATION URL
════════════════════════════════════════════════════════════ */
function computeScore(patches) {
  const pts = { CRITICAL:25, HIGH:15, MEDIUM:8, LOW:3, INFO:1 };
  return Math.max(0, 100 - patches.reduce((acc, p) => acc + (pts[p.severity?.toUpperCase()]||0), 0));
}

function computeStats(patches) {
  const stats = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0, INFO:0 };
  patches.forEach(p => { const k = p.severity?.toUpperCase(); if (k in stats) stats[k]++; });
  return stats;
}

function validateUrl(url) {
  if (!url.trim()) return "Veuillez entrer une URL.";
  if (!url.startsWith("http://") && !url.startsWith("https://"))
    return "L'URL doit commencer par http:// ou https://";
  try {
    const p = new URL(url);
    if (!p.hostname || !p.hostname.includes(".")) return "Domaine invalide — exemple : https://mon-site.com";
    if (["localhost","127.0.0.1","0.0.0.0","::1"].some(l => p.hostname.startsWith(l)))
      return "Les adresses locales ne sont pas autorisées.";
  } catch { return "URL invalide — vérifiez le format."; }
  return null;
}

/* ════════════════════════════════════════════════════════════
   HISTORIQUE (localStorage) — 20 scans max, plus récent en premier
════════════════════════════════════════════════════════════ */
const LS_KEY       = "vulnscan_history";
const loadHistory  = ()      => { try { return JSON.parse(localStorage.getItem(LS_KEY))||[]; } catch { return []; } };
const saveHistory  = (list)  => localStorage.setItem(LS_KEY, JSON.stringify(list));
const addToHistory = (entry) => {
  const list = [entry, ...loadHistory().filter(h => h.scan_id !== entry.scan_id)].slice(0,20);
  saveHistory(list);
};

/* ════════════════════════════════════════════════════════════
   ICÔNES SVG — composants React légers, sans dépendance externe
════════════════════════════════════════════════════════════ */
const IconShield  = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" fill="url(#sg)"/>
    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <defs><linearGradient id="sg" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
      <stop stopColor="#3b82f6"/><stop offset="1" stopColor="#0ea5e9"/>
    </linearGradient></defs>
  </svg>
);
const IconBug     = ({ size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 3h6M9 3a3 3 0 0 0-3 3v1M9 3a3 3 0 0 1 3 3m3-3a3 3 0 0 1 3 3v1M12 6a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V9a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M6 10H3M21 10h-3M6 14H3M21 14h-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
const IconCode    = ({ size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <polyline points="16,18 22,12 16,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="8,6 2,12 8,18"   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
const IconCopy    = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

/* ════════════════════════════════════════════════════════════
   COMPOSANT : CopyBtn — bouton copie avec retour "Copié !" 2s
════════════════════════════════════════════════════════════ */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={`copy-btn ${copied?"copied":""}`} onClick={() => {
      navigator.clipboard.writeText(text||"");
      setCopied(true); setTimeout(()=>setCopied(false), 2000);
    }}>
      <IconCopy/> {copied ? "Copié !" : "Copier"}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPOSANT : Donut — graphique circulaire SVG par sévérité
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   COMPOSANT : ScoreRing — anneau SVG animé (rouge/orange/vert)
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   COMPOSANT : VulnCard
   → Carte accordéon par vulnérabilité
   → En déroulant : explication, solution, code vulnérable,
     code corrigé généré par IA
════════════════════════════════════════════════════════════ */
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
              {patch.fichier && <span className="vuln-file">{patch.fichier}</span>}
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
              <div className="section-label">Explication</div>
              <p className="vuln-desc">{patch.explication}</p>
            </div>
          )}
          {patch.solution && (
            <div className="vuln-section">
              <div className="section-label">Solution</div>
              <p className="vuln-desc">{patch.solution}</p>
            </div>
          )}
          {patch.code_vulnerable && (
            <div className="vuln-section">
              <div className="code-block-header danger-header">
                <span>Code vulnérable</span>
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
                <span>Code corrigé — généré par IA</span>
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

/* ════════════════════════════════════════════════════════════
   COMPOSANT : HistoryPage
   → 3 niveaux d'accordion :
     Niveau 1 : liste des scans (score, URL, date)
     Niveau 2 : liste des vulnérabilités du scan
     Niveau 3 : détail complet avec code vulnérable + corrigé
════════════════════════════════════════════════════════════ */
function HistoryPage({ onBack }) {
  const [history,  setHistory]  = useState(()=>{ try{return JSON.parse(localStorage.getItem(LS_KEY))||[];}catch{return [];} });
  const [openScan, setOpenScan] = useState(null);
  const [openVuln, setOpenVuln] = useState(null);
  const [copied,   setCopied]   = useState(null);

  const toggleScan = (id) => { setOpenScan(p=>p===id?null:id); setOpenVuln(null); };
  const toggleVuln = (id) => setOpenVuln(p=>p===id?null:id);
  const copyCode   = (text, id) => { navigator.clipboard.writeText(text||""); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const deleteOne  = (sid) => { const u=history.filter(h=>h.scan_id!==sid); localStorage.setItem(LS_KEY,JSON.stringify(u)); setHistory(u); if(openScan===sid)setOpenScan(null); };
  const clearAll   = () => { localStorage.removeItem(LS_KEY); setHistory([]); setOpenScan(null); };

  const scoreColor = s => s<40?"#ff4d6d":s<70?"#ff8c42":"#06d6a0";
  const sevColor   = s => ({CRITICAL:"#ff4d6d",HIGH:"#ff8c42",MEDIUM:"#ffd166",LOW:"#06d6a0",INFO:"#4cc9f0"})[s?.toUpperCase()]||"#4cc9f0";

  return (
    <div className="history-page">
      <div className="hist-header">
        <div>
          <h2 className="hist-title">Historique des scans</h2>
          <p className="hist-sub">{history.length} scan(s) sauvegardé(s)</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-back" onClick={onBack}>← Retour</button>
          {history.length>0 && <button className="btn-clear" onClick={clearAll}>Tout effacer</button>}
        </div>
      </div>

      {history.length===0 && (
        <div className="hist-empty">
          <div className="hist-empty-title">Aucun historique</div>
          <p className="hist-empty-sub">Vos scans apparaîtront ici automatiquement.</p>
        </div>
      )}

      <div className="hist-list">
        {history.map(scan => {
          const isOpen  = openScan===scan.scan_id;
          const patches = scan.patches||[];
          return (
            <div key={scan.scan_id} className={`hist-scan ${isOpen?"open":""}`}>
              <div className="hist-scan-head" onClick={()=>toggleScan(scan.scan_id)}>
                <div className="hsh-left">
                  <div className="hsh-score" style={{color:scoreColor(scan.score)}}>
                    {scan.score}<span>/100</span>
                  </div>
                  <div>
                    <div className="hsh-url">{scan.url}</div>
                    <div className="hsh-meta">
                      {scan.generated_at && <span>{new Date(scan.generated_at).toLocaleString("fr-FR")}</span>}
                      <span>{patches.length} vulnérabilité(s)</span>
                    </div>
                  </div>
                </div>
                <div className="hsh-right">
                  <button className="btn-pdf-sm" onClick={e=>{e.stopPropagation();generatePDF(scan);}} title="Exporter PDF">PDF</button>
                  <button className="btn-del"    onClick={e=>{e.stopPropagation();deleteOne(scan.scan_id);}}>✕</button>
                  <span className={`hist-chevron ${isOpen?"up":""}`}>▾</span>
                </div>
              </div>

              {isOpen && (
                <div className="hist-vulns">
                  {patches.length===0 && <div className="hist-no-vuln">Aucune vulnérabilité détectée</div>}
                  {patches.map((patch,i) => {
                    const vid    = `${scan.scan_id}-${i}`;
                    const isVOpen= openVuln===vid;
                    const color  = sevColor(patch.severity);
                    return (
                      <div key={vid} className={`hist-vuln ${isVOpen?"open":""}`}>
                        <div className="hist-vuln-head" onClick={()=>toggleVuln(vid)}>
                          <div className="hvh-left">
                            <div className="hvh-dot" style={{background:color, boxShadow:`0 0 6px ${color}`}}/>
                            <span className="hvh-type">{patch.type}</span>
                          </div>
                          <div className="hvh-right">
                            <span className="hvh-sev" style={{color, borderColor:color+"40", background:color+"15"}}>
                              {patch.severity?.toUpperCase()}
                            </span>
                            <span className={`hist-chevron small ${isVOpen?"up":""}`}>▾</span>
                          </div>
                        </div>

                        {isVOpen && (
                          <div className="hist-vuln-body">
                            {patch.explication && (
                              <div className="hvb-block">
                                <div className="hvb-label">Description</div>
                                <p className="hvb-text">{patch.explication}</p>
                              </div>
                            )}
                            {(patch.fichier||patch.champ) && (
                              <div className="hvb-block">
                                <div className="hvb-label">Où trouvé</div>
                                <div className="hvb-location">
                                  {patch.fichier && <span>{patch.fichier}</span>}
                                  {patch.champ   && <span>— champ : <strong>{patch.champ}</strong></span>}
                                </div>
                              </div>
                            )}
                            {patch.solution && (
                              <div className="hvb-block">
                                <div className="hvb-label">Correctif</div>
                                <p className="hvb-text">{patch.solution}</p>
                              </div>
                            )}
                            {patch.code_vulnerable && (
                              <div className="hvb-block">
                                <div className="hvb-code-head">
                                  <span className="hvb-label" style={{margin:0}}>Code vulnérable</span>
                                  <button className={`hvb-copy danger ${copied===vid+"-v"?"ok":""}`}
                                    onClick={()=>copyCode(patch.code_vulnerable, vid+"-v")}>
                                    {copied===vid+"-v"?"Copié !":"Copier"}
                                  </button>
                                </div>
                                <div className="hvb-code-window">
                                  <div className="hvb-titlebar">
                                    <span className="dot r"/><span className="dot y"/><span className="dot g"/>
                                    <span className="hvb-filename">{patch.fichier||"code_vulnerable"}</span>
                                  </div>
                                  <pre className="hvb-code hvb-code-danger">{patch.code_vulnerable}</pre>
                                </div>
                              </div>
                            )}
                            {patch.code_corrige && (
                              <div className="hvb-block">
                                <div className="hvb-code-head">
                                  <span className="hvb-label" style={{margin:0}}>Code corrigé — IA</span>
                                  <button className={`hvb-copy ${copied===vid?"ok":""}`}
                                    onClick={()=>copyCode(patch.code_corrige, vid)}>
                                    {copied===vid?"Copié !":"Copier"}
                                  </button>
                                </div>
                                <div className="hvb-code-window">
                                  <div className="hvb-titlebar">
                                    <span className="dot r"/><span className="dot y"/><span className="dot g"/>
                                    <span className="hvb-filename">{patch.fichier||"fix"}</span>
                                  </div>
                                  <pre className="hvb-code">{patch.code_corrige}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPOSANT : Header — navigation + toggle thème
════════════════════════════════════════════════════════════ */
function Header({ page, setPage, theme, setTheme }) {
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
      <button className="theme-toggle" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>
        {theme==="dark" ? "☀️ Mode clair" : "🌙 Mode sombre"}
      </button>
      <div className="status-pill">
        <span className="status-dot"/>SYSTÈME OPÉRATIONNEL
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL : App
   → Orchestre scan, rapport, navigation, thème
════════════════════════════════════════════════════════════ */
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

  const [theme, setTheme] = useState(()=>localStorage.getItem("vulnscan_theme")||"dark");
  useEffect(()=>{ document.body.setAttribute("data-theme",theme); localStorage.setItem("vulnscan_theme",theme); },[theme]);

  const STEPS = ["Connexion","Crawling","Détection","Analyse IA","Rapport"];

  const handleScan = async () => {
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setUrlError(""); setApiError(""); setReport(null);
    setScanning(true); setProgress(0); setStepIdx(0);

    // Animation de progression en parallèle de l'appel Flask
    const animSteps = async () => {
      for (let i=0; i<[12,30,52,74,92].length; i++) {
        setStepIdx(i); await new Promise(r=>setTimeout(r,700)); setProgress([12,30,52,74,92][i]);
      }
    };
    const anim = animSteps();

    try {
      // Appel POST vers Flask
      const res  = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      await anim; setProgress(100);

      // Erreur HTTP retournée par Flask
      if (!res.ok) {
        setApiError(data.error || "Erreur lors du scan.");
        setScanning(false); return;
      }

      // Traitement des données réelles retournées par Flask
      const patches = data.patches || [];
      const reportData = {
        scan_id:       data.scan_id,
        url:           url.trim(),
        generated_at:  data.generated_at,
        score:         computeScore(patches),
        stats:         computeStats(patches),
        total_patches: data.total_patches ?? patches.length,
        patches,
      };
      setReport(reportData);
      setTab("vulns");
      addToHistory(reportData);

    } catch {
      // Flask injoignable — affiche un message d'erreur clair
      await anim; setProgress(100);
      setApiError(`Impossible de contacter le serveur — vérifiez que Flask tourne sur ${API_URL}`);
    }
    setScanning(false);
  };

  const scoreColor   = !report?"#fff":report.score<40?"#ff4d6d":report.score<70?"#ff8c42":"#06d6a0";
  const scoreVerdict = !report?"":report.score<40?"CRITIQUE":report.score<70?"MODÉRÉ":"BON";
  const total        = report?Object.values(report.stats).reduce((a,b)=>a+b,0):0;
  const maxStat      = report?Math.max(...Object.values(report.stats),1):1;

  if (page==="history") return (
    <div className="app">
      <div className="aurora"/><div className="mesh-grid"/>
      <Header page={page} setPage={setPage} theme={theme} setTheme={setTheme}/>
      <main className="main"><HistoryPage onBack={()=>setPage("dashboard")}/></main>
    </div>
  );

  return (
    <div className="app">
      <div className="aurora"/>
      <div className="mesh-grid"/>
      <div className="scanline"/>
      <Header page={page} setPage={setPage} theme={theme} setTheme={setTheme}/>

      <main className="main">

        <section className="hero">
          <div className="hero-eyebrow">Outil d'audit de sécurité web · Powered by AI</div>
          <h1 className="hero-title">ANALYSE DE<span className="hl"> VULNÉRABILITÉS</span><br/>AUTOMATISÉE</h1>
          <p className="hero-sub">Entrez l'URL de votre site cible. Le scanner détecte les vulnérabilités et l'IA génère les correctifs en temps réel.</p>

          <div className={`url-wrapper ${urlError?"has-error":""}`}>
            <div className="url-prefix">TARGET URL</div>
            <input className="url-input" type="text" placeholder="https://votre-site.com"
              value={url} onChange={e=>{setUrl(e.target.value);setUrlError("");setApiError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleScan()} disabled={scanning}/>
            <button className={`scan-btn ${scanning?"scanning":""}`} onClick={handleScan} disabled={scanning}>
              {scanning?<><span className="spinner"/>ANALYSE...</>:<><IconBug size={17}/>LANCER LE SCAN</>}
            </button>
          </div>

          {urlError && <div className="error-msg">Attention : {urlError}</div>}
          {apiError && !scanning && <div className="error-msg error-api">Erreur : {apiError}</div>}

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
                <div className="prog-fill" style={{width:`${progress}%`}}><div className="prog-shine"/></div>
              </div>
              <div className="prog-pct">{progress}% — Analyse en cours...</div>
            </div>
          )}
        </section>

        {!report && !scanning && (
          <div className="empty-state">
            <div className="empty-icon"><IconShield/></div>
            <div className="empty-title">EN ATTENTE DE SCAN</div>
            <p className="empty-sub">Entrez une URL valide ci-dessus et lancez l'analyse pour voir le rapport complet.</p>
          </div>
        )}

        {report && (
          <section className="report fade-in">

            <div className="report-topbar">
              <div>
                <div className="rtb-lbl">URL analysée · {report.scan_id}</div>
                <div className="rtb-url">{report.url}</div>
              </div>
              <div className="rtb-right">
                <div className="rtb-lbl">Généré le</div>
                <div className="rtb-time">
                  {report.generated_at?new Date(report.generated_at).toLocaleString("fr-FR"):new Date().toLocaleString("fr-FR")}
                </div>
                <button className="btn-pdf" onClick={()=>generatePDF(report)}>Exporter PDF</button>
              </div>
            </div>

            <div className="metrics-row">
              <div className="score-panel">
                <div className="sp-label">SECURITY SCORE</div>
                <div className="score-ring-wrap">
                  <ScoreRing score={report.score} color={scoreColor}/>
                  <div className="score-center">
                    <div className="sp-num"    style={{color:scoreColor}}>{report.score}</div>
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

            <div className="charts-row">
              <div className="chart-panel">
                <div className="panel-title">Répartition par sévérité</div>
                <div className="hbar-list">
                  {Object.entries(report.stats).map(([k,v])=>(
                    <div className="hbar-item" key={k}>
                      <div className="hbar-lbl">{k}</div>
                      <div className="hbar-track">
                        <div className="hbar-fill" style={{width:`${(v/maxStat)*100}%`,background:SEV[k]?.color||"#4cc9f0",boxShadow:`0 0 8px ${SEV[k]?.glow}`}}/>
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
                  {report.patches.map((p,i)=>{
                    const sev=SEV[p.severity?.toUpperCase()]||SEV.INFO;
                    return (
                      <div className="dl-item" key={i}>
                        <div className="dl-left">
                          <div className="dl-dot" style={{background:sev.color}}/>
                          <span className="dl-name">{p.type}</span>
                        </div>
                        <span className="dl-cnt" style={{color:sev.color}}>{sev.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="tabs">
              <button className={`tab-btn ${tab==="vulns"?"active":""}`} onClick={()=>setTab("vulns")}>
                <IconBug/> Vulnérabilités ({report.total_patches})
              </button>
              <button className={`tab-btn ${tab==="fixes"?"active":""}`} onClick={()=>setTab("fixes")}>
                <IconCode/> Correctifs IA
              </button>
            </div>

            {tab==="vulns" && (
              <div className="vuln-list">
                {report.patches.length===0
                  ? <div className="empty-state" style={{padding:"40px 0"}}>
                      <div className="empty-title" style={{fontSize:"1.2rem"}}>Aucune vulnérabilité détectée</div>
                    </div>
                  : report.patches.map((p,i)=><VulnCard key={p.vuln_id||i} patch={p} index={i}/>)
                }
              </div>
            )}

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
                      </div>
                      {p.code_vulnerable && (
                        <div>
                          <div className="code-block-header danger-header" style={{borderRadius:0,borderTop:"1px solid rgba(255,77,109,0.2)"}}>
                            <span>Code vulnérable</span>
                            <CopyBtn text={p.code_vulnerable}/>
                          </div>
                          <pre className="fix-code danger-code">{p.code_vulnerable}</pre>
                        </div>
                      )}
                      {p.code_corrige && (
                        <div>
                          <div className="code-block-header success-header" style={{borderRadius:0}}>
                            <span>Code corrigé — généré par IA</span>
                            <CopyBtn text={p.code_corrige}/>
                          </div>
                          <div className="code-window" style={{borderRadius:"0 0 var(--r) var(--r)"}}>
                            <div className="code-titlebar">
                              <span className="dot r"/><span className="dot y"/><span className="dot g"/>
                              <span className="code-filename">{p.fichier||"fix"}</span>
                            </div>
                            <pre className="fix-code success-code">{p.code_corrige}</pre>
                          </div>
                        </div>
                      )}
                      {!p.code_corrige && (
                        <div style={{padding:"16px 20px",color:"var(--muted)",fontSize:"0.82rem"}}>
                          {p.solution||"Voir la description de la vulnérabilité."}
                        </div>
                      )}
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