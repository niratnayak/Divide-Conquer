import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { runGeneral, runRole, latestAnalyses } from '../services/analysis.js';
import { ROLE_NAMES, CUSTOM_ROLE } from '../services/resumeScoring.js';
import { isLLMConfigured } from '../services/llm.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

// GET /api/analysis/roles — options for the role dropdown
router.get('/roles', (req, res) => {
  res.json({ roles: [...ROLE_NAMES, CUSTOM_ROLE], aiEnabled: isLLMConfigured() });
});

// GET /api/analysis/latest — most recent general and role-specific results
router.get('/latest', asyncHandler(async (req, res) => {
  res.json(await latestAnalyses(req.user.id));
}));

// POST /api/analysis/general — Mode A, independent of any job
router.post('/general', asyncHandler(async (req, res) => {
  res.json(await runGeneral(req.user.id));
}));

// POST /api/analysis/role  { role, jd? } — Mode B
router.post('/role', asyncHandler(async (req, res) => {
  res.json(await runRole(req.user.id, { role: req.body?.role, jd: req.body?.jd }));
}));

export default router;
