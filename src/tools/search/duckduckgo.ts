import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const DDG_URL = 'https://html.duckduckgo.com/html/';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Parse DuckDuckGo HTML search results page.
 * DDG's HTML endpoint returns a simple, stable structure.
 */
function parseDdgHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Each result block: <div class="result"> ... </div>
  // Link: <a class="result__a" href="...">Title</a>
  // Snippet: <a class="result__snippet">Description...</a>
  // URL display: <a class="result__url">...</a>

  const blockRegex = /<div class="result">([\s\S]*?)<\/div>\s*(?=<div class="result|$)/gi;
  const blocks = html.match(blockRegex) ?? [];

  for (const block of blocks) {
    // Extract title and URL from the link
    const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const rawUrl = linkMatch[1];
    const rawTitle = linkMatch[2].replace(/<[^>]*>/g, '').trim();

    // Skip empty results
    if (!rawTitle || !rawUrl) continue;

    // Extract snippet
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]*>/g, '').trim()
      : '';

    results.push({
      title: rawTitle,
      url: rawUrl,
      snippet,
    });
  }

  return results;
}

/**
 * Execute a DuckDuckGo search via the HTML (non-JS) endpoint.
 * Free, no API key required.
 */
async function runDdgSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const url = `${DDG_URL}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const results = parseDdgHtml(html);

  return results.slice(0, maxResults);
}

export const ddgSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const results = await runDdgSearch(input.query, 5);

      if (results.length === 0) {
        return formatToolResult(
          { message: 'No results found. Try a different query.', results: [] },
          [],
        );
      }

      const urls = results.map((r) => r.url);
      return formatToolResult({ results }, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[DuckDuckGo] error: ${message}`);
      throw new Error(`[DuckDuckGo] ${message}`);
    }
  },
});
