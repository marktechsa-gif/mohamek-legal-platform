"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch, downloadGeneratedDocx } from "../../../lib/api";

interface GeneratedDocumentContent {
  court_name: string;
  plaintiff: { name: string; id_or_cr_number: string; capacity: string };
  defendant: { name: string; id_or_cr_number: string };
  subject: string;
  facts: string[];
  legal_basis: Array<{ regulation_code: string; article_number: string; relevance: string }>;
  claims: string[];
  attachments: string[];
  disclaimer: string;
}

export default function GeneratedDocumentPage() {
  return (
    <Suspense fallback={<main className="container"><p className="muted">جارٍ التحميل...</p></main>}>
      <GeneratedDocumentPageInner />
    </Suspense>
  );
}

function GeneratedDocumentPageInner() {
  const params = useParams<{ caseId: string }>();
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  const [content, setContent] = useState<GeneratedDocumentContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!docId) return;
    apiFetch<{ document: { content_json: GeneratedDocumentContent } }>(
      `/cases/${params.caseId}/documents/${docId}`,
      { auth: true }
    )
      .then((data) => setContent(data.document.content_json))
      .catch((err) => setError(err instanceof Error ? err.message : "تعذّر تحميل المستند"));
  }, [docId, params.caseId]);

  async function handleDownload() {
    if (!docId) return;
    setDownloading(true);
    try {
      await downloadGeneratedDocx(params.caseId, docId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تنزيل الملف");
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <main className="container">
        <div className="error">{error}</div>
      </main>
    );
  }

  if (!content) {
    return (
      <main className="container">
        <p className="muted">جارٍ التحميل...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>لائحة الدعوى — مسودة</h1>

      <div className="disclaimer">{content.disclaimer}</div>

      <div className="card">
        <button className="btn" type="button" onClick={handleDownload} disabled={downloading}>
          تنزيل بصيغة Word
        </button>
      </div>

      <div className="card">
        <h2>المحكمة</h2>
        <p>{content.court_name}</p>
      </div>

      <div className="card">
        <h2>المدعي</h2>
        <p>{content.plaintiff.name} — {content.plaintiff.id_or_cr_number} — {content.plaintiff.capacity}</p>
      </div>

      <div className="card">
        <h2>المدعى عليه</h2>
        <p>{content.defendant.name} — {content.defendant.id_or_cr_number}</p>
      </div>

      <div className="card">
        <h2>موضوع الدعوى</h2>
        <p>{content.subject}</p>
      </div>

      <div className="card">
        <h2>الوقائع</h2>
        <ol>
          {content.facts.map((fact, i) => (
            <li key={i}>{fact}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>السند النظامي</h2>
        <ul>
          {content.legal_basis.map((b, i) => (
            <li key={i}>
              {b.regulation_code} — المادة {b.article_number}: {b.relevance}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>الطلبات</h2>
        <ol>
          {content.claims.map((claim, i) => (
            <li key={i}>{claim}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>المرفقات</h2>
        <ul>
          {content.attachments.map((att, i) => (
            <li key={i}>{att}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
