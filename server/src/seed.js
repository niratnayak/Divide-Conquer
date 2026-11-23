// Loads demo data that mirrors the frontend's sample content.
// Usage: npm run seed   (WARNING: clears users and student profiles)
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import StudentProfile from './models/StudentProfile.js';

const PASSWORD = 'password123';

const students = [
  { name: 'Aarav Sharma', email: 'aarav@college.edu', department: 'Computer Engineering', cgpa: 8.9,
    skills: ['React', 'JavaScript', 'CSS', 'Git'], projects: ['github.com/aarav/portfolio', 'github.com/aarav/taskboard'],
    certifications: ['AWS Cloud Practitioner'] },
  { name: 'Mira Naik', email: 'mira@college.edu', department: 'Information Technology', cgpa: 9.1,
    skills: ['React', 'TypeScript', 'CSS', 'AWS'], projects: ['github.com/mira/shop', 'github.com/mira/chat', 'github.com/mira/blog'],
    certifications: ['Meta Front-End Developer', 'AWS Cloud Practitioner'] },
  { name: 'Rohan Patil', email: 'rohan@college.edu', department: 'Computer Engineering', cgpa: 7.8,
    skills: ['JavaScript', 'HTML', 'Python', 'SQL', 'Node.js'], projects: ['github.com/rohan/api', 'github.com/rohan/scraper'],
    certifications: [] },
  { name: 'Sana Khan', email: 'sana@college.edu', department: 'Electronics', cgpa: 8.2,
    skills: ['HTML', 'CSS', 'Python', 'Excel', 'SQL', 'Linux'], projects: ['github.com/sana/iot-dashboard'],
    certifications: ['Google Data Analytics'] },
];

async function seed() {
  await connectDB(process.env.MONGODB_URI);
  await Promise.all([User.deleteMany({}), StudentProfile.deleteMany({})]);

  const passwordHash = await User.hashPassword(PASSWORD);
  await User.create({ name: 'Placement Officer', email: 'officer@college.edu', role: 'tpo', passwordHash });

  for (const s of students) {
    const user = await User.create({ name: s.name, email: s.email, role: 'student', passwordHash });
    const { email, ...profile } = s;
    await StudentProfile.create({ ...profile, email, user: user._id });
  }

  console.log('Seed complete.');
  console.log(`  Officer:  officer@college.edu / ${PASSWORD}`);
  console.log(`  Students: ${students.map((s) => s.email).join(', ')} / ${PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
