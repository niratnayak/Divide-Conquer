import { Router } from 'express';
import StudentProfile from '../models/StudentProfile.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { rankStudents } from '../services/skillSearch.js';

const router = Router();
router.use(requireAuth, requireRole('tpo'));

// GET /api/students/departments — departments students have chosen, for the filter
router.get('/departments', asyncHandler(async (req, res) => {
  const departments = (await StudentProfile.distinct('department')).filter(Boolean).sort();
  res.json({ departments });
}));

// POST /api/students/search  { department?, minCgpa?, skills: [] } — students ranked by evidence for the skills
router.post('/search', asyncHandler(async (req, res) => {
  const { department, minCgpa, skills } = req.body || {};
  if (!Array.isArray(skills) || !skills.some((s) => String(s || '').trim())) {
    throw new HttpError(400, 'Enter at least one skill to search for.');
  }
  const filter = {};
  if (department) filter.department = String(department).slice(0, 120);
  if (minCgpa !== undefined && minCgpa !== null && minCgpa !== '') {
    const cutoff = Number(minCgpa);
    if (Number.isNaN(cutoff) || cutoff < 0 || cutoff > 10) throw new HttpError(400, 'CGPA cutoff must be between 0 and 10.');
    if (cutoff > 0) filter.cgpa = { $gte: cutoff }; // students without a CGPA don't pass a cutoff
  }
  const profiles = await StudentProfile.find(filter)
    .select('user name email department cgpa skills certifications resume.originalName +resumeText')
    .lean();
  res.json(rankStudents(profiles, skills));
}));

export default router;
