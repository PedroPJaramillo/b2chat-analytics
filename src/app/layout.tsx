import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import { Metadata } from 'next'
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'B2Chat Analytics',
  description: 'Advanced analytics dashboard for B2Chat customer service performance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder"}
    >
      <html lang="en">
        <body className={`${inter.className} antialiased`} suppressHydrationWarning>
          <ThemeProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
