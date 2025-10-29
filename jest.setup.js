// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.CLERK_SECRET_KEY = 'sk_test_mock'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.B2CHAT_API_URL = 'https://api.b2chat.io'
process.env.B2CHAT_USERNAME = 'test_user'
process.env.B2CHAT_PASSWORD = 'test_pass'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
  useParams() {
    return {}
  },
}))

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  auth: () => ({ userId: 'user_test' }),
  currentUser: () => Promise.resolve({ id: 'user_test', email: 'test@example.com' }),
  useAuth: () => ({ isSignedIn: true, userId: 'user_test' }),
  useUser: () => ({ user: { id: 'user_test', email: 'test@example.com' } }),
  ClerkProvider: ({ children }) => children,
  SignIn: () => null,
  SignUp: () => null,
  UserButton: () => null,
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock window.matchMedia (only in browser environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Suppress console errors in tests (optional)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})