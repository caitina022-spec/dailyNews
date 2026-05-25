import { getDb } from "../lib/db";

const db = getDb();
const newsCount = db.prepare("SELECT COUNT(*) as count FROM news").get() as { count: number };
const sourceCount = db.prepare("SELECT COUNT(*) as count FROM sources").get() as { count: number };

console.log(`Database initialized. sources=${sourceCount.count}, news=${newsCount.count}`);
