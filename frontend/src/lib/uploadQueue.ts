export type QueueResult<T> = { succeeded: T[]; failed: T[] };

type Options<T> = {
  concurrency?: number;
  retries?: number;
  onStart?: (item: T) => void;
  onFinish?: (item: T, success: boolean) => void;
};

/** Uploads a batch without exhausting the browser, API or Google Drive. */
export async function uploadInQueue<T>(
  items: T[],
  upload: (item: T) => Promise<void>,
  options: Options<T> = {},
): Promise<QueueResult<T>> {
  const concurrency = Math.min(Math.max(options.concurrency ?? 3, 1), 5);
  const retries = Math.max(options.retries ?? 1, 0);
  const succeeded: T[] = [];
  const failed: T[] = [];
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      const item = items[index];
      if (!item) return;
      options.onStart?.(item);
      let success = false;
      for (let attempt = 0; attempt <= retries && !success; attempt += 1) {
        try {
          await upload(item);
          success = true;
        } catch {
          if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        }
      }
      if (success) succeeded.push(item); else failed.push(item);
      options.onFinish?.(item, success);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { succeeded, failed };
}