/**
 * Normalizes a URL or domain string into a clean hostname and root domain.
 * Examples:
 *   "https://www.stripe.com/us/payments?ref=1" -> { hostname: "stripe.com", rootDomain: "stripe.com" }
 *   "eu.posthog.com" -> { hostname: "eu.posthog.com", rootDomain: "posthog.com" }
 */
export function normalizeDomain(rawUrl: string): { hostname: string; rootDomain: string } {
  if (!rawUrl) return { hostname: '', rootDomain: '' };

  let cleaned = rawUrl.trim().toLowerCase();
  
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  
  // Remove credentials or port if any
  cleaned = cleaned.replace(/^[^\/@]+@/, '');
  
  // Remove path, query, hash
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx !== -1) {
    cleaned = cleaned.substring(0, slashIdx);
  }
  const questionIdx = cleaned.indexOf('?');
  if (questionIdx !== -1) {
    cleaned = cleaned.substring(0, questionIdx);
  }
  const hashIdx = cleaned.indexOf('#');
  if (hashIdx !== -1) {
    cleaned = cleaned.substring(0, hashIdx);
  }

  // Remove port
  cleaned = cleaned.replace(/:\d+$/, '');

  // Strip leading www.
  let hostname = cleaned.replace(/^www\./, '');

  // Extract root domain (e.g. eu.posthog.com -> posthog.com)
  const parts = hostname.split('.');
  let rootDomain = hostname;
  if (parts.length > 2) {
    // Basic multi-part TLD handling (e.g., .co.uk, .com.au)
    const secondToLast = parts[parts.length - 2];
    const last = parts[parts.length - 1];
    if (['co', 'com', 'org', 'net', 'edu', 'gov'].includes(secondToLast) && last.length === 2) {
      if (parts.length >= 3) {
        rootDomain = parts.slice(-3).join('.');
      }
    } else {
      rootDomain = parts.slice(-2).join('.');
    }
  }

  return { hostname, rootDomain };
}

const CORP_SUFFIXES = [
  'inc', 'incorporated', 'llc', 'corp', 'corporation', 'ltd', 'limited',
  'co', 'company', 'pbc', 'bv', 'sa', 'sas', 'ulc', 'plc', 'pty', 'kk', 'gmbh'
];

/**
 * Normalizes a company name for fuzzy & exact matching:
 * - strips accents & non-alphanumeric characters
 * - removes corporate suffixes
 * - strips extra spaces
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  let cleaned = name.toLowerCase();

  // Remove punctuation
  cleaned = cleaned.replace(/[^a-z0-9\s]/g, ' ');

  // Split into words
  const words = cleaned.split(/\s+/).filter(Boolean);

  // Filter out trailing corporate entity types
  const filtered = words.filter((w) => !CORP_SUFFIXES.includes(w));

  return filtered.join(' ').trim();
}
