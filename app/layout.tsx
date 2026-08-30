import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { Providers } from "./providers";

// Two families, both variable, both self-hosted by next/font — no runtime
// request to Google. `Geist`/`Geist_Mono` are gone: `--font-geist-sans` was
// never read by any CSS rule and `font-mono` is used nowhere in the app, so
// keeping them would have meant paying for four families to render two.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: BRAND.fullName, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Required by next-themes: its pre-hydration script writes `class` and
      // `style` on this element, which React would otherwise report as a
      // hydration mismatch on every load.
      suppressHydrationWarning
      className={`${publicSans.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
