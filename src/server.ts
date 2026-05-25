/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers, ResolverContext } from "./resolvers/index.js";
import { ErpRestApi } from "./datasources/erpRestApi.js";
import { InfoRestApi } from "./datasources/infoRestApi.js";
import { config } from "./config.js";

import { maskError } from "./formatError.js";

const server = new ApolloServer<ResolverContext>({
  typeDefs,
  resolvers,
  formatError: maskError,
});

async function start() {
  const { port, erpApiUrl, infoApiUrl, apiKey } = config;

  const { url } = await startStandaloneServer(server, {
    context: async (): Promise<ResolverContext> => ({
      dataSources: {
        erpApi: new ErpRestApi(erpApiUrl, apiKey),
        infoApi: new InfoRestApi(infoApiUrl, apiKey),
      },
    }),
    listen: { port },
  });

  console.log(`🚀 Servidor GraphQL rodando em ${url}`);
}

start().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
