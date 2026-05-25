/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

const REQUEST_TIMEOUT_MS = 4000;

interface CacheEntry {
  data: ErpOrganizationResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;

export interface ErpOrganizationResponse {
  id: string;
  legalName: string;
  cnpj: string;
  complianceActive: boolean;
}

export class ErpRestApi {
  static clearCache(): void {
    cache.clear();
  }

  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getOrganization(organizationId: string): Promise<ErpOrganizationResponse> {
    const cacheKey = `erp:org:${organizationId}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/api/organization/${organizationId}`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`ERP API responded with status ${response.status}`);
      }

      const data = (await response.json()) as ErpOrganizationResponse;
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
