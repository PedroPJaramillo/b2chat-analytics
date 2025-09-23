import { authMiddleware } from "@clerk/nextjs"

export default authMiddleware({
  // Routes that don't require authentication
  publicRoutes: [
    "/",
    "/api/health",
    "/api/webhook/clerk"
  ],
  // Routes that are ignored by the auth middleware
  ignoredRoutes: [
    "/api/webhook/clerk",
    "/_next/static",
    "/_next/image",
    "/favicon.ico"
  ],
  // API routes that require authentication
  apiRoutes: ["/api/(.*)"],
  // After authentication, redirect to dashboard
  afterAuth(auth, req, evt) {
    // Handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Handle users who are authenticated but don't have access
    if (auth.userId && !auth.isPublicRoute) {
      // Check if user has required role for admin routes
      if (req.nextUrl.pathname.startsWith("/admin")) {
        const metadata = auth.sessionClaims?.metadata as { role?: string } | undefined
        const role = metadata?.role
        if (role !== "Admin") {
          return new Response("Forbidden", { status: 403 })
        }
      }
    }
  },
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}