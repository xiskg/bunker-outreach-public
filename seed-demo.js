import {createUser, getUserByEmail, addLead, saveDraft, saveSettings, pool} from './db.js';
import {hashPassword} from './auth.js';
export async function seedDemo() {
 if (process.env.DEMO_MODE !== 'true') throw new Error('Demo seeding is unavailable outside demo mode');
 const password = process.env.DEMO_PASSWORD;
 if (!password || password.length < 12) throw new Error('Set a local DEMO_PASSWORD of at least 12 characters');
 for (const [name,email] of [['Demo Operator','operator@example.com'],['Second Demo','second@example.org']]) {
  const user = await getUserByEmail(email) || await createUser(name,email,await hashPassword(password));
  await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [user.id]);
  await addLead(user.id,'Example Studio','hello@example.com','https://example.com','US');
  if (email === 'operator@example.com') {
   await addLead(user.id,'Example Labs','team@example.org','https://example.org','US');
   await saveDraft(user.id,'team@example.org','Fictional message','This is demonstration data.',null,3);
  }
 }
}
