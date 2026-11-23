import { Router } from 'express';
import StudentProfile from '../models/StudentProfile.js';
import InterviewSession, { INTERVIEW_CATEGORIES, serializeSession } from '../models/InterviewSession.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { isLLMConfigured } from '../services/llm.js';
import { resumeProblem, roleReference } from '../services/resumeScoring.js';
import {
  generateQuestions, evaluateAnswer, planCounts, MIN_ANSWER_CHARS, MAX_ANSWER_CHARS,
} from '../services/interview.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

const dailyLimit = () => Number(process.env.AI_INTERVIEW_DAILY_LIMIT) || 40;
const today = () => new Date().toISOString().slice(0, 10);

async function readyProfile(userId) {
  const profile = await StudentProfile.findOne({ user: userId }).select('+resumeText');
  if (!profile?.resume?.originalName) throw new HttpError(400, 'Upload your resume before practising an interview.');
  const problem = resumeProblem(profile.resumeText);
  if (problem) throw new HttpError(422, problem);
  return profile;
}

/** Refuses when the student has used today's AI calls for interview practice (summed over their sessions). */
async function checkDailyLimit(profileId) {
  if (!isLLMConfigured()) throw new HttpError(424, 'AI is not set up on the server yet (GROQ_API_KEY is missing).');
  const day = today();
  const sessions = await InterviewSession.find({ profile: profileId, updatedAt: { $gte: new Date(`${day}T00:00:00Z`) } }).select('aiCalls');
  const used = sessions.reduce((n, s) => n + (s.aiCalls?.get(day) || 0), 0);
  if (used >= dailyLimit()) throw new HttpError(429, "You've reached today's interview practice limit. Try again tomorrow.");
}

const countCall = (session) => session.aiCalls.set(today(), (session.aiCalls.get(today()) || 0) + 1);

const aiError = (err) => new HttpError(/rate limit/i.test(err.message) ? 429 : 424, `The AI could not respond: ${err.message}`);

async function ownSession(userId, id) {
  const profile = await readyProfile(userId);
  const session = await InterviewSession.findOne({ _id: id, profile: profile._id });
  if (!session) throw new HttpError(404, 'Practice session not found.');
  return { profile, session };
}

// GET /api/interview/latest — the student's most recent practice session, or null
router.get('/latest', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  const session = profile && await InterviewSession.findOne({ profile: profile._id }).sort({ createdAt: -1 });
  res.json({ session: session ? serializeSession(session) : null, aiEnabled: isLLMConfigured() });
}));

// POST /api/interview/sessions  { role, jd?, categories: [], count } — new session with AI-written questions
router.post('/sessions', asyncHandler(async (req, res) => {
  const role = String(req.body?.role || '').trim().slice(0, 80);
  const jd = String(req.body?.jd || '').trim().slice(0, 8000);
  const categories = INTERVIEW_CATEGORIES.filter((c) => (req.body?.categories || []).includes(c));
  const count = Math.min(Math.max(Number(req.body?.count) || 5, 3), 10);
  if (!role) throw new HttpError(400, 'Choose the role you are preparing for.');
  if (!categories.length) throw new HttpError(400, 'Choose at least one question category.');
  const reference = roleReference(role);
  if (!reference && jd.length < 80) throw new HttpError(400, 'For a custom role, paste the job description so the questions fit it.');

  const profile = await readyProfile(req.user.id);
  await checkDailyLimit(profile._id);
  let questions;
  try {
    ({ questions } = await generateQuestions({
      resumeText: profile.resumeText, role: reference ? reference.name : role, jd, reference, plan: planCounts(categories, count),
    }));
  } catch (err) {
    throw aiError(err);
  }
  if (!questions.length) throw new HttpError(424, 'The AI did not produce usable questions. Please try again.');
  const session = new InterviewSession({ profile: profile._id, role: reference ? reference.name : role, jdText: jd, categories, questions });
  countCall(session);
  await session.save();
  res.status(201).json({ session: serializeSession(session) });
}));

// POST /api/interview/sessions/:id/questions/:qid/answer  { answer } — AI feedback on the answer
router.post('/sessions/:id/questions/:qid/answer', asyncHandler(async (req, res) => {
  const answer = String(req.body?.answer || '').trim();
  if (answer.length < MIN_ANSWER_CHARS) throw new HttpError(400, 'Write a fuller answer before asking for feedback.');
  if (answer.length > MAX_ANSWER_CHARS) throw new HttpError(400, `Keep your answer under ${MAX_ANSWER_CHARS} characters.`);
  const { profile, session } = await ownSession(req.user.id, req.params.id);
  const question = session.questions.id(req.params.qid);
  if (!question) throw new HttpError(404, 'Question not found.');

  await checkDailyLimit(profile._id);
  try {
    const { evaluation } = await evaluateAnswer({ question, resumeText: profile.resumeText, role: session.role, answer });
    question.answer = answer;
    question.evaluation = evaluation;
  } catch (err) {
    throw aiError(err);
  }
  countCall(session);
  await session.save();
  res.json({ session: serializeSession(session) });
}));

// POST /api/interview/sessions/:id/questions/:qid/follow-up — adds the suggested follow-up as a new question (no AI call)
router.post('/sessions/:id/questions/:qid/follow-up', asyncHandler(async (req, res) => {
  const { session } = await ownSession(req.user.id, req.params.id);
  const question = session.questions.id(req.params.qid);
  if (!question?.evaluation?.followUp) throw new HttpError(400, 'There is no follow-up question for this answer.');
  const existing = session.questions.find((q) => q.followUpOf?.equals(question._id));
  if (!existing) {
    session.questions.push({
      category: question.category,
      question: question.evaluation.followUp,
      basedOn: 'Follow-up to your answer',
      tests: question.tests,
      followUpOf: question._id,
    });
    await session.save();
  }
  res.json({ session: serializeSession(session) });
}));

export default router;
