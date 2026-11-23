import fs from 'node:fs/promises';
import { Router } from 'express';
import StudentProfile from '../models/StudentProfile.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resumeUpload } from '../middleware/upload.js';
import { extractSkillsFromText, parseResumeText } from '../services/skills.js';
import { resumeProblem } from '../services/resumeScoring.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();

// Returns the saved profile. Resume analysis (routes/analysis.js) runs only when the student asks for it.
async function respondWithAnalysis(res, profileId, extra = {}) {
  const fresh = await StudentProfile.findById(profileId);
  res.json({ profile: { ...fresh.toPublic(), ...extra } });
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

async function getOrCreateProfile(userId) {
  let profile = await StudentProfile.findOne({ user: userId });
  if (!profile) {
    const user = await User.findById(userId);
    profile = await StudentProfile.create({ user: userId, name: user?.name || '', email: user?.email });
  }
  return profile;
}

// GET /api/profile/me
router.get('/me', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const profile = await getOrCreateProfile(req.user.id);
  // Skills come from the resume. Profiles saved before that rule get their skills synced once here.
  if (profile.resume?.originalName && !sameList(profile.skills, profile.extractedSkills)) {
    profile.skills = profile.extractedSkills;
    await profile.save();
  }
  res.json({ profile: profile.toPublic() });
}));

// PUT /api/profile/me  { name, department, cgpa, linkedin } — skills come from the uploaded resume
router.put('/me', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const profile = await getOrCreateProfile(req.user.id);
  const { name, department, cgpa, linkedin } = req.body;

  if (name !== undefined) profile.name = String(name).trim().slice(0, 120);
  if (department !== undefined) profile.department = String(department).trim().slice(0, 120);
  if (linkedin !== undefined) profile.linkedin = String(linkedin).trim().slice(0, 300);
  if (cgpa !== undefined) {
    if (cgpa === '' || cgpa === null) profile.cgpa = null;
    else {
      const value = Number(cgpa);
      if (Number.isNaN(value) || value < 0 || value > 10) throw new HttpError(400, 'CGPA must be between 0 and 10.');
      profile.cgpa = Math.round(value * 100) / 100;
    }
  }

  await profile.save();
  if (name !== undefined) await User.updateOne({ _id: req.user.id }, { name: profile.name });
  await respondWithAnalysis(res, profile._id);
}));

// POST /api/profile/me/resume  (multipart/form-data, field "resume")
router.post(
  '/me/resume',
  requireAuth,
  requireRole('student'),
  resumeUpload.single('resume'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a resume file to upload.');

    // Parse text from uploaded resume (PDF, DOCX, TXT). An unreadable or non-resume file is
    // rejected here, and the previously saved resume is kept.
    const text = (await parseResumeText(req.file.path, req.file.originalname)) || '';
    const problem = resumeProblem(text);
    if (problem) {
      await fs.unlink(req.file.path).catch(() => {});
      throw new HttpError(422, problem);
    }

    const profile = await StudentProfile.findOne({ user: req.user.id }).select('+resume.path')
      || (await getOrCreateProfile(req.user.id));

    const oldPath = profile.resume?.path;
    profile.resume = {
      path: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
    };

    profile.extractedSkills = extractSkillsFromText(text);
    // The skills found in the resume are the student's saved skills (shown on the resume card)
    profile.skills = profile.extractedSkills;
    // Saved so the AI can use it later without re-reading the file
    profile.resumeText = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000);

    await profile.save();
    if (oldPath && oldPath !== req.file.path) fs.unlink(oldPath).catch(() => {});
    await respondWithAnalysis(res, profile._id);
  })
);

// GET /api/profile/:userId/resume — the student themself or any placement officer
router.get('/:userId/resume', requireAuth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'tpo' && req.user.id !== userId) throw new HttpError(403, 'You cannot view this resume.');
  const profile = await StudentProfile.findOne({ user: userId }).select('+resume.path');
  if (!profile?.resume?.path) throw new HttpError(404, 'No resume uploaded.');
  res.download(profile.resume.path, profile.resume.originalName);
}));

export default router;
