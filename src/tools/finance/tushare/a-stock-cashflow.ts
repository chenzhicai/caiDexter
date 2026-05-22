import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_CASHFLOW_DESCRIPTION = `
Fetches A-share cash flow statement (现金流量表) from Tushare, including operating, investing, and financing cash flows.
`.trim();

const AStockCashflowInputSchema = z.object({
  ticker: z.string().describe("A-share stock ticker code, e. g., '600000'."),
  period: z.string().optional().describe('Reporting period in YYYYMMDD format.'),
  limit: z.number().optional().default(4).describe('Number of periods to retrieve. Default 4.'),
});

interface CashflowData {
  ts_code: string;
  end_date: string;
  report_type: number;
  net_cashflow_oper: number;
  net_cashflow_oper_act: number;
  cashflow_oper_act: number;
  net_cashflow_inv: number;
  net_cashflow_inv_act: number;
  cashflow_inv_act: number;
  net_cashflow_fin: number;
  net_cashflow_fin_act: number;
  cashflow_fin_act: number;
  net_cashflow: number;
  free_cashflow: number;
}

export const getAStockCashflow = new DynamicStructuredTool({
  name: 'get_a_stock_cashflow',
  description: 'Fetches A-share cash flow statement (operating, investing, financing).',
  schema: AStockCashflowInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    try {
      const data = await tushare.call<CashflowData[]>('cashflow', {
        ts_code: tsCode,
        ...(input.period && { period: input.period }),
        limit: input.limit || 4,
      }, {
        fields: 'ts_code,end_date,report_type,net_cashflow_oper,net_cashflow_oper_act,net_cashflow_inv,net_cashflow_inv_act,net_cashflow_fin,net_cashflow_fin_act,net_cashflow,free_cashflow',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No cash flow data found' }, []);
      }

      const result = data.map((item) => ({
        period: item.end_date,
        report_type: item.report_type === 1 ? '合并报表' : '单体报表',
        operating_cashflow: item.net_cashflow_oper,
        operating_cashflow_actual: item.net_cashflow_oper_act,
        investing_cashflow: item.net_cashflow_inv,
        investing_cashflow_actual: item.net_cashflow_inv_act,
        financing_cashflow: item.net_cashflow_fin,
        financing_cashflow_actual: item.net_cashflow_fin_act,
        net_cashflow: item.net_cashflow,
        free_cashflow: item.free_cashflow,
      }));

      return formatToolResult(result.reverse(), []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`[Tushare] get_a_stock_cashflow failed for ${tsCode}: ${msg}`);
      return formatToolResult({ error: `Cash flow data unavailable: ${msg}` }, []);
    }
  },
});
