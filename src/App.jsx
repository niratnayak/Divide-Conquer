import React, { useState, useEffect } from 'react';
import {
  Sparkles, GraduationCap, BriefcaseBusiness, ArrowRight, LogOut, Loader2
} from 'lucide-react';
import { api, tokenStore, ROLE_TO_API, ROLE_FROM_API } from './api.js';
import StudentDashboard from './StudentDashboard.jsx';
import TpoDashboard from './TpoDashboard.jsx';

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon"><Sparkles size={19} /></span>
      <span><b>ResumeIQ</b><small>AI RESUME INSIGHTS</small></span>
    </div>
  );
}

export function Tag({ children, tone = '' }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

// Sign-in page headings for each role, when signing in or creating an account
const LOGIN_COPY = {
  student: {
    signIn: {
      eyebrow: 'WELCOME BACK',
      title: 'Your resume, one step better.',
      text: 'Sign in to analyse your resume, see what to improve, and track your score as it grows.',
    },
    register: {
      eyebrow: 'GET STARTED',
      title: 'Build a resume that gets noticed.',
      text: 'Create your account, upload your resume and get instant AI feedback on how to make it stronger.',
    },
  },
  officer: {
    signIn: {
      eyebrow: 'STUDENT SKILL INSIGHTS',
      title: 'Discover talent. Explore skills. Find the right students.',
      text: 'Easily explore student profiles, identify key skills, and discover talent based on their capabilities.',
    },
    register: {
      eyebrow: 'FOR PLACEMENT OFFICERS',
      title: 'Set up your placement workspace.',
      text: 'Create your account to explore student profiles and see the skills behind every resume.',
    },
  },
};

export function Login({ onLogin }) {
  const [role, setRole] = useState('Student');
  const [fullName, setFullName] = useState('');
  const [nameError, setNameError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFullNameChange = (e) => {
    const val = e.target.value;
    if (/^[a-zA-Z\s]*$/.test(val)) {
      setFullName(val);
      setNameError('');
    } else {
      setNameError('Full name should contain alphabets only');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (register) {
      if (!fullName.trim()) {
        setNameError('Please enter your full name');
        return;
      }
      if (!/^[a-zA-Z\s]+$/.test(fullName.trim())) {
        setNameError('Full name should contain alphabets only');
        return;
      }
    }

    setBusy(true);
    try {
      const payload = { email, password, role: ROLE_TO_API[role] };
      const { token, user } = register
        ? await api.register({ ...payload, name: fullName.trim() })
        : await api.login(payload);
      tokenStore.set(token);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = LOGIN_COPY[role === 'Placement officer' ? 'officer' : 'student'][register ? 'register' : 'signIn'];

  return (
    <main className="login-shell">
      <section className="login-hero">
        <Brand />
        <div className="hero-copy">
          <p className="eyebrow light">AI-POWERED RESUME ANALYSIS</p>
          <h1>Know your resume. Grow your skills.</h1>
          <p>ResumeIQ scores resumes, shows students exactly what to improve, and helps placement officers find the right talent.</p>
        </div>
        <div className="hero-foot">© 2026 ResumeIQ</div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p className="muted">{copy.text}</p>

          <div className="role-switch">
            <button className={role === 'Student' ? 'selected' : ''} onClick={() => setRole('Student')}>
              <GraduationCap size={17} />Student
            </button>
            <button className={role === 'Placement officer' ? 'selected' : ''} onClick={() => setRole('Placement officer')}>
              <BriefcaseBusiness size={17} />Placement officer
            </button>
          </div>

          <form onSubmit={submit} className="login-fields">
            {register && (
              <div>
                <input
                  type="text"
                  className={nameError ? 'has-error' : ''}
                  placeholder="Full Name"
                  value={fullName}
                  onChange={handleFullNameChange}
                  required
                />
                {nameError && <small className="field-error">{nameError}</small>}
              </div>
            )}

            <input
              type="email"
              placeholder="College email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              minLength="6"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button className="primary-btn full" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={18} />
            </button>
            {error && <p className="field-error" style={{ fontSize: '13px', marginTop: '6px' }}>{error}</p>}
          </form>
          <button className="text-button" onClick={() => { setRegister(!register); setError(''); setNameError(''); }}>
            {register ? 'Already have an account?  Sign in' : 'New to ResumeIQ?  Create an account'}
          </button>
        </div>
      </section>
    </main>
  );
}

export function Header({ user, onLogout }) {
  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayRole = ROLE_FROM_API[user?.role] || user?.role || 'Member';
  return (
    <header className="topbar">
      <Brand />
      <div className="user-area">
        <span className="avatar">{(displayName[0] || 'S').toUpperCase()}</span>
        <span className="user-meta">
          <b>{displayName}</b>
          <small>{displayRole}</small>
        </span>
        <button className="icon-button" title="Sign out" onClick={onLogout}>
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(tokenStore.get()));
  useEffect(() => {
    if (!tokenStore.get()) {
      setChecking(false);
      return;
    }
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = () => {
    tokenStore.clear();
    setUser(null);
  };

  if (checking) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Loader2 size={20} className="spin" /> Opening your workspace…
      </div>
    );
  }

  if (!user) return <Login onLogin={setUser} />;

  const isOfficer = user.role === 'tpo' || user.role === 'Placement officer';

  return (
    <div className="app-shell">
      <Header user={user} onLogout={handleLogout} />
      {isOfficer ? (
        <TpoDashboard />
      ) : (
        <StudentDashboard
          user={user}
        />
      )}
      <footer className="app-footer">ResumeIQ <span>·</span> AI resume insights</footer>
    </div>
  );
}

export default App;
