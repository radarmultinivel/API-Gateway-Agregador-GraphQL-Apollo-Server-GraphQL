/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../src/schema/typeDefs.js";
import { resolvers, ResolverContext } from "../src/resolvers/index.js";
import { ErpRestApi } from "../src/datasources/erpRestApi.js";
import { InfoRestApi } from "../src/datasources/infoRestApi.js";
import { maskError } from "../src/formatError.js";

const QUERY = `
  query GetReport($orgId: ID!, $cnpj: String!) {
    getUnifiedAuditReport(organizationId: $orgId, cnpj: $cnpj) {
      organizationId
      companyName
      cnpj
      isComplianceActive
      financialMetrics {
        currency
        currentBalance
        lastUpdateTimestamp
        conversionRateBrl
      }
    }
  }
`;

const ERP_RESPONSE = {
  id: "ORG-001",
  legalName: "Tech Solutions Ltda",
  cnpj: "11222333000181",
  complianceActive: true,
};

const INFO_RESPONSE = {
  currency: "USD",
  balance: 1500000.50,
  updatedAt: "2026-05-25T10:00:00Z",
  brlRate: 5.25,
};

function buildServer(context: ResolverContext) {
  return new ApolloServer<ResolverContext>({
    typeDefs,
    resolvers,
    formatError: maskError,
  });
}

function createMockFetch() {
  return vi.fn();
}

describe("GraphQL API Gateway BFF", () => {
  let server: ApolloServer<ResolverContext>;
  let mockFetch: ReturnType<typeof vi.fn>;
  let context: ResolverContext;

  beforeEach(() => {
    ErpRestApi.clearCache();
    InfoRestApi.clearCache();
    mockFetch = createMockFetch();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe("getUnifiedAuditReport - sucesso total", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(ERP_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(INFO_RESPONSE),
        });

      context = {
        dataSources: {
          erpApi: new ErpRestApi("http://fake.erp", "test-key"),
          infoApi: new InfoRestApi("http://fake.info", "test-key"),
        },
      };

      server = buildServer(context);
    });

    it("deve retornar dados completos quando ambas as APIs respondem com sucesso", async () => {
      const response = await server.executeOperation(
        {
          query: QUERY,
          variables: { orgId: "ORG-001", cnpj: "11222333000181" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind !== "single") return;

      expect(response.body.singleResult.errors).toBeUndefined();

      const data = response.body.singleResult.data?.getUnifiedAuditReport as any;
      expect(data.organizationId).toBe("ORG-001");
      expect(data.companyName).toBe("Tech Solutions Ltda");
      expect(data.cnpj).toBe("11222333000181");
      expect(data.isComplianceActive).toBe(true);
      expect(data.financialMetrics.currency).toBe("USD");
      expect(data.financialMetrics.currentBalance).toBe(1500000.50);
      expect(data.financialMetrics.lastUpdateTimestamp).toBe("2026-05-25T10:00:00Z");
      expect(data.financialMetrics.conversionRateBrl).toBe(5.25);
    });

    it("deve disparar as duas requisições HTTP em paralelo", async () => {
      const response = await server.executeOperation(
        {
          query: QUERY,
          variables: { orgId: "ORG-001", cnpj: "11222333000181" },
        },
        { contextValue: context }
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const erpUrl = mockFetch.mock.calls[0][0];
      const infoUrl = mockFetch.mock.calls[1][0];
      expect(erpUrl).toContain("/api/organization/ORG-001");
      expect(infoUrl).toContain("/api/financial/11222333000181");
    });
  });

  describe("getUnifiedAuditReport - degradação graciosa", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(ERP_RESPONSE),
        })
        .mockRejectedValueOnce(new Error("Timeout ou falha na API financeira"));

      context = {
        dataSources: {
          erpApi: new ErpRestApi("http://fake.erp", "test-key"),
          infoApi: new InfoRestApi("http://fake.info", "test-key"),
        },
      };

      server = buildServer(context);
    });

    it("deve retornar financialMetrics como null quando API Info falha", async () => {
      const response = await server.executeOperation(
        {
          query: QUERY,
          variables: { orgId: "ORG-001", cnpj: "11222333000181" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind !== "single") return;

      expect(response.body.singleResult.errors).toBeUndefined();

      const data = response.body.singleResult.data?.getUnifiedAuditReport as any;
      expect(data.organizationId).toBe("ORG-001");
      expect(data.companyName).toBe("Tech Solutions Ltda");
      expect(data.isComplianceActive).toBe(true);
      expect(data.financialMetrics).toBeNull();
    });
  });

  describe("getUnifiedAuditReport - falha na API ERP", () => {
    beforeEach(() => {
      mockFetch
        .mockRejectedValueOnce(new Error("ERP API fora do ar"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(INFO_RESPONSE),
        });

      context = {
        dataSources: {
          erpApi: new ErpRestApi("http://fake.erp", "test-key"),
          infoApi: new InfoRestApi("http://fake.info", "test-key"),
        },
      };

      server = buildServer(context);
    });

    it("deve propagar erro quando a API ERP falha (dado essencial)", async () => {
      const response = await server.executeOperation(
        {
          query: QUERY,
          variables: { orgId: "ORG-001", cnpj: "11222333000181" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind !== "single") return;

      expect(response.body.singleResult.errors).toBeDefined();
      expect(response.body.singleResult.errors!.length).toBeGreaterThan(0);
      expect(response.body.singleResult.errors![0].message).toBe(
        "Ocorreu um erro interno ao processar sua solicitação."
      );
    });
  });

  describe("consulta com seleção parcial de campos", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(ERP_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(INFO_RESPONSE),
        });

      context = {
        dataSources: {
          erpApi: new ErpRestApi("http://fake.erp", "test-key"),
          infoApi: new InfoRestApi("http://fake.info", "test-key"),
        },
      };

      server = buildServer(context);
    });

    it("deve retornar apenas os campos solicitados (underfetching prevention)", async () => {
      const partialQuery = `
        query GetPartial($orgId: ID!, $cnpj: String!) {
          getUnifiedAuditReport(organizationId: $orgId, cnpj: $cnpj) {
            companyName
            cnpj
            isComplianceActive
          }
        }
      `;

      const response = await server.executeOperation(
        {
          query: partialQuery,
          variables: { orgId: "ORG-001", cnpj: "11222333000181" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind !== "single") return;

      const data = response.body.singleResult.data?.getUnifiedAuditReport as any;
      expect(data.companyName).toBe("Tech Solutions Ltda");
      expect(data.cnpj).toBe("11222333000181");
      expect(data.isComplianceActive).toBe(true);
      expect(data.organizationId).toBeUndefined();
      expect(data.financialMetrics).toBeUndefined();
    });
  });

  describe("cache interno das datasources", () => {
    it("deve usar cache e não chamar fetch novamente para o mesmo ID", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(ERP_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(INFO_RESPONSE),
        });

      context = {
        dataSources: {
          erpApi: new ErpRestApi("http://fake.erp", "test-key"),
          infoApi: new InfoRestApi("http://fake.info", "test-key"),
        },
      };

      server = buildServer(context);

      const sameQuery = `
        query GetReport($orgId: ID!, $cnpj: String!) {
          getUnifiedAuditReport(organizationId: $orgId, cnpj: $cnpj) {
            companyName
          }
        }
      `;

      await server.executeOperation(
        { query: sameQuery, variables: { orgId: "ORG-001", cnpj: "11222333000181" } },
        { contextValue: context }
      );

      await server.executeOperation(
        { query: sameQuery, variables: { orgId: "ORG-001", cnpj: "11222333000181" } },
        { contextValue: context }
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
