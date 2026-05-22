import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const BING_URL = 'https://www.bing.com/search';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Execute a Bing search by scraping the HTML results page.
 * Free, no API key required. Works from China.
 */
async function runBingSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const url = `${BING_URL}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Bing returned HTTP ${response.status}`);
  }

  const html = await response.text();

  // Extract all search result titles + URLs from <h2> blocks
  const titles: { title: string; url: string }[] = [];
  const h2Regex = /<h2[^>]*>.*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>.*?<\/h2>/gi;
  let h2Match;
  while ((h2Match = h2Regex.exec(html)) !== null) {
    const rawUrl = h2Match[1];
    const rawTitle = h2Match[2].replace(/<[^>]*>/g, '').trim();
    if (rawTitle && rawUrl) {
      titles.push({ title: rawTitle, url: rawUrl });
    }
  }

  // Extract all snippets from <p class="b_lineclamp2"> blocks
  const snippets: string[] = [];
  const snippetRegex = /<p class="b_lineclamp2[^"]*">([^<]*)<\/p>/gi;
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    const text = snippetMatch[1]
      .replace(/&ensp;/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#0?183;/g, '·')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (text) {
      snippets.push(text);
    }
  }

  // Zip titles and snippets by position
  const results: SearchResult[] = [];
  const count = Math.min(titles.length, snippets.length, maxResults);
  for (let i = 0; i < count; i++) {
    results.push({
      title: titles[i].title,
      url: titles[i].url,
      snippet: snippets[i],
    });
  }

  return results;
}

export const bingSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const results = await runBingSearch(input.query, 5);

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
      logger.error(`[Bing] error: ${message}`);
      throw new Error(`[Bing] ${message}`);
    }
  },
});
