"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, uploadCaseDocument } from "../../lib/api";

interface IntakeQuestion {
  id: string;
  prompt: string;
  field: string;
  type: "text" | "long_text" | "boolean" | "date" | "select";
  options?: string[];
}

type Phase = "questions" | "documents" | "generating" | "done";

export default function IntakePage() {
  return (
    <Suspense fallback={<main className="container"><p className="muted">جارٍ التحميل...</p></main>}>
      <IntakePageInner />
    </Suspense>
  );
}

function IntakePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const [phase, setPhase] = useState<Phase>("questions");
  const [question, setQuestion] = useState<IntakeQuestion | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerBool, setAnswerBool] = useState<"yes" | "no" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

  useEffect(() => {
    if (!caseId) return;
    loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function loadNextQuestion() {
    if (!caseId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ complete: boolean; question: IntakeQuestion | null }>(
        `/cases/${caseId}/intake/next`,
        { auth: true }
      );
      if (data.complete) {
        setPhase("documents");
        setQuestion(null);
      } else {
        setQuestion(data.question);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل السؤال التالي");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId || !question) return;
    setError(null);
    setLoading(true);

    const value = question.type === "boolean" ? answerBool === "yes" : answerText;

    try {
      const data = await apiFetch<{ complete: boolean; nextQuestion: IntakeQuestion | null }>(
        `/cases/${caseId}/intake/answer`,
        { method: "POST", auth: true, body: { questionId: question.id, value } }
      );
      setAnswerText("");
      setAnswerBool("");
      if (data.complete) {
        setPhase("documents");
        setQuestion(null);
      } else {
        setQuestion(data.nextQuestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الإجابة");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!caseId || !file) return;
    setError(null);
    setLoading(true);
    try {
      await uploadCaseDocument(caseId, file, fileDescription);
      setUploadedCount((n) => n + 1);
      setFile(null);
      setFileDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع المستند");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!caseId) return;
    setError(null);
    setPhase("generating");
    try {
      const data = await apiFetch<{ id: string }>(`/cases/${caseId}/documents/generate`, {
        method: "POST",
        auth: true,
        body: {},
      });
      router.push(`/documents/${caseId}?docId=${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر توليد المستند");
      setPhase("documents");
    }
  }

  if (!caseId) {
    return (
      <main className="container">
        <div className="card">
          <p className="error">لم يتم تحديد القضية. عد إلى الصفحة الرئيسية وابدأ قضية جديدة.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>محادثة الاستقصاء</h1>

      {error && <div className="error">{error}</div>}

      {phase === "questions" && question && (
        <div className="card">
          <form onSubmit={submitAnswer}>
            <label>{question.prompt}</label>

            {question.type === "boolean" && (
              <select
                value={answerBool}
                onChange={(e) => setAnswerBool(e.target.value as "yes" | "no")}
                required
              >
                <option value="" disabled>
                  اختر...
                </option>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            )}

            {question.type === "select" && (
              <select value={answerText} onChange={(e) => setAnswerText(e.target.value)} required>
                <option value="" disabled>
                  اختر...
                </option>
                {question.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {question.type === "long_text" && (
              <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} required />
            )}

            {(question.type === "text" || question.type === "date") && (
              <input
                type="text"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                required
              />
            )}

            <button className="btn" type="submit" disabled={loading}>
              التالي
            </button>
          </form>
        </div>
      )}

      {phase === "questions" && loading && !question && <p className="muted">جارٍ التحميل...</p>}

      {phase === "documents" && (
        <div className="card">
          <h2>المستندات الداعمة</h2>
          <p className="muted">ارفع أي مستندات تدعم قضيتك (اختياري). رفعت حتى الآن: {uploadedCount}</p>

          <label>الملف</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label>وصف مختصر لصلة المستند بالقضية</label>
          <input
            type="text"
            value={fileDescription}
            onChange={(e) => setFileDescription(e.target.value)}
          />
          <button className="btn btn-secondary" type="button" onClick={handleUpload} disabled={!file || loading}>
            رفع المستند
          </button>

          <hr style={{ margin: "20px 0", borderColor: "var(--border)" }} />

          <button className="btn" type="button" onClick={handleGenerate} disabled={loading}>
            صياغة لائحة الدعوى الآن
          </button>
        </div>
      )}

      {phase === "generating" && (
        <div className="card">
          <p>جارٍ صياغة لائحة الدعوى استنادًا لنصوص الأنظمة ذات العلاقة... قد يستغرق هذا بضع ثوانٍ.</p>
        </div>
      )}
    </main>
  );
}
