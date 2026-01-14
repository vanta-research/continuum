import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { AccentColorProvider } from "@/components/accent-color-provider";

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
        <AccentColorProvider>{children}</AccentColorProvider>
      </body>
    </html>
  );
}
