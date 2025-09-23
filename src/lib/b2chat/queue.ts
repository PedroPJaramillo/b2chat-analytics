interface QueueItem {
  id: string
  fn: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: number
}

export class RateLimitedQueue {
  private queue: QueueItem[] = []
  private processing = false
  private requestsThisSecond = 0
  private requestsToday = 0
  private lastRequestTime = 0
  private dayStartTime = Date.now()

  constructor(
    private maxRequestsPerSecond = 5,
    private maxRequestsPerDay = 10000
  ) {}

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem = {
        id: Math.random().toString(36).substring(7),
        fn,
        resolve,
        reject,
        timestamp: Date.now(),
      }

      this.queue.push(item)
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      // Check daily limit
      if (this.hasDayReset()) {
        this.resetDayCounters()
      }

      if (this.requestsToday >= this.maxRequestsPerDay) {
        console.warn('Daily rate limit reached')
        break
      }

      // Check per-second limit
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      if (timeSinceLastRequest >= 1000) {
        this.requestsThisSecond = 0
      }

      if (this.requestsThisSecond >= this.maxRequestsPerSecond) {
        const waitTime = 1000 - timeSinceLastRequest
        await this.sleep(waitTime)
        this.requestsThisSecond = 0
      }

      const item = this.queue.shift()!

      try {
        const result = await item.fn()
        item.resolve(result)

        this.requestsThisSecond++
        this.requestsToday++
        this.lastRequestTime = Date.now()
      } catch (error) {
        item.reject(error)
      }
    }

    this.processing = false
  }

  private hasDayReset(): boolean {
    return Date.now() - this.dayStartTime > 24 * 60 * 60 * 1000
  }

  private resetDayCounters(): void {
    this.requestsToday = 0
    this.dayStartTime = Date.now()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      requestsThisSecond: this.requestsThisSecond,
      requestsToday: this.requestsToday,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      maxRequestsPerDay: this.maxRequestsPerDay,
    }
  }
}

export const rateLimitedQueue = new RateLimitedQueue()