/**
 * UI Utility Classes
 *
 * Centralized spacing and layout utility classes for consistent styling
 * across the application. Use these instead of hardcoded Tailwind classes.
 */

/**
 * Standard page container classes for dashboard pages
 *
 * Provides consistent spacing:
 * - flex-1: Fills available vertical space
 * - space-y-4: 16px vertical spacing between children
 * - p-4 pt-6: 16px padding, 24px top padding on mobile
 * - md:p-8: 32px padding on desktop
 *
 * @example
 * ```tsx
 * import { pageContainerClasses } from "@/lib/ui-utils"
 *
 * export default function MyPage() {
 *   return (
 *     <div className={pageContainerClasses}>
 *       {content}
 *     </div>
 *   )
 * }
 * ```
 */
export const pageContainerClasses = "flex-1 space-y-4 p-4 pt-6 md:p-8"

/**
 * Standard grid classes for metric cards with responsive breakpoints
 *
 * Responsive behavior:
 * - Mobile (<640px): 1 column
 * - Small (≥640px): 2 columns
 * - Large (≥1024px): 3 columns
 * - XL (≥1280px): 4 columns
 * - 2XL (≥1536px): 5 columns
 *
 * @example
 * ```tsx
 * import { metricGridClasses } from "@/lib/ui-utils"
 *
 * <div className={metricGridClasses}>
 *   <MetricCard />
 *   <MetricCard />
 *   <MetricCard />
 * </div>
 * ```
 */
export const metricGridClasses = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"

/**
 * Two-column grid for larger card layouts
 *
 * Responsive behavior:
 * - Mobile: 1 column
 * - Desktop (≥768px): 2 columns
 */
export const twoColumnGridClasses = "grid gap-4 md:grid-cols-2"

/**
 * Three-column grid for medium-sized cards
 *
 * Responsive behavior:
 * - Mobile: 1 column
 * - Tablet (≥768px): 2 columns
 * - Desktop (≥1024px): 3 columns
 */
export const threeColumnGridClasses = "grid gap-4 md:grid-cols-2 lg:grid-cols-3"

/**
 * Four-column grid with smooth transitions
 *
 * Responsive behavior:
 * - Mobile: 1 column
 * - Small (≥640px): 2 columns
 * - Desktop (≥1024px): 4 columns
 */
export const fourColumnGridClasses = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
