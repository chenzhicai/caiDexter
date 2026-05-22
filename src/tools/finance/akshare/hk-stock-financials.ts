import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { akshare } from './client.js';
import { formatToolResult } from '../../types.js';

export const HK_STOCK_FINANCIALS_DESCRIPTION = `
Fetches Hong Kong stock multi-period financial analysis data from AKShare, including revenue, net profit, EPS, ROE, ROA, gross margin, net profit margin, debt ratio, and growth rates over multiple reporting periods.

## When to Use
- Get historical financial trend data for Hong Kong stocks
- Compare financial performance across periods (revenue growth, profit growth)
- Get income statement-like summary and key financial ratios
- HK stock tickers: 5-digit codes like 00700 (Tencent), 09988 (Alibaba)

## When NOT to Use
- Single-period snapshot metrics (use get_hk_stock_metrics instead)
- US stocks (use get_financials instead)
- A-share Chinese stocks (use get_a_stock_financials)
`.trim();

const HkStockFinancialsInputSchema = z.object({
  ticker: z
    .string()
    .describe("Hong Kong stock ticker code, e.g., '00700' for Tencent, '09988' for Alibaba."),
  limit: z
    .number()
    .optional()
    .default(8)
    .describe('Number of reporting periods to retrieve. Default 8.'),
});

function normalizeHkCode(ticker: string): string {
  const code = ticker.trim().toUpperCase();
  if (code.endsWith('.HK')) return code.replace('.HK', '');
  if (/^\d{1,4}$/.test(code)) return code.padStart(5, '0');
  return code;
}

// Map AKShare Chinese columns to English
const ANALYSIS_MAPPING: Record<string, string> = {
  'REPORT_DATE': 'report_date',
  'DATE_TYPE_CODE': 'period_type',
  'BASIC_EPS': 'eps',
  'DILUTED_EPS': 'diluted_eps',
  'BPS': 'book_value_per_share',
  'OPERATE_INCOME': 'revenue',
  'OPERATE_INCOME_YOY': 'revenue_yoy',
  'OPERATE_INCOME_QOQ': 'revenue_qoq',
  'GROSS_PROFIT': 'gross_profit',
  'GROSS_PROFIT_YOY': 'gross_profit_yoy',
  'GROSS_PROFIT_QOQ': 'gross_profit_qoq',
  'GROSS_PROFIT_RATIO': 'gross_margin',
  'HOLDER_PROFIT': 'net_profit',
  'HOLDER_PROFIT_YOY': 'net_profit_yoy',
  'HOLDER_PROFIT_QOQ': 'net_profit_qoq',
  'NET_PROFIT_RATIO': 'net_profit_margin',
  'ROE_AVG': 'roe',
  'ROE_YEARLY': 'roe_yearly',
  'ROA': 'roa',
  'ROIC_YEARLY': 'roic',
  'PER_NETCASH_OPERATE': 'operating_cashflow_per_share',
  'PER_OI': 'operating_income_per_share',
  'OCF_SALES': 'ocf_to_sales',
  'DEBT_ASSET_RATIO': 'debt_to_assets',
  'CURRENT_RATIO': 'current_ratio',
  'TAX_EBT': 'tax_rate',
  'EPS_TTM': 'eps_ttm',
  'FISCAL_YEAR': 'fiscal_year_end',
  'CURRENCY': 'currency',
};

export const getHkStockFinancials = new DynamicStructuredTool({
  name: 'get_hk_stock_financial_analysis',
  description:
    'Fetches Hong Kong stock multi-period financial analysis (revenue, profit, margins, ROE, ROA, growth rates) from AKShare.',
  schema: HkStockFinancialsInputSchema,
  func: async (input) => {
    const symbol = normalizeHkCode(input.ticker);
    const limit = input.limit || 8;

    try {
      let data = await akshare.hkFinancialAnalysis(symbol);

      if (!data || data.length === 0) {
        return formatToolResult(
          { error: `No financial analysis data found for HK ticker ${symbol}` },
          []
        );
      }

      // Limit to requested number of periods (already sorted by date desc in bridge)
      data = data.slice(0, limit);

      // Map to English column names
      const result = data.map((item) => {
        const mapped: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(item)) {
          const englishKey = ANALYSIS_MAPPING[key] || key.toLowerCase();
          if (value !== null && value !== undefined) {
            mapped[englishKey] = value;
          }
        }
        return mapped;
      });

      return formatToolResult(result, []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `AKShare HK financials error: ${msg}` }, []);
    }
  },
});
