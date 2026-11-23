// Rule-based parts of resume analysis: section detection, measurable-impact and formatting
// checks, skill classification, and the checks that keep AI suggestions honest.
// The AI only scores the categories that need judgement; every total is added up here.
import { readFileSync } from 'node:fs';
import { mentionsSkill, extractSkillsFromText } from './skills.js';

const ROLE_FILE = JSON.parse(readFileSync(new URL('../config/roles.json', import.meta.url), 'utf8'));
export const ROLE_NAMES = Object.keys(ROLE_FILE.roles);
export const CUSTOM_ROLE = 'Other / Custom Role';

/** Reference competencies for a dropdown role, or null for a custom role. */
export function roleReference(role) {
  const key = ROLE_NAMES.find((r) => r.toLowerCase() === String(role || '').trim().toLowerCase());
  return key ? { name: key, ...ROLE_FILE.roles[key] } : null;
}

// ---------- Text helpers ----------

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Common alternative spellings, so "JS" counts for JavaScript and "Jest" counts for Testing
const ALIASES = {
  javascript: ['JS'],
  typescript: ['TS'],
  'node.js': ['Node', 'NodeJS', 'Node JS'],
  react: ['React.js', 'ReactJS'],
  'next.js': ['NextJS'],
  rest: ['RESTful', 'REST API', 'REST APIs'],
  apis: ['API'],
  postgresql: ['Postgres'],
  'machine learning': ['ML'],
  'deep learning': ['DL', 'neural network', 'neural networks'],
  kubernetes: ['K8s'],
  'ci/cd': ['CICD', 'CI CD', 'GitHub Actions'],
  gcp: ['Google Cloud'],
  aws: ['Amazon Web Services'],
  'scikit-learn': ['sklearn', 'Scikit Learn'],
  testing: ['Jest', 'unit tests', 'unit testing', 'Cypress', 'PyTest', 'Selenium', 'Mocha'],
  oop: ['object oriented', 'object-oriented'],
  llm: ['LLMs', 'large language model', 'large language models', 'GPT'],
  databases: ['database', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL'],
  'data visualization': ['data visualisation', 'Matplotlib', 'Seaborn', 'Power BI', 'Tableau'],
  'vector database': ['vector DB', 'Pinecone', 'FAISS', 'ChromaDB'],
  scripting: ['Bash', 'Shell scripting', 'shell script'],
  'cloud computing': ['cloud'],
};

/** Whole-word match. Short all-caps acronyms (SQL, REST, AWS) are case-sensitive so "the rest" ≠ REST. */
function mentionsTerm(text, term) {
  if (!text || !term) return false;
  if (/^[A-Z][A-Z0-9/+#]{1,4}$/.test(term)) {
    return new RegExp(`(^|[^A-Za-z0-9+#])${escape(term)}s?($|[^A-Za-z0-9+#])`).test(text);
  }
  return mentionsSkill(text, term);
}

// Every skill or tool name we know of: used to catch AI rewrites that bring in a new skill
const VOCABULARY = [...new Set([
  ...Object.values(ROLE_FILE.roles).flatMap((r) => [...r.required, ...r.preferred]),
  ...Object.values(ALIASES).flat().filter((t) => /^[A-Z]/.test(t)),
])];

export function mentionsAny(text, skill) {
  return [skill, ...(ALIASES[String(skill).toLowerCase()] || [])].some((t) => mentionsTerm(text, t));
}

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[•●▪◦‣*–—·"“”'‘’-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const dedupe = (arr) => {
  const seen = new Map();
  for (const s of arr) if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  return [...seen.values()];
};

const cleanList = (arr, n, len = 240) => (Array.isArray(arr) ? arr : [])
  .filter((s) => typeof s === 'string' && s.trim())
  .map((s) => s.trim().slice(0, len))
  .slice(0, n);

const PRIORITIES = ['high', 'medium', 'low'];
const cleanActions = (arr, n) => (Array.isArray(arr) ? arr : []).slice(0, n).map((a) => ({
  title: String(a?.title || '').slice(0, 120),
  detail: String(a?.detail || '').slice(0, 400),
  priority: PRIORITIES.includes(a?.priority) ? a.priority : 'medium',
})).filter((a) => a.title);

const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

// ---------- Sections ----------

const SECTION_PATTERNS = {
  summary: /^(professional |career )?(summary|profile|objective|about( me)?)$/,
  education: /^(education|academics?|academic (background|details|qualifications)|qualifications|educational qualifications?)$/,
  experience: /^((work|professional|internship) )?(experience|internships?|employment( history)?|work history)$/,
  projects: /^((academic|personal|key|technical|major) )?projects?$/,
  skills: /^((technical|key|core) )?skills( (and|&) (tools|technologies|interests))?$|^(tech stack|technologies|tools (and|&) technologies)$/,
  achievements: /^(achievements?|awards?|honou?rs?|accomplishments|awards (and|&) achievements|achievements (and|&) awards)$/,
  certifications: /^(certifications?|certificates|licenses?( (and|&) certifications)?|courses( (and|&) certifications)?)$/,
  other: /^(extra ?curricular( activities)?|positions? of responsibility|leadership|volunteering|hobbies|interests|languages|activities|publications)$/,
};

function headingKey(line) {
  if (!line || line.length > 45) return null;
  const h = line.toLowerCase().replace(/[^a-z& ]/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.keys(SECTION_PATTERNS).find((k) => SECTION_PATTERNS[k].test(h)) || null;
}

/** Splits resume text by headings. Text before the first heading goes under "header". */
export function splitSections(text) {
  const sections = {};
  let current = 'header';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const key = headingKey(line);
    if (key) { current = key; sections[key] = sections[key] || ''; continue; }
    if (line) sections[current] = sections[current] ? `${sections[current]}\n${line}` : line;
  }
  return sections;
}

const detectedCount = (sections) => Object.keys(sections).filter((k) => k !== 'header').length;

// ---------- Is this a readable resume? ----------

export const UNREADABLE_RESUME = "We couldn't read the text in this file. It may be a scanned image or a photo. Please re-upload your resume as a text-based PDF or Word file.";
export const NOT_A_RESUME = "This file doesn't look like a resume: no contact details or resume sections (such as Education, Skills or Projects) were found. Please re-upload your resume.";

const RESUME_TERMS = /\b(education|bachelor|degree|university|college|institute|cgpa|gpa|internships?|projects?|skills|experience|certifications?|b\.?\s?tech|m\.?\s?tech|b\.?\s?e\.)/gi;

/**
 * Null if the text reads as a resume, otherwise the message to show. Rule-based, so no AI call
 * is spent on a scanned image, a garbled file or a document that isn't a resume.
 */
export function resumeProblem(text) {
  const t = String(text || '');
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  // Scanned PDFs give no text; broken encodings give mostly symbols
  if (letters < 150 || letters / t.replace(/\s/g, '').length < 0.5) return UNREADABLE_RESUME;

  const contact = /\S+@\S+\.\S+/.test(t) || /(\+?\d[\d\s-]{8,}\d)/.test(t);
  const headings = detectedCount(splitSections(t)) >= 2;
  const terms = new Set((t.match(RESUME_TERMS) || []).map((s) => s.toLowerCase())).size >= 3;
  const skills = extractSkillsFromText(t).length >= 2;
  const signals = [contact, headings, terms, skills].filter(Boolean).length;
  return (contact || headings) && signals >= 2 ? null : NOT_A_RESUME;
}

const BULLET = /^([•●▪◦‣*·–—-]|\d+[.)])\s*/;

/** Bullet points from experience and projects (falls back to longer lines if no bullet marks survived). */
export function bulletLines(sections) {
  const body = [sections.experience, sections.projects].filter(Boolean).join('\n')
    .split('\n').map((l) => l.trim()).filter(Boolean);
  const marked = body.filter((l) => BULLET.test(l));
  const lines = marked.length >= 2 ? marked : body.filter((l) => l.split(/\s+/).length >= 6);
  return lines.map((l) => l.replace(BULLET, '').trim()).filter(Boolean);
}

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}\b/gi;

/** True if a bullet contains a number that is a result, not just a date. */
export function hasMetric(line) {
  const cleaned = line.replace(MONTHS, ' ').replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\b\d{1,2}\/\d{2,4}\b/g, ' ');
  return /\d/.test(cleaned);
}

function impactStats(sections) {
  const bullets = bulletLines(sections);
  const withNumbers = bullets.filter(hasMetric).length;
  return { total: bullets.length, withNumbers, ratio: bullets.length ? withNumbers / bullets.length : 0 };
}

const impactReason = ({ total, withNumbers }) => (total
  ? `${withNumbers} of ${total} project/experience bullets show a measurable result.`
  : 'No project or experience bullets found to check for measurable results.');

// ---------- Rule-scored categories ----------

/** Formatting and structure, out of 15. */
export function formattingScore(text, sections) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  const good = [];
  const issues = [];
  let score = 0;

  const core = [['education', 'Education'], ['skills', 'Skills']];
  for (const [key, label] of core) {
    if (sections[key]) score += 2; else issues.push(`No ${label} section heading found`);
  }
  if (sections.projects || sections.experience) score += 2; else issues.push('No Projects or Experience section heading found');

  if (words >= 250 && words <= 900) { score += 3; good.push(`good length (${words} words)`); }
  else if (words >= 150 && words <= 1200) { score += 1; issues.push(`${words} words: aim for roughly 300-800 for a one-page fresher resume`); }
  else issues.push(`${words} words: ${words < 150 ? 'too thin to judge well' : 'too long for a fresher resume'}`);

  const hasEmail = /\S+@\S+\.\S+/.test(text);
  const hasPhone = /(\+?\d[\d\s-]{8,}\d)/.test(text);
  score += (hasEmail ? 1 : 0) + (hasPhone ? 1 : 0);
  if (!hasEmail) issues.push('No email address found');
  if (!hasPhone) issues.push('No phone number found');

  if (bulletLines(sections).length >= 4) { score += 2; good.push('uses bullet points'); }
  else issues.push('Few bullet points under projects/experience');

  // Two-column and table layouts usually come out of PDF readers as many 1-2 word fragments
  const shortShare = lines.length ? lines.filter((l) => l.split(/\s+/).length <= 2).length / lines.length : 0;
  const layoutSuspect = lines.length > 40 && shortShare > 0.45;
  if (layoutSuspect) issues.push('Text reads as fragments: a two-column or table layout may confuse applicant tracking systems');
  else score += 2;

  return {
    score,
    reason: issues.length ? `${issues.slice(0, 3).join('; ')}.` : `Clean structure: ${good.join(', ')}.`,
    issues,
    layoutSuspect,
  };
}

/** Skills presentation, out of 15. */
export function skillsPresentation(sections) {
  const skillsText = sections.skills || '';
  if (!skillsText) return { score: 0, reason: 'No Skills section found.' };
  const listed = extractSkillsFromText(skillsText);
  const evidence = [sections.experience, sections.projects].filter(Boolean).join('\n');
  const used = listed.filter((s) => mentionsAny(evidence, s));
  const grouped = skillsText.split('\n').filter((l) => l.includes(':')).length >= 2;

  let score = 4;
  if (grouped) score += 3;
  if (listed.length >= 6 && listed.length <= 30) score += 3;
  else if (listed.length) score += 1;
  if (listed.length) score += Math.round(5 * (used.length / listed.length));

  const parts = [`${listed.length} recognised skills`, grouped ? 'grouped by type' : 'not grouped (try "Languages: … / Frameworks: …")'];
  if (listed.length) parts.push(`${used.length} of them backed by a project or experience`);
  if (listed.length > 30) parts.push('the list is long enough to look like keyword stuffing');
  return { score: Math.min(15, score), reason: `${parts.join(', ')}.` };
}

const EXPECTED_SECTIONS = [
  ['summary', 'Professional summary', false],
  ['education', 'Education', false],
  ['skills', 'Skills', false],
  ['projects', 'Projects', false],
  ['experience', 'Internships / work experience', true],
  ['achievements', 'Achievements', true],
  ['certifications', 'Certifications', true],
];

export function missingSections(text, sections) {
  const out = [];
  if (!/\S+@\S+\.\S+/.test(text) || !/(\+?\d[\d\s-]{8,}\d)/.test(text)) {
    out.push({ label: 'Contact details (email and phone)', status: 'incomplete', optional: false });
  }
  for (const [key, label, optional] of EXPECTED_SECTIONS) {
    if (sections[key] === undefined) out.push({ label, status: 'missing', optional });
    else if (sections[key].length < 40) out.push({ label, status: 'incomplete', optional });
  }
  return out;
}

// ---------- Honesty checks on AI output ----------

/** True if `quote` really appears in the resume (ignoring case, bullets and spacing). */
export function quotedFromResume(text, quote) {
  const q = norm(quote);
  return q.length >= 12 && norm(text).includes(q);
}

/**
 * Makes an AI rewrite safe to show: numbers that are not in the original line become [X]
 * placeholders, and a rewrite that brings in a skill the resume never mentions is dropped.
 */
export function honestRewrite(original, suggestion, resumeText, vocabulary = VOCABULARY) {
  const allowed = new Set(String(original).match(/\d+(?:\.\d+)?/g) || []);
  const fixed = String(suggestion || '').replace(/\[[^\]]*\]|\d+(?:\.\d+)?/g, (m) => {
    if (m.startsWith('[')) return m.replace(/\d+(?:\.\d+)?/g, (d) => (allowed.has(d) ? d : 'X'));
    return allowed.has(m) ? m : '[X]';
  }).trim();
  if (!fixed) return null;
  const newSkills = [...extractSkillsFromText(fixed), ...vocabulary.filter((v) => mentionsAny(fixed, v))]
    .filter((s) => !mentionsAny(resumeText, s));
  return newSkills.length ? null : fixed;
}

function lineSuggestions(list, text) {
  return (Array.isArray(list) ? list : []).flatMap((s) => {
    const original = String(s?.original || '').trim();
    if (!quotedFromResume(text, original)) return [];
    const suggestion = honestRewrite(original, s?.suggestion, text);
    if (!suggestion || norm(suggestion) === norm(original)) return [];
    return [{ original: original.slice(0, 300), issue: String(s?.issue || '').slice(0, 240), suggestion: suggestion.slice(0, 400) }];
  }).slice(0, 8);
}

// ---------- Totals ----------

/** Total out of 100 over the categories that apply. N/A categories hand their weight to the rest. */
export function totalScore(categories) {
  const live = categories.filter((c) => c.applicable);
  const max = live.reduce((s, c) => s + c.max, 0);
  return max ? Math.round((live.reduce((s, c) => s + c.score, 0) / max) * 100) : 0;
}

const NO_EXPERIENCE = 'No internship or work experience found: scored as a fresher, so these points are shared across the other categories.';

function experienceApplies(sections, ai) {
  return detectedCount(sections) >= 2 ? Boolean(sections.experience) : ai?.hasExperience !== false;
}

// ---------- Mode A: general analysis ----------

export function buildGeneral(text, ai) {
  const sections = splitSections(text);
  const headingsFound = detectedCount(sections) >= 2;
  const fmt = formattingScore(text, sections);
  const skills = skillsPresentation(sections);
  const impact = impactStats(sections);
  const hasExp = experienceApplies(sections, ai);
  const ruleSaysMissing = (key) => headingsFound && !sections[key];

  const categories = [
    { key: 'formatting', label: 'Formatting & structure', max: 15, score: fmt.score, reason: fmt.reason, source: 'rules' },
    ruleSaysMissing('summary')
      ? { key: 'summary', label: 'Professional summary', max: 10, score: 0, reason: 'No summary or objective section found.', source: 'rules' }
      : { key: 'summary', label: 'Professional summary', max: 10, score: clamp(ai.summaryScore, 10), reason: String(ai.summaryReason || ''), source: 'ai' },
    { key: 'skills', label: 'Skills presentation', max: 15, score: skills.score, reason: skills.reason, source: 'rules' },
    ruleSaysMissing('projects')
      ? { key: 'projects', label: 'Project descriptions', max: 20, score: 0, reason: 'No projects section found.', source: 'rules' }
      : { key: 'projects', label: 'Project descriptions', max: 20, score: clamp(ai.projectsScore, 20), reason: String(ai.projectsReason || ''), source: 'ai' },
    hasExp
      ? { key: 'experience', label: 'Experience & internships', max: 15, score: clamp(ai.experienceScore, 15), reason: String(ai.experienceReason || ''), source: 'ai' }
      : { key: 'experience', label: 'Experience & internships', max: 15, score: 0, reason: NO_EXPERIENCE, source: 'rules', applicable: false },
    {
      key: 'impact', label: 'Achievements & impact', max: 15,
      score: Math.round(12 * Math.min(1, impact.ratio / 0.5)) + (sections.achievements ? 3 : 0),
      reason: `${impactReason(impact)}${sections.achievements ? ' Has an achievements section.' : ' No achievements section.'}`,
      source: 'rules',
    },
    { key: 'grammar', label: 'Grammar & readability', max: 10, score: clamp(ai.grammarScore, 10), reason: String(ai.grammarReason || ''), source: 'ai' },
  ].map((c) => ({ applicable: true, ...c, reason: c.reason.slice(0, 300) }));

  const missing = missingSections(text, sections);
  if (!headingsFound) missing.unshift({ label: 'Clear section headings (none could be detected)', status: 'missing', optional: false });

  return {
    score: totalScore(categories),
    categories,
    strengths: cleanList(ai.strengths, 5),
    weaknesses: cleanList(ai.weaknesses, 5),
    missingSections: missing,
    lineSuggestions: lineSuggestions(ai.lineSuggestions, text),
    priorities: cleanActions(ai.priorities, 5),
    formattingIssues: fmt.issues,
  };
}

// ---------- Mode B: role-specific analysis ----------

/** matched: used in a project/experience · partial: only listed · claimed: only in the profile form · notFound */
export function classifySkill(skill, text, sections, claimed = []) {
  const hasBody = sections.experience || sections.projects;
  const evidence = hasBody ? [sections.experience, sections.projects, sections.achievements].filter(Boolean).join('\n') : text;
  if (mentionsAny(evidence, skill)) return 'matched';
  if (mentionsAny(text, skill)) return 'partial';
  if (claimed.some((c) => c.toLowerCase() === skill.toLowerCase() || mentionsAny(c, skill))) return 'claimed';
  return 'notFound';
}

function coverage(list, states) {
  if (!list.length) return null;
  return list.reduce((s, k) => s + (states[k] === 'matched' ? 1 : states[k] === 'partial' ? 0.5 : 0), 0) / list.length;
}

/** Requirements to check against: from the JD when one is given (verified against its text), else the role reference. */
export function requirementsFor({ jd, ref, ai }) {
  if (!jd) {
    return { required: ref?.required || [], preferred: ref?.preferred || [], keywords: ref?.keywords || [], source: 'reference' };
  }
  const inJd = (s) => mentionsAny(jd, s);
  const aiReq = cleanList(ai.jdRequiredSkills, 20, 60).filter(inJd);
  const aiPref = cleanList(ai.jdPreferredSkills, 15, 60).filter(inJd);
  const ruleSkills = dedupe([...extractSkillsFromText(jd), ...[...(ref?.required || []), ...(ref?.preferred || [])].filter(inJd)]);
  const prefKeys = new Set(aiPref.map((s) => s.toLowerCase()));
  const required = dedupe([...aiReq, ...ruleSkills.filter((s) => !prefKeys.has(s.toLowerCase()))]).slice(0, 15);
  const reqKeys = new Set(required.map((s) => s.toLowerCase()));
  const preferred = aiPref.filter((s) => !reqKeys.has(s.toLowerCase())).slice(0, 10);
  const keywords = dedupe([...cleanList(ai.jdKeywords, 15, 60).filter(inJd), ...(ref?.keywords || []).filter(inJd)])
    .filter((k) => !reqKeys.has(k.toLowerCase()) && !prefKeys.has(k.toLowerCase()))
    .slice(0, 12);
  return { required, preferred, keywords, source: 'jd' };
}

export function buildRole(text, { role, jd, ref, claimed = [] }, ai) {
  const sections = splitSections(text);
  const reqs = requirementsFor({ jd, ref, ai });
  const allSkills = dedupe([...reqs.required, ...reqs.preferred]);
  const states = Object.fromEntries(allSkills.map((s) => [s, classifySkill(s, text, sections, claimed)]));
  const kindOf = (s) => (reqs.required.includes(s) ? 'required' : 'preferred');
  const group = (state) => allSkills.filter((s) => states[s] === state).map((s) => ({ skill: s, kind: kindOf(s) }));

  const req = coverage(reqs.required, states);
  const pref = coverage(reqs.preferred, states);
  let techScore;
  let techReason;
  if (req === null && pref === null) {
    techScore = 0;
    techReason = 'No clear skill requirements could be found in the job description.';
  } else {
    techScore = req !== null && pref !== null ? 22 * req + 8 * pref : 30 * (req ?? pref);
    const m = reqs.required.filter((s) => states[s] === 'matched').length;
    const p = reqs.required.filter((s) => states[s] === 'partial').length;
    techReason = `${m} of ${reqs.required.length} required skills shown in projects/experience, ${p} only listed`
      + (reqs.preferred.length ? `; ${reqs.preferred.filter((s) => ['matched', 'partial'].includes(states[s])).length} of ${reqs.preferred.length} preferred skills present.` : '.');
  }

  const kwHits = reqs.keywords.filter((k) => mentionsAny(text, k));
  const impact = impactStats(sections);
  const hasExp = experienceApplies(sections, ai);

  const categories = [
    { key: 'technical', label: 'Technical skills', max: 30, score: Math.round(techScore), reason: techReason, source: 'rules' },
    { key: 'projects', label: 'Project relevance', max: 25, score: clamp(ai.projectScore, 25), reason: String(ai.projectReason || ''), source: 'ai' },
    hasExp
      ? { key: 'experience', label: 'Experience relevance', max: 15, score: clamp(ai.experienceScore, 15), reason: String(ai.experienceReason || ''), source: 'ai' }
      : { key: 'experience', label: 'Experience relevance', max: 15, score: 0, reason: NO_EXPERIENCE, source: 'rules', applicable: false },
    reqs.keywords.length
      ? {
        key: 'keywords', label: 'Role-specific keywords', max: 10, source: 'rules',
        score: Math.round((10 * kwHits.length) / reqs.keywords.length),
        reason: `${kwHits.length} of ${reqs.keywords.length} role keywords found${kwHits.length < reqs.keywords.length ? `; missing: ${reqs.keywords.filter((k) => !kwHits.includes(k)).slice(0, 5).join(', ')}` : ''}.`,
      }
      : { key: 'keywords', label: 'Role-specific keywords', max: 10, score: 0, reason: 'No role keywords to check.', source: 'rules', applicable: false },
    { key: 'education', label: 'Education & qualifications', max: 10, score: clamp(ai.educationScore, 10), reason: String(ai.educationReason || ''), source: 'ai' },
    { key: 'impact', label: 'Demonstrated impact', max: 10, score: Math.round(10 * Math.min(1, impact.ratio / 0.5)), reason: impactReason(impact), source: 'rules' },
  ].map((c) => ({ applicable: true, ...c, reason: c.reason.slice(0, 300) }));

  // Rejection reasons: facts from the rules first, then the AI's view
  const reasons = [];
  const missingReq = reqs.required.filter((s) => ['notFound', 'claimed'].includes(states[s]));
  if (missingReq.length) reasons.push(`Required skills not found in the resume: ${missingReq.slice(0, 6).join(', ')}.`);
  if (impact.total && impact.ratio < 0.25) reasons.push('Few bullets show measurable results, so the impact of the work is unclear.');
  const fmt = formattingScore(text, sections);
  if (fmt.layoutSuspect) reasons.push('The layout reads as fragments; an applicant tracking system may not parse it.');
  if (clamp(ai.projectScore, 25) < 10) reasons.push(`Projects do not clearly relate to ${role}.`);
  const allReasons = dedupe([...reasons, ...cleanList(ai.rejectionReasons, 4)]).slice(0, 6);

  return {
    score: totalScore(categories),
    categories,
    requirementSource: reqs.source,
    skills: {
      matched: group('matched'),
      partial: group('partial'),
      claimed: group('claimed'),
      notFound: group('notFound'),
    },
    keywordsMissing: reqs.keywords.filter((k) => !kwHits.includes(k)),
    relevantProjects: (Array.isArray(ai.relevantProjects) ? ai.relevantProjects : [])
      .filter((p) => norm(p?.name).length >= 3 && norm(text).includes(norm(p.name)))
      .slice(0, 5)
      .map((p) => ({ name: String(p.name).slice(0, 120), why: String(p.why || '').slice(0, 240) })),
    weakContent: (Array.isArray(ai.weakContent) ? ai.weakContent : [])
      .filter((w) => quotedFromResume(text, w?.text))
      .slice(0, 6)
      .map((w) => ({ text: String(w.text).slice(0, 300), why: String(w.why || '').slice(0, 240) })),
    rejectionReasons: allReasons,
    recommendations: cleanActions(ai.recommendations, 5),
  };
}
