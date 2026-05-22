import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { akshare } from './client.js';
import { formatToolResult } from '../../types.js';

export const HK_STOCK_COMPANY_DESCRIPTION = `
Fetches Hong Kong stock company profile from AKShare, including company name, industry, chairman, establishment date, registered address, employees, and business description.

## When to Use
- Get company background information for Hong Kong listed companies
- Look up industry classification, management, and corporate details
- HK stock tickers: 5-digit codes like 00700 (Tencent), 09988 (Alibaba)

## When NOT to Use
- US stocks (use get_financials instead)
- A-share Chinese stocks (use get_a_stock_company)
`.trim();

const HkStockCompanyInputSchema = z.object({
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
const COMPANY_MAPPING: Record<string, string> = {
  '公司名称': 'company_name',
  '公司简称': 'short_name',
  '英文名称': 'english_name',
  '注册地': 'registered_location',
  '注册地址': 'registered_address',
  '公司成立日期': 'established_date',
  '所属行业': 'industry',
  '董事长': 'chairman',
  '员工总数': 'employees',
  '公司网址': 'website',
  '公司简介': 'business_description',
  '办公地址': 'office_address',
  'E-MAIL': 'email',
  '审计师': 'auditor',
  '法律顾问': 'legal_advisor',
};

export const getHkStockCompany = new DynamicStructuredTool({
  name: 'get_hk_stock_company',
  description: 'Fetches Hong Kong stock company profile (industry, chairman, employees, business description) from AKShare.',
  schema: HkStockCompanyInputSchema,
  func: async (input) => {
    const symbol = normalizeHkCode(input.ticker);

    try {
      const data = await akshare.hkCompany(symbol);

      if (!data) {
        return formatToolResult({ error: `No company data found for HK ticker ${symbol}` }, []);
      }

      const result: Record<string, unknown> = { ticker: symbol };

      for (const [key, value] of Object.entries(data)) {
        const englishKey = COMPANY_MAPPING[key] || key;
        if (value !== null && value !== undefined && value !== '') {
          result[englishKey] = value;
        }
      }

      return formatToolResult(result, []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `AKShare HK company error: ${msg}` }, []);
    }
  },
});
