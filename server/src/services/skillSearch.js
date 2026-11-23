// Skill search for placement officers: how strongly each student shows a skill, from the evidence in
// their resume and profile. Rule-based, so a search never costs an AI call.
import { mentionsAny, splitSections } from './resumeScoring.js';

/*
 * Evidence score for one skill, 0-100:
 *   Used in projects / experience   60, +8 for each further line that uses it (up to +24)
 *   Only listed on the resume       30
 *   Related certification           +16 on top of either; 25 on its own
 *   Only typed into the profile     10
 *   Not found                       0
 */
export const LEVELS = ['proven', 'listed', 'profile', 'none'];

const BULLET = /^([•●▪◦‣*·–—-]|\d+[.)])\s*/;

/** Lines that show the skill being used: from the experience/projects sections when the resume has them. */
function usageLines(text, sections, skill) {
  const body = [sections.experience, sections.projects, sections.achievements].filter(Boolean).join('\n');
  // Without recognisable headings, count full sentences (6+ words) outside the skills list
  const source = body || Object.entries(sections).filter(([k]) => k !== 'skills').map(([, v]) => v).join('\n');
  return source.split('\n')
    .map((l) => l.replace(BULLET, '').trim())
    .filter((l) => (body || l.split(/\s+/).length >= 6) && mentionsAny(l, skill));
}

export function scoreSkill(skill, profile, sections) {
  const text = profile.resumeText || '';
  const uses = text ? usageLines(text, sections, skill).length : 0;
  const listed = Boolean(text) && mentionsAny(text, skill);
  const cert = (profile.certifications || []).find((c) => mentionsAny(c, skill))
    || (sections.certifications && mentionsAny(sections.certifications, skill) ? 'listed on resume' : null);
  const claimed = (profile.skills || []).some((s) => s.toLowerCase() === skill.toLowerCase() || mentionsAny(s, skill));

  const reasons = [];
  let score = 0;
  let level = 'none';
  if (uses > 0) {
    level = 'proven';
    score = 60 + 8 * Math.min(uses - 1, 3);
    reasons.push(`Used in ${uses} project or experience line${uses === 1 ? '' : 's'}`);
  } else if (listed) {
    level = 'listed';
    score = 30;
    reasons.push('Listed on the resume, but no project or experience shows it being used');
  }
  if (cert) {
    score = level === 'none' ? 25 : score + 16;
    if (level === 'none') level = 'profile';
    reasons.push(cert === 'listed on resume' ? 'Related certification on the resume' : `Certification: ${cert}`);
  }
  if (level === 'none' && claimed) {
    level = 'profile';
    score = 10;
    reasons.push('Only added to the profile; the resume does not mention it');
  }
  if (level === 'none') reasons.push('Not found on the resume or profile');
  return { skill, score: Math.min(score, 100), level, reasons };
}

/** Up to 8 skills, duplicates (any case) removed, keeping the spelling typed first. */
function cleanSkills(skills) {
  const seen = new Map();
  for (const raw of Array.isArray(skills) ? skills : []) {
    const s = String(raw || '').trim().slice(0, 40);
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  }
  return [...seen.values()].slice(0, 8);
}

/**
 * Ranks the given profiles for the skills. Returns per-skill coverage (how many students have each
 * skill, and at what level) and the students, strongest first.
 */
export function rankStudents(profiles, skillsInput, { limit = 200 } = {}) {
  const skills = cleanSkills(skillsInput);
  const students = profiles.map((p) => {
    const sections = splitSections(p.resumeText || '');
    const perSkill = skills.map((s) => scoreSkill(s, p, sections));
    return {
      userId: String(p.user),
      name: p.name || p.email || 'Student',
      department: p.department || '',
      cgpa: p.cgpa ?? null,
      hasResume: Boolean(p.resume?.originalName),
      score: perSkill.length ? Math.round(perSkill.reduce((t, s) => t + s.score, 0) / perSkill.length) : 0,
      found: perSkill.filter((s) => s.level !== 'none').length,
      skills: perSkill,
    };
  }).sort((a, b) => b.score - a.score || b.found - a.found || (b.cgpa ?? -1) - (a.cgpa ?? -1) || a.name.localeCompare(b.name));

  const total = students.length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const coverage = skills.map((skill, i) => {
    const counts = Object.fromEntries(LEVELS.map((l) => [l, students.filter((s) => s.skills[i].level === l).length]));
    const top = students.filter((s) => s.skills[i].score > 0).sort((a, b) => b.skills[i].score - a.skills[i].score)[0];
    return {
      skill,
      counts,
      havePct: pct(total - counts.none),
      missingPct: total ? 100 - pct(total - counts.none) : 0,
      sharpest: top ? {
        userId: top.userId,
        name: top.name,
        score: top.skills[i].score,
        // Others with the same top score, so a tie is never shown as a single winner
        tiedWith: students.filter((s) => s !== top && s.skills[i].score === top.skills[i].score).length,
      } : null,
    };
  });

  return { total, skills, coverage, students: students.slice(0, limit) };
}
