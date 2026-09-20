import { query } from "../db/client";
import { getAiProvider } from "../lib/aiProvider";
import { ApiError } from "../middleware/errorHandler";
import type { DiagnosticSuggestion } from "../types";

function buildSystemPrompt(): string {
  return `أنت مساعد تشخيص فني لورش صيانة السيارات. تستلم أكواد أعطال OBD-II (DTC)
وتُعيد لكل كود الأسباب الجذرية المحتملة وخطوات الإصلاح الأولية التي يتّبعها
فني ورشة. هذه اقتراحات أولية تساعد الفني على البدء بسرعة، وليست بديلاً عن
فحصه الفعلي للمركبة — لا تجزم بسبب واحد قاطع، اذكر الاحتمالات مرتبة من
الأكثر شيوعًا. أخرج JSON فقط بالبنية التالية، لكل كود عنصر مستقل:
[{"dtc_code": "string", "likely_causes": ["string"], "recommended_steps": ["string"], "confidence": "low|medium|high"}]`;
}

function extractJsonArray(raw: string): unknown {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new ApiError(502, "AI_RESPONSE_NOT_JSON", "AI provider did not return a JSON array");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function diagnoseDtcCodes(
  workOrderId: string,
  dtcCodes: string[],
  vehicleContext: { make?: string; model?: string; modelYear?: number }
): Promise<DiagnosticSuggestion[]> {
  if (dtcCodes.length === 0) {
    throw new ApiError(400, "DTC_CODES_REQUIRED");
  }

  const ai = getAiProvider();
  const prompt = `بيانات المركبة: ${JSON.stringify(vehicleContext)}
أكواد الأعطال المُلتقطة من جهاز الفحص: ${dtcCodes.join(", ")}

حلّل كل كود وأعد الاقتراحات بصيغة JSON حسب البنية المحددة.`;

  const raw = await ai.complete({ system: buildSystemPrompt(), prompt });
  const suggestions = extractJsonArray(raw) as DiagnosticSuggestion[];

  await query(
    `insert into work_order_diagnostics (work_order_id, dtc_codes, ai_suggested_causes, ai_provider, ai_model)
     values ($1, $2, $3, $4, $5)`,
    [workOrderId, dtcCodes, JSON.stringify(suggestions), ai.name, ai.model]
  );

  return suggestions;
}
