import type { IntakeQuestion } from "../types";

/**
 * بنك أسئلة الاستقصاء الموجَّه لتوليد لائحة الدعوى.
 * الأسئلة الأساسية تُعرض دائمًا؛ أسئلة الفروع (عمل/تجاري) تُفعَّل تلقائيًا حسب
 * إجابات العميل على is_employee و is_counterparty_commercial — هذا هو "التفريع
 * التلقائي حسب صفة العميل" الموصوف في docs/ARCHITECTURE.md.
 */
export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "court_city",
    prompt: "في أي مدينة تريد رفع الدعوى؟ (يحدد المحكمة المختصة)",
    field: "court_city",
    type: "text",
  },
  {
    id: "plaintiff_name",
    prompt: "اسمك الكامل (المدعي)؟",
    field: "plaintiff_name",
    type: "text",
  },
  {
    id: "plaintiff_id_or_cr",
    prompt: "رقم الهوية الوطنية أو السجل التجاري الخاص بك؟",
    field: "plaintiff_id_or_cr",
    type: "text",
  },
  {
    id: "plaintiff_capacity",
    prompt: "هل ترفع الدعوى بصفتك الشخصية، أم كوكيل/ولي عن طرف آخر؟",
    field: "plaintiff_capacity",
    type: "select",
    options: ["أصيل عن نفسي", "وكيل نظامي", "ولي/وصي"],
  },
  {
    id: "defendant_name",
    prompt: "اسم الطرف المدَّعى عليه؟",
    field: "defendant_name",
    type: "text",
  },
  {
    id: "defendant_id_or_cr",
    prompt: "رقم هوية أو سجل تجاري للمدَّعى عليه إن كان معروفًا لديك؟",
    field: "defendant_id_or_cr",
    type: "text",
  },
  {
    id: "is_employee",
    prompt: "هل قضيتك متعلقة بعلاقة عمل وأنت موظف لدى الطرف الآخر؟",
    field: "is_employee",
    type: "boolean",
    regulationCodesActivated: ["labor_law"],
  },
  {
    id: "is_counterparty_commercial",
    prompt: "هل الطرف الآخر جهة تجارية (شركة أو مؤسسة)؟",
    field: "is_counterparty_commercial",
    type: "boolean",
    regulationCodesActivated: ["commercial_courts_law"],
  },

  // فرع نظام العمل — يظهر فقط إذا أجاب العميل بأنه موظف
  {
    id: "labor_employer_name",
    prompt: "اسم جهة العمل (صاحب العمل)؟",
    field: "labor_employer_name",
    type: "text",
    appliesWhen: (answers) => answers.is_employee === true,
  },
  {
    id: "labor_employment_dates",
    prompt: "تاريخ بداية العمل، وتاريخ انتهائه إن كانت العلاقة منتهية؟",
    field: "labor_employment_dates",
    type: "text",
    appliesWhen: (answers) => answers.is_employee === true,
  },
  {
    id: "labor_dispute_type",
    prompt: "ما طبيعة النزاع العمالي؟",
    field: "labor_dispute_type",
    type: "select",
    options: ["فصل تعسفي", "مستحقات مالية متأخرة", "مكافأة نهاية الخدمة", "أخرى"],
    appliesWhen: (answers) => answers.is_employee === true,
  },

  // فرع نظام المحاكم التجارية — يظهر فقط إذا كان الطرف الآخر جهة تجارية
  {
    id: "commercial_relationship_nature",
    prompt: "ما طبيعة العلاقة التجارية بينك وبين الطرف الآخر؟ (عقد توريد، شراكة، بيع...)",
    field: "commercial_relationship_nature",
    type: "long_text",
    appliesWhen: (answers) => answers.is_counterparty_commercial === true,
  },

  {
    id: "case_subject",
    prompt: "بجملة أو جملتين، ما موضوع الدعوى؟",
    field: "case_subject",
    type: "text",
  },
  {
    id: "facts_narrative",
    prompt: "اسرد وقائع القضية بالتفصيل، بالترتيب الزمني قدر الإمكان.",
    field: "facts_narrative",
    type: "long_text",
  },
  {
    id: "supporting_evidence_summary",
    prompt: "لخّص المستندات أو الأدلة التي لديك وتدعم موقفك (سترفعها كملفات في الخطوة التالية).",
    field: "supporting_evidence_summary",
    type: "long_text",
  },
  {
    id: "claim_value",
    prompt: "ما القيمة التقديرية للدعوى بالريال السعودي؟ (اكتب 'غير محددة القيمة' إن لم تنطبق)",
    field: "claim_value",
    type: "text",
  },
  {
    id: "claims",
    prompt: "ما الذي تطلبه من المحكمة تحديدًا؟ (طلباتك)",
    field: "claims",
    type: "long_text",
  },
];

/** الأنظمة المفعَّلة دائمًا بصرف النظر عن نوع القضية */
export const BASE_REGULATION_CODES = [
  "sharia_procedure_law",
  "evidence_law",
  "civil_transactions_law",
];

export function getApplicableQuestions(
  answers: Record<string, unknown>
): IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter((q) => !q.appliesWhen || q.appliesWhen(answers));
}

export function getNextQuestion(
  answers: Record<string, unknown>
): IntakeQuestion | undefined {
  return getApplicableQuestions(answers).find((q) => !(q.field in answers));
}

export function isIntakeComplete(answers: Record<string, unknown>): boolean {
  return getApplicableQuestions(answers).every((q) => q.field in answers);
}

/** الأنظمة الواجب استرجاع مواد منها لهذه القضية، بناءً على إجابات الاستقصاء */
export function getActivatedRegulationCodes(
  answers: Record<string, unknown>
): string[] {
  const codes = new Set(BASE_REGULATION_CODES);
  for (const q of INTAKE_QUESTIONS) {
    if (q.regulationCodesActivated && answers[q.field] === true) {
      q.regulationCodesActivated.forEach((c) => codes.add(c));
    }
  }
  return Array.from(codes);
}
