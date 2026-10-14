import { CrmAccount, InboundAccount } from '@/types/crm';
import { normalizeDomain, normalizeCompanyName } from './normalizers';

export interface ScoredCandidate {
  account: CrmAccount;
  matchScore: number; // 0 to 1 heuristic score
  matchReasons: string[];
}

/**
 * Calculates Levenshtein string distance
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  return d[m][n];
}

/**
 * String similarity ratio (0 to 1) based on Levenshtein distance
 */
function stringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

/**
 * Computes Jaccard word token overlap
 */
function tokenJaccard(s1: string, s2: string): number {
  const t1 = new Set(s1.split(/\s+/).filter(Boolean));
  const t2 = new Set(s2.split(/\s+/).filter(Boolean));
  if (t1.size === 0 && t2.size === 0) return 1;
  if (t1.size === 0 || t2.size === 0) return 0;

  const intersection = new Set([...t1].filter((x) => t2.has(x)));
  const union = new Set([...t1, ...t2]);

  return intersection.size / union.size;
}

/**
 * Deterministic fast check:
 * Returns matching CrmAccount if an exact match exists on:
 * 1. Normalized Hostname/Domain
 * 2. Normalized Company Name with 100% match
 */
export function deterministicCheck(
  inbound: InboundAccount,
  existingAccounts: CrmAccount[]
): { matchedAccount: CrmAccount | null; reason?: string } {
  const inbDomain = normalizeDomain(inbound.website);
  const inbName = normalizeCompanyName(inbound.name);

  for (const acc of existingAccounts) {
    const accDomain = normalizeDomain(acc.domain);
    const accName = normalizeCompanyName(acc.name);

    const hasCrossBorderDifference =
      inbound.country &&
      acc.headquarters.country &&
      inbound.country !== acc.headquarters.country;

    const hasRegionalOrSubsidiaryFlag = /\b(europe|uk|australia|france|canada|japan|international|federal|embedded|asia|emea|apac|latam|pty|bv|sas|ulc|kk)\b/i.test(
      inbound.name
    );

    // If it is a cross-border entity or contains subsidiary/regional division keywords,
    // do not auto-merge in deterministic fast-pass. Defer to Jev evaluation for curator review!
    if (hasCrossBorderDifference || hasRegionalOrSubsidiaryFlag) {
      continue;
    }

    // 1. Exact normalized hostname match
    if (inbDomain.hostname && accDomain.hostname && inbDomain.hostname === accDomain.hostname) {
      return {
        matchedAccount: acc,
        reason: `Exact domain match (${inbDomain.hostname} == ${accDomain.hostname})`,
      };
    }

    // 2. Exact normalized root domain match AND company name token match
    if (inbDomain.rootDomain && accDomain.rootDomain && inbDomain.rootDomain === accDomain.rootDomain) {
      if (inbName === accName || inbName.includes(accName) || accName.includes(inbName)) {
        return {
          matchedAccount: acc,
          reason: `Exact root domain (${inbDomain.rootDomain}) + company name match`,
        };
      }
    }

    // 3. Exact normalized company name match (if length >= 5 to avoid false collision on short words)
    if (inbName.length >= 5 && inbName === accName) {
      return {
        matchedAccount: acc,
        reason: `Exact normalized legal company name match ("${inbName}")`,
      };
    }
  }

  return { matchedAccount: null };
}

/**
 * Candidate Blocking / Fast Retrieval:
 * Ranks and returns top candidate accounts for ambiguous cases.
 */
export function retrieveCandidates(
  inbound: InboundAccount,
  existingAccounts: CrmAccount[],
  limit: number = 3
): ScoredCandidate[] {
  const inbDomain = normalizeDomain(inbound.website);
  const inbName = normalizeCompanyName(inbound.name);
  const candidates: ScoredCandidate[] = [];

  for (const acc of existingAccounts) {
    const accDomain = normalizeDomain(acc.domain);
    const accName = normalizeCompanyName(acc.name);
    const reasons: string[] = [];
    let score = 0;

    // Check root domain match
    if (inbDomain.rootDomain && accDomain.rootDomain && inbDomain.rootDomain === accDomain.rootDomain) {
      score += 0.5;
      reasons.push(`Shared root domain: ${inbDomain.rootDomain}`);
    }

    // Name similarity & substring overlap
    const sim = stringSimilarity(inbName, accName);
    const jaccard = tokenJaccard(inbName, accName);
    const nameScore = Math.max(sim, jaccard);

    if (nameScore > 0.35) {
      score += nameScore * 0.45;
      reasons.push(`Name similarity: ${Math.round(nameScore * 100)}%`);
    } else if (inbName.includes(accName) || accName.includes(inbName)) {
      score += 0.4;
      reasons.push(`Substring name overlap ("${accName}")`);
    }

    // Check alias match
    if (acc.aliases) {
      for (const alias of acc.aliases) {
        const normAlias = normalizeCompanyName(alias);
        const aliasSim = stringSimilarity(inbName, normAlias);
        const aliasJaccard = tokenJaccard(inbName, normAlias);
        const isSubstr = inbName.includes(normAlias) || normAlias.includes(inbName);
        if (aliasSim > 0.6 || aliasJaccard > 0.35 || isSubstr) {
          score += 0.45;
          reasons.push(`Matched alias: "${alias}"`);
          break;
        }
      }
    }

    // Country/City match bonus
    if (inbound.country && acc.headquarters.country && inbound.country === acc.headquarters.country) {
      score += 0.05;
    }

    if (score >= 0.25) {
      candidates.push({
        account: acc,
        matchScore: Math.min(1.0, score),
        matchReasons: reasons,
      });
    }
  }

  // Sort descending by matchScore
  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates.slice(0, limit);
}
