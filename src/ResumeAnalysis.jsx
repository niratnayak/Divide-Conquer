import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Lightbulb, AlertTriangle, ArrowRight, Target, FileSearch, Download, FileText } from 'lucide-react';
import { api } from './api.js';

function Tag({ children, tone = '' }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

const CUSTOM = 'Other / Custom Role';
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_TONE = { high: 'missing', medium: '', low: 'matched' };

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

function CategoryBars({ categories }) {
  return (
    <div className="cat-list">
      {categories.map((c) => (
        <div className={`cat-row ${c.applicable ? '' : 'na'}`} key={c.key}>
          <div className="cat-top">
            <b>{c.label}</b>
            <span>{c.applicable ? `${c.score}/${c.max}` : 'N/A'}</span>
          </div>
          <div className="bar"><i style={{ width: c.applicable ? `${(c.score / c.max) * 100}%` : '0%' }} /></div>
          <small>{c.reason}</small>
        </div>
      ))}
    </div>
  );
}

function Actions({ items }) {
  if (!items?.length) return null;
  return (
    <div className="suggestion-list">
      {[...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)).map((s) => (
        <div className="suggestion" key={s.title}>
          <Lightbulb size={15} />
          <div>
            <b>{s.title} <Tag tone={PRIORITY_TONE[s.priority] || ''}>{s.priority} priority</Tag></b>
            <p>{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function GeneralResult({ r }) {
  return (
    <>
      <ScoreHead result={r} label="General resume quality" />
      <CategoryBars categories={r.categories} />
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
      {r.lineSuggestions.length > 0 && (
        <>
          <p className="eyebrow">LINE-BY-LINE IMPROVEMENTS</p>
          <p className="priority-legend">Fill in the [X] blanks with your real numbers. If you don't know a number, leave it out rather than guess.</p>
          <div className="line-fixes">
            {r.lineSuggestions.map((s) => (
              <div className="line-fix" key={s.original}>
                <p className="before">{s.original}</p>
                <p className="after">{s.suggestion}</p>
                <small>{s.issue}</small>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="eyebrow">PRIORITY RECOMMENDATIONS</p>
      <Actions items={r.priorities} />
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
      <CategoryBars categories={r.categories} />

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
      <p className="eyebrow">IMPROVEMENT RECOMMENDATIONS</p>
      <Actions items={r.recommendations} />
    </>
  );
}

/** Text with its [X] blanks highlighted. */
function Marked({ text }) {
  return String(text).split(/(\[[^\]]+\])/).map((part, i) => (
    /^\[[^\]]+\]$/.test(part) ? <mark className="blank" key={i}>{part}</mark> : part
  ));
}

function TailoredPreview({ t }) {
  return (
    <div className="tailored-preview">
      {t.name && <h3>{t.name}</h3>}
      {t.headline && <p className="tp-headline"><Marked text={t.headline} /></p>}
      {t.contact.length > 0 && <p className="tp-contact">{t.contact.join('  |  ')}</p>}
      {t.summary && <><h4>Summary</h4><p><Marked text={t.summary} /></p></>}
      {t.skills.length > 0 && (
        <>
          <h4>Skills</h4>
          {t.skills.map((g) => <p key={g.category}><b>{g.category ? `${g.category}: ` : ''}</b>{g.items.join(', ')}</p>)}
        </>
      )}
      {t.sections.map((s) => (
        <div key={s.title}>
          <h4>{s.title}</h4>
          {s.entries.map((e, i) => (
            <div className="tp-entry" key={i}>
              {(e.title || e.dates) && <p className="tp-entry-top"><b><Marked text={e.title} /></b><span><Marked text={e.dates} /></span></p>}
              {e.subtitle && <p><i><Marked text={e.subtitle} /></i></p>}
              {e.bullets.length > 0 && <ul>{e.bullets.map((b, j) => <li key={j}><Marked text={b.text} /></li>)}</ul>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * After reading an analysis, the student can turn it into a tailored resume (one AI call, saved),
 * fill in the number blanks and download it as a Word file.
 */
function TailorPanel({ r }) {
  const [data, setData] = useState(null);
  const [values, setValues] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy('generate');
    setError('');
    try {
      const d = await api.tailorResume(r.id);
      setData(d);
      setValues(d.blanks.map(() => ''));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    setBusy('download');
    setError('');
    try {
      const { blob, name } = await api.downloadTailored(r.id, values);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="tailor-box">
      <p className="eyebrow">TAILORED RESUME</p>
      {!data && (
        <>
          <p className="muted">
            Read through the analysis above first. When you're happy with it, generate a version of your resume rewritten
            with these suggestions{r.mode === 'role' ? ` for ${r.role}` : ''}. It only uses what is already in your resume:
            no new skills, projects or numbers.
          </p>
          <div className="analysis-run">
            <button className="small-primary" onClick={generate} disabled={Boolean(busy) || r.stale}>
              {busy === 'generate'
                ? <><Loader2 size={12} className="spin" /> Generating…</>
                : <><FileText size={12} /> {r.hasTailored ? 'Show tailored version' : 'Generate tailored version'}</>}
            </button>
            {r.stale && <small className="muted">Run the analysis on your new resume first.</small>}
          </div>
        </>
      )}
      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}
      {data && (
        <>
          <TailoredPreview t={data.tailored} />
          {data.blanks.length > 0 && (
            <div className="blank-form">
              <p className="priority-legend">
                Fill in the highlighted blanks with your real numbers. If you don't know one, leave it empty and that number is left out.
              </p>
              {data.blanks.map((b, i) => (
                <label key={i}>
                  <small><Marked text={b.context} /></small>
                  <input
                    value={values[i] ?? ''}
                    placeholder={b.blank}
                    maxLength={30}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="analysis-run">
            <button className="small-primary" onClick={download} disabled={Boolean(busy)}>
              {busy === 'download' ? <><Loader2 size={12} className="spin" /> Preparing…</> : <><Download size={12} /> Download Word file (.docx)</>}
            </button>
            <small className="muted">Check it before you send it: you can edit anything in Word.</small>
          </div>
        </>
      )}
    </div>
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
        {!aiEnabled && <small className="muted">AI analysis isn't set up on the server yet.</small>}
      </div>

      {current?.stale && <p className="insights-note">You've uploaded a new resume since this result. Click Analyse to score the new version.</p>}
      {note && <p className="insights-note">{note}</p>}
      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}

      {current && tab === 'general' && <GeneralResult r={current} />}
      {current && tab === 'role' && <RoleResult r={current} />}
      {current && <TailorPanel key={current.id} r={current} />}
      {current && <p className="disclaimer">Scores mix fixed rules and AI judgement. Treat them as advice, not a verdict.</p>}
    </section>
  );
}
