import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_COMPANY_DESCRIPTION = `
Fetches A-share company basic information from Tushare, including exchange, chairman, registered capital, etc.
`.trim();

const AStockCompanyInputSchema = z.object({
  ticker: z.string().describe("A-share stock ticker code, e.g., '600000'."),
});

interface CompanyData {
  ts_code: string;
  exchange: string;
  chairman: string;
  manager: string;
  secretar: string;
  reg_capital: number;
  setup_date: string;
  province: string;
  city: string;
  introduction: string;
  website: string;
  email: string;
  office: string;
  employees: number;
  main_business: string;
  business_scope: string;
}

export const getAStockCompany = new DynamicStructuredTool({
  name: 'get_a_stock_company',
  description: 'Fetches A-share company information (exchange, chairman, registered capital).',
  schema: AStockCompanyInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    try {
      const data = await tushare.call<CompanyData[]>('stock_company', {
        ts_code: tsCode,
      }, {
        fields: 'ts_code,exchange,chairman,manager,secretar,reg_capital,setup_date,province,city,employees,main_business',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No company data found' }, []);
      }

      const item = data[0];
      const result = {
        ticker: item.ts_code,
        exchange: item.exchange === 'SSE' ? '上海证券交易所' : item.exchange === 'SZSE' ? '深圳证券交易所' : item.exchange,
        chairman: item.chairman,
        manager: item.manager,
        secretary: item.secretar,
        registered_capital: item.reg_capital,
        established_date: item.setup_date,
        province: item.province,
        city: item.city,
        employees: item.employees,
        main_business: item.main_business,
      };

      return formatToolResult(result, []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`[Tushare] get_a_stock_company failed for ${tsCode}: ${msg}`);
      return formatToolResult({ error: `Company data unavailable: ${msg}` }, []);
    }
  },
});
