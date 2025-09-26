export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/50">
      <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            B2Chat Analytics
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;Advanced analytics and insights for exceptional customer service performance.&rdquo;
              </p>
              <footer className="text-sm">B2Chat Team</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}