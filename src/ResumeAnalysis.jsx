import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, ArrowRight, Target, FileSearch, PenLine, ListChecks, Copy, Check } from 'lucide-react';
import { api } from './api.js';

function Tag({ children, tone = '' }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

const CUSTOM = 'Other / Custom Role';
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function ScoreHead({ result, label }) {
  const delta = result.previousScore != null ? result.score - result.previousScore : null;
  return (
    <div className="score-head">
      <div className="score-big"><b>{result.score}</b><small>/100</small></div>
      <div>
        <b>{label}</b>
        {delta !== null && delta !== 0 && (
          <small className={delta > 0 ? 'delta up' : 'delta down'}>
            {result.previousScore} <ArrowRight size={11} /> {result.score} ({delta > 0 ? '+' : ''}{delta} since your last resume)
          </small>
        )}
        <small>Analysed {new Date(result.createdAt).toLocaleString()}</small>
      </div>
    </div>
  );
}

const TICKS = [0, 25, 50, 75, 100];

/**
 * Category scores as one chart: each bar is the share of that category's maximum, on a shared
 * 0-100% axis. Hover or focus a row for its reason; all reasons are also in "Why these scores".
 */
function CategoryChart({ categories }) {
  const [active, setActive] = useState(null);
  return (
    <>
      <figure className="cat-chart" aria-label="Score by category, as a share of each category's maximum">
        {categories.map((c) => {
          const pct = c.applicable ? Math.round((c.score / c.max) * 100) : 0;
          return (
            <div
              key={c.key}
              className={`cc-row ${c.applicable ? '' : 'na'}`}
              tabIndex={0}
              aria-label={`${c.label}: ${c.applicable ? `${c.score} of ${c.max}` : 'not applicable'}. ${c.reason}`}
              onMouseEnter={() => setActive(c.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(c.key)}
              onBlur={() => setActive(null)}
            >
              <span className="cc-label">{c.label}</span>
              <span className="cc-track">{c.applicable && <i style={{ width: `${pct}%` }} />}</span>
              <span className="cc-value">{c.applicable ? <>{c.score}<small>/{c.max}</small></> : 'N/A'}</span>
              {active === c.key && c.reason && (
                <span className="cc-tip" role="tooltip">
                  <b>{c.label}{c.applicable ? ` · ${pct}%` : ''}</b>
                  {c.reason}
                </span>
              )}
            </div>
          );
        })}
        <div className="cc-axis" aria-hidden="true">
          <span className="cc-ticks">{TICKS.map((t) => <span key={t} style={{ left: `${t}%` }}>{t}%</span>)}</span>
        </div>
      </figure>
      <details className="cc-why">
        <summary>Why these scores</summary>
        <ul>
          {categories.map((c) => <li key={c.key}><b>{c.label}:</b> {c.reason}</li>)}
        </ul>
      </details>
    </>
  );
}

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

/** A titled card for one block of results. */
function ResultCard({ icon: Icon, title, subtitle, count, children }) {
  return (
    <section className="result-card">
      <header className="result-card-head">
        <span className="result-card-icon"><Icon size={18} /></span>
        <div>
          <h3>{title}{count != null && <span className="result-card-count">{count}</span>}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Text with its [X] blanks highlighted. */
function Marked({ text }) {
  return String(text).split(/(\[[^\]]+\])/).map((part, i) => (
    /^\[[^\]]+\]$/.test(part) ? <mark className="blank" key={i}>{part}</mark> : part
  ));
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button type="button" className="fix-copy" onClick={copy} aria-label="Copy suggested line">
      {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
    </button>
  );
}

function LineFixes({ items }) {
  if (!items?.length) return null;
  return (
    <ResultCard
      icon={PenLine}
      title="Line-by-line improvements"
      subtitle="Replace [X] blanks with your real numbers. If you don't know one, leave it out rather than guess."
      count={items.length}
    >
      <ol className="fix-list">
        {items.map((s, i) => (
          <li className="fix-item" key={s.original}>
            <div className="fix-head">
              <span className="fix-num">{i + 1}</span>
              <span className="fix-issue">{s.issue}</span>
            </div>
            <div className="fix-pair">
              <div className="fix-col before">
                <span className="fix-label">Current</span>
                <p>{s.original}</p>
              </div>
              <ArrowRight size={16} className="fix-arrow" aria-hidden="true" />
              <div className="fix-col after">
                <span className="fix-label">Suggested <CopyButton text={s.suggestion} /></span>
                <p><Marked text={s.suggestion} /></p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </ResultCard>
  );
}

function Actions({ items, title, subtitle }) {
  if (!items?.length) return null;
  const sorted = [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));
  return (
    <ResultCard icon={ListChecks} title={title} subtitle={subtitle} count={items.length}>
      <ol className="rec-list">
        {sorted.map((s, i) => {
          const p = PRIORITY_LABEL[s.priority] ? s.priority : 'medium';
          return (
            <li className={`rec-item ${p}`} key={s.title}>
              <span className="rec-num">{i + 1}</span>
              <div>
                <div className="rec-top">
                  <b>{s.title}</b>
                  <span className={`rec-pill ${p}`}>{PRIORITY_LABEL[p]} priority</span>
                </div>
                <p>{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </ResultCard>
  );
}

function GeneralResult({ r }) {
  return (
    <>
      <ScoreHead result={r} label="General resume quality" />
      <CategoryChart categories={r.categories} />
      <div className="insights-cols">
        <div><p className="eyebrow">STRENGTHS</p><ul>{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div><p className="eyebrow">WEAKNESSES</p><ul>{r.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
      </div>
      {r.missingSections.length > 0 && (
        <>
          <p className="eyebrow">MISSING OR INCOMPLETE SECTIONS</p>
          <div className="chip-row">
            {r.missingSections.map((m) => (
              <Tag key={m.label} tone={m.optional ? '' : 'missing'}>
                {m.label} · {m.status}{m.optional ? ' (optional)' : ''}
              </Tag>
            ))}
          </div>
        </>
      )}
      <LineFixes items={r.lineSuggestions} />
    </>
  );
}

function SkillGroup({ title, items, tone, note }) {
  if (!items.length) return null;
  return (
    <div className="skill-group">
      <p className="eyebrow">{title}</p>
      {note && <small className="muted">{note}</small>}
      <div className="chip-row">
        {items.map((s) => <Tag key={s.skill} tone={tone}>{s.skill}{s.kind === 'preferred' ? ' · preferred' : ''}</Tag>)}
      </div>
    </div>
  );
}

function RoleResult({ r }) {
  return (
    <>
      <ScoreHead result={r} label={`Compatibility with ${r.role}`} />
      <p className="insights-note">
        {r.requirementSource === 'jd'
          ? 'Compared against the job description you pasted.'
          : `No job description given, so this uses a general reference for ${r.role}. Paste a real JD for a sharper result.`}
      </p>
      <CategoryChart categories={r.categories} />

      <SkillGroup title="MATCHED SKILLS" items={r.skills.matched} tone="matched" note="Shown in a project or experience entry." />
      <SkillGroup title="PARTIALLY DEMONSTRATED" items={r.skills.partial} note="Listed on your resume, but no project or experience shows you using it." />
      <SkillGroup title="IN YOUR PROFILE, NOT ON YOUR RESUME" items={r.skills.claimed} note="You added these to your profile, but your resume never mentions them. If you have used them, put the proof on the resume." />
      <SkillGroup
        title="NOT FOUND IN YOUR RESUME"
        items={r.skills.notFound}
        tone="missing"
        note="This only means the resume doesn't mention them, not that you don't have them. If you have used one, show it in a project or bullet. If not, it's a gap to work on."
      />
      {r.keywordsMissing?.length > 0 && (
        <p className="muted small-note">Role keywords not found: {r.keywordsMissing.join(', ')}</p>
      )}

      {r.relevantProjects.length > 0 && (
        <>
          <p className="eyebrow">RELEVANT PROJECTS</p>
          <ul>{r.relevantProjects.map((p) => <li key={p.name}><b>{p.name}</b>: {p.why}</li>)}</ul>
        </>
      )}
      {r.weakContent.length > 0 && (
        <>
          <p className="eyebrow">WEAK OR IRRELEVANT CONTENT</p>
          <div className="line-fixes">
            {r.weakContent.map((w) => (
              <div className="line-fix" key={w.text}><p className="before">{w.text}</p><small>{w.why}</small></div>
            ))}
          </div>
        </>
      )}
      {r.rejectionReasons.length > 0 && (
        <>
          <p className="eyebrow">POTENTIAL REJECTION REASONS</p>
          <ul>{r.rejectionReasons.map((s) => <li key={s}>{s}</li>)}</ul>
        </>
      )}
    </>
  );
}

/**
 * Resume analysis in two modes. General (Mode A) ignores jobs entirely; role-specific (Mode B)
 * compares against a chosen role and optional JD. Both can be run on the same resume.
 * `version` changes after a resume upload so a stale result is flagged.
 */
export default function ResumeAnalysis({ version = 0, hasResume = false }) {
  const [tab, setTab] = useState('general');
  const [roles, setRoles] = useState([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [jd, setJd] = useState('');
  const [results, setResults] = useState({ general: null, role: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    api.analysisRoles().then((d) => { setRoles(d.roles); setAiEnabled(d.aiEnabled); }).catch(() => {});
  }, []);

  useEffect(() => {
    api.latestAnalyses().then((d) => setResults({ general: d.general, role: d.role })).catch(() => {});
  }, [version]);

  const isKnown = role !== CUSTOM && roles.some((r) => r.toLowerCase() === role.trim().toLowerCase());
  const needsCustomName = role === CUSTOM;
  // A typed role that isn't in the list is treated as a custom role
  const roleToSend = needsCustomName ? customRole.trim() : role.trim();
  const customWithoutJd = roleToSend && !isKnown && jd.trim().length < 80;

  const run = async () => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const data = tab === 'general' ? await api.analyseGeneral() : await api.analyseRole(roleToSend, jd);
      setResults((r) => ({ ...r, [tab]: data.analysis }));
      if (data.cached) setNote('Nothing changed since the last run, so this is the saved result.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const current = results[tab];
  const canRun = hasResume && aiEnabled && !busy && (tab === 'general' || (roleToSend && !customWithoutJd));

  return (
    <>
    <section className="panel insights-panel analysis-panel">
      <div className="panel-heading">
        <div>
          <b><Sparkles size={14} /> Resume analysis</b>
          <small>Run a general quality check, a check for a specific role, or both, on the same resume.</small>
        </div>
      </div>

      <div className="analysis-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'active' : ''} onClick={() => { setTab('general'); setError(''); setNote(''); }}>
          <FileSearch size={13} /> General analysis
        </button>
        <button role="tab" aria-selected={tab === 'role'} className={tab === 'role' ? 'active' : ''} onClick={() => { setTab('role'); setError(''); setNote(''); }}>
          <Target size={13} /> Role-specific analysis
        </button>
      </div>

      {tab === 'role' && (
        <div className="role-form">
          <label>
            Target role
            <input
              list="analysis-roles"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Start typing, e.g. Frontend Developer"
            />
            <datalist id="analysis-roles">
              {roles.map((r) => <option key={r} value={r} />)}
            </datalist>
          </label>
          {needsCustomName && (
            <label>
              Custom role name
              <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="e.g. Embedded Systems Engineer" />
            </label>
          )}
          <label>
            Job description {isKnown ? '(optional)' : '(required for a custom role)'}
            <textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description here. Its requirements take priority over the general role reference." />
          </label>
          {customWithoutJd && <small className="muted">Paste the job description to analyse a custom role.</small>}
        </div>
      )}

      <div className="analysis-run">
        <button className="small-primary" onClick={run} disabled={!canRun}>
          {busy ? <><Loader2 size={12} className="spin" /> Analysing…</> : <><Sparkles size={12} /> Analyse</>}
        </button>
        {!hasResume && <small className="muted">Upload your resume above first.</small>}
        {hasResume && tab === 'role' && !roleToSend && <small className="muted">Select or enter a target role above.</small>}
        {!aiEnabled && <small className="muted">AI analysis isn't set up on the server yet.</small>}
      </div>

      {current?.stale && <p className="insights-note">You've uploaded a new resume since this result. Click Analyse to score the new version.</p>}
      {note && <p className="insights-note">{note}</p>}
      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}

      {current && tab === 'general' && <GeneralResult r={current} />}
      {current && tab === 'role' && <RoleResult r={current} />}
      {current && <p className="disclaimer">Scores mix fixed rules and AI judgement. Treat them as advice, not a verdict.</p>}
    </section>

    {/* Recommendations get their own section below the analysis, for whichever tab is open */}
    {current && (
      <div className="recommendations-section">
        {tab === 'general'
          ? <Actions items={current.priorities} title="Priority recommendations" subtitle="From your general analysis. Most important first, so start at the top." />
          : <Actions items={current.recommendations} title="Improvement recommendations" subtitle={`From your ${current.role} analysis. Most important first, so start at the top.`} />}
      </div>
    )}
    </>
  );
}
