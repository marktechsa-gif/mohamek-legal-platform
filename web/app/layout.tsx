import type { Metadata } from "next";

// خط Cairo مُستضاف محليًا (@fontsource) بدل الاعتماد على Google Fonts CDN في وقت التشغيل —
// نفس خط هوية MarkTech Solutions المستخدم في site/index.php، بنفس الأوزان.
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart MRO & Garage ERP",
  description: "نظام إدارة الورش والصيانة الذكي — إدارة أوامر الشغل والتشاليح واللوجستيات والمحاسبة",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
