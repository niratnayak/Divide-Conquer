import mongoose from 'mongoose';

export const INTERVIEW_CATEGORIES = ['technical', 'project', 'resume', 'hr', 'scenario'];

const evaluationSchema = new mongoose.Schema({
  overall: Number, // out of 10, averaged in code over the criteria that apply
  criteria: { type: mongoose.Schema.Types.Mixed, default: {} },
  strengths: [String],
  missing: [String],
  improvements: [String],
  structure: [String], // how to build a stronger answer, with [placeholders] for the student's own examples
  followUp: String,
  evaluatedAt: Date,
}, { _id: false });

const questionSchema = new mongoose.Schema({
  category: { type: String, enum: INTERVIEW_CATEGORIES, required: true },
  question: { type: String, required: true },
  basedOn: { type: String, default: '' }, // the resume item or job requirement it comes from
  tests: { type: String, default: '' },
  followUpOf: { type: mongoose.Schema.Types.ObjectId, default: null },
  answer: { type: String, default: '' },
  evaluation: { type: evaluationSchema, default: null },
});

// One practice session: questions for a target role, and the student's answers with AI feedback
const interviewSessionSchema = new mongoose.Schema(
  {
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    role: { type: String, required: true, trim: true },
    jdText: { type: String, default: '', maxlength: 8000 },
    categories: [{ type: String, enum: INTERVIEW_CATEGORIES }],
    questions: [questionSchema],
    // AI calls made for this session, by day (YYYY-MM-DD), for the per-student daily cap
    aiCalls: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

export function serializeSession(doc) {
  return {
    id: doc._id.toString(),
    role: doc.role,
    hasJobDescription: Boolean(doc.jdText),
    categories: doc.categories,
    createdAt: doc.createdAt,
    questions: doc.questions.map((q) => ({
      id: q._id.toString(),
      category: q.category,
      question: q.question,
      basedOn: q.basedOn,
      tests: q.tests,
      followUpOf: q.followUpOf ? q.followUpOf.toString() : null,
      answer: q.answer,
      evaluation: q.evaluation || null,
    })),
  };
}

export default mongoose.model('InterviewSession', interviewSessionSchema);
