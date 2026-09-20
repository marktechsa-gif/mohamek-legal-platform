import { query } from "../db/client";
import { getAiProvider } from "../lib/aiProvider";
import { ApiError } from "../middleware/errorHandler";
import { getActivatedRegulationCodes } from "./intakeEngine";
import { retrieveRelevantArticles } from "./legalKnowledgeBase";
import type { GeneratedDocumentContent, RelevantArticle } from "../types";

const DISCLAIMER =
  "هذا المستند مسودة داعمة أولية أُنشئت بمساعدة الذكاء الاصطناعي، وليست استشارة قانونية ولا بديلاً عن محامٍ مرخّص. يجب مراجعتها واعتمادها من محامٍ مرخّص أو مستشار قانوني قبل تقديمها لأي جهة قضائية.";

function buildSystemPrompt(relevantArticles: RelevantArticle[]): string {
  const articlesBlock = relevantArticles
    .map(
      (a) =>
        `- [${a.regulationCode} / المادة ${a.articleNumber}] ${a.regulationNameAr}: "${a.articleText}"`
    )
    .join("\n");

  return `أنت مساعد صياغة قانونية يعمل ضمن منصة "أسانيد" السعودية. مهمتك صياغة لائحة دعوى مبدئية بصيغة JSON فقط.

قواعد صارمة يجب الالتزام بها دون استثناء:
1. استشهد فقط بالمواد النظامية الواردة حرفيًا في القائمة أدناه، بنفس رمز النظام ورقم المادة تمامًا كما وردا. لا تذكر أي نظام أو رقم مادة غير موجود في هذه القائمة مهما بدا مناسبًا من معرفتك العامة.
2. إن لم تجد في القائمة أدناه ما يكفي لسند مطلب معيّن، اذكر ذلك صراحة في حقل "legal_basis" بدل اختلاق استشهاد، أو احذف ذلك المطلب.
3. أخرج JSON صالحًا فقط مطابقًا تمامًا للبنية المطلوبة، دون أي نص خارج كتلة الـ JSON.

المواد النظامية المتاحة للاستشهاد (ولا يوجد غيرها):
${articlesBlock || "(لا توجد أي مواد متاحة حاليًا)"}

بنية الإخراج المطلوبة (JSON):
{
  "court_name": "string",
  "plaintiff": { "name": "string", "id_or_cr_number": "string", "capacity": "string" },
  "defendant": { "name": "string", "id_or_cr_number": "string" },
  "subject": "string",
  "facts": ["string", "..."],
  "legal_basis": [{ "regulation_code": "string", "article_number": "string", "relevance": "string" }],
  "claims": ["string", "..."],
  "attachments": ["string", "..."]
}`;
}

function buildUserPrompt(
  caseRow: { court_city: string },
  answers: Record<string, unknown>,
  documentSummaries: string[]
): string {
  return `بيانات القضية من محادثة الاستقصاء:
${JSON.stringify(answers, null, 2)}

المدينة/المحكمة المطلوبة: ${caseRow.court_city ?? answers.court_city ?? "غير محددة"}

ملخص المستندات الداعمة التي رفعها العميل:
${documentSummaries.length > 0 ? documentSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n") : "لم يرفع العميل مستندات."}

صُغ الآن لائحة الدعوى بصيغة JSON حسب البنية المحددة في تعليمات النظام.`;
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new ApiError(502, "AI_RESPONSE_NOT_JSON", "AI provider did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * ضمانة منع الاستشهاد المُختلَق: يرفض المستند بالكامل إن استشهد بأي مادة
 * غير موجودة فعليًا ضمن المواد المُسترجَعة من قاعدة المعرفة.
 * راجع docs/LEGAL_KNOWLEDGE_BASE.md.
 */
function validateCitations(
  content: GeneratedDocumentContent,
  relevantArticles: RelevantArticle[]
): void {
  const validKeys = new Set(
    relevantArticles.map((a) => `${a.regulationCode}::${a.articleNumber}`)
  );

  for (const basis of content.legal_basis) {
    const key = `${basis.regulation_code}::${basis.article_number}`;
    if (!validKeys.has(key)) {
      throw new ApiError(
        422,
        "UNGROUNDED_CITATION_REJECTED",
        `Citation ${key} is not present in the retrieved legal knowledge base context`
      );
    }
  }
}

export async function generateLawsuitStatement(caseId: string) {
  const caseResult = await query<{ id: string; case_type: string }>(
    `select id, case_type from cases where id = $1`,
    [caseId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new ApiError(404, "CASE_NOT_FOUND");
  }

  const answersResult = await query<{ question_id: string; answer_value: unknown }>(
    `select question_id, answer_value from intake_answers where case_id = $1`,
    [caseId]
  );
  const answers: Record<string, unknown> = {};
  for (const row of answersResult.rows) {
    answers[row.question_id] = row.answer_value;
  }

  const docsResult = await query<{ client_description: string | null; original_filename: string }>(
    `select client_description, original_filename from case_documents where case_id = $1`,
    [caseId]
  );
  const documentSummaries = docsResult.rows.map(
    (d) => d.client_description || d.original_filename
  );

  const regulationCodes = getActivatedRegulationCodes(answers);
  const relevantArticles = await retrieveRelevantArticles(regulationCodes);

  if (relevantArticles.length === 0) {
    throw new ApiError(
      422,
      "NO_GROUNDED_ARTICLES_FOUND",
      "قاعدة المعرفة القانونية فارغة من مواد الأنظمة المطلوبة لهذه القضية؛ يجب تعبئتها قبل التوليد. راجع legal-kb/README.md"
    );
  }

  const ai = getAiProvider();
  const raw = await ai.complete({
    system: buildSystemPrompt(relevantArticles),
    prompt: buildUserPrompt({ court_city: String(answers.court_city ?? "") }, answers, documentSummaries),
  });

  const parsed = extractJson(raw) as Omit<GeneratedDocumentContent, "disclaimer">;
  const content: GeneratedDocumentContent = { ...parsed, disclaimer: DISCLAIMER };

  validateCitations(content, relevantArticles);

  const insertResult = await query<{ id: string }>(
    `insert into generated_documents
       (case_id, document_type, status, content_json, ai_provider, ai_model)
     values ($1, 'lawsuit_statement', 'draft', $2, $3, $4)
     returning id`,
    [caseId, JSON.stringify(content), ai.name, ai.model]
  );
  const generatedDocumentId = insertResult.rows[0].id;

  for (const basis of content.legal_basis) {
    const article = relevantArticles.find(
      (a) => a.regulationCode === basis.regulation_code && a.articleNumber === basis.article_number
    );
    if (article) {
      await query(
        `insert into generated_document_citations (generated_document_id, legal_article_id, cited_for)
         values ($1, $2, $3)`,
        [generatedDocumentId, article.id, basis.relevance]
      );
    }
  }

  await query(`update cases set status = 'generated', updated_at = now() where id = $1`, [caseId]);

  return { id: generatedDocumentId, content };
}
