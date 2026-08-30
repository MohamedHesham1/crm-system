import type { AnchorHTMLAttributes, ReactNode } from "react"

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }

/** Aliased over `next/link` for the `components` project (`vitest.config.ts`). */
export default function Link({ href, children, ...rest }: Props) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}
