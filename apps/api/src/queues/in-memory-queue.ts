type FailedJobRecord = {
  id: string;
  name: string;
  data: unknown;
  failedReason?: string;
  attemptsMade: number;
  finishedOn?: number;
};

export class InMemoryQueue {
  private readonly failedJobs: FailedJobRecord[] = [];

  constructor(private readonly queueName: string) {}

  add(name: string, data: unknown, options?: { jobId?: string }) {
    return Promise.resolve({
      id: options?.jobId ?? `${this.queueName}:${Date.now()}`,
      name,
      data,
      attemptsMade: 0,
    });
  }

  getFailed() {
    return Promise.resolve(this.failedJobs);
  }
}
