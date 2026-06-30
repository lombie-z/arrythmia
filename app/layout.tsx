import type { Metadata } from "next";
import "./globals.css";
import { PlayingProvider } from "@/lib/playing-context";

export const metadata: Metadata = {
  title: "Arrhythmia — Isaac Rozsa",
  description:
    "Arrhythmia. Independent album by Isaac Rozsa, my indie, neo-classical sulk.",
  metadataBase: new URL("https://arrhythmia.isaacrozsa.com"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Arrhythmia — Isaac Rozsa",
    description: "Arrhythmia. Independent album by Isaac Rozsa, my indie, neo-classical sulk.",
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
    title: "Arrhythmia — Isaac Rozsa",
    description: "Arrhythmia. Independent album by Isaac Rozsa, my indie, neo-classical sulk.",
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
