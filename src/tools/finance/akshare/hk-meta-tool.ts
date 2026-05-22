import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../../model/llm.js';
import { formatToolResult } from '../../types.js';
import { getCurrentDate } from '../../../agent/prompts.js';
import { withTimeout, SUB_TOOL_TIMEOUT_MS } from '../utils.js';

import { getHkStockPrice, getHkStockPrices } from './hk-stock-price.js';
import { getHkStockMetrics } from './hk-stock-metrics.js';
import { getHkStockCompany } from './hk-stock-company.js';
import { getHkStockFinancials } from './hk-stock-financials.js';

const HK_STOCK_FINANCIALS_DESCRIPTION = `
Intelligent meta-tool for retrieving Hong Kong (HK) stock financial data from AKShare. Takes a natural language query and automatically routes to appropriate HK stock financial data tools.

## When to Use
- Hong Kong stock tickers: 5-digit codes like 00700 (Tencent), 09988 (Alibaba), 00005 (HSBC), 00388 (HKEX)
- Current or historical HK stock prices (OHLCV)
- HK stock financial metrics (PE, PB, ROE, market cap, dividend yield, EPS, revenue)
- HK stock multi-period financial analysis (revenue trend, profit growth, margins, ratios)
- HK stock company profile (industry, chairman, employees, business description)

## When NOT to Use
- US stocks (use get_financials instead)
- A-share Chinese stocks (use get_a_stock_financials instead)
- General web searches or non-financial topics
- Questions that don't require external financial data

## Ticker Format
- 5-digit HK stock codes: 00700 (Tencent), 09988 (Alibaba), 00005 (HSBC)
- May also appear as 700, 9988 (with leading zeros stripped) - tool handles normalization
`.trim();

const HK_STOCK_TOOLS = [
  getHkStockPrice,
  getHkStockPrices,
  getHkStockMetrics,
  getHkStockCompany,
  getHkStockFinancials,
];

const HK_STOCK_TOOL_MAP = new Map<string, DynamicStructuredTool>(
  HK_STOCK_TOOLS.map((t) => [t.name, t])
);

function formatSubToolName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildRouterPrompt(): string {
  return `You are a Hong Kong stock financial data routing assistant. AKShare data expert.
Current date: ${getCurrentDate()}

Given a user's natural language query about Hong Kong stock financial data, call the appropriate HK stock financial tool(s).

## HK Ticker Rules
- HK stocks use 5-digit codes: 00700 (Tencent), 09988 (Alibaba), 00005 (HSBC), 00388 (HKEX), 01299 (AIA), 02318 (Ping An)
- Tickers may be given as "700", "9988" etc. - normalize to 5 digits (00700, 09988)

## Tool Selection Guidelines
1. For current/latest stock price → get_hk_stock_price
2. For historical stock prices over date range → get_hk_stock_prices
3. For PE, PB, market cap, ROE, EPS, dividend yield, revenue snapshot → get_hk_stock_metrics
4. For multi-period financial trends (revenue, profit, margins, ROE/ROA growth) → get_hk_stock_financial_analysis
5. For company profile (industry, chairman, employees) → get_hk_stock_company

## Efficiency
- For current/latest price, call get_hk_stock_price without start_date/end_date
- For a single metrics snapshot vs. trend analysis, choose appropriately
- Call multiple tools if needed (e.g., prices + metrics)

Call the appropriate tool(s) now.`;
}

const GetHkStockFinancialsInputSchema = z.object({
  query: z
    .string()
    .describe('Natural language query about Hong Kong stock financial data'),
});

export function createGetHkStockFinancials(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_hk_stock_financials',
    description: HK_STOCK_FINANCIALS_DESCRIPTION,
    schema: GetHkStockFinancialsInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as
        | ((msg: string) => void)
        | undefined;

      onProgress?.('Routing HK stock query...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: HK_STOCK_TOOLS,
      });
      const aiMessage = response as AIMessage;

      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for HK query' }, []);
      }

      const toolNames = [
        ...new Set(toolCalls.map((tc) => formatSubToolName(tc.name))),
      ];
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);

      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = HK_STOCK_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await withTimeout(
              (tool as DynamicStructuredTool).invoke(tc.args as any),
              SUB_TOOL_TIMEOUT_MS,
              tc.name
            );
            const result =
              typeof rawResult === 'string'
                ? rawResult
                : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed,
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);

      const combinedData: Record<string, unknown> = {};

      for (const result of successfulResults) {
        const ticker = (result.args as Record<string, unknown>).ticker as
          | string
          | undefined;
        const key = ticker ? `${result.tool}_${ticker}` : result.tool;
        combinedData[key] = result.data;
      }

      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, []);
    },
  });
}
