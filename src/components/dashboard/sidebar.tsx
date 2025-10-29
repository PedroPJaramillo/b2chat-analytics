"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronLeft, ChevronDown, ChevronRight } from "lucide-react"
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
  Database,
  BrainCircuit,
  User,
  Bell,
  Monitor,
  FileDown,
  Target,
  Calendar,
  HardDrive,
  Contact,
  FileJson,
  ClipboardList,
} from "lucide-react"

const sidebarNavSections = [
  {
    title: "Dashboard",
    items: [
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
    ]
  },
  {
    title: "Data",
    items: [
      {
        title: "Agents",
        href: "/dashboard/agents",
        icon: Users,
      },
      {
        title: "Contacts",
        href: "/dashboard/contacts",
        icon: Contact,
      },
      {
        title: "Chats",
        href: "/dashboard/chats",
        icon: MessageSquare,
      },
      {
        title: "Chat View",
        href: "/dashboard/chats/view",
        icon: ClipboardList,
      },
    ]
  },
  {
    title: "Insights",
    items: [
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
        title: "SLA Compliance",
        href: "/dashboard/sla",
        icon: Target,
      },
      {
        title: "Customer Satisfaction",
        href: "/dashboard/satisfaction",
        icon: UserCheck,
      },
      {
        title: "Customer Analysis",
        href: "/dashboard/customer-analysis",
        icon: BrainCircuit,
        badge: "AI"
      },
      {
        title: "Reports",
        href: "/dashboard/reports",
        icon: PieChart,
      },
    ]
  },
  {
    title: "Admin",
    items: [
      {
        title: "Data Sync",
        href: "/dashboard/sync",
        icon: Database,
        badge: "Admin"
      },
      {
        title: "Raw Data",
        href: "/dashboard/raw-data",
        icon: FileJson,
        badge: "Debug"
      },
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        subItems: [
          {
            title: "Profile",
            href: "/dashboard/settings/profile",
            icon: User,
          },
          {
            title: "Notifications",
            href: "/dashboard/settings/notifications",
            icon: Bell,
          },
          {
            title: "Display",
            href: "/dashboard/settings/display",
            icon: Monitor,
          },
          {
            title: "Export",
            href: "/dashboard/settings/export",
            icon: FileDown,
          },
          {
            title: "Data Sync Config",
            href: "/dashboard/settings/sync",
            icon: Database,
            badge: "Admin",
          },
          {
            title: "SLA Config",
            href: "/dashboard/settings/sla",
            icon: Target,
            badge: "Admin",
          },
          {
            title: "Office Hours",
            href: "/dashboard/settings/office-hours",
            icon: Clock,
            badge: "Admin",
          },
          {
            title: "Holidays",
            href: "/dashboard/settings/holidays",
            icon: Calendar,
            badge: "Admin",
          },
          {
            title: "Database",
            href: "/dashboard/settings/database",
            icon: HardDrive,
            badge: "Admin",
          },
        ],
      },
    ]
  }
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  onCollapse?: () => void
}

export function Sidebar({ className, isCollapsed = false, onCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [openSettings, setOpenSettings] = useState(() =>
    pathname.startsWith('/dashboard/settings')
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-col py-4", className)}>
        <div className="space-y-4">
          <div className="px-3 py-2">
            <div className="mb-4 flex items-center justify-between px-4">
              {!isCollapsed && (
                <h2 className="text-lg font-semibold tracking-tight">
                  B2Chat Analytics
                </h2>
              )}
              {onCollapse && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCollapse}
                  className={cn(
                    "hidden h-8 w-8 md:flex",
                    isCollapsed && "rotate-180"
                  )}
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {sidebarNavSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  {!isCollapsed && (
                    <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.title}
                    </h3>
                  )}
                  {section.items.map((item) => {
                    // For Settings, match sub-pages too; for others, exact match
                    const isActive = item.href === "/dashboard/settings"
                      ? pathname.startsWith(item.href)
                      : pathname === item.href

                    // Check if item has sub-items (Settings menu)
                    const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0

                    if (hasSubItems && !isCollapsed) {
                      // Render collapsible menu for Settings
                      return (
                        <Collapsible
                          key={item.href}
                          open={openSettings}
                          onOpenChange={setOpenSettings}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className={cn(
                                "w-full justify-start",
                                isActive && "bg-muted font-medium"
                              )}
                            >
                              <item.icon className="mr-2 h-4 w-4" />
                              {item.title}
                              {openSettings ? (
                                <ChevronDown className="ml-auto h-4 w-4" />
                              ) : (
                                <ChevronRight className="ml-auto h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4 space-y-1 mt-1">
                            {item.subItems.map((subItem) => {
                              const isSubActive = pathname === subItem.href
                              return (
                                <Button
                                  key={subItem.href}
                                  variant={isSubActive ? "secondary" : "ghost"}
                                  className={cn(
                                    "w-full justify-start text-sm",
                                    isSubActive && "bg-muted font-medium"
                                  )}
                                  asChild
                                >
                                  <Link href={subItem.href}>
                                    <subItem.icon className="mr-2 h-3.5 w-3.5" />
                                    {subItem.title}
                                    {subItem.badge && (
                                      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                                        {subItem.badge}
                                      </Badge>
                                    )}
                                  </Link>
                                </Button>
                              )
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    }

                    // Regular menu item (non-collapsible)
                    return isCollapsed ? (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                              "w-full",
                              "justify-center px-2",
                              isActive && "bg-muted font-medium"
                            )}
                            asChild
                            aria-label={item.title}
                          >
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        key={item.href}
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isActive && "bg-muted font-medium"
                        )}
                        asChild
                      >
                        <Link href={item.href}>
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.title}
                          {'badge' in item && item.badge && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </Button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
