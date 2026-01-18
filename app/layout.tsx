import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { AccentColorProvider } from "@/components/accent-color-provider";
import { DownloadManagerProvider } from "@/components/download-manager-provider";
import { LocalServerProvider } from "@/components/local-server-provider";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "VANTA Research",
  description: "Advanced AI Research Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark accent-blue">
      <body className={`${roboto.variable} antialiased`}>
        <AccentColorProvider>
          <DownloadManagerProvider>
            <LocalServerProvider>{children}</LocalServerProvider>
          </DownloadManagerProvider>
        </AccentColorProvider>
      </body>
    </html>
  );
}
