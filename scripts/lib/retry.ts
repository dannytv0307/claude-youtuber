const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry on rate limits / transient server errors (any provider) with exponential backoff. */
export const withRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 5,
): Promise<T> => {
  let delay = 4000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "limit: 0" = model not available on this key's tier; retrying cannot help
      if (/limit: 0\b/.test(msg)) {
        const model = msg.match(/model: ([\w.-]+)/)?.[1] ?? "?";
        console.error(
          `  ${label}: model ${model} không có quota cho key này (free tier = 0). Cần key từ project đã gắn billing, hoặc đặt ảnh thủ công vào public/projects/<id>/images/.`,
        );
        process.exit(1);
      }
      // 402 = AI Studio prepaid credits empty; retrying cannot help
      if (/"code":402|prepayment credits/i.test(msg)) {
        console.error(
          `  ${label}: hết prepaid credit của Gemini API. Nạp tại https://aistudio.google.com (Projects → Billing).`,
        );
        process.exit(1);
      }
      const retryable = /429|RESOURCE_EXHAUSTED|500|503|UNAVAILABLE|deadline/i.test(
        msg,
      );
      if (!retryable || i >= attempts) throw err;
      console.warn(`  ${label}: lỗi tạm thời (${i}/${attempts}), thử lại sau ${delay / 1000}s`);
      await sleep(delay);
      delay *= 2;
    }
  }
};


/** Rate-limit / quota errors: after withRetry gives up, further scenes would fail the same way. */
export const isQuotaError = (err: unknown) =>
  /429|RESOURCE_EXHAUSTED|quota/i.test(err instanceof Error ? err.message : String(err));
