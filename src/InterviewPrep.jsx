import React, { useEffect, useState } from 'react';
import {
  MessagesSquare, Loader2, AlertTriangle, Send, Plus, CornerDownRight, ChevronLeft, ChevronRight, Sparkles,
} from 'lucide-react';
import { api } from './api.js';

const CATEGORIES = [
  { key: 'technical', label: 'Technical', hint: 'Skills, languages, frameworks and tools from your resume and the role.' },
  { key: 'project', label: 'Project-based', hint: 'Your projects: technologies, decisions, challenges and your contribution.' },
  { key: 'resume', label: 'Resume-based', hint: 'Internships, achievements, certifications and the skills you claim.' },
  { key: 'hr', label: 'HR', hint: 'Introduce yourself, why this role, strengths, a challenge you handled.' },
  { key: 'scenario', label: 'Scenario-based', hint: 'Practical situations that test problem-solving and decisions.' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const CRITERIA = [
  ['technical', 'Technical correctness'],
  ['relevance', 'Relevance'],
  ['completeness', 'Completeness'],
  ['clarity', 'Clarity'],
  ['structure', 'Logical structure'],
  ['examples', 'Relevant examples'],
];
const CUSTOM = 'Other / Custom Role';
const MIN_ANSWER = 20;
const MAX_ANSWER = 3000;

const verdict = (score) => (score >= 8 ? 'Strong answer' : score >= 6 ? 'Good, with gaps' : score >= 4 ? 'Needs work' : 'Off track');

/** Text with its [placeholders] highlighted. */
function Placeholders({ text }) {
  return String(text).split(/(\[[^\]]+\])/).map((part, i) => (
    /^\[[^\]]+\]$/.test(part) ? <mark className="blank" key={i}>{part}</mark> : part
  ));
}

function Setup({ roles, aiEnabled, hasResume, onStart, onCancel }) {
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [jd, setJd] = useState('');
  const [categories, setCategories] = useState(CATEGORIES.map((c) => c.key));
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const roleToSend = role === CUSTOM ? customRole.trim() : role.trim();
  const isKnown = roles.some((r) => r.toLowerCase() === roleToSend.toLowerCase());
  const needsJd = roleToSend && !isKnown && jd.trim().length < 80;
  const canStart = hasResume && aiEnabled && !busy && roleToSend && categories.length && !needsJd;

  const toggle = (key) => setCategories((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await onStart({ role: roleToSend, jd, categories, count });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="iv-setup">
      <div className="iv-setup-grid">
        <label>
          Role you're preparing for
          <input list="iv-roles" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Start typing, e.g. Frontend Developer" />
          <datalist id="iv-roles">{[...roles, CUSTOM].map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        {role === CUSTOM && (
          <label>
            Custom role name
            <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="e.g. Embedded Systems Engineer" />
          </label>
        )}
      </div>
      <label className="iv-jd">
        Job description {isKnown || !roleToSend ? '(optional)' : '(required for a custom role)'}
        <textarea rows={4} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description to get questions on its exact requirements." />
      </label>

      <p className="iv-label">Question categories</p>
      <div className="iv-cats">
        {CATEGORIES.map((c) => (
          <label key={c.key} className={`iv-cat ${categories.includes(c.key) ? 'on' : ''}`}>
            <input type="checkbox" checked={categories.includes(c.key)} onChange={() => toggle(c.key)} />
            <b>{c.label}</b>
            <small>{c.hint}</small>
          </label>
        ))}
      </div>

      <p className="iv-label">Number of questions</p>
      <div className="iv-count" role="radiogroup" aria-label="Number of questions">
        {[5, 8, 10].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={count === n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>
        ))}
      </div>

      <div className="analysis-run">
        <button type="button" className="small-primary" onClick={start} disabled={!canStart}>
          {busy ? <><Loader2 size={12} className="spin" /> Writing your questions…</> : <><Sparkles size={12} /> Generate questions</>}
        </button>
        {onCancel && <button type="button" className="text-button" onClick={onCancel} disabled={busy}>Back to my session</button>}
        {!hasResume && <small className="muted">Upload your resume above first.</small>}
        {hasResume && !roleToSend && <small className="muted">Select or enter a role above.</small>}
        {!aiEnabled && <small className="muted">AI isn't set up on the server yet.</small>}
        {needsJd && <small className="muted">Paste the job description for a custom role.</small>}
      </div>
      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}
    </div>
  );
}

function Feedback({ q, onFollowUp, followUpQuestion, busy }) {
  const e = q.evaluation;
  return (
    <div className="iv-feedback">
      <div className="iv-score">
        <div className="iv-score-num"><b>{e.overall}</b><small>/10</small></div>
        <div>
          <b>{verdict(e.overall)}</b>
          <small>Average of the criteria below{e.criteria.technical === null ? ' (technical correctness doesn’t apply to this question)' : ''}.</small>
        </div>
      </div>

      <div className="iv-criteria">
        {CRITERIA.map(([key, label]) => {
          const v = e.criteria[key];
          return (
            <div className={`iv-crit ${v === null ? 'na' : ''}`} key={key}>
              <span>{label}</span>
              <span className="iv-crit-bar"><i style={{ width: v === null ? 0 : `${v * 10}%` }} /></span>
              <b>{v === null ? 'N/A' : `${v}/10`}</b>
            </div>
          );
        })}
      </div>

      <div className="iv-fb-grid">
        <div className="iv-fb good"><p>What you did well</p><ul>{e.strengths.length ? e.strengths.map((s) => <li key={s}>{s}</li>) : <li>Nothing stood out yet. Use the steps below to rebuild the answer.</li>}</ul></div>
        <div className="iv-fb miss"><p>What was missing</p><ul>{e.missing.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div className="iv-fb improve"><p>How to improve</p><ul>{e.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>
      </div>

      {e.structure.length > 0 && (
        <div className="iv-structure">
          <p>A stronger answer structure</p>
          <ol>{e.structure.map((s) => <li key={s}><Placeholders text={s} /></li>)}</ol>
          <small>Fill the highlighted parts with your own genuine examples from your projects and experience. Never invent experience in an interview.</small>
        </div>
      )}

      {e.followUp && (
        <div className="iv-followup">
          <CornerDownRight size={16} />
          <div>
            <p>An interviewer might follow up with</p>
            <b>{e.followUp}</b>
          </div>
          <button type="button" className="small-primary" onClick={onFollowUp} disabled={busy}>
            {followUpQuestion ? 'Go to follow-up' : 'Answer this follow-up'}
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionView({ session, q, index, onSession, onSelect }) {
  const [answer, setAnswer] = useState(q.answer || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const followUpQuestion = session.questions.find((x) => x.followUpOf === q.id);
  const total = session.questions.length;

  const submit = async () => {
    setBusy('answer');
    setError('');
    try {
      const { session: s } = await api.answerQuestion(session.id, q.id, answer);
      onSession(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const followUp = async () => {
    if (followUpQuestion) { onSelect(followUpQuestion.id); return; }
    setBusy('follow');
    setError('');
    try {
      const { session: s } = await api.addFollowUp(session.id, q.id);
      onSession(s);
      const added = s.questions.find((x) => x.followUpOf === q.id);
      if (added) onSelect(added.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const changed = answer.trim() !== (q.answer || '').trim();
  return (
    <div className="iv-question">
      <div className="iv-q-meta">
        <span className={`iv-tag ${q.category}`}>{CATEGORY_LABEL[q.category]}</span>
        <span>Question {index + 1} of {total}</span>
        {q.basedOn && <span>· Based on: <b>{q.basedOn}</b></span>}
      </div>
      <h3>{q.question}</h3>
      {q.tests && <p className="iv-tests">What it checks: {q.tests}</p>}

      <label className="iv-answer">
        Your answer
        <textarea
          rows={7}
          value={answer}
          maxLength={MAX_ANSWER}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer as you would in the interview. Use real examples from your own projects and experience."
        />
      </label>
      <div className="analysis-run">
        <button type="button" className="small-primary" onClick={submit} disabled={Boolean(busy) || answer.trim().length < MIN_ANSWER || (q.evaluation && !changed)}>
          {busy === 'answer' ? <><Loader2 size={12} className="spin" /> Evaluating…</> : <><Send size={12} /> {q.evaluation ? 'Get feedback on new answer' : 'Submit for feedback'}</>}
        </button>
        <small className="muted">{answer.length}/{MAX_ANSWER}{answer.trim().length < MIN_ANSWER ? ' · write at least a sentence' : ''}</small>
        <span className="iv-nav">
          <button type="button" className="text-button" disabled={index === 0} onClick={() => onSelect(session.questions[index - 1].id)}><ChevronLeft size={14} /> Previous</button>
          <button type="button" className="text-button" disabled={index === total - 1} onClick={() => onSelect(session.questions[index + 1].id)}>Next <ChevronRight size={14} /></button>
        </span>
      </div>
      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}
      {q.evaluation && <Feedback q={q} onFollowUp={followUp} followUpQuestion={followUpQuestion} busy={Boolean(busy)} />}
    </div>
  );
}

/**
 * Interview practice: AI-written questions from the student's resume and target role, then feedback on each
 * answer with a suggested follow-up. Sessions are saved, so the latest one reopens on return.
 */
export default function InterviewPrep({ hasResume = false }) {
  const [roles, setRoles] = useState([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [session, setSession] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analysisRoles().then((d) => setRoles(d.roles.filter((r) => r !== CUSTOM))).catch(() => {});
    api.latestInterview()
      .then((d) => { setAiEnabled(d.aiEnabled); setSession(d.session); setActiveId(d.session?.questions[0]?.id || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const start = async (setup) => {
    const { session: s } = await api.startInterview(setup);
    setSession(s);
    setActiveId(s.questions[0]?.id || null);
    setSetupOpen(false);
  };

  const answered = session ? session.questions.filter((q) => q.evaluation) : [];
  const average = answered.length ? Math.round((answered.reduce((t, q) => t + q.evaluation.overall, 0) / answered.length) * 10) / 10 : null;
  const activeIndex = session ? Math.max(0, session.questions.findIndex((q) => q.id === activeId)) : 0;
  const active = session?.questions[activeIndex];

  return (
    <section className="panel iv-panel">
      <div className="iv-head">
        <span className="result-card-icon"><MessagesSquare size={18} /></span>
        <div>
          <h2>Interview preparation</h2>
          <p className="muted">Practise with questions written from your resume and the role you want. Get a score and specific feedback on every answer.</p>
        </div>
        {session && !setupOpen && (
          <button type="button" className="iv-new" onClick={() => setSetupOpen(true)}><Plus size={14} /> New practice session</button>
        )}
      </div>

      {loading && <div className="ss-empty"><Loader2 size={16} className="spin" /> Loading…</div>}

      {!loading && (!session || setupOpen) && (
        <Setup roles={roles} aiEnabled={aiEnabled} hasResume={hasResume} onStart={start} onCancel={session ? () => setSetupOpen(false) : null} />
      )}

      {!loading && session && !setupOpen && (
        <>
          <div className="iv-summary">
            <span>Practising for <b>{session.role}</b>{session.hasJobDescription ? ' · from your job description' : ''}</span>
            <span><b>{answered.length}</b> of {session.questions.length} answered</span>
            {average !== null && <span>Average score <b>{average}/10</b></span>}
          </div>
          <div className="iv-layout">
            <ol className="iv-list">
              {session.questions.map((q, i) => (
                <li key={q.id}>
                  <button type="button" className={`${q.id === active?.id ? 'on' : ''} ${q.followUpOf ? 'follow' : ''}`} onClick={() => setActiveId(q.id)}>
                    <span className="iv-num">{q.followUpOf ? <CornerDownRight size={12} /> : i + 1}</span>
                    <small className="iv-list-cat">{q.followUpOf ? 'Follow-up' : CATEGORY_LABEL[q.category]}</small>
                    <span className={`iv-badge ${q.evaluation ? '' : 'todo'}`}>{q.evaluation ? q.evaluation.overall : '–'}</span>
                    <span className="iv-list-text">{q.question}</span>
                  </button>
                </li>
              ))}
            </ol>
            {active && <QuestionView key={active.id} session={session} q={active} index={activeIndex} onSession={setSession} onSelect={setActiveId} />}
          </div>
        </>
      )}
    </section>
  );
}
