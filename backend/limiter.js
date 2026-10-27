// ============================================================================
// Concurrency Limiter (Semaphore) for CPU-Intensive Tasks (Sharp Super-Resolution)
// Prevents event-loop blockage, OOM crashes, and 100% CPU saturation
// ============================================================================
const os = require('os');

class ConcurrencyLimiter {
  constructor(maxConcurrency = Math.max(2, Math.min(4, os.cpus().length))) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  async acquire(timeoutMs = 20000) {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex(item => item.resolve === resolve);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          reject(new Error('Hệ thống đang bận xử lý nhiều tác vụ nâng cấp ảnh. Vui lòng thử lại sau giây lát!'));
        }
      }, timeoutMs);

      this.queue.push({
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject
      });
    });
  }

  release() {
    this.running--;
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      this.running++;
      const next = this.queue.shift();
      next.resolve();
    }
  }

  /**
   * Run an async worker within the bounded concurrency limit
   */
  async run(taskFn, timeoutMs = 20000) {
    await this.acquire(timeoutMs);
    try {
      return await taskFn();
    } finally {
      this.release();
    }
  }

  getStats() {
    return {
      maxConcurrency: this.maxConcurrency,
      running: this.running,
      queued: this.queue.length
    };
  }
}

// Global CPU limiter instance for Sharp upscaling
const upscaleLimiter = new ConcurrencyLimiter();

module.exports = {
  upscaleLimiter,
  ConcurrencyLimiter
};
