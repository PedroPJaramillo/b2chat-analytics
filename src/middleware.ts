import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/webhook/clerk'
])

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    auth.protect()
  }

  // Handle admin routes
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const { sessionClaims } = await auth()
    const metadata = sessionClaims?.metadata as { role?: string } | undefined
    const role = metadata?.role
    if (role !== "Admin") {
      return new Response("Forbidden", { status: 403 })
    }
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}