import React, { useEffect, useState } from 'react';
import { Users, Loader2, AlertTriangle, Trophy, FileText, ChevronDown, Search } from 'lucide-react';
import { api } from './api.js';
import TagInput from './TagInput.jsx';

// Same list the student profile form offers; departments already saved by students are added to it
const STANDARD_DEPARTMENTS = [
  'Computer Engineering', 'Information Technology', 'Electronics and Computer Science Engineering',
  'Electronics', 'Mechanical Engineering', 'Civil Engineering',
];
const QUICK_SKILLS = ['React', 'Python', 'Java', 'SQL', 'Node.js', 'Machine Learning', 'AWS', 'Figma'];

// Evidence levels, strongest first. Ordered, so one hue from dark to light, and grey for "not found".
const LEVELS = [
  { key: 'proven', label: 'Used in projects' },
  { key: 'listed', label: 'Listed on resume' },
  { key: 'profile', label: 'Profile or certificate only' },
  { key: 'none', label: 'Not found' },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.key, l.label]));

function Legend() {
  return (
    <div className="ss-legend">
      {LEVELS.map((l) => <span key={l.key}><i className={`lv-${l.key}`} />{l.label}</span>)}
    </div>
  );
}

/** One row per skill: share of students at each evidence level, plus who is sharpest. */
function Coverage({ coverage, total }) {
  return (
    <section className="panel ss-card">
      <div className="ss-card-head">
        <div>
          <h2>Skill coverage</h2>
          <p className="muted">How many of the {total} matching students have each skill, and how strongly.</p>
        </div>
        <Legend />
      </div>
      <div className="ss-coverage">
        {coverage.map((c) => (
          <div className="ss-cov-row" key={c.skill}>
            <div className="ss-cov-top">
              <b>{c.skill}</b>
              <span><strong>{c.havePct}%</strong> have it · {c.missingPct}% don't</span>
            </div>
            <div className="ss-stack" role="img" aria-label={`${c.skill}: ${LEVELS.map((l) => `${c.counts[l.key]} ${l.label.toLowerCase()}`).join(', ')}`}>
              {LEVELS.map((l) => c.counts[l.key] > 0 && (
                <span
                  key={l.key}
                  className={`lv-${l.key}`}
                  style={{ flexGrow: c.counts[l.key] }}
                  title={`${l.label}: ${c.counts[l.key]} student${c.counts[l.key] === 1 ? '' : 's'}`}
                />
              ))}
            </div>
            <small className="ss-cov-counts">
              {LEVELS.map((l) => `${c.counts[l.key]} ${l.label.toLowerCase()}`).join(' · ')}
            </small>
            {c.sharpest && (
              <p className="ss-sharpest"><Trophy size={14} /> Sharpest in {c.skill}: <b>{c.sharpest.name}</b> ({c.sharpest.score}/100)
                {c.sharpest.tiedWith > 0 && `, tied with ${c.sharpest.tiedWith} other${c.sharpest.tiedWith === 1 ? '' : 's'}`}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StudentRow({ s, rank }) {
  const [open, setOpen] = useState(false);
  const [resumeError, setResumeError] = useState('');

  const viewResume = async () => {
    setResumeError('');
    try {
      const blob = await api.studentResume(s.userId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setResumeError(err.message);
    }
  };

  return (
    <li className={`ss-student ${rank === 1 ? 'top' : ''}`}>
      <div className="ss-student-main">
        <span className="ss-rank">{rank}</span>
        <div className="ss-who">
          <b>{s.name}</b>
          <small>{[s.department, s.cgpa != null ? `CGPA ${s.cgpa}` : 'No CGPA'].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="ss-chips">
          {s.skills.map((k) => (
            <span className={`ss-chip lv-${k.level}`} key={k.skill} title={k.reasons.join('. ')}>
              {k.skill} · {k.level === 'none' ? 'not found' : k.score}
            </span>
          ))}
        </div>
        <div className="ss-score" aria-label={`Overall evidence score ${s.score} out of 100`}>
          <b>{s.score}</b><small>/100</small>
          <span className="ss-meter"><i style={{ width: `${s.score}%` }} /></span>
        </div>
      </div>
      <div className="ss-student-actions">
        <button type="button" className="text-button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronDown size={14} className={open ? 'flip' : ''} /> {open ? 'Hide' : 'Why this score'}
        </button>
        {s.hasResume && (
          <button type="button" className="text-button" onClick={viewResume}><FileText size={14} /> View resume</button>
        )}
        {resumeError && <small className="field-error">{resumeError}</small>}
      </div>
      {open && (
        <ul className="ss-reasons">
          {s.skills.map((k) => (
            <li key={k.skill}><b>{k.skill}</b> ({LEVEL_LABEL[k.level]}, {k.score}/100): {k.reasons.join('. ')}.</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Placement officer page: filter by department and CGPA cutoff, enter skills, and see how many
 * students have each skill and who shows it most strongly. Results refresh as the filters change.
 */
export default function TpoDashboard() {
  const [departments, setDepartments] = useState(STANDARD_DEPARTMENTS);
  const [department, setDepartment] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [skills, setSkills] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.studentDepartments()
      .then(({ departments: saved }) => setDepartments([...new Set([...STANDARD_DEPARTMENTS, ...saved])]))
      .catch(() => {});
  }, []);

  const cgpaNum = minCgpa === '' ? null : Number(minCgpa);
  const cgpaError = cgpaNum !== null && (Number.isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) ? 'CGPA cutoff must be between 0 and 10.' : '';

  // Search shortly after the filters stop changing
  useEffect(() => {
    if (!skills.length || cgpaError) { setResult(null); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      setError('');
      try {
        const data = await api.searchStudents({ department, minCgpa: cgpaNum, skills });
        if (active) setResult(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setBusy(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [department, cgpaNum, cgpaError, skills]);

  return (
    <div className="workspace officer-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STUDENT SKILL INSIGHTS</p>
          <h1>Discover the right talent, <em>skill by skill.</em></h1>
          <p className="muted">Choose a department, a CGPA cutoff and the skills you need. ResumeIQ ranks students by the evidence in their resumes and profiles.</p>
        </div>
        {result && <span className="tag"><Users size={14} /> {result.total} student{result.total === 1 ? '' : 's'} match</span>}
      </div>

      <section className="panel ss-filters">
        <div className="ss-filter-grid">
          <label>
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            Minimum CGPA
            <input
              type="number" min="0" max="10" step="0.1" placeholder="e.g. 7.5"
              className={cgpaError ? 'has-error' : ''}
              value={minCgpa}
              onChange={(e) => setMinCgpa(e.target.value)}
            />
            {cgpaError && <small className="field-error">{cgpaError}</small>}
          </label>
        </div>
        <TagInput
          label="Skills"
          values={skills}
          onChange={setSkills}
          placeholder="Type a skill and press Enter, e.g. React"
          hint="Add up to 8 skills. Students are ranked by their average evidence score across them."
          suggestions={QUICK_SKILLS}
          suggestionLabel="Quick add:"
          max={8}
        />
      </section>

      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}

      {!skills.length && (
        <div className="ss-empty"><Search size={18} /> Add a skill above to see which students have it.</div>
      )}
      {skills.length > 0 && busy && !result && (
        <div className="ss-empty"><Loader2 size={16} className="spin" /> Finding students…</div>
      )}

      {result && (
        <div className={`ss-results ${busy ? 'is-busy' : ''}`}>
          {result.total === 0 ? (
            <div className="ss-empty">No students match this department and CGPA cutoff.</div>
          ) : (
            <>
              <Coverage coverage={result.coverage} total={result.total} />
              <section className="panel ss-card">
                <div className="ss-card-head">
                  <div>
                    <h2>Student ranking</h2>
                    <p className="muted">Strongest evidence first. Hover a skill, or open "Why this score", to see what counted.</p>
                  </div>
                </div>
                <ol className="ss-list">
                  {result.students.map((s, i) => <StudentRow s={s} rank={i + 1} key={s.userId} />)}
                </ol>
                {result.total > result.students.length && (
                  <p className="muted ss-more">Showing the top {result.students.length} of {result.total}. Narrow the filters to see others.</p>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
