import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, X, Plus, Upload, AlertTriangle
} from 'lucide-react';
import { api } from './api.js';
import ResumeAnalysis from './ResumeAnalysis.jsx';
import TagInput from './TagInput.jsx';

function Tag({ children, tone = '' }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function StudentDashboard({ user, onSelectJob }) {
  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [skills, setSkills] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [projects, setProjects] = useState(['']);
  const [resume, setResume] = useState(null);
  const [extracted, setExtracted] = useState([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [cgpaError, setCgpaError] = useState('');
  const [department, setDepartment] = useState('');
  // Bumped after a save or upload so the AI panel shows the new analysis status
  const [aiVersion, setAiVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api.getProfile()
      .then(({ profile }) => {
        if (!active || !profile) return;
        setName(profile.name || user?.name || '');
        setLinkedin(profile.linkedin || '');
        setCgpa(profile.cgpa != null ? String(profile.cgpa) : '');
        setDepartment(profile.department || '');
        setSkills(profile.skills || []);
        setCertifications(profile.certifications || []);
        if (profile.projects && profile.projects.length > 0) {
          setProjects(profile.projects);
        }
        setResume(profile.resume);
        setExtracted(profile.extractedSkills || []);
      })
      .catch((err) => {
        console.warn('Could not load profile from DB:', err.message);
      });

    return () => { active = false; };
  }, [user]);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setSaved(false);
    if (/^[a-zA-Z\s]*$/.test(val)) {
      setName(val);
      setNameError('');
    } else {
      setNameError('Full name should contain alphabets only');
    }
  };

  const handleCgpaChange = (e) => {
    const val = e.target.value;
    setSaved(false);

    if (val === '') {
      setCgpa('');
      setCgpaError('');
      return;
    }

    const num = Number(val);
    if (isNaN(num)) {
      setCgpaError('Please enter a valid number');
      return;
    }

    if (num > 10) {
      setCgpaError('CGPA cannot exceed 10');
      return;
    }

    if (num < 0) {
      setCgpaError('CGPA cannot be negative');
      return;
    }

    setCgpaError('');
    setCgpa(val);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Please enter your full name');
      return;
    }
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      setNameError('Full name should contain alphabets only');
      return;
    }
    if (cgpa !== '') {
      const num = Number(cgpa);
      if (isNaN(num) || num < 0 || num > 10) {
        setCgpaError('CGPA cannot exceed 10');
        return;
      }
    }
    setNameError('');
    setCgpaError('');
    setSaveError('');
    setSaving(true);

    try {
      const cleanProjects = projects.map(p => p.trim()).filter(Boolean);
      const parsedCgpa = (cgpa === '' || cgpa === null || cgpa === undefined) ? null : Number(cgpa);
      const { profile } = await api.updateProfile({
        name: name.trim(),
        department: department.trim(),
        linkedin: linkedin.trim(),
        cgpa: parsedCgpa,
        skills,
        certifications,
        projects: cleanProjects,
      });

      if (profile) {
        setName(profile.name || '');
        setLinkedin(profile.linkedin || '');
        setCgpa(profile.cgpa != null ? String(profile.cgpa) : '');
        setDepartment(profile.department || '');
        setSkills(profile.skills || []);
        setCertifications(profile.certifications || []);
        if (profile.projects && profile.projects.length > 0) {
          setProjects(profile.projects);
        }
        setResume(profile.resume);
        setExtracted(profile.extractedSkills || []);
      }
      setSaved(true);
      setAiVersion(v => v + 1);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadNotice('');
    setUploadError('');
    try {
      const { profile } = await api.uploadResume(file);
      if (profile) {
        setResume(profile.resume);
        setExtracted(profile.extractedSkills || []);
        setAiVersion(v => v + 1);
        setUploadNotice('Resume uploaded. Run an analysis below to see your score.');
        setTimeout(() => setUploadNotice(''), 5000);
      }
    } catch (err) {
      // Unreadable or non-resume files are rejected by the server with a "please re-upload" message
      setUploadError(err.status === 422 ? err.message : `Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const resumeDisplayName = (typeof resume === 'string' ? resume : resume?.originalName) || '';

  return (
    <div className="workspace student-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMART CAREER INSIGHTS</p>
          <h1>Your Resume, <em>Smarter with AI</em></h1>
          <p className="muted">Get instant AI-powered resume analysis, skill recommendations, and job compatibility scores to improve your placement opportunities.</p>
        </div>
        <Tag tone={resumeDisplayName ? 'success' : ''}>
          <CheckCircle2 size={13} /> {resumeDisplayName ? 'Resume uploaded' : 'Add a resume to get match-ready'}
        </Tag>
      </div>

      <div className="student-grid">
        <section className="panel profile-panel">
          <div className="panel-heading">
            <div>
              <b>Your profile</b>
            </div>
            <button className="small-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          <div className="form-grid">
            <label>
              Full name
              <input
                type="text"
                className={nameError ? 'has-error' : ''}
                placeholder="e.g. Aarav Sharma"
                value={name}
                onChange={handleNameChange}
              />
              {nameError && <small className="field-error">{nameError}</small>}
            </label>

            <label>
              LinkedIn Profile URL
              <input
                type="url"
                placeholder="https://linkedin.com/in/your-profile"
                value={linkedin}
                onChange={e => { setLinkedin(e.target.value); setSaved(false); }}
              />
            </label>

            <label>
              CGPA
              <input
                type="number"
                className={cgpaError ? 'has-error' : ''}
                placeholder="Enter your CGPA (e.g. 8.5)"
                min="0"
                max="10"
                step="0.01"
                value={cgpa}
                onChange={handleCgpaChange}
                onKeyDown={e => {
                  if (['e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {cgpaError ? (
                <small className="field-error">{cgpaError}</small>
              ) : (
                <small className="field-hint">
                  Enter your current academic CGPA (out of 10).
                </small>
              )}
            </label>

            <label>
              Department
              <select
                value={department}
                onChange={e => {
                  setDepartment(e.target.value);
                  setSaved(false);
                }}
                required
                className={!department ? 'is-placeholder' : ''}
              >
                <option value="" disabled>
                  Select your department
                </option>
                <option value="Computer Engineering">
                  Computer Engineering
                </option>
                <option value="Information Technology">
                  Information Technology
                </option>
                <option value="Electronics and Computer Science Engineering">
                  Electronics and Computer Science Engineering
                </option>
                <option value="Electronics">
                  Electronics
                </option>
                <option value="Mechanical Engineering">
                  Mechanical Engineering
                </option>
                <option value="Civil Engineering">
                  Civil Engineering
                </option>
                {department && !['Computer Engineering', 'Information Technology', 'Electronics and Computer Science Engineering', 'Electronics', 'Mechanical Engineering', 'Civil Engineering'].includes(department) && (
                  <option value={department}>{department}</option>
                )}
              </select>
            </label>
          </div>

          <TagInput
            label="Skills"
            values={skills}
            onChange={(v) => { setSkills(v); setSaved(false); }}
            placeholder="e.g. React, Python, SQL — press Enter after each"
            hint="Add the technical skills you can show evidence for. Press Enter or comma after each one."
            suggestions={extracted}
            suggestionLabel="Found in your resume:"
          />

          <TagInput
            label="Certifications"
            values={certifications}
            onChange={(v) => { setCertifications(v); setSaved(false); }}
            placeholder="e.g. AWS Cloud Practitioner — press Enter after each"
            hint="Include the issuer if helpful, e.g. “Google Data Analytics (Coursera)”."
            max={20}
          />

          <div className="project-links-full">
            <label>Project Links</label>
            {projects.map((project, index) => (
              <div className="input-add" key={index}>
                <input
                  type="url"
                  placeholder="https://github.com/username/project"
                  value={project}
                  onChange={e =>
                    setProjects(current =>
                      current.map((item, i) =>
                        i === index ? e.target.value : item
                      )
                    )
                  }
                />
                {projects.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    title="Remove link"
                    aria-label="Remove project"
                    onClick={() =>
                      setProjects(current => current.filter((_, i) => i !== index))
                    }
                  >
                    <X size={15} />
                  </button>
                )}
                {index === projects.length - 1 && (
                  <button
                    type="button"
                    aria-label="Add another project"
                    title="Add project link"
                    onClick={() => setProjects(current => [...current, ''])}
                  >
                    <Plus size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {saved && <p className="inline-success" style={{ marginTop: '8px' }}><CheckCircle2 size={14} /> Profile changes saved to database.</p>}
          {saveError && <p className="field-error" style={{ marginTop: '8px' }}>{saveError}</p>}
        </section>

        <section className="resume-card">
          <p className="resume-card-eyebrow">YOUR RESUME</p>
          <h3>{resumeDisplayName ? 'Ready for analysis' : 'Upload your resume'}</h3>
          <p className="resume-card-sub">PDF, Word (DOC or DOCX) or TXT · up to 5 MB</p>

          <label className={`resume-drop ${uploading ? 'is-busy' : ''}`}>
            <Upload size={20} />
            <span className="resume-drop-name">
              {uploading ? 'Uploading…' : resumeDisplayName || 'No file yet'}
            </span>
            <span className="resume-drop-btn">{resumeDisplayName ? 'Replace file' : 'Choose file'}</span>
            {/* Native input is hidden: its "No file chosen" text contradicted the saved file name */}
            <input
              className="resume-file-input"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleResumeUpload}
              disabled={uploading}
            />
          </label>
          {uploadNotice && <p className="resume-card-msg ok"><CheckCircle2 size={14} /> {uploadNotice}</p>}
          {uploadError && <p className="resume-card-msg err"><AlertTriangle size={14} /> {uploadError}</p>}

          {extracted.length > 0 && (
            <>
              <p className="resume-card-eyebrow">SKILLS FOUND IN YOUR RESUME</p>
              <div className="resume-card-skills">
                {extracted.map(s => <span key={s}>{s}</span>)}
              </div>
            </>
          )}

          <p className="resume-card-eyebrow">HOW IT WORKS</p>
          <ol className="resume-steps">
            <li><span><b>Upload</b> your latest resume.</span></li>
            <li><span><b>Analyse</b> it for overall quality or for a role you're aiming at.</span></li>
            <li><span><b>Improve</b> it with the suggestions, then upload again to see your score move.</span></li>
          </ol>
        </section>
      </div>

      <ResumeAnalysis version={aiVersion} hasResume={Boolean(resumeDisplayName)} />
    </div>
  );
}

export { StudentDashboard as StudentView };
export default StudentDashboard;
