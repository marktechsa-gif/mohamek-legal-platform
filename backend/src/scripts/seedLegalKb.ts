import fs from "node:fs";
import path from "node:path";
import { pool, query } from "../db/client";

interface SeedArticle {
  number: string;
  text: string;
  tags: string[];
}

interface SeedRegulation {
  code: string;
  name_ar: string;
  issued_by: string;
  articles: SeedArticle[];
}

async function main() {
  const fileArgIndex = process.argv.indexOf("--file");
  const filePath =
    fileArgIndex !== -1 && process.argv[fileArgIndex + 1]
      ? path.resolve(process.argv[fileArgIndex + 1])
      : path.resolve(__dirname, "../../../legal-kb/seed/sample_articles.json");

  console.log(`Seeding legal knowledge base from: ${filePath}`);
  const regulations: SeedRegulation[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  for (const reg of regulations) {
    const regResult = await query<{ id: string }>(
      `insert into legal_regulations (code, name_ar, issued_by)
       values ($1, $2, $3)
       on conflict (code) do update set name_ar = excluded.name_ar, issued_by = excluded.issued_by
       returning id`,
      [reg.code, reg.name_ar, reg.issued_by]
    );
    const regulationId = regResult.rows[0].id;

    for (const article of reg.articles) {
      await query(
        `insert into legal_articles (regulation_id, article_number, article_text, topic_tags)
         values ($1, $2, $3, $4)
         on conflict (regulation_id, article_number)
         do update set article_text = excluded.article_text, topic_tags = excluded.topic_tags`,
        [regulationId, article.number, article.text, article.tags]
      );
    }

    console.log(`  ✓ ${reg.name_ar} (${reg.code}): ${reg.articles.length} مادة`);
  }

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
