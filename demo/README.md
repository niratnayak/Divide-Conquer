# Demo resume: Ananya Kulkarni (fictional)

`demo-resume-ananya.pdf` and `demo-resume-ananya.docx` contain the same text. Upload either one. Every
name, company, college and contact detail in them is made up.

The resume is built so that each feature has something to show. The numbers below come from running
the app's own rule-based scoring on the file. The AI-scored parts (summary, projects, experience,
grammar, education) will vary a little from run to run.

## 1. Profile form (student login)

| Field | Value |
|---|---|
| Name | Ananya Kulkarni |
| Department | Computer Engineering |
| CGPA | 8.1 |
| Skills | React, Node.js, JavaScript, MongoDB, Docker, SQL |
| Certifications | MongoDB Basics - MongoDB University |
| Projects | CampusCart, BusTrack |

Docker is in the profile on purpose and does not appear on the resume.

## 2. General analysis (Mode A)

What to point out:
- **Formatting 15/15**: every section is detected, 370 words, bullet points used (rule-based).
- **Weak summary**: "Hardworking and passionate ... learn new things and grow" is generic, so the AI scores it low and suggests a rewrite.
- **Skills presentation 13/15**: 19 skills grouped by type, but only 10 of them are backed by a project or internship.
- **Impact 11/15**: only 4 of 12 bullets show a measurable result.
- **Line rewrites**: weak bullets such as "Worked on the frontend of the company website." and
  "Responsible for making APIs for the admin panel." get rewrites. Any new numbers appear as `[X]`
  placeholders, so the AI never invents metrics.
- **Grammar**: "It calculate who owes whom" is a deliberate slip.

## 3. Role analysis (Mode B): pick "Full Stack Developer", no JD

The skills panel shows all four states:

| State | Skills |
|---|---|
| Matched (used in a project or internship) | JavaScript, React, Node.js, REST, Git, MongoDB, Express |
| Partially demonstrated (only listed) | SQL, TypeScript |
| Claimed in profile, not on resume | Docker |
| Not found | Next.js, Testing |

Keywords score 4 of 6 (missing: end-to-end, full stack). Technical skills score 23/30.

To see the fresher rule, delete the "Internship Experience" section and re-upload. Experience is then
marked N/A and its weight is shared across the other categories.

### Optional: paste this JD to compare JD mode

```
Full Stack Developer Intern - 6 months, Pune
Required: JavaScript, TypeScript, React, Next.js, Node.js, PostgreSQL, REST APIs, Git.
Preferred: Docker, unit testing with Jest, CI/CD.
You will build features end-to-end, write clean API code, and own deployment of small services.
```

The score should drop: TypeScript is only listed, and Next.js, PostgreSQL, Docker and Jest are missing.

## 4. Interview prep

Pick Full Stack Developer with the technical, project, resume and HR categories. The questions will
name CampusCart (JWT login, chat APIs, 300+ users), BusTrack (Firebase updates every 5 seconds) and the
BrightLeaf internship. Technical questions about Next.js or Docker are asked as "how would you
approach ...", because the resume shows no use of them.

## 5. Officer search (TPO login)

Search for **React, MongoDB, SQL, Docker, Next.js**. Ananya's evidence scores:

| Skill | Score | Why |
|---|---|---|
| MongoDB | 84 | used in a project, plus a certification |
| React | 68 | used in two project lines |
| SQL | 30 | only listed on the resume |
| Docker | 10 | only typed into the profile |
| Next.js | 0 | not found |
