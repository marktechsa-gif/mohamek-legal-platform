export type CaseType = "general" | "labor" | "commercial";

export type CaseStatus = "intake_in_progress" | "ready_to_generate" | "generated" | "failed";

export type DocumentType =
  | "lawsuit_statement"
  | "response_memo"
  | "defense_memo"
  | "appeal_memo"
  | "retrial_petition";

export interface AuthUser {
  id: string;
  email: string;
}

export interface IntakeQuestion {
  id: string;
  prompt: string;
  field: string;
  type: "text" | "long_text" | "boolean" | "date" | "select";
  options?: string[];
  /** إذا أُرجعت true بناءً على الإجابات السابقة، يُفعَّل هذا السؤال ضمن التدفق */
  appliesWhen?: (answers: Record<string, unknown>) => boolean;
  regulationCodesActivated?: string[];
}

export interface RelevantArticle {
  id: string;
  regulationCode: string;
  regulationNameAr: string;
  articleNumber: string;
  articleText: string;
}

export interface GeneratedDocumentContent {
  court_name: string;
  plaintiff: {
    name: string;
    id_or_cr_number: string;
    capacity: string;
  };
  defendant: {
    name: string;
    id_or_cr_number: string;
  };
  subject: string;
  facts: string[];
  legal_basis: Array<{
    regulation_code: string;
    article_number: string;
    relevance: string;
  }>;
  claims: string[];
  attachments: string[];
  disclaimer: string;
}
