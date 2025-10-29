"use client"

import { ContactsTable } from "@/components/contacts/contacts-table"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function ContactsPage() {
  return (
    <div className={pageContainerClasses}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground">
            View and analyze all customer contacts
          </p>
        </div>
      </div>

      {/* Contacts Table */}
      <ContactsTable />
    </div>
  )
}
