# API Gateway BFF — GraphQL Aggregate Resolver Engine

**Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026**

---

## 1. Objetivo do Programa

Este projeto implementa uma **API Gateway** que atua como **Backend-For-Frontend (BFF)** utilizando **GraphQL** e **Apollo Server 4** em Node.js com TypeScript. O sistema unifica o consumo de duas APIs REST corporativas independentes sob um único endpoint de consulta, eliminando os problemas de **overfetching** (excesso de dados trafegados) e **underfetching** (múltiplas requisições para obter dados relacionados).

A aplicação demonstra a eficiência do paradigma GraphQL como agregador e otimizador de redes em arquiteturas distribuídas ou microsserviços. O cliente frontend (web, mobile ou B2B) faz uma única requisição declarativa contendo os campos exatos de que necessita. Em background, o Apollo Server aciona seus resolvers de forma assíncrona e paralela, consulta as duas APIs REST simuladas, unifica as respostas na estrutura correta do grafo e retorna um payload enxuto contendo estritamente os campos solicitados.

---

## 2. Requisitos

### Funcionais

- **RF01** — O sistema deve expor um endpoint GraphQL único para consulta de dados consolidados.
- **RF02** — O sistema deve consultar duas APIs REST independentes em paralelo para compor o resultado.
- **RF03** — O sistema deve suportar seleção parcial de campos pelo cliente (apenas os campos solicitados devem ser retornados).
- **RF04** — Em caso de falha de uma API não essencial (dados financeiros), o sistema deve retornar os dados disponíveis com os campos faltantes como `null` (degradação graciosa).
- **RF05** — Em caso de falha de uma API essencial (dados organizacionais), o sistema deve propagar o erro ao cliente.
- **RF06** — O sistema deve mascarar mensagens de erro internas (stack traces, caminhos de arquivos) antes de enviá-las ao cliente.
- **RF07** — As chaves de API devem trafegar apenas pelo contexto interno do servidor, nunca expostas no esquema GraphQL.

### Não Funcionais

- **RNF01** — Tempo máximo de resposta por chamada HTTP externa: 4 segundos (com AbortController).
- **RNF02** — Cache em memória de curta duração (5 segundos) para evitar chamadas duplicadas.
- **RNF03** — As duas APIs REST devem ser consultadas em paralelo via `Promise.allSettled`.
- **RNF04** — Tipagem estrita em toda a camada de domínio (TypeScript).
- **RNF05** — Testes automatizados com Vitest rodando offline (sem dependência de rede externa).

---

## 3. Especificações Técnicas

### Stack e Tecnologias

| Camada          | Tecnologia                               |
|-----------------|------------------------------------------|
| Linguagem       | Node.js 20+ / TypeScript 5.6+            |
| Motor GraphQL   | Apollo Server 4.13 + graphql 16.9        |
| Cliente HTTP    | Fetch nativo (Node.js 20+)               |
| Runtime Dev     | tsx 4.19 (TypeScript Execute)            |
| Testes          | Vitest 2.1                               |
| Variáveis de Ambiente | dotenv 16.4                         |

### Estrutura do Projeto

```
/
├── src/
│   ├── schema/
│   │   └── typeDefs.ts          # Definição do esquema GraphQL (SDL)
│   ├── resolvers/
│   │   └── index.ts             # Resolvedores e orquestração de dados
│   ├── datasources/
│   │   ├── erpRestApi.ts        # Adaptador para API REST corporativa (ERP)
│   │   └── infoRestApi.ts       # Adaptador para API REST de informações financeiras
│   ├── formatError.ts           # Middleware global de sanitização de erros
│   ├── config.ts                # Configurações centralizadas via variáveis de ambiente
│   └── server.ts                # Inicialização do Apollo Server
├── tests/
│   └── gateway.test.ts          # Testes de integração (Vitest)
├── .env.example                 # Template de variáveis de ambiente
├── vitest.config.ts             # Configuração do Vitest
├── tsconfig.json                # Configuração do TypeScript
├── package.json                 # Dependências e scripts
└── README.md                    # Documentação
```

---

## 4. Fluxograma da Arquitetura

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Web / Mobile / B2B)                     │
│                    Query GraphQL com campos declarativos                  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ POST /graphql
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        APOLLO SERVER (BFF GATEWAY)                        │
│                                                                           │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────────┐  │
│  │   typeDefs    │    │    Resolvers      │    │      DataSources       │  │
│  │  (Schema SDL) │───▶│  (Orquestrador)   │───▶│   (Adaptadores HTTP)   │  │
│  │               │    │                   │    │                        │  │
│  │ Corporate     │    │ Promise.allSettled│    │ ErpRestApi             │  │
│  │ AuditReport   │    │  [                │    │   .getOrganization()   │  │
│  │ FiscalMetrics │    │    erpApi.getOrg(),│    │                        │  │
│  │               │    │    infoApi.getFin()│    │ InfoRestApi            │  │
│  └──────────────┘    │  ]                 │    │   .getFinancialByCnpj()│  │
│                       └────────┬─────────┘    └──────────┬─────────────┘  │
│                                │                         │                │
│                         formatError                      │                │
│                       (mascara erros)                 fetch() fetch()     │
└────────────────────────────────┼─────────────────────────┼───────────────┘
                                 │                         │
                    ┌────────────┴─────────────┐  ┌────────┴────────────┐
                    │   ERP REST API (3001)     │  │  Info REST API (3002)│
                    │   GET /api/organization   │  │  GET /api/financial  │
                    │   /:organizationId        │  │  /:cnpj              │
                    │                           │  │                     │
                    │   Resposta:               │  │  Resposta:          │
                    │   { id, legalName,        │  │  { currency,         │
                    │     cnpj, complianceActive}│  │    balance,          │
                    └───────────────────────────┘  │    updatedAt,        │
                                                   │    brlRate }         │
                                                   └─────────────────────┘
```

### Fluxo de Execução

1. O cliente envia uma **query GraphQL** para o endpoint `/graphql` com os campos desejados.
2. O Apollo Server recebe a requisição e executa o resolver `getUnifiedAuditReport`.
3. O resolver dispara **duas chamadas HTTP em paralelo** via `Promise.allSettled`:
   - **ERP API**: busca dados cadastrais da organização (nome, CNPJ, status de compliance).
   - **Info API**: busca dados financeiros (moeda, saldo atual, data da última atualização, taxa de câmbio).
4. Cada DataSource aplica:
   - **Cache** em memória (TTL de 5 segundos) para evitar chamadas repetidas.
   - **Timeout** de 4 segundos via `AbortController`.
   - Tratamento de erros HTTP (status codes 4xx/5xx).
5. O resolver combina os resultados:
   - Se **ERP falhar**: erro é propagado ao cliente (dado essencial) — mas com mensagem sanitizada pelo `formatError`.
   - Se **Info falhar**: `financialMetrics` é retornado como `null` (degradação graciosa), e os dados organizacionais são preservados.
6. O middleware `formatError` sanitiza qualquer erro antes de chegar ao cliente, removendo stack traces e informações de infraestrutura.
7. O cliente recebe apenas os campos que solicitou, com tamanho de payload otimizado.

---

## 5. Dependências

### Produção

| Pacote          | Versão  | Finalidade                              |
|-----------------|---------|-----------------------------------------|
| @apollo/server  | ^4.11.0 | Motor GraphQL com Apollo Server 4       |
| graphql         | ^16.9.0 | Biblioteca core do GraphQL              |
| graphql-tag     | ^2.12.6 | Template literals para SDL (`gql`)      |
| dotenv          | ^16.4.0 | Gerenciamento de variáveis de ambiente  |

### Desenvolvimento

| Pacote       | Versão  | Finalidade                              |
|--------------|---------|-----------------------------------------|
| typescript   | ^5.6.0  | Compilador TypeScript                   |
| tsx          | ^4.19.0 | Execução TypeScript em tempo real (dev) |
| vitest       | ^2.1.0  | Framework de testes                     |
| @types/node  | ^22.0.0 | Tipagens do Node.js                     |

---

## 6. Instalação e Configuração

### Pré-requisitos

- Node.js 20 ou superior
- npm 9+ ou yarn

### Passo a Passo

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/api-gateway-bff-graphql.git
cd api-gateway-bff-graphql

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente (opcional — valores padrão já funcionam)
cp .env.example .env

# 4. Inicie o servidor em modo desenvolvimento
npm run dev

# 5. Acesse o Apollo Sandbox em:
#    http://localhost:4000/graphql
```

### Variáveis de Ambiente

| Variável         | Valor Padrão               | Descrição                              |
|------------------|----------------------------|----------------------------------------|
| PORT             | 4000                       | Porta do servidor GraphQL              |
| ERP_API_URL      | http://localhost:3001       | URL base da API ERP                    |
| INFO_API_URL     | http://localhost:3002       | URL base da API de informações         |
| API_GATEWAY_KEY  | fake-api-key-dev            | Chave de autenticação para APIs REST   |

---

## 7. Execução

### Modo Desenvolvimento

```bash
npm run dev
```

Inicia o servidor com hot-reload via `tsx watch`.

### Modo Produção

```bash
npm run build    # Compila TypeScript para JavaScript em ./dist
npm start        # Executa o servidor compilado
```

### Testes

```bash
npm test         # Executa a suíte de testes uma vez
npm run test:watch  # Executa testes em modo watch
```

---

## 8. Manual do Usuário Técnico

### Consulta Completa (Todos os Campos)

```graphql
query {
  getUnifiedAuditReport(organizationId: "ORG-001", cnpj: "11222333000181") {
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
```

**Resposta esperada:**

```json
{
  "data": {
    "getUnifiedAuditReport": {
      "organizationId": "ORG-001",
      "companyName": "Tech Solutions Ltda",
      "cnpj": "11222333000181",
      "isComplianceActive": true,
      "financialMetrics": {
        "currency": "USD",
        "currentBalance": 1500000.5,
        "lastUpdateTimestamp": "2026-05-25T10:00:00Z",
        "conversionRateBrl": 5.25
      }
    }
  }
}
```

### Consulta Parcial (Apenas Campos da Organização)

```graphql
query {
  getUnifiedAuditReport(organizationId: "ORG-001", cnpj: "11222333000181") {
    companyName
    cnpj
    isComplianceActive
  }
}
```

**Resposta esperada:**

```json
{
  "data": {
    "getUnifiedAuditReport": {
      "companyName": "Tech Solutions Ltda",
      "cnpj": "11222333000181",
      "isComplianceActive": true
    }
  }
}
```

**Benefício:** como o cliente não solicitou `financialMetrics`, a chamada à API Financeira nem precisa ser feita em cenários mais avançados com GraphQL Resolvers por campo. No modelo atual (resolver único no nível da query), ambas as APIs são chamadas, mas apenas os campos solicitados são retornados no payload final, economizando banda de rede.

### Consulta com Degradação Graciosa (API Financeira Indisponível)

Se a API de dados financeiros estiver fora do ar ou retornar erro:

```json
{
  "data": {
    "getUnifiedAuditReport": {
      "organizationId": "ORG-001",
      "companyName": "Tech Solutions Ltda",
      "cnpj": "11222333000181",
      "isComplianceActive": true,
      "financialMetrics": null
    }
  }
}
```

O servidor não quebra com erro 500. Os dados organizacionais são preservados e `financialMetrics` é retornado como `null`.

### Erro na API Essencial (ERP Indisponível)

Se a API de dados organizacionais falhar, o sistema retorna uma mensagem sanitizada:

```json
{
  "errors": [
    {
      "message": "Ocorreu um erro interno ao processar sua solicitação.",
      "extensions": {
        "code": "INTERNAL_ERROR"
      }
    }
  ],
  "data": null
}
```

Stack traces e detalhes da infraestrutura interna nunca são expostos ao cliente.

---

## 9. Testes

### Cenários Cobertos

A suíte de testes (`tests/gateway.test.ts`) cobre 6 cenários:

| #  | Cenário                                         | Tipo           | Descrição                                                                 |
|----|-------------------------------------------------|----------------|---------------------------------------------------------------------------|
| 1  | Sucesso total                                   | Integração     | Ambas as APIs respondem corretamente; todos os campos são retornados      |
| 2  | Chamadas paralelas                              | Integração     | Verifica que as duas APIs são chamadas exatamente uma vez cada            |
| 3  | Degradação graciosa (Info falha)                | Integração     | API financeira falha; `financialMetrics` retorna `null`                   |
| 4  | Erro na API ERP                                 | Integração     | API organizacional falha; erro propagado com mensagem sanitizada          |
| 5  | Seleção parcial de campos                       | Integração     | Campos não solicitados não aparecem no payload de resposta                |
| 6  | Cache interno                                   | Integração     | Duas chamadas com mesmos parâmetros; fetch é chamado apenas na primeira   |

### Execução

```bash
# Executar todos os testes
npm test

# Executar em modo watch (desenvolvimento)
npm run test:watch

# Cobertura (opcional — requer @vitest/coverage-v8)
npx vitest --coverage
```

### Arquitetura dos Testes

- Utilizam `vi.stubGlobal("fetch", mockFetch)` para simular requisições HTTP.
- Cada teste limpa o cache interno dos DataSources (`ErpRestApi.clearCache()`, `InfoRestApi.clearCache()`) para garantir isolamento.
- Rodam **offline** — nenhuma dependência de rede externa.

---

## 10. Casos de Uso Corporativos

- **Consolidação de Dashboards Gerenciais** — painéis que necessitam de dados de múltiplos sistemas ERP/CRM legados em uma única chamada de API, reduzindo latência e complexidade no frontend.
- **Otimização de banda para aplicações Mobile** — redução drástica de payload em conexões instáveis ou limitadas (3G/4G em campo).
- **Unificação de Ecossistemas Legados** — durante fusões e aquisições, unifica infraestruturas de TI de diferentes companhias sob um ponto único de consulta GraphQL, abstraindo a complexidade dos sistemas legados.
- **Migração progressiva** — permite que sistemas antigos convivam com novos enquanto o frontend consome um único endpoint BFF, facilitando a substituição gradual dos backends.

---

## 11. Licença

MIT
