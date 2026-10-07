import type { Metadata } from "next";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { Archivo, Public_Sans } from "next/font/google";
import "./globals.css";
import { brandCssVariables, BRAND_PRODUCT, getBrandSettings } from "@/lib/branding";
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

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  const brand = await getBrandSettings()
  return {
    title: { default: `${brand.organizationName} ${BRAND_PRODUCT}`, template: `%s · ${brand.organizationName}` },
    description: brand.organizationName === BRAND.name
      ? BRAND.description
      : `${brand.organizationName} customer support and service desk`,
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection()
  const brand = await getBrandSettings()

  return (
    <html
      lang="en"
      // Required by next-themes: its pre-hydration script writes `class` and
      // `style` on this element, which React would otherwise report as a
      // hydration mismatch on every load.
      suppressHydrationWarning
      className={`${publicSans.variable} ${archivo.variable} h-full antialiased`}
      style={brandCssVariables(brand) as CSSProperties}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
