/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

import { GraphQLFormattedError } from "graphql";

export function maskError(formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  const original = error instanceof Error && (error as any).originalError?.extensions;
  return {
    message: "Ocorreu um erro interno ao processar sua solicitação.",
    extensions: {
      code: original?.code || "INTERNAL_ERROR",
    },
  };
}
