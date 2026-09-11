import type { AdvisorAIRequest, AdvisorAIAnswer, AdvisorAIUsage } from './contracts';
import type { WorldPulseResponse } from './world-pulse-contracts';
import type { ISODate } from '../simulation/types';

export type AdvisorAIAuditEntry = {
  id: string;
  createdAt: string;
  request: Pick<AdvisorAIRequest, 'requestId' | 'question' | 'context'>;
  result: { ok: true; answer: AdvisorAIAnswer; usage: AdvisorAIUsage; source?: 'llm' | 'local_fallback' } | { ok: false; message: string; usage?: AdvisorAIUsage; diagnostics?: { issues: string[]; truncated: boolean } };
};

export type WorldPulseAIAuditEntry = {
  id: string;
  createdAt: string;
  currentDate: ISODate;
  response: WorldPulseResponse;
};

export const advisorAuditStorageKey = 'ordo-advisor-ai-audit-v1';
export const advisorAuditMaximumEntries = 20;
export const worldPulseAuditStorageKey = 'ordo-world-pulse-ai-audit-v1';
export const worldPulseAuditMaximumEntries = 24;

function readJsonArray<T>(storageKey: string, maximumEntries: number): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, maximumEntries) as T[] : [];
  } catch {
    return [];
  }
}

export const readAdvisorAudit = () => readJsonArray<AdvisorAIAuditEntry>(advisorAuditStorageKey, advisorAuditMaximumEntries);
export const readWorldPulseAudit = () => readJsonArray<WorldPulseAIAuditEntry>(worldPulseAuditStorageKey, worldPulseAuditMaximumEntries);
