import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BRIDGE_PATH = resolve(__dirname, 'bridge.py');

/**
 * Synchronous check: is the bridge script present and is Python available?
 * Used during tool registration. The async isAkshareAvailable() also pings the bridge.
 */
export function isAkshareBridgeInstalled(): boolean {
  return existsSync(BRIDGE_PATH);
}

// Cache whether the bridge is available
let _bridgeAvailable: boolean | null = null;
let _bridgeChecked = false;

/**
 * Check if the AKShare bridge (Python + akshare) is available.
 * Caches the result after the first check.
 */
export async function isAkshareAvailable(): Promise<boolean> {
  if (_bridgeChecked) return _bridgeAvailable === true;
  _bridgeChecked = true;

  if (!existsSync(BRIDGE_PATH)) {
    logger.debug('[AKShare] Bridge script not found');
    _bridgeAvailable = false;
    return false;
  }

  try {
    const result = await callBridge('ping', {});
    if (result && (result as Record<string, unknown>).status === 'ok') {
      logger.debug('[AKShare] Bridge available');
      _bridgeAvailable = true;
      return true;
    }
  } catch {
    // Bridge unavailable
  }

  logger.debug('[AKShare] Bridge unavailable');
  _bridgeAvailable = false;
  return false;
}

interface BridgeResult {
  data?: unknown;
  error?: string;
  count?: number;
  status?: string;
  akshare_version?: string;
}

/**
 * Call the AKShare Python bridge with the given action and params.
 */
async function callBridge(action: string, params: Record<string, unknown>): Promise<BridgeResult> {
  return new Promise((resolve, reject) => {
    const args = [BRIDGE_PATH, action, JSON.stringify(params)];
    const python = process.platform === 'win32' ? 'python' : 'python3';

    const proc = spawn(python, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`[AKShare] Failed to start bridge: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Try to parse error from stdout first
        try {
          const parsed = JSON.parse(stdout.trim() || '{}');
          if (parsed.error) {
            reject(new Error(`[AKShare] ${parsed.error}`));
            return;
          }
        } catch {
          // Fall through to generic error
        }
        reject(
          new Error(
            `[AKShare] Bridge exited with code ${code}: ${stderr || stdout || 'unknown error'}`
          )
        );
        return;
      }

      try {
        const result = JSON.parse(stdout.trim() || '{}');
        if (result.error) {
          reject(new Error(`[AKShare] ${result.error}`));
          return;
        }
        resolve(result);
      } catch {
        reject(new Error(`[AKShare] Invalid JSON from bridge: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

export interface HkDailyParams {
  symbol: string;
  start_date?: string;
  end_date?: string;
  adjust?: string;
}

export const akshare = {
  /** Ping the bridge to check availability. */
  async ping(): Promise<boolean> {
    try {
      const result = await callBridge('ping', {});
      return (result as Record<string, unknown>)?.status === 'ok';
    } catch {
      return false;
    }
  },

  /** Get HK stock daily OHLCV data. */
  async hkDaily(params: HkDailyParams): Promise<Record<string, unknown>[]> {
    const result = await callBridge('hk_daily', {
      symbol: params.symbol,
      ...(params.start_date && { start_date: params.start_date }),
      ...(params.end_date && { end_date: params.end_date }),
      ...(params.adjust && { adjust: params.adjust }),
    });
    return (result.data as Record<string, unknown>[]) || [];
  },

  /** Get HK stock spot quote. */
  async hkSpot(symbol: string): Promise<Record<string, unknown> | null> {
    const result = await callBridge('hk_spot', { symbol });
    return (result.data as Record<string, unknown>) || null;
  },

  /** Get HK stock company profile. */
  async hkCompany(symbol: string): Promise<Record<string, unknown> | null> {
    const result = await callBridge('hk_company', { symbol });
    return (result.data as Record<string, unknown>) || null;
  },

  /** Get HK stock financial indicators snapshot. */
  async hkFinancialIndicator(symbol: string): Promise<Record<string, unknown> | null> {
    const result = await callBridge('hk_financial_indicator', { symbol });
    return (result.data as Record<string, unknown>) || null;
  },

  /** Get HK stock multi-period financial analysis indicators. */
  async hkFinancialAnalysis(symbol: string): Promise<Record<string, unknown>[]> {
    const result = await callBridge('hk_financial_analysis', { symbol });
    return (result.data as Record<string, unknown>[]) || [];
  },

  /** Get A-share daily OHLCV data (Tushare fallback). */
  async aDaily(params: HkDailyParams): Promise<Record<string, unknown>[]> {
    const result = await callBridge('a_daily', {
      symbol: params.symbol,
      ...(params.start_date && { start_date: params.start_date }),
      ...(params.end_date && { end_date: params.end_date }),
      ...(params.adjust && { adjust: params.adjust }),
    });
    return (result.data as Record<string, unknown>[]) || [];
  },

  /** Get A-share financial indicators (Tushare fallback). */
  async aIndicators(symbol: string): Promise<Record<string, unknown> | null> {
    const result = await callBridge('a_indicators', { symbol });
    return (result.data as Record<string, unknown>) || null;
  },
};
