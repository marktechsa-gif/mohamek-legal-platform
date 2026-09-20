import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "أسانيد — صياغة اللوائح والمذكرات القانونية بالذكاء الاصطناعي",
  description:
    "منصة أسانيد تجري معك محادثة استقصائية عن قضيتك وتصوغ لك لائحة الدعوى مستندة لنصوص الأنظمة السعودية.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
