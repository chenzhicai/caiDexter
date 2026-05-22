import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { akshare } from './client.js';
import { formatToolResult } from '../../types.js';

export const HK_STOCK_PRICE_DESCRIPTION = `
Fetches Hong Kong stock daily price data from AKShare, including daily OHLC (open, high, low, close) and volume.

## When to Use
- Get current or historical stock prices for Hong Kong stocks
- HK stock tickers: 5-digit codes like 00700 (Tencent), 09988 (Alibaba), 00005 (HSBC)
- Supports date range filtering and price adjustment (qfq/hfq)

## When NOT to Use
- US stocks (use get_stock_price or get_stock_prices instead)
- A-share Chinese stocks (use get_a_stock_price)
- Non-HK stocks
`.trim();

const HkStockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "Hong Kong stock ticker code, e.g., '00700' for Tencent, '09988' for Alibaba, '00005' for HSBC."
    ),
  start_date: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format. Defaults to recent 7 days.'),
  end_date: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format. Defaults to today.'),
});

function normalizeHkCode(ticker: string): string {
  const code = ticker.trim().toUpperCase();
  // Remove .HK suffix if present
  if (code.endsWith('.HK')) {
    return code.replace('.HK', '');
  }
  // Ensure 5-digit format
  if (/^\d{1,4}$/.test(code)) {
    return code.padStart(5, '0');
  }
  return code;
}

export const getHkStockPrice = new DynamicStructuredTool({
  name: 'get_hk_stock_price',
  description: 'Fetches current or historical Hong Kong stock price data (OHLCV) from AKShare.',
  schema: HkStockPriceInputSchema,
  func: async (input) => {
    const symbol = normalizeHkCode(input.ticker);

    const today = new Date();
    const defaultEnd = today.toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultStart = weekAgo.toISOString().split('T')[0];

    try {
      const data = await akshare.hkDaily({
        symbol,
        start_date: input.start_date || defaultStart,
        end_date: input.end_date || defaultEnd,
        adjust: 'qfq',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: `No price data found for HK ticker ${symbol}` }, []);
      }

      const result = data.map((item) => ({
        date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      return formatToolResult(result, []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `AKShare HK price error: ${msg}` }, []);
    }
  },
});

const HkStockPricesInputSchema = z.object({
  ticker: z.string().describe("Hong Kong stock ticker code, e.g., '00700'."),
  start_date: z.string().describe('Start date in YYYY-MM-DD format.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format.'),
});

export const getHkStockPrices = new DynamicStructuredTool({
  name: 'get_hk_stock_prices',
  description: 'Retrieves historical Hong Kong stock price data over a date range from AKShare.',
  schema: HkStockPricesInputSchema,
  func: async (input) => {
    const symbol = normalizeHkCode(input.ticker);

    try {
      const data = await akshare.hkDaily({
        symbol,
        start_date: input.start_date,
        end_date: input.end_date,
        adjust: 'qfq',
      });

      if (!data || data.length === 0) {
        return formatToolResult({ error: `No price data found for HK ticker ${symbol}` }, []);
      }

      const result = data.map((item) => ({
        date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      return formatToolResult(result, []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `AKShare HK price error: ${msg}` }, []);
    }
  },
});
