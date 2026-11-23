import mongoose from 'mongoose';

export const ANALYSIS_MODES = ['general', 'role'];

// One saved result per resume + mode + target (role and JD). Re-running with the same
// inputs returns the saved result instead of calling the AI again.
const analysisSchema = new mongoose.Schema(
  {
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    mode: { type: String, enum: ANALYSIS_MODES, required: true },
    role: { type: String, trim: true, default: '' },
    jdText: { type: String, default: '', maxlength: 8000 },
    // 'general', or a hash of role + JD, so scores for the same target can be compared over time
    targetKey: { type: String, required: true },
    // Hash of every input the AI saw
    fingerprint: { type: String, required: true },
    resumeUploadedAt: Date,
    score: { type: Number, min: 0, max: 100 },
    previousScore: { type: Number, default: null },
    // Categories, skills, suggestions etc. (shape differs per mode; see services/resumeScoring.js)
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    model: String,
    // Tailored resume built from this analysis (made once, on request; see services/tailor.js)
    tailored: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

analysisSchema.index({ profile: 1, fingerprint: 1 });
analysisSchema.index({ profile: 1, mode: 1, targetKey: 1, createdAt: -1 });

export function serializeAnalysis(doc, profile) {
  const uploadedAt = profile?.resume?.uploadedAt;
  return {
    id: doc._id.toString(),
    mode: doc.mode,
    role: doc.role,
    hasJobDescription: Boolean(doc.jdText),
    score: doc.score,
    previousScore: doc.previousScore,
    ...doc.result,
    model: doc.model,
    createdAt: doc.createdAt,
    hasTailored: Boolean(doc.tailored),
    // true when a newer resume was uploaded after this analysis
    stale: Boolean(uploadedAt && doc.resumeUploadedAt && new Date(uploadedAt) > new Date(doc.resumeUploadedAt)),
  };
}

export default mongoose.model('Analysis', analysisSchema);
