import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต",
  description: "ระบบจองคิวเข้ารับคำปรึกษา ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต",
  icons: {
    icon: "/brand/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
