import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { GeneratedDocumentContent } from "../types";
import { absoluteStoragePath, ensureUploadsDir } from "./storage";

const ARABIC_FONT = "Arial";

function rtlParagraph(text: string, options: { bold?: boolean; heading?: boolean } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    heading: options.heading ? HeadingLevel.HEADING_2 : undefined,
    children: [
      new TextRun({
        text,
        bold: options.bold,
        font: ARABIC_FONT,
        rightToLeft: true,
      }),
    ],
  });
}

function rtlList(items: string[]) {
  return items.map(
    (item, i) =>
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `${i + 1}. ${item}`, font: ARABIC_FONT, rightToLeft: true })],
      })
  );
}

export function buildLawsuitStatementDocument(content: GeneratedDocumentContent): Document {
  return new Document({
    sections: [
      {
        children: [
          rtlParagraph(`لائحة دعوى`, { bold: true, heading: true }),
          rtlParagraph(`المحكمة: ${content.court_name}`),
          new Paragraph({ text: "" }),

          rtlParagraph("المدعي", { bold: true }),
          rtlParagraph(`الاسم: ${content.plaintiff.name}`),
          rtlParagraph(`رقم الهوية/السجل: ${content.plaintiff.id_or_cr_number}`),
          rtlParagraph(`الصفة: ${content.plaintiff.capacity}`),
          new Paragraph({ text: "" }),

          rtlParagraph("المدعى عليه", { bold: true }),
          rtlParagraph(`الاسم: ${content.defendant.name}`),
          rtlParagraph(`رقم الهوية/السجل: ${content.defendant.id_or_cr_number}`),
          new Paragraph({ text: "" }),

          rtlParagraph("موضوع الدعوى", { bold: true }),
          rtlParagraph(content.subject),
          new Paragraph({ text: "" }),

          rtlParagraph("الوقائع", { bold: true }),
          ...rtlList(content.facts),
          new Paragraph({ text: "" }),

          rtlParagraph("السند النظامي", { bold: true }),
          ...rtlList(
            content.legal_basis.map(
              (b) => `${b.regulation_code} — المادة ${b.article_number}: ${b.relevance}`
            )
          ),
          new Paragraph({ text: "" }),

          rtlParagraph("الطلبات", { bold: true }),
          ...rtlList(content.claims),
          new Paragraph({ text: "" }),

          rtlParagraph("المرفقات", { bold: true }),
          ...rtlList(content.attachments),
          new Paragraph({ text: "" }),

          rtlParagraph(content.disclaimer, { bold: true }),
        ],
      },
    ],
  });
}

export async function saveLawsuitStatementDocx(
  generatedDocumentId: string,
  content: GeneratedDocumentContent
): Promise<string> {
  ensureUploadsDir();
  const relativePath = path.join("generated-documents", `${generatedDocumentId}.docx`);
  const fullPath = absoluteStoragePath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  const doc = buildLawsuitStatementDocument(content);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);

  return relativePath;
}
