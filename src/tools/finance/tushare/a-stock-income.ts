import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_INCOME_DESCRIPTION = `
Fetches A-share income statement (利润表) from Tushare, including revenue, net profit, EPS, etc.
`.trim();

const AStockIncomeInputSchema = z.object({
  ticker: z.string().describe("A-share stock ticker code, e.g., '600000'."),
  period: z
    .string()
    .optional()
    .describe('Reporting period in YYYYMMDD format. E.g., 20231231 for annual, 20240630 for Q2.'),
  limit: z.number().optional().default(4).describe('Number of periods to retrieve. Default 4.'),
});

interface IncomeData {
  ts_code: string;
  end_date: string;
  report_type: number;
  comp_type: number;
  total_revenue: number;
  revenue: number;
  intl_income: number;
  n_income: number;
  total_cogs: number;
  cogs: number;
  business_tax: number;
  selling_exp: number;
  mgt_exp: number;
  fin_exp: number;
  assets_impair: number;
  operating_profit: number;
  total_profit: number;
  profit_before_tax: number;
  income_tax: number;
  n_income_attr_p: number;
  minority_income: number;
  basic_eps: number;
  diluted_eps: number;
}

export const getAStockIncome = new DynamicStructuredTool({
  name: 'get_a_stock_income',
  description: 'Fetches A-share income statement (revenue, net profit, EPS).',
  schema: AStockIncomeInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    try {
      const data = await tushare.call<IncomeData[]>('income', {
        ts_code: tsCode,
        ...(input.period && { period: input.period }),
        limit: input.limit || 4,
      }, {
        fields: 'ts_code,end_date,report_type,total_revenue,revenue,n_income,operating_profit,total_profit,profit_before_tax,income_tax,basic_eps',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No income data found' }, []);
      }

      const result = data.map((item) => ({
        period: item.end_date,
        report_type: item.report_type === 1 ? '合并报表' : '单体报表',
        total_revenue: item.total_revenue,
        revenue: item.revenue,
        net_profit: item.n_income,
        operating_profit: item.operating_profit,
        total_profit: item.total_profit,
        profit_before_tax: item.profit_before_tax,
        income_tax: item.income_tax,
        eps: item.basic_eps,
      }));

      return formatToolResult(result.reverse(), []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`[Tushare] get_a_stock_income failed for ${tsCode}: ${msg}`);
      return formatToolResult({ error: `Income data unavailable: ${msg}` }, []);
    }
  },
});