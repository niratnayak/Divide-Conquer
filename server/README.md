# ResumeIQ API

Express + MongoDB (Mongoose) backend for the ResumeIQ frontend.

## Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET
npm run seed              # optional: demo officer, 4 students, 5 jobs (clears existing data)
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
| GET | /api/jobs?q= | any | List jobs (students see Open only) |
| POST | /api/jobs | tpo | `{ title, company, description, skills, minCgpa? }` |
| PATCH / DELETE | /api/jobs/:id | tpo | Edit, close (`status: 'Closed'`) or delete |
| GET | /api/jobs/shortlists?limit=3 | tpo | Top candidates for every open job, one call |
| GET | /api/jobs/:id/leaderboard | any | Ranked candidates (other students anonymised for student viewers) |
| POST | /api/jobs/:id/apply | student | Apply to a role |
| GET | /api/jobs/:id/applications | tpo | Applications for a role |
| GET | /api/applications/me | student | My applications |
| PATCH | /api/applications/:id | tpo | `{ status: applied\|shortlisted\|rejected\|selected }` |
| GET | /api/market/demand | any | Most-requested skills across open jobs |
| GET | /api/analysis/roles | student | Role dropdown options |
| GET | /api/analysis/latest | student | Latest general and role-specific results |
| POST | /api/analysis/general | student | Mode A: general resume quality score (no job involved) |
| POST | /api/analysis/role | student | Mode B: `{ role, jd? }` → role compatibility score |
| POST | /api/analysis/:id/tailor | student | Tailored resume built from that analysis (one AI call, then saved) |
| POST | /api/analysis/:id/tailor/docx | student | `{ values }` → tailored resume as a Word file, blanks filled in |

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

### Tailored resume

After reading an analysis, a student can generate a tailored version of their resume from it
(`src/services/tailor.js`). It is made once per analysis with one Groq call and saved. Every part is checked
against the resume text: skills must be in the resume, each bullet must be based on a real resume line,
numbers not in that line become blanks such as `[X%]`, and a rewrite that names a skill, tool or anything
else the resume never mentions falls back to the student's own line. The student fills the blanks (an empty
one is left out) and downloads a `.docx`.

## Match score (built-in)

- Required-skill overlap: up to 70
- Projects: 5 each (max 3) · Certifications: 5 each (max 2)
- CGPA: (cgpa / 10) × 5
- Below a job's minimum CGPA → score capped at 50

Set `AI_SERVICE_URL` to use the Python/FastAPI ranker instead (contract in `src/services/matching.js`); it falls back to the built-in scorer if the service is down.

## Notes

- CGPA is self-reported (honor system).
- Only `.txt` resumes are parsed for skills right now. PDF/DOCX are stored; parse them in the AI service or add `pdf-parse` / `mammoth`.
- Resumes are stored on local disk in `uploads/`. For deployment on hosts with ephemeral disks, switch to S3/Cloudinary.
