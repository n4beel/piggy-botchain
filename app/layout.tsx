import type { Metadata, Viewport } from "next";
import { Lexend, Roboto_Mono } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import WrongNetworkBar from "@/components/botchain/WrongNetworkBar";
import PageShell from "@/components/layout/PageShell";
import { app } from "@/lib/app-config";
import "./globals.css";

const lexendFont = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
});

const robotoMonoFont = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.tagline,
  openGraph: {
    title: `${app.name} — ${app.tagline}`,
    description: app.tagline,
    type: "website",
    url: app.url,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBE3E8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lexendFont.variable} ${robotoMonoFont.variable} h-full`}
      style={{ ["--accent" as string]: app.accent }}
    >
      <body className="min-h-full antialiased bg-[#FBE3E8] text-[#3A1020]">
        <EvmProvider>
          <ToastProvider>
            <WrongNetworkBar />
            <PageShell>{children}</PageShell>
          </ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
