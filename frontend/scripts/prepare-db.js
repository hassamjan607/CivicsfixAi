const fs = require("fs");
const path = require("path");

function prepareDb() {
  const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    console.error("prisma/schema.prisma not found!");
    return;
  }

  let content = fs.readFileSync(schemaPath, "utf-8");
  const dbUrl = process.env.DATABASE_URL || "";
  const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

  if (isPostgres) {
    console.log("🐘 PostgreSQL URL detected. Setting Prisma provider to 'postgresql'...");
    content = content.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  } else {
    console.log("📁 SQLite URL or local dev detected. Setting Prisma provider to 'sqlite'...");
    content = content.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
  }

  fs.writeFileSync(schemaPath, content, "utf-8");
  console.log("✅ Prisma schema datasource successfully synchronized.");
}

prepareDb();
