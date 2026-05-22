import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { akshare } from './client.js';
import { formatToolResult } from '../../types.js';

export const HK_STOCK_METRICS_DESCRIPTION = `
Fetches Hong Kong stock financial metrics from AKShare, including PE ratio, PB ratio, market cap, ROE, EPS, dividend yield, revenue, net profit, and other key financial indicators.

## When to Use
- Get financial metrics snapshot for Hong Kong stocks
- HK stock tickers: 5-digit codes like 00700 (Tencent), 09988 (Alibaba)
- Check valuation (PE, PB), profitability (ROE, ROA), and growth metrics

## When NOT to Use
- US stocks (use get_financials instead)
- A-share Chinese stocks (use get_a_stock_metrics)
`.trim();

const HkStockMetricsInputSchema = z.object({
  ticker: z
    .string()
    .describe("Hong Kong stock ticker code, e.g., '00700' for Tencent, '09988' for Alibaba."),
});

function normalizeHkCode(ticker: string): string {
  const code = ticker.trim().toUpperCase();
  if (code.endsWith('.HK')) return code.replace('.HK', '');
  if (/^\d{1,4}$/.test(code)) return code.padStart(5, '0');
  return code;
}

// Map Chinese column names from AKShare to English
const METRICS_MAPPING: Record<string, string> = {
  '基本每股收益(元)': 'eps',
  '每股净资产(元)': 'book_value_per_share',
  '每股经营现金流(元)': 'operating_cashflow_per_share',
  '营业总收入': 'revenue',
  '营业总收入同比增长(%)': 'revenue_yoy',
  '净利润': 'net_profit',
  '净利润同比增长(%)': 'net_profit_yoy',
  '销售净利率(%)': 'net_profit_margin',
  '股东权益回报率(%)': 'roe',
  '总资产回报率(%)': 'roa',
  '市盈率': 'pe',
  '市净率': 'pb',
  '股息率(%)': 'dividend_yield',
  '总市值(港元)': 'market_cap_hkd',
  '已发行股本(股)': 'shares_outstanding',
  '最新股本(股)': 'total_shares',
};

export const getHkStockMetrics = new DynamicStructuredTool({
  name: 'get_hk_stock_metrics',
  description: 'Fetches Hong Kong stock financial metrics (PE, PB, ROE, EPS, revenue, net profit) from AKShare.',
  schema: HkStockMetricsInputSchema,
  func: async (input) => {
    const symbol = normalizeHkCode(input.ticker);

    try {
      const data = await akshare.hkFinancialIndicator(symbol);

      if (!data) {
        return formatToolResult({ error: `No metrics data found for HK ticker ${symbol}` }, []);
      }

      // Map Chinese keys to English and filter out null values
      const result: Record<string, unknown> = { ticker: symbol };

      for (const [key, value] of Object.entries(data)) {
        const englishKey = METRICS_MAPPING[key] || key;
        if (value !== null && value !== undefined && value !== '') {
          result[englishKey] = value;
        }
      }

      return formatToolResult(result, []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `AKShare HK metrics error: ${msg}` }, []);
    }
  },
});
