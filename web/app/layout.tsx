import type { Metadata } from "next";
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
