import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { pageContainerClasses } from "@/lib/ui-utils"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <div className={pageContainerClasses}>
      {children}
    </div>
  )
}
