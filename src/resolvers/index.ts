/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

import { ErpRestApi } from "../datasources/erpRestApi.js";
import { InfoRestApi, InfoFinancialResponse } from "../datasources/infoRestApi.js";

export interface ResolverContext {
  dataSources: {
    erpApi: ErpRestApi;
    infoApi: InfoRestApi;
  };
}

interface CorporateAuditReport {
  organizationId: string;
  companyName: string;
  cnpj: string;
  isComplianceActive: boolean;
  financialMetrics: {
    currency: string;
    currentBalance: number;
    lastUpdateTimestamp: string;
    conversionRateBrl: number;
  } | null;
}

export const resolvers = {
  Query: {
    async getUnifiedAuditReport(
      _parent: unknown,
      args: { organizationId: string; cnpj: string },
      context: ResolverContext
    ): Promise<CorporateAuditReport> {
      const { organizationId, cnpj } = args;
      const { erpApi, infoApi } = context.dataSources;

      const [orgData, finData] = await Promise.allSettled([
        erpApi.getOrganization(organizationId),
        infoApi.getFinancialByCnpj(cnpj),
      ]);

      if (orgData.status === "rejected") {
        throw new Error(
          `Falha ao recuperar dados organizacionais: ${orgData.reason.message}`
        );
      }

      const org = orgData.value;
      const finDataSettled = finData as PromiseSettledResult<InfoFinancialResponse>;

      return {
        organizationId: org.id,
        companyName: org.legalName,
        cnpj: org.cnpj,
        isComplianceActive: org.complianceActive,
        financialMetrics:
          finDataSettled.status === "fulfilled"
            ? {
                currency: finDataSettled.value.currency,
                currentBalance: finDataSettled.value.balance,
                lastUpdateTimestamp: finDataSettled.value.updatedAt,
                conversionRateBrl: finDataSettled.value.brlRate,
              }
            : null,
      };
    },
  },
};
