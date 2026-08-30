"use client"

import { useSyncExternalStore } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

const noopSubscribe = () => () => {}

/**
 * `useTheme()` cannot know the resolved theme during SSR or the first client
 * render, so the icon is rendered only after mount. `useSyncExternalStore`
 * reports `false` for the server snapshot and `true` on the client, giving
 * the same mount gate as a `useEffect(() => setMounted(true), [])` without
 * the cascading-render setState-in-effect it would otherwise trigger. The
 * button itself is always present, at a fixed size, so the nav does not
 * reflow on hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : null}
    </Button>
  )
}
