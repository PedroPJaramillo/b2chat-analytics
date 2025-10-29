"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { cn } from "@/lib/utils"

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved !== null) {
      setIsCollapsed(saved === "true")
    }
  }, [])

  // Save sidebar state to localStorage
  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const newValue = !prev
      localStorage.setItem("sidebar-collapsed", String(newValue))
      return newValue
    })
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden bg-background">
        <aside
          className={cn(
            "hidden border-r bg-background transition-[width] duration-300 md:flex md:flex-col overflow-y-auto",
            isCollapsed
              ? "w-[64px]"
              : "w-[220px] lg:w-[240px]"
          )}
        >
          <Sidebar
            isCollapsed={isCollapsed}
            onCollapse={toggleSidebar}
          />
        </aside>
        <main className="flex flex-1 flex-col overflow-y-auto">
          <ErrorBoundary>
            <div className="mx-auto w-full max-w-screen-2xl animate-in fade-in duration-300">
              {children}
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
