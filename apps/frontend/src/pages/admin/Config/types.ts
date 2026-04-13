export type HealthState = {
  ok: boolean;
  checkedAt: string;
  reason?: string;
  status?: number;
  latencyMs?: number;
  model?: string;
};

export type LlmTestResult = {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
  response?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  cost?: number;
  error?: string;
};

export type LlmLogItem = {
  id: string;
  source: string;
  providerId?: string | null;
  providerName?: string | null;
  model?: string | null;
  status: string;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  cost?: number | null;
  prompt?: string | null;
  systemPrompt?: string | null;
  response?: string | null;
  error?: string | null;
  meta?: unknown;
  userId?: string | null;
  submissionId?: string | null;
  createdAt: string;
};
