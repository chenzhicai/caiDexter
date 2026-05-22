import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_INDICATOR_DESCRIPTION = `
Fetches A-share financial indicators from Tushare, including ROE, gross margin, net profit margin, etc.
`.trim();

const AStockIndicatorInputSchema = z.object({
  ticker: z.string().describe("A-share stock ticker code, e.g., '600000'."),
  period: z.string().optional().describe('Reporting period in YYYYMMDD format.'),
  limit: z.number().optional().default(4).describe('Number of periods to retrieve. Default 4.'),
});

interface IndicatorData {
  ts_code: string;
  end_date: string;
  roe: number;
  roe_dt: number;
  roe_year: number;
  net_profit_margin: number;
  gross_profit_margin: number;
  cogs_ratio: number;
  expense_ratio: number;
  profit_ratio: number;
  net_profit_ratio: number;
  roa: number;
  roic: number;
  op_income: number;
  total_revenue: number;
  net_profit: number;
  ebit: number;
  ebit_1: number;
}

export const getAStockIndicator = new DynamicStructuredTool({
  name: 'get_a_stock_indicator',
  description: 'Fetches A-share financial indicators (ROE, gross margin, net profit margin, ROA).',
  schema: AStockIndicatorInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    try {
      const data = await tushare.call<IndicatorData[]>('fina_indicator', {
        ts_code: tsCode,
        ...(input.period && { period: input.period }),
        limit: input.limit || 4,
      }, {
        fields: 'ts_code,end_date,roe,net_profit_margin,gross_profit_margin,profit_ratio,roa,roic',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No financial indicator data found' }, []);
      }

      const result = data.map((item) => ({
        period: item.end_date,
        roe: item.roe,
        roe_diluted: item.roe_dt,
        net_profit_margin: item.net_profit_margin,
        gross_profit_margin: item.gross_profit_margin,
        profit_margin: item.profit_ratio,
        roa: item.roa,
        roic: item.roic,
      }));

      return formatToolResult(result.reverse(), []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`[Tushare] get_a_stock_indicator failed for ${tsCode}: ${msg}`);
      return formatToolResult({ error: `Indicator data unavailable: ${msg}` }, []);
    }
  },
});
