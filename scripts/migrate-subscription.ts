import "dotenv/config";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function splitStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  // Clean comments line by line
  const lines = sqlText.split("\n").map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) return "";
    // Remove trailing single-line comments if any
    const commentIdx = line.indexOf("--");
    if (commentIdx !== -1) {
      // Basic check: verify if the -- is not inside quotes
      const preceding = line.substring(0, commentIdx);
      const quoteCount = (preceding.match(/'/g) || []).length;
      if (quoteCount % 2 === 0) {
        return preceding;
      }
    }
    return line;
  });

  const cleanedText = lines.join("\n");

  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];
    const prevChar = i > 0 ? cleanedText[i - 1] : "";

    if (char === "'" && prevChar !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && prevChar !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote) {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

async function run() {
  console.log("🔄 Starting subscription & gamification migration...");
  
  const migrationPath = path.join(process.cwd(), "supabase/migrations/060_subscription_and_gamification.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf8");

  const statements = splitStatements(sqlContent);
  console.log(`Parsed ${statements.length} independent SQL statements.`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing statement:`);
    console.log(statement.substring(0, 100) + (statement.length > 100 ? "..." : ""));

    try {
      const queryArr = [statement];
      Object.defineProperty(queryArr, "raw", { value: [statement] });
      await sql(queryArr as any);
      console.log("✅ Success");
    } catch (err: any) {
      if (err.code === "42701" || err.message?.includes("already exists")) {
        console.log("⚠️ Column/Constraint/Relation already exists. Skipping.");
      } else {
        console.error("❌ Statement execution failed:", err);
        throw err;
      }
    }
  }

  console.log("\n🎉 Migration completed successfully!");
}

run().catch(e => {
  console.error("❌ Migration failed execution:", e);
  process.exit(1);
});
