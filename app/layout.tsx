import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex",
});

export const metadata: Metadata = {
  title: "Smartcut",
  description: "Раскрой листовых материалов с картой, операциями и метриками",
  icons: {
    icon: "/logo_smartcut.svg",
    shortcut: "/logo_smartcut.svg",
    apple: "/logo_smartcut.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} ${ibmPlexSans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
