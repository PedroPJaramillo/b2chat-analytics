import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/webhook/clerk'
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Add correlation ID to request
  const correlationId = req.headers.get('x-correlation-id') || uuidv4()
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-correlation-id', correlationId)

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

  // Create response with correlation ID
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add correlation ID to response headers
  response.headers.set('x-correlation-id', correlationId)

  return response
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}