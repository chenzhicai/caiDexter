import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tushare, normalizeTsCode } from './client.js';
import { akshare, isAkshareAvailable } from '../akshare/client.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const A_STOCK_PRICE_DESCRIPTION = `
Fetches A-share stock price data from Tushare, including daily OHLC (open, high, low, close) and volume.

## When to Use
- Get current or historical stock prices for A-shares (Chinese stocks)
- Stock tickers: 600000 (Shanghai), 000001 (Shenzhen), 300001 (ChiNext)

## When NOT to Use
- US stocks (use get_stock_price or get_stock_prices instead)
- Non-Chinese stocks
`.trim();

const AStockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe("A-share stock ticker code, e.g., '600000' for Shanghai, '000001' for Shenzhen."),
  start_date: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format. Defaults to recent trading day.'),
  end_date: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format. Defaults to today.'),
});

interface DailyData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

/**
 * 获取 A股行情数据
 */
async function fetchDaily(params: {
  ts_code: string;
  start_date?: string;
  end_date?: string;
}): Promise<DailyData[]> {
  return tushare.call<DailyData[]>('daily', {
    ts_code: params.ts_code,
    ...(params.start_date && { start_date: params.start_date }),
    ...(params.end_date && { end_date: params.end_date }),
  }, {
    fields: 'ts_code,trade_date,open,high,low,close,vol,amount',
  });
}

export const getAStockPrice = new DynamicStructuredTool({
  name: 'get_a_stock_price',
  description: 'Fetches current or historical A-share stock price data (OHLCV).',
  schema: AStockPriceInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    const today = new Date();
    const endDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString().split('T')[0].replace(/-/g, '');

    const start = input.start_date?.replace(/-/g, '') || startDate;
    const end = input.end_date?.replace(/-/g, '') || endDate;

    // Try Tushare first
    try {
      const data = await fetchDaily({
        ts_code: tsCode,
        start_date: start,
        end_date: end,
      });

      if (data && data.length > 0) {
        const result = data.map((item) => ({
          date: item.trade_date,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.vol,
          amount: item.amount,
        }));
        return formatToolResult(result, []);
      }
    } catch (error) {
      logger.warn(`[Tushare] get_a_stock_price failed for ${tsCode}, trying AKShare fallback: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fallback to AKShare
    try {
      const data = await akshare.aDaily({
        symbol: tsCode,
        start_date: input.start_date || undefined,
        end_date: input.end_date || undefined,
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No data found' }, []);
      }

      return formatToolResult(data, []);
    } catch (akError) {
      const msg = akError instanceof Error ? akError.message : String(akError);
      return formatToolResult({ error: `Price data unavailable: ${msg}` }, []);
    }
  },
});

/**
 * 获取历史 K 线数据
 */
const AStockPricesInputSchema = z.object({
  ticker: z
    .string()
    .describe("A-share stock ticker code, e.g., '600000'."),
  start_date: z.string().describe('Start date in YYYY-MM-DD format.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format.'),
  adjust: z
    .enum(['qfq', 'hfq', ''])
    .optional()
    .describe('Price adjustment: qfq (前复权), hfq (后复权), empty for raw.'),
});

export const getAStockPrices = new DynamicStructuredTool({
  name: 'get_a_stock_prices',
  description: 'Retrieves historical A-share stock price data over a date range.',
  schema: AStockPricesInputSchema,
  func: async (input) => {
    const tsCode = normalizeTsCode(input.ticker);

    const start = input.start_date.replace(/-/g, '');
    const end = input.end_date.replace(/-/g, '');

    // Try Tushare first
    try {
      const data = await fetchDaily({
        ts_code: tsCode,
        start_date: start,
        end_date: end,
      });

      if (data && data.length > 0) {
        const result = data
          .map((item) => ({
            date: item.trade_date,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.vol,
            amount: item.amount,
          }))
          .reverse();
        return formatToolResult(result, []);
      }
    } catch (error) {
      logger.warn(`[Tushare] get_a_stock_prices failed for ${tsCode}, trying AKShare: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fallback to AKShare
    try {
      const data = await akshare.aDaily({
        symbol: tsCode,
        start_date: input.start_date,
        end_date: input.end_date,
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: 'No data found' }, []);
      }

      return formatToolResult(data, []);
    } catch (akError) {
      const msg = akError instanceof Error ? akError.message : String(akError);
      return formatToolResult({ error: `Price data unavailable: ${msg}` }, []);
    }
  },
});