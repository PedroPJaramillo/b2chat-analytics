"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/providers/theme-provider"
import { cn } from "@/lib/utils"

export function ModeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative h-9 w-9"
    >
      <Sun className={cn("h-4 w-4 transition-all", isDark ? "-rotate-90 scale-0" : "rotate-0 scale-100")}
      />
      <Moon className={cn(
        "absolute h-4 w-4 transition-all",
        isDark ? "rotate-0 scale-100" : "rotate-90 scale-0"
      )}
      />
    </Button>
  )
}
