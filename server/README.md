# ResumeIQ API

Express + MongoDB (Mongoose) backend for the ResumeIQ frontend.

## Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET
npm run seed              # optional: demo officer and 4 students (clears existing data)
npm run dev               # http://localhost:5000
```

In a second terminal, from the project root: `npm run dev` (Vite proxies `/api` to port 5000).

Demo logins after seeding (password `password123`):
- Officer: `officer@college.edu`
- Students: `aarav@college.edu`, `mira@college.edu`, `rohan@college.edu`, `sana@college.edu`

## Endpoints

All routes except register/login need `Authorization: Bearer <token>`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /api/auth/register | public | `{ email, password, role: 'student'\|'tpo', name }` |
| POST | /api/auth/login | public | `{ email, password, role? }` → `{ token, user }` |
| GET | /api/auth/me | any | Current user |
| GET / PUT | /api/profile/me | student | Read / update profile (name, department, cgpa, linkedin, skills, certifications, projects) |
| POST | /api/profile/me/resume | student | multipart field `resume` (PDF/DOC/DOCX/TXT, 5 MB) |
| GET | /api/profile/:userId/resume | owner or tpo | Download resume |
| GET | /api/analysis/roles | student | Role dropdown options |
| GET | /api/analysis/latest | student | Latest general and role-specific results |
| POST | /api/analysis/general | student | Mode A: general resume quality score (no job involved) |
| POST | /api/analysis/role | student | Mode B: `{ role, jd? }` → role compatibility score |
| GET | /api/interview/latest | student | Most recent interview practice session |
| POST | /api/interview/sessions | student | `{ role, jd?, categories, count }` → new session with AI-written questions |
| POST | /api/interview/sessions/:id/questions/:qid/answer | student | `{ answer }` → AI feedback (score /10, criteria, strengths, gaps, answer structure, follow-up) |
| POST | /api/interview/sessions/:id/questions/:qid/follow-up | student | Adds the suggested follow-up as a new question (no AI call) |
| GET | /api/students/departments | tpo | Departments students have chosen (for the filter) |
| POST | /api/students/search | tpo | `{ department?, minCgpa?, skills }` → per-skill coverage and students ranked by evidence |

## Resume analysis

Both modes read the uploaded resume's text. Each run is one Groq call; running again on the same
resume and target returns the saved result (`cached: true`) without a call.

- **General (Mode A)** out of 100: formatting 15, summary 10, skills presentation 15, projects 20,
  experience 15, impact 15, grammar 10.
- **Role (Mode B)** out of 100: technical skills 30, project relevance 25, experience relevance 15,
  keywords 10, education 10, impact 10. A pasted JD takes priority; without one, the role's entry in
  `src/config/roles.json` is used. A custom role needs a JD.
- Formatting, skills presentation, impact, keywords and technical skills are scored by rules in
  `src/services/resumeScoring.js`; the AI scores the rest, each capped at its maximum, and the total is
  added up in code.
- No internship/work experience → that category is marked N/A and its weight is shared by the others.
- Skills are shown as matched (used in a project/experience), partially demonstrated (only listed),
  claimed in the profile but not on the resume, or not found in the resume.
- AI line rewrites are only shown if the quoted line really is in the resume; new numbers become `[X]`
  placeholders and rewrites that add a skill the resume never mentions are dropped.

## Interview preparation

`src/services/interview.js`, `src/routes/interview.js`. One Groq call writes the questions for the chosen
categories (technical, project, resume, HR, scenario), spread evenly; one call evaluates each answer and also
suggests a follow-up question. Checked in code: project and resume questions must name something in the resume,
technical ones a resume skill or role requirement; the overall score is the average of the criteria that apply
(technical correctness is skipped for HR questions); answer-structure steps that claim experience without a
`[placeholder]` are removed. Capped by `AI_INTERVIEW_DAILY_LIMIT` per student per day.

## Student skill search (placement officers)

`src/services/skillSearch.js` scores each student 0-100 per searched skill from the evidence in their resume
and profile, with no AI call: used in project/experience lines 60 (+8 per further line, up to +24), only listed
on the resume 30, a related certification +16 (25 on its own), only typed into the profile 10, not found 0.
A student's overall score is the average across the skills searched. The response also gives, per skill, how
many students are at each level, the share who have it, and who is sharpest (with ties counted).

## Notes

- CGPA is self-reported (honor system).
- Resume text is read from PDF (`pdfjs-dist`, pinned to 4.8.69, the newest release that runs on Node 18; newer ones need Node 20+), DOCX (`mammoth`), DOC (`word-extractor`) and TXT. Scanned or unrelated files are rejected at upload.
- Resumes are stored on local disk in `uploads/`. For deployment on hosts with ephemeral disks, switch to S3/Cloudinary.
