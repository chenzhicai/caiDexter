import { DynamicStructuredTool } from '@langchain/core/tools'; import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { akshare } from '../akshare/client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_METRICS_DESCRIPTION = `
Fetches A-share stock daily metrics from Tushare, including P/E ratio, P/B ratio, market cap, and turnover rate.
`.trim();

const AStockMetricsInputSchema = z.object({
  ticker: z.string().describe("A-share stock ticker code, e.g., '600000'."),
  start_date: z.string().optional().describe('Start date in YYYY-MM-DD format. Defaults to today.'),
});

interface DailyBasicData {
  ts_code: string;
  trade_date: string;
  close: number;
  turnover_rate: number;
  turnover_rate_f: number;
  volume_ratio: number;
  pe: number;
  pe_ttm: number;
  pb: number;
  ps: number;
  ps_ttm: number;
  dv_ratio: number;
  dv_ttm: number;
  total_share: number;
  float_share: number;
  free_share: number;
  total_mv: number;
  circ_mv: number;
}

export const getAStockMetrics = new DynamicStructuredTool({
  name: 'get_a_stock_metrics',
  description: 'Fetches A-share stock daily metrics (P/E, P/B, market cap, turnover rate).',
  schema: AStockMetricsInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);
    const today = new Date();
    const endDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString().split('T')[0].replace(/-/g, '');

    // Try Tushare first
    try {
      const data = await tushare.call<DailyBasicData[]>('daily_basic', {
        ts_code: tsCode,
        start_date: input.start_date?.replace(/-/g, '') || startDate,
        end_date: input.start_date?.replace(/-/g, '') || endDate,
      }, {
        fields: 'ts_code,trade_date,close,turnover_rate,pe,pb,ps,dv_ratio,total_share,float_share,total_mv,circ_mv',
      });

      if (data && data.length > 0) {
        const item = data[0];
        const result = {
          ticker: item.ts_code,
          date: item.trade_date,
          close: item.close,
          pe: item.pe,
          pb: item.pb,
          ps: item.ps,
          dividend_yield: item.dv_ratio,
          total_shares: item.total_share,
          float_shares: item.float_share,
          market_cap: item.total_mv,
          circ_market_cap: item.circ_mv,
          turnover_rate: item.turnover_rate,
        };
        return formatToolResult(result, []);
      }
    } catch (error) {
      logger.warn(`[Tushare] get_a_stock_metrics failed for ${tsCode}, trying AKShare: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fallback to AKShare
    try {
      const data = await akshare.aIndicators(tsCode);
      if (!data) {
        return formatToolResult({ error: 'No metrics data found' }, []);
      }
      return formatToolResult(data, []);
    } catch (akError) {
      const msg = akError instanceof Error ? akError.message : String(akError);
      return formatToolResult({ error: `Metrics data unavailable: ${msg}` }, []);
    }
  },
});