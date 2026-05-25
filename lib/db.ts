import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { CATEGORIES, SourceConfig } from "./types";

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || "./data/intel.db");
let db: SqliteCliDatabase | null = null;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new SqliteCliDatabase(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    initDb(db);
  }
  return db;
}

export function initDb(database = getDb()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_at TEXT NOT NULL,
      published_at_source TEXT NOT NULL DEFAULT 'source',
      is_publish_time_verified INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL,
      vendors TEXT DEFAULT '',
      keywords TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      event TEXT DEFAULT '',
      related_entities TEXT DEFAULT '',
      potential_impact TEXT DEFAULT '',
      insight_for_china_telecom TEXT DEFAULT '',
      opportunity_for_huawei TEXT DEFAULT '',
      suggested_action TEXT DEFAULT '',
      importance_score INTEGER DEFAULT 3,
      risk_level TEXT DEFAULT '低',
      is_china_telecom_related INTEGER DEFAULT 0,
      is_huawei_related INTEGER DEFAULT 0,
      include_in_daily INTEGER DEFAULT 0,
      daily_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      content_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL,
      category_hint TEXT NOT NULL,
      include_keywords TEXT NOT NULL DEFAULT '',
      exclude_keywords TEXT NOT NULL DEFAULT '',
      quality_score INTEGER NOT NULL DEFAULT 3,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);
    CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
    CREATE INDEX IF NOT EXISTS idx_news_importance ON news(importance_score);
    CREATE INDEX IF NOT EXISTS idx_daily_report_date ON daily_reports(report_date);
  `);
  migrateNewsPublishTime(database);
  migrateSourceQuality(database);
  seedSources(database);
}

function migrateNewsPublishTime(database: SqliteCliDatabase) {
  const columns = database.query("PRAGMA table_info(news);") as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("published_at_source")) {
    database.exec("ALTER TABLE news ADD COLUMN published_at_source TEXT NOT NULL DEFAULT 'source';");
  }
  if (!names.has("is_publish_time_verified")) {
    database.exec("ALTER TABLE news ADD COLUMN is_publish_time_verified INTEGER NOT NULL DEFAULT 1;");
  }
  if (!names.has("daily_order")) {
    database.exec("ALTER TABLE news ADD COLUMN daily_order INTEGER NOT NULL DEFAULT 0;");
  }
  database.exec(`
    UPDATE news
    SET published_at_source = 'missing',
        is_publish_time_verified = 0,
        updated_at = datetime('now')
    WHERE source IN ('C114 运营商', 'C114 监管政策', 'C114 设备商', 'C114 IT资讯')
      AND published_at = created_at;
  `);
  database.exec(`
    UPDATE news
    SET published_at_source = 'source',
        is_publish_time_verified = 1,
        updated_at = datetime('now')
    WHERE url LIKE 'https://www.c114.com.cn/%'
      AND published_at <> created_at;
  `);
}

function migrateSourceQuality(database: SqliteCliDatabase) {
  const columns = database.query("PRAGMA table_info(sources);") as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("include_keywords")) {
    database.exec("ALTER TABLE sources ADD COLUMN include_keywords TEXT NOT NULL DEFAULT '';");
  }
  if (!names.has("exclude_keywords")) {
    database.exec("ALTER TABLE sources ADD COLUMN exclude_keywords TEXT NOT NULL DEFAULT '';");
  }
  if (!names.has("quality_score")) {
    database.exec("ALTER TABLE sources ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 3;");
  }
}

function seedSources(database: SqliteCliDatabase) {
  const count = database.prepare("SELECT COUNT(*) as count FROM sources").get() as { count: number };
  if (count.count > 0) return;
  const filePath = path.resolve(process.cwd(), "config/sources.json");
  if (!fs.existsSync(filePath)) return;
  const sources = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Array<Omit<SourceConfig, "id" | "created_at" | "updated_at">>;
  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT INTO sources (source_name, source_url, source_type, category_hint, include_keywords, exclude_keywords, quality_score, enabled, created_at, updated_at)
    VALUES (@source_name, @source_url, @source_type, @category_hint, @include_keywords, @exclude_keywords, @quality_score, @enabled, @created_at, @updated_at)
  `);
  for (const source of sources) {
    if (!CATEGORIES.includes(source.category_hint)) continue;
    insert.run({
      ...source,
      include_keywords: source.include_keywords || "",
      exclude_keywords: source.exclude_keywords || "",
      quality_score: source.quality_score || 3,
      enabled: source.enabled ? 1 : 0,
      created_at: now,
      updated_at: now
    });
  }
}

export const nowIso = () => new Date().toISOString();

type NamedParams = Record<string, unknown>;

class SqliteCliDatabase {
  constructor(private filePath: string) {
    execFileSync("sqlite3", [this.filePath, "SELECT 1;"], { encoding: "utf-8" });
  }

  exec(sql: string) {
    this.runSql(sql);
  }

  prepare(sql: string) {
    return new SqliteCliStatement(this, sql);
  }

  query(sql: string) {
    const output = execFileSync("sqlite3", ["-json", this.filePath, sql], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return output.trim() ? JSON.parse(output) : [];
  }

  runSql(sql: string) {
    execFileSync("sqlite3", [this.filePath, sql], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  }
}

class SqliteCliStatement {
  constructor(private db: SqliteCliDatabase, private sql: string) {}

  all(...params: unknown[]) {
    return this.db.query(bindParams(this.sql, params));
  }

  get(...params: unknown[]) {
    return this.all(...params)[0];
  }

  run(...params: unknown[]) {
    const sql = bindParams(this.sql, params);
    this.db.runSql(sql);
    return { lastInsertRowid: this.getLastId(sql) };
  }

  private getLastId(sql: string) {
    const match = sql.match(/insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (!match) return 0;
    const row = this.db.query(`SELECT MAX(id) as id FROM ${match[1]};`)[0] as { id?: number } | undefined;
    return row?.id || 0;
  }
}

function bindParams(sql: string, params: unknown[]) {
  if (params.length === 1 && isNamedParams(params[0])) {
    return Object.entries(params[0])
      .sort(([a], [b]) => b.length - a.length)
      .reduce((result, [key, value]) => result.replaceAll(`@${key}`, sqlValue(value)), sql);
  }
  let index = 0;
  return sql.replace(/\?/g, () => sqlValue(params[index++]));
}

function isNamedParams(value: unknown): value is NamedParams {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}
