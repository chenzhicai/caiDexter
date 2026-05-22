import { logger } from '../../../utils/logger.js';

const BASE_URL = 'https://api.tushare.pro';

interface TushareData {
  fields?: string[];
  items?: unknown[][];
  has_more?: boolean;
}

interface TushareResponse {
  code: number;
  msg: string;
  data?: TushareData;
  request_id?: string;
}

interface TushareRequest {
  api_name: string;
  token?: string;
  fields?: string;
  params?: Record<string, unknown>;
}

/**
 * Tushare API 客户端
 */
export const tushare = {
  async call<T = unknown>(
    apiName: string,
    params: Record<string, unknown> = {},
    options: { fields?: string; maxRetries?: number } = {}
  ): Promise<T> {
    const token = process.env.TUSHARE_TOKEN;
    if (!token) {
      throw new Error('[Tushare] TUSHARE_TOKEN not found in environment variables');
    }

    const request: TushareRequest = {
      api_name: apiName,
      token,
      params,
      ...(options.fields && { fields: options.fields }),
    };

    let lastError: Error | null = null;
    const maxRetries = options.maxRetries ?? 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = (await response.json()) as TushareResponse;

        if (result.code !== 0) {
          throw new Error(`Tushare API error: ${result.msg} (code: ${result.code})`);
        }

        // Tushare 返回格式: { fields: [...], items: [[...], ...] }
        // 需要将数组的数组 (items) 转换为对象数组，使用 fields 作为键
        if (result.data?.items && result.data?.fields) {
          const { fields, items } = result.data;
          return items.map((row) => {
            const obj: Record<string, unknown> = {};
            fields.forEach((field, i) => {
              obj[field] = row[i];
            });
            return obj;
          }) as T;
        }
        return result.data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`[Tushare] ${apiName} attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`);

        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
    }

    throw new Error(`[Tushare] ${apiName} failed after ${maxRetries} attempts: ${lastError?.message}`);
  },
};

/**
 * 将 A股代码转换为 Tushare 格式
 * 600000 → sh.600000
 * 000001 → sz.000001
 * 300001 → sz.300001
 */
export function normalizeTsCode(ticker: string): string {
  const code = ticker.trim().toUpperCase();

  // 如果已经是 Tushare 格式 (600000.SH 或 300308.SZ)，直接返回
  if (code.endsWith('.SH') || code.endsWith('.SZ')) {
    return code;
  }

  // 如果是旧格式 (sh.600000 或 sz.300308)，转换
  if (code.startsWith('SH.') || code.startsWith('SZ.')) {
    const market = code.startsWith('SH.') ? 'SH' : 'SZ';
    const stockCode = code.split('.')[1];
    return `${stockCode}.${market}`;
  }

  // 6/688 开头 → 上海
  if (code.startsWith('6') || code.startsWith('688')) {
    return `${code}.SH`;
  }

  // 00/30 开头 → 深圳
  if (code.startsWith('00') || code.startsWith('30')) {
    return `${code}.SZ`;
  }

  // 默认当作深圳处理
  return `${code}.SZ`;
}

/**
 * 从 Tushare ts_code 提取纯数字代码
 * sh.600000 → 600000
 */
export function extractTicker(tsCode: string): string {
  const parts = tsCode.split('.');
  return parts.length === 2 ? parts[1] : tsCode;
}

/**
 * 判断是否为 A股 ticker
 */
export function isATicker(ticker: string): boolean {
  const code = ticker.trim();
  // 6位数字、sh./sz. 开头、或 .SH/.SZ 结尾
  return /^\d{6}$/.test(code) || /^sh\.\d{6}$/i.test(code) || /^sz\.\d{6}$/i.test(code) || /^\d{6}\.(SH|SZ)$/i.test(code);
}