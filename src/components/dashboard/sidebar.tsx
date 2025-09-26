"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  Users,
  MessageSquare,
  Settings,
  PieChart,
  Activity,
  Clock,
  TrendingUp,
  UserCheck,
  Database
} from "lucide-react"

const sidebarNavItems = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: TrendingUp,
  },
  {
    title: "Agents",
    href: "/dashboard/agents",
    icon: Users,
  },
  {
    title: "Chats",
    href: "/dashboard/chats",
    icon: MessageSquare,
  },
  {
    title: "Performance",
    href: "/dashboard/performance",
    icon: Activity,
  },
  {
    title: "Response Times",
    href: "/dashboard/response-times",
    icon: Clock,
  },
  {
    title: "Customer Satisfaction",
    href: "/dashboard/satisfaction",
    icon: UserCheck,
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: PieChart,
  },
  {
    title: "Data Sync",
    href: "/dashboard/sync",
    icon: Database,
    badge: "Admin"
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            B2Chat Analytics
          </h2>
          <div className="space-y-1">
            <ScrollArea className="h-[calc(100vh-8rem)] px-1">
              {sidebarNavItems.map((item) => (
                <Button
                  key={item.href}
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    pathname === item.href && "bg-muted font-medium"
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.title}
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                </Button>
              ))}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}