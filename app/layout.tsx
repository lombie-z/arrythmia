import type { Metadata } from "next";
import "./globals.css";
import { PlayingProvider } from "@/lib/playing-context";

export const metadata: Metadata = {
  title: "arrhythmia — I. Rozsa",
  description:
    "arrhythmia — an album by I. Rozsa. Sydney-based bedroom producer and composer.",
  metadataBase: new URL("https://arrhythmia.isaacrozsa.com"),
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "arrhythmia — I. Rozsa",
    description: "arrhythmia — an album by I. Rozsa.",
    type: "website",
    siteName: "arrhythmia",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "arrhythmia — I. Rozsa",
    description: "arrhythmia — an album by I. Rozsa.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PlayingProvider>{children}</PlayingProvider>
      </body>
    </html>
  );
}
