export type MatchableJob = {
  id: string;
  name: string;
  customerName: string;
  tradeType: string;
};

export type JobMatch = {
  jobId: string | null;
  jobName: string | null;
  confidence: number;
};

const locationWords = ["cary", "raleigh", "apex", "morrisville", "durham"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function importantTokens(job: MatchableJob) {
  const words = normalize(`${job.name} ${job.customerName} ${job.tradeType}`)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["the", "and", "install", "replacement"].includes(word));

  return Array.from(new Set([...words, ...locationWords.filter((word) => normalize(job.name).includes(word))]));
}

export function matchJob(text: string, jobs: MatchableJob[]): JobMatch {
  const haystack = normalize(text);
  let best: JobMatch = { jobId: null, jobName: null, confidence: 0 };

  for (const job of jobs) {
    const tokens = importantTokens(job);
    const hits = tokens.filter((token) => haystack.includes(token));
    const customerHit = haystack.includes(normalize(job.customerName));
    const locationHit = locationWords.some((word) => haystack.includes(word) && normalize(job.name).includes(word));
    const confidence = Math.min(0.98, hits.length / Math.max(tokens.length, 4) + (customerHit ? 0.35 : 0) + (locationHit ? 0.2 : 0));

    if (confidence > best.confidence) {
      best = { jobId: job.id, jobName: job.name, confidence };
    }
  }

  return best.confidence >= 0.55 ? best : { jobId: null, jobName: null, confidence: 0 };
}

export function findJobByModelName(jobMatch: string | null, jobs: MatchableJob[]): JobMatch {
  if (!jobMatch) return { jobId: null, jobName: null, confidence: 0 };
  const normalized = normalize(jobMatch);
  const job = jobs.find(
    (candidate) =>
      normalize(candidate.name) === normalized ||
      normalize(candidate.customerName) === normalized ||
      normalized.includes(normalize(candidate.customerName)),
  );

  return job ? { jobId: job.id, jobName: job.name, confidence: 0.9 } : { jobId: null, jobName: null, confidence: 0 };
}
