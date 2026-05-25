/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

import { gql } from "graphql-tag";

export const typeDefs = gql`
  type CorporateAuditReport {
    organizationId: ID!
    companyName: String!
    cnpj: String!
    isComplianceActive: Boolean!
    financialMetrics: FiscalMetrics
  }

  type FiscalMetrics {
    currency: String!
    currentBalance: Float!
    lastUpdateTimestamp: String!
    conversionRateBrl: Float!
  }

  type Query {
    getUnifiedAuditReport(organizationId: ID!, cnpj: String!): CorporateAuditReport!
  }
`;
