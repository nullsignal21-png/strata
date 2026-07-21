export type MatchableJob = {
  id: string;
  name: string;
  customerName: string;
  tradeType: string;
  city?: string | null;
  address?: string | null;
};

export type JobMatchStatus = "matched" | "suggested" | "unmatched";

export type JobMatch = {
  jobId: string | null;
  jobName: string | null;
  confidence: number;
  reason: string;
  status: JobMatchStatus;
};

const stopWords = new Set(["the", "and", "install", "replacement", "service", "job", "for", "with"]);

export function normalizeJobText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return normalizeJobText(value)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function importantTokens(job: MatchableJob) {
  return Array.from(
    new Set(tokens(`${job.name} ${job.customerName} ${job.tradeType} ${job.city ?? ""} ${job.address ?? ""}`)),
  );
}

function reason(parts: string[]) {
  return parts.length ? parts.join(", ") : "No strong customer, location, or job keyword match.";
}

export function matchJob(text: string, jobs: MatchableJob[]): JobMatch {
  const haystack = normalizeJobText(text);
  let best: JobMatch = {
    jobId: null,
    jobName: null,
    confidence: 0,
    reason: "No jobs available.",
    status: "unmatched",
  };

  for (const job of jobs) {
    const jobTokens = importantTokens(job);
    const hits = jobTokens.filter((token) => haystack.includes(token));
    const customerHit = haystack.includes(normalizeJobText(job.customerName));
    const customerTokenHit = tokens(job.customerName).some((token) => haystack.includes(token));
    const cityHit = job.city ? haystack.includes(normalizeJobText(job.city)) : false;
    const addressHit = job.address
      ? tokens(job.address).some((token) => token.length > 3 && haystack.includes(token))
      : false;
    const tradeHit = haystack.includes(normalizeJobText(job.tradeType));
    const confidence = Math.min(
      0.98,
        hits.length / Math.max(jobTokens.length, 5) +
        (customerHit ? 0.35 : 0) +
        (!customerHit && customerTokenHit ? 0.25 : 0) +
        (cityHit ? 0.18 : 0) +
        (addressHit ? 0.22 : 0) +
        (tradeHit ? 0.1 : 0),
    );

    if (confidence > best.confidence) {
      const reasons = [
        customerHit ? "customer name matched" : null,
        !customerHit && customerTokenHit ? "customer keyword matched" : null,
        cityHit ? "city matched" : null,
        addressHit ? "address keyword matched" : null,
        tradeHit ? "trade type matched" : null,
        hits.length ? `${hits.length} job keywords matched` : null,
      ].filter(Boolean) as string[];

      best = {
        jobId: job.id,
        jobName: job.name,
        confidence,
        reason: reason(reasons),
        status: confidence >= 0.65 ? "matched" : confidence >= 0.45 ? "suggested" : "unmatched",
      };
    }
  }

  if (best.status === "unmatched") {
    return {
      jobId: null,
      jobName: null,
      confidence: 0,
      reason: "No strong customer, location, or job keyword match.",
      status: "unmatched",
    };
  }

  return best;
}

export function findJobByModelName(jobMatch: string | null, jobs: MatchableJob[]): JobMatch {
  if (!jobMatch) {
    return { jobId: null, jobName: null, confidence: 0, reason: "Model returned no job.", status: "unmatched" };
  }

  const normalized = normalizeJobText(jobMatch);
  const job = jobs.find(
    (candidate) =>
      normalizeJobText(candidate.name) === normalized ||
      normalizeJobText(candidate.customerName) === normalized ||
      normalized.includes(normalizeJobText(candidate.customerName)),
  );

  return job
    ? {
        jobId: job.id,
        jobName: job.name,
        confidence: 0.9,
        reason: "Model job name matched a known job.",
        status: "matched",
      }
    : { jobId: null, jobName: null, confidence: 0, reason: "Model job did not match a known job.", status: "unmatched" };
}
