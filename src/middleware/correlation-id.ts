import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * Correlation ID Middleware
 *
 * Adds a correlation ID to each request for distributed tracing.
 * The correlation ID can be:
 * 1. Provided by the client in X-Correlation-ID header
 * 2. Auto-generated if not provided
 *
 * The correlation ID is then:
 * - Added to response headers
 * - Available for logging throughout the request lifecycle
 */

export function correlationIdMiddleware(request: NextRequest) {
  // Get existing correlation ID from request header, or generate new one
  const correlationId = request.headers.get('x-correlation-id') || uuidv4()

  // Clone the request headers and add correlation ID
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-correlation-id', correlationId)

  // Create response with correlation ID
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add correlation ID to response headers for client visibility
  response.headers.set('x-correlation-id', correlationId)

  return response
}

/**
 * Helper function to extract correlation ID from request headers
 */
export function getCorrelationId(request: Request): string | null {
  return request.headers.get('x-correlation-id')
}

/**
 * Helper function to extract correlation ID from Next.js request
 */
export function getCorrelationIdFromNextRequest(request: NextRequest): string | null {
  return request.headers.get('x-correlation-id')
}
