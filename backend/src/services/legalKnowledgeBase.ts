import { query } from "../db/client";
import type { RelevantArticle } from "../types";

interface ArticleRow {
  id: string;
  regulation_code: string;
  regulation_name_ar: string;
  article_number: string;
  article_text: string;
}

/**
 * يسترجع فقط المواد المخزَّنة فعليًا في قاعدة البيانات ضمن الأنظمة المفعَّلة
 * لهذه القضية. هذا الاسترجاع هو حدود المعرفة القانونية المسموح للنموذج
 * الاستشهاد منها — راجع docs/LEGAL_KNOWLEDGE_BASE.md لتفاصيل الضمانة.
 *
 * الترشيح حاليًا بسيط (كل مواد الأنظمة المفعَّلة، مع ترجيح اختياري بالكلمات
 * المفتاحية عبر topic_tags)، بانتظار ترقية لاحقة لاسترجاع دلالي عبر pgvector.
 */
export async function retrieveRelevantArticles(
  regulationCodes: string[],
  topicKeywords: string[] = []
): Promise<RelevantArticle[]> {
  if (regulationCodes.length === 0) return [];

  const result = await query<ArticleRow>(
    `select
       la.id,
       lr.code as regulation_code,
       lr.name_ar as regulation_name_ar,
       la.article_number,
       la.article_text
     from legal_articles la
     join legal_regulations lr on lr.id = la.regulation_id
     where lr.code = any($1)
     order by lr.code, la.article_number`,
    [regulationCodes]
  );

  let rows = result.rows;

  if (topicKeywords.length > 0) {
    // ترجيح بسيط: أعطِ الأولوية للمواد التي تتقاطع وسومها مع الكلمات المفتاحية،
    // لكن لا تستبعد الباقي — لأن قاعدة المعرفة الحالية صغيرة ومُنتقاة يدويًا.
    const keywordSet = new Set(topicKeywords.map((k) => k.toLowerCase()));
    rows = [...rows].sort((a, b) => {
      const aScore = keywordSet.has(a.article_number.toLowerCase()) ? 1 : 0;
      const bScore = keywordSet.has(b.article_number.toLowerCase()) ? 1 : 0;
      return bScore - aScore;
    });
  }

  return rows.map((r) => ({
    id: r.id,
    regulationCode: r.regulation_code,
    regulationNameAr: r.regulation_name_ar,
    articleNumber: r.article_number,
    articleText: r.article_text,
  }));
}
