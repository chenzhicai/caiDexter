import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_BALANCE_DESCRIPTION = `
Fetches A-share balance sheet (资产负债表) from Tushare, including total assets, liabilities, equity, etc.
`.trim();

const AStockBalanceInputSchema = z.object({
  ticker: z.string().describe("A-share stock ticker code, e. g., '600000'."),
  period: z.string().optional().describe('Reporting period in YYYYMMDD format.'),
  limit: z.number().optional().default(4).describe('Number of periods to retrieve. Default 4.'),
});

interface BalanceSheetData {
  ts_code: string;
  end_date: string;
  report_type: number;
  total_assets: number;
  intl_assets: number;
  total_liab: number;
  intl_liab: number;
  total_hldr_eqy: number;
  hldr_eqy_excl_min_int: number;
  total_owner_eqy: number;
  owner_eqy: number;
  cash_eq: number;
  tradable_fi_assets: number;
  net_assets: number;
}

export const getAStockBalance = new DynamicStructuredTool({
  name: 'get_a_stock_balance',
  description: 'Fetches A-share balance sheet (total assets, liabilities, equity).',
  schema: AStockBalanceInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    try {
      const data = await tushare.call<BalanceSheetData[]>('balancesheet', {
        ts_code: tsCode,
        ...(input.period && { period: input.period }),
        limit: input.limit || 4,
      }, {
        fields: 'ts_code,end_date,report_type,total_assets,intl_assets,total_liab,intl_liab,total_hldr_eqy,hldr_eqy_excl_min_int,total_owner_eqy,owner_eqy,cash_eq',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No balance sheet data found' }, []);
      }

      const result = data.map((item) => ({
        period: item.end_date,
        report_type: item.report_type === 1 ? '合并报表' : '单体报表',
        total_assets: item.total_assets,
        intangible_assets: item.intl_assets,
        total_liabilities: item.total_liab,
        intangible_liabilities: item.intl_liab,
        total_equity: item.total_hldr_eqy,
        equity_excl_minority: item.hldr_eqy_excl_min_int,
        owner_equity: item.total_owner_eqy,
        cash_equivalents: item.cash_eq,
      }));

      return formatToolResult(result.reverse(), []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`[Tushare] get_a_stock_balance failed for ${tsCode}: ${msg}`);
      return formatToolResult({ error: `Balance sheet data unavailable: ${msg}` }, []);
    }
  },
});