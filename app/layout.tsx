import type { Metadata } from "next";
import "./globals.css";
import { PlayingProvider } from "@/lib/playing-context";

export const metadata: Metadata = {
  title: "arrythmia",
  description: "arrythmia — an album",
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
