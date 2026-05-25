/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

const REQUEST_TIMEOUT_MS = 4000;

interface CacheEntry {
  data: InfoFinancialResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;

export interface InfoFinancialResponse {
  currency: string;
  balance: number;
  updatedAt: string;
  brlRate: number;
}

export class InfoRestApi {
  static clearCache(): void {
    cache.clear();
  }

  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getFinancialByCnpj(cnpj: string): Promise<InfoFinancialResponse> {
    const cacheKey = `info:fin:${cnpj}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/api/financial/${cnpj}`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Info API responded with status ${response.status}`);
      }

      const data = (await response.json()) as InfoFinancialResponse;
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
