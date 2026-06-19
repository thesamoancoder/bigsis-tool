import { useState, useRef } from "react";

// ── Brand tokens ─────────────────────────────
const C = {
  navy:       "#1B2C4A",
  navyLight:  "#243A61",
  gold:       "#D4AF6A",
  goldLight:  "#F7F1E4",
  goldDark:   "#9A7A3A",
  ice:        "#E3ECF1",
  iceDark:    "#C2D5DF",
  white:      "#FFFFFF",
  bg:         "#F4F7F9",
  text:       "#1A1A2E",
  muted:      "#6B7A8D",
  success:    "#2E7D32",
  successBg:  "#E8F5E9",
  warn:       "#B45309",
  warnBg:     "#FEF3C7",
  danger:     "#C62828",
  dangerBg:   "#FFEBEE",
};

const STRATEGY_MAP = {
  "Errors & Inaccuracies":                { code: "S1", color: C.navy,    bg: "#E8EDF3", template: "Template 1" },
  "Declined – No Written Notice":         { code: "S2", color: "#5C3D8F", bg: "#F0EBFA", template: "Template 2" },
  "Hardship & Circumstances":             { code: "S3", color: C.goldDark, bg: C.goldLight, template: "Template 3" },
  "Payment for Removal":                  { code: "S4", color: C.success, bg: C.successBg, template: "Template 4" },
  "Account Audit":                        { code: "S5", color: "#0277BD", bg: "#E1F5FE", template: "Template 5" },
  "Monitor / No Action Needed":           { code: "OK", color: C.muted,   bg: "#F0F4F8", template: null },
};

// ── Helpers ──────────────────────────────────
function Badge({ strategy }) {
  const s = STRATEGY_MAP[strategy] || STRATEGY_MAP["Monitor / No Action Needed"];
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 700,
      padding: "2px 9px", borderRadius: 99,
      background: s.bg, color: s.color, letterSpacing: "0.04em"
    }}>{s.code}</span>
  );
}

function StatusDot({ status }) {
  const map = { flag: C.danger, warn: C.warn, ok: C.success };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: map[status] || C.muted, marginRight: 6, flexShrink: 0, marginTop: 4 }} />;
}

function Card({ children, style = {}, ...rest }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.iceDark}`,
      padding: "20px 24px", ...style
    }} {...rest}>{children}</div>
  );
}

function GoldBox({ label, children }) {
  return (
    <div style={{
      background: C.goldLight, borderLeft: `4px solid ${C.gold}`,
      borderRadius: "0 8px 8px 0", padding: "14px 18px", margin: "12px 0"
    }}>
      {label && <div style={{ fontWeight: 700, fontSize: 12, color: C.goldDark, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function NavyBox({ children }) {
  return (
    <div style={{
      background: C.navy, borderRadius: 10, padding: "16px 20px", margin: "12px 0"
    }}>
      <div style={{ fontSize: 13, color: C.ice, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// ── Main Component ───────────────────────────
export default function App() {
  const [step, setStep] = useState("upload"); // upload | analysing | results | tracker
  const [pdfText, setPdfText] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [trackerRows, setTrackerRows] = useState([]);
  const fileRef = useRef();

  // ── PDF read as base64 ──────────────────────
  async function handleFile(file) {
    if (!file || file.type !== "application/pdf") {
      setError("Please upload a PDF file. Credit reports from Equifax, Experian, and Centrix are all supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Please upload a PDF under 10MB.");
      return;
    }
    setError("");
    setFileName(file.name);

    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = () => rej(new Error("Could not read file"));
      r.readAsDataURL(file);
    });

    setStep("analysing");
    setProgress("Reading your credit file...");
    await analyseWithClaude(base64);
  }

  // ── Claude API call ─────────────────────────
  async function analyseWithClaude(base64) {
    try {
      setProgress("Extracting entries from your report...");

      const systemPrompt = `You are a credit file analyst for Big Sis Credit Hacks, an Australian and New Zealand credit repair service. You read credit reports and extract every listing into structured data.

You must respond ONLY with valid JSON — no preamble, no markdown fences, no explanation. Just the raw JSON object.

Extract all entries from the credit report and return this exact structure:

{
  "bureau": "Equifax AU / Experian AU / Centrix NZ / Equifax NZ / Experian NZ / Unknown",
  "reportDate": "DD/MM/YYYY or Unknown",
  "score": "number or Unknown",
  "scoreRange": "0-1200 or 0-1000 or Unknown",
  "summary": "2-3 sentence plain-English summary of what's on the file and the overall situation",
  "entries": [
    {
      "id": 1,
      "type": "Enquiry / Default / Judgement / Repayment History / Personal Detail Issue / Other",
      "lender": "Lender name",
      "dateListed": "DD/MM/YYYY or Unknown",
      "amount": "$X,XXX or Unknown or N/A",
      "bureau": "which bureau this entry appears on",
      "status": "flag / warn / ok",
      "statusReason": "Short plain-English reason for the status",
      "suggestedStrategy": "Errors & Inaccuracies / Declined – No Written Notice / Hardship & Circumstances / Payment for Removal / Account Audit / Monitor / No Action Needed",
      "strategyReason": "1-2 sentence plain-English explanation of why this strategy fits",
      "expiryDate": "DD/MM/YYYY or N/A",
      "expired": true or false,
      "notes": "Any additional observations — e.g. amount looks incorrect, duplicate entry, no written notice likely"
    }
  ],
  "topPriorities": [1, 2, 3],
  "quickWins": "Plain-English description of the 1-2 easiest entries to dispute first",
  "warnings": ["Any important warnings about the file as a whole"]
}

Status guide:
- "flag" = negative entry that should be disputed (defaults, judgements, unrecognised enquiries, expired entries, errors)
- "warn" = entry worth watching or querying (enquiries that may have had no written notice, older entries nearing expiry, entries with uncertain accuracy)
- "ok" = positive or neutral entry (on-time payments, entries that appear accurate and within date)

If the PDF does not appear to be a credit report, return:
{"error": "This does not appear to be a credit report. Please upload a credit file downloaded from Equifax, Experian, or Centrix."}

Be thorough. Extract every entry you can see. If information is partially visible or unclear, include the entry with what you can read and note the uncertainty.`;

      const response = await fetch("/.netlify/functions/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 }
              },
              {
                type: "text",
                text: "Please analyse this credit report and return the structured JSON as specified."
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      setProgress("Building your tracker...");

      const data = await response.json();
      const rawText = data.content?.find(b => b.type === "text")?.text || "";
      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      if (parsed.error) {
        setError(parsed.error);
        setStep("upload");
        return;
      }

      setAnalysis(parsed);

      // Build tracker rows from entries
      const rows = (parsed.entries || []).map(e => ({
        ...e,
        disputeSent: false,
        disputeDate: "",
        followUpDate: "",
        outcome: "Pending",
        notes2: "",
      }));
      setTrackerRows(rows);
      setStep("results");

    } catch (e) {
      console.error(e);
      setError("Something went wrong analysing your file. Please try again or check your internet connection.");
      setStep("upload");
    }
  }

  function updateRow(id, field, value) {
    setTrackerRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  // ── UPLOAD SCREEN ───────────────────────────
  if (step === "upload") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Arial', sans-serif" }}>
        {/* Header */}
        <div style={{ background: C.navy, padding: "0" }}>
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 24px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: C.navy }}>B</div>
              <div>
                <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Big Sis Credit Hacks</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.white, lineHeight: 1.1 }}>Credit File Analyser</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.ice, marginTop: 8, lineHeight: 1.5 }}>Upload your credit report PDF — the AI reads it, extracts every entry, and tells you exactly which strategy to use for each one.</div>
          </div>
        </div>

        <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>

          {/* Upload zone */}
          <Card style={{ border: `2px dashed ${C.iceDark}`, textAlign: "center", padding: "40px 24px", cursor: "pointer", transition: "border-color 0.2s" }}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Drop your credit report here</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>or click to browse — PDF files only</div>
            <div style={{ display: "inline-block", background: C.navy, color: C.white, padding: "10px 28px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>Choose File</div>
          </Card>

          {error && (
            <div style={{ background: C.dangerBg, border: `1px solid #FFCDD2`, borderRadius: 8, padding: "12px 16px", marginTop: 16, color: C.danger, fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <GoldBox label="Where to get your free credit report">
            Pull your report from every bureau — the same entry can appear differently across bureaus. All reports are free and checking them yourself has zero impact on your score.<br /><br />
            <strong>Australia:</strong> equifax.com.au · experian.com.au<br />
            <strong>New Zealand:</strong> equifax.co.nz · experian.co.nz · centrix.co.nz
          </GoldBox>

          <NavyBox>
            <strong style={{ color: C.gold }}>Your privacy:</strong> Your credit file is processed only to generate your analysis and is not stored anywhere. Nothing is saved after you close this window.
          </NavyBox>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>What this tool does</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["📋", "Extracts every entry", "Enquiries, defaults, judgements, accounts"],
                ["🎯", "Matches your strategy", "Tells you exactly which template to use"],
                ["⚠️", "Flags expired entries", "Entries that should have come off already"],
                ["✅", "Builds your tracker", "One place to manage every dispute"],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ background: C.white, border: `1px solid ${C.iceDark}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{title}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ANALYSING SCREEN ────────────────────────
  if (step === "analysing") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Arial', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>
            <span style={{ animation: "spin 1.5s linear infinite", display: "inline-block" }}>⚙️</span>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Analysing your credit file</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>{progress}</div>
          <div style={{ fontSize: 12, color: C.iceDark, marginTop: 8 }}>{fileName}</div>
          <GoldBox label="Did you know?">
            Credit providers are legally required to respond to disputes within 30 days in both Australia and New Zealand. That clock starts the moment you submit in writing.
          </GoldBox>
        </div>
      </div>
    );
  }

  // ── RESULTS + TRACKER ───────────────────────
  if ((step === "results" || step === "tracker") && analysis) {
    const flagged  = trackerRows.filter(r => r.status === "flag");
    const warning  = trackerRows.filter(r => r.status === "warn");
    const ok       = trackerRows.filter(r => r.status === "ok");
    const disputed = trackerRows.filter(r => r.disputeSent);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Arial', sans-serif" }}>

        {/* Header */}
        <div style={{ background: C.navy }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: C.navy }}>B</div>
                <div>
                  <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>Big Sis Credit Hacks</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>Credit File Analysis</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setStep("results")} style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: step === "results" ? C.gold : "transparent", color: step === "results" ? C.navy : C.ice }}>Analysis</button>
                <button onClick={() => setStep("tracker")} style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: step === "tracker" ? C.gold : "transparent", color: step === "tracker" ? C.navy : C.ice }}>Tracker ({disputed.length}/{trackerRows.length})</button>
                <button onClick={() => { setStep("upload"); setAnalysis(null); setFileName(""); setError(""); }} style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid rgba(255,255,255,0.2)`, cursor: "pointer", fontSize: 13, color: C.ice, background: "transparent" }}>New File</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 48px" }}>

          {/* ── ANALYSIS TAB ── */}
          {step === "results" && (
            <>
              {/* Score + summary row */}
              <div style={{ display: "grid", gridTemplateColumns: analysis.score !== "Unknown" ? "160px 1fr" : "1fr", gap: 14, marginBottom: 20 }}>
                {analysis.score !== "Unknown" && (
                  <Card style={{ textAlign: "center", padding: "20px 16px" }}>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Credit Score</div>
                    <div style={{ fontSize: 44, fontWeight: 800, color: C.navy, lineHeight: 1 }}>{analysis.score}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>out of {analysis.scoreRange}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{analysis.bureau}</div>
                  </Card>
                )}
                <Card>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Summary</div>
                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>{analysis.summary}</div>
                  {analysis.quickWins && (
                    <div style={{ background: C.successBg, borderLeft: `3px solid ${C.success}`, borderRadius: "0 6px 6px 0", padding: "10px 14px", fontSize: 13, color: "#1B5E20" }}>
                      <strong>Quick wins:</strong> {analysis.quickWins}
                    </div>
                  )}
                </Card>
              </div>

              {/* Stats bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Flagged", count: flagged.length, color: C.danger, bg: C.dangerBg },
                  { label: "Watch", count: warning.length, color: C.warn, bg: C.warnBg },
                  { label: "OK", count: ok.length, color: C.success, bg: C.successBg },
                  { label: "Total entries", count: trackerRows.length, color: C.navy, bg: C.ice },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {analysis.warnings?.length > 0 && (
                <div style={{ background: C.warnBg, border: `1px solid #FCD34D`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.warn, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚠️ Important Notices</div>
                  {analysis.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#78350F", marginBottom: 4 }}>• {w}</div>
                  ))}
                </div>
              )}

              {/* Entries */}
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>All Entries</div>

              {/* Strategy legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {Object.entries(STRATEGY_MAP).slice(0, 5).map(([name, s]) => (
                  <span key={name} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color, fontWeight: 600 }}>{s.code} — {name}</span>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {trackerRows.map(entry => (
                  <Card key={entry.id} style={{ borderLeft: `4px solid ${entry.status === "flag" ? C.danger : entry.status === "warn" ? C.gold : C.success}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <StatusDot status={entry.status} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{entry.lender}</span>
                          <span style={{ fontSize: 12, color: C.muted, background: C.bg, padding: "2px 8px", borderRadius: 6 }}>{entry.type}</span>
                          {entry.expired && <span style={{ fontSize: 11, background: C.dangerBg, color: C.danger, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>EXPIRED</span>}
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.muted, flexWrap: "wrap", marginBottom: 8 }}>
                          {entry.dateListed !== "Unknown" && <span>Listed: {entry.dateListed}</span>}
                          {entry.amount && entry.amount !== "N/A" && entry.amount !== "Unknown" && <span>Amount: {entry.amount}</span>}
                          {entry.expiryDate && entry.expiryDate !== "N/A" && <span>Expires: {entry.expiryDate}</span>}
                          <span>Bureau: {entry.bureau}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}><strong style={{ color: C.navy }}>Status:</strong> {entry.statusReason}</div>
                        {entry.suggestedStrategy !== "Monitor / No Action Needed" && (
                          <div style={{ fontSize: 13, color: "#444" }}><strong style={{ color: C.navy }}>Strategy:</strong> {entry.strategyReason}</div>
                        )}
                        {entry.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontStyle: "italic" }}>💡 {entry.notes}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <Badge strategy={entry.suggestedStrategy} />
                        {STRATEGY_MAP[entry.suggestedStrategy]?.template && (
                          <span style={{ fontSize: 11, color: C.goldDark, background: C.goldLight, padding: "2px 8px", borderRadius: 6 }}>
                            Use {STRATEGY_MAP[entry.suggestedStrategy].template}
                          </span>
                        )}
                        {analysis.topPriorities?.includes(entry.id) && (
                          <span style={{ fontSize: 11, color: C.success, background: C.successBg, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>⭐ Priority</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <button onClick={() => setStep("tracker")} style={{ width: "100%", padding: "14px", background: C.navy, color: C.white, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Open My Dispute Tracker →
                </button>
              </div>
            </>
          )}

          {/* ── TRACKER TAB ── */}
          {step === "tracker" && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Your Dispute Tracker</div>
                <div style={{ fontSize: 13, color: C.muted }}>Tick off disputes as you send them. Track your 30-day deadlines and outcomes below.</div>
              </div>

              {/* Progress bar */}
              <Card style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 8 }}>
                  <span>Disputes sent</span>
                  <span style={{ fontWeight: 700, color: C.navy }}>{disputed.length} of {trackerRows.filter(r => r.status !== "ok").length}</span>
                </div>
                <div style={{ height: 8, background: C.bg, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: `linear-gradient(90deg, ${C.navy}, ${C.gold})`, borderRadius: 99, width: `${trackerRows.filter(r => r.status !== "ok").length > 0 ? (disputed.length / trackerRows.filter(r => r.status !== "ok").length) * 100 : 0}%`, transition: "width 0.4s" }} />
                </div>
              </Card>

              <GoldBox label="Golden Rule">
                Always use the complaints portal on the lender's website — not a generic contact form. It creates an automatic timestamp and starts your 30-day legal clock from the moment you submit.
              </GoldBox>

              {/* Tracker rows — flagged first, then warn, then ok */}
              {["flag", "warn", "ok"].map(statusGroup => {
                const groupRows = trackerRows.filter(r => r.status === statusGroup);
                if (groupRows.length === 0) return null;
                const groupLabel = { flag: "🔴 Dispute These", warn: "🟡 Worth Reviewing", ok: "🟢 Looking Good" }[statusGroup];
                return (
                  <div key={statusGroup} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{groupLabel}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {groupRows.map(row => (
                        <Card key={row.id} style={{ opacity: row.outcome === "Removed ✅" ? 0.6 : 1, transition: "opacity 0.3s" }}>
                          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                            {/* Checkbox */}
                            <div
                              onClick={() => updateRow(row.id, "disputeSent", !row.disputeSent)}
                              style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${row.disputeSent ? C.navy : C.iceDark}`, background: row.disputeSent ? C.navy : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              {row.disputeSent && <span style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>✓</span>}
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{row.lender}</span>
                                <Badge strategy={row.suggestedStrategy} />
                                {STRATEGY_MAP[row.suggestedStrategy]?.template && (
                                  <span style={{ fontSize: 11, color: C.goldDark }}>{STRATEGY_MAP[row.suggestedStrategy].template}</span>
                                )}
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 8 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Date Sent</div>
                                  <input
                                    type="date"
                                    value={row.disputeDate}
                                    onChange={e => updateRow(row.id, "disputeDate", e.target.value)}
                                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.iceDark}`, fontSize: 13, fontFamily: "Arial", color: C.text, background: C.white, boxSizing: "border-box" }}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>30-Day Follow-Up</div>
                                  <input
                                    type="date"
                                    value={row.followUpDate}
                                    onChange={e => updateRow(row.id, "followUpDate", e.target.value)}
                                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.iceDark}`, fontSize: 13, fontFamily: "Arial", color: C.text, background: C.white, boxSizing: "border-box" }}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Outcome</div>
                                  <select
                                    value={row.outcome}
                                    onChange={e => updateRow(row.id, "outcome", e.target.value)}
                                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.iceDark}`, fontSize: 13, fontFamily: "Arial", color: C.text, background: C.white, boxSizing: "border-box" }}
                                  >
                                    {["Pending", "Sent — Awaiting Response", "Removed ✅", "Declined — Escalating", "Declined — Final", "In Negotiation"].map(o => (
                                      <option key={o}>{o}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div style={{ marginTop: 8 }}>
                                <input
                                  type="text"
                                  placeholder="Notes (reference number, what they said, next step…)"
                                  value={row.notes2}
                                  onChange={e => updateRow(row.id, "notes2", e.target.value)}
                                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.iceDark}`, fontSize: 13, fontFamily: "Arial", color: C.text, background: C.white, boxSizing: "border-box" }}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}

              <NavyBox>
                <strong style={{ color: C.gold }}>Escalation path reminder:</strong> If no response in 30 days → use Escalation Script 1. If declined → use Escalation Script 2. If still unresolved → lodge with OAIC (Australia: oaic.gov.au) or Privacy Commissioner (NZ: privacy.org.nz).
              </NavyBox>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
