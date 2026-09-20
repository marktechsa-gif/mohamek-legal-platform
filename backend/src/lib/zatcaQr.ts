/**
 * توليد رمز QR للفاتورة الضريبية المبسّطة حسب متطلبات هيئة الزكاة والضريبة
 * والجمارك (ZATCA) — المرحلة الأولى: ترميز TLV (Tag-Length-Value) لخمسة حقول
 * إلزامية، مُرمّزة بعدها Base64. هذا توليد محلي بالكامل، لا يحتاج أي استدعاء
 * API خارجي لأن المرحلة الأولى لا تتطلب اعتمادًا مسبقًا من ZATCA — بخلاف
 * المرحلة الثانية (الربط المباشر/Fatoora) التي تحتاج تكاملًا واعتمادًا فعليًا
 * ونقطة امتداد منفصلة لاحقًا.
 */

interface ZatcaInvoiceFields {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  totalWithVat: string;
  vatAmount: string;
}

function tlvField(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, "utf-8");
  return Buffer.concat([Buffer.from([tag, valueBuffer.length]), valueBuffer]);
}

export function buildZatcaQrBase64(fields: ZatcaInvoiceFields): string {
  const tlv = Buffer.concat([
    tlvField(1, fields.sellerName),
    tlvField(2, fields.vatNumber),
    tlvField(3, fields.timestampIso),
    tlvField(4, fields.totalWithVat),
    tlvField(5, fields.vatAmount),
  ]);

  return tlv.toString("base64");
}
