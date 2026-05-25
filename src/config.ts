/* Desenvolvido por L. A. Leandro - São José dos Campos - SP - 25/05/2026 */

import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  erpApiUrl: process.env.ERP_API_URL || "http://localhost:3001",
  infoApiUrl: process.env.INFO_API_URL || "http://localhost:3002",
  apiKey: process.env.API_GATEWAY_KEY || "fake-api-key-dev",
};
