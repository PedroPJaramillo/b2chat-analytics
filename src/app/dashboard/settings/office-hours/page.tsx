"use client"

import { useUser } from "@clerk/nextjs"
import { OfficeHoursSection } from "@/components/settings/office-hours-section"
import { redirect } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

export default function OfficeHoursPage() {
  const { user, isLoaded } = useUser()

  const getUserRole = () => {
    return (user?.publicMetadata?.role as string) || "Manager"
  }

  const isAdmin = getUserRole() === "Admin"

  if (!isAdmin) {
    redirect("/dashboard/settings/profile")
  }

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return <OfficeHoursSection isAdmin={isAdmin} />
}
