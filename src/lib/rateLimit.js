const buckets = new Map();

function now() {
  return Date.now();
}

function getClientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function cleanupBucket(bucket, currentTime, windowMs) {
  bucket.hits = bucket.hits.filter((timestamp) => currentTime - timestamp < windowMs);
}

export function enforceRateLimit(req, key, { limit = 10, windowMs = 60_000 } = {}) {
  const currentTime = now();
  const bucketKey = `${key}:${getClientIp(req)}`;
  const bucket = buckets.get(bucketKey) || { hits: [] };

  cleanupBucket(bucket, currentTime, windowMs);

  if (bucket.hits.length >= limit) {
    const retryAfterMs = windowMs - (currentTime - bucket.hits[0]);
    const error = new Error("Too many requests. Please try again shortly.");
    error.status = 429;
    error.retryAfterSeconds = Math.max(Math.ceil(retryAfterMs / 1000), 1);
    throw error;
  }

  bucket.hits.push(currentTime);
  buckets.set(bucketKey, bucket);
}
