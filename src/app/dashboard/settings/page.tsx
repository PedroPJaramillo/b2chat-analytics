import { redirect } from "next/navigation"

export default function SettingsPage() {
  // Redirect to profile as the default settings page
  redirect("/dashboard/settings/profile")
}
