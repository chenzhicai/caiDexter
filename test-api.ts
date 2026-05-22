import { config } from 'dotenv';
import { tushare, normalizeTsCode } from './src/tools/finance/tushare/client';

config({ quiet: true });

async function main() {
  console.log('=== Test 1: stock_basic (获取股票列表) ===');
  const stocks = await tushare.call<{ ts_code: string; symbol: string; name: string }[]>('stock_basic', { exchange: 'SSE', limit: 3 });
  console.log('SSE stocks:', JSON.stringify(stocks?.slice(0, 2), null, 2));

  const sz = await tushare.call<{ ts_code: string; symbol: string; name: string }[]>('stock_basic', { exchange: 'SZSE', limit: 3 });
  console.log('SZSE stocks:', JSON.stringify(sz?.slice(0, 2), null, 2));

  console.log('\n=== Test 2: 用实际代码查询日线 ===');
  if (stocks && stocks.length > 0 && stocks[0] && typeof stocks[0] === 'object') {
    const code = (stocks[0] as any).ts_code;
    console.log('Testing with:', code);
    const daily = await tushare.call<{ ts_code: string; trade_date: string; close: number }[]>('daily', { ts_code: code, limit: 3 });
    console.log('daily result:', JSON.stringify(daily?.slice(0, 2), null, 2));
  } else {
    console.log('No valid stock data returned.');
  }

  console.log('\n=== Test 3: normalizeTsCode ===');
  console.log('600000 →', normalizeTsCode('600000'));
  console.log('000001 →', normalizeTsCode('000001'));
  console.log('300001 →', normalizeTsCode('300001'));
  console.log('688001 →', normalizeTsCode('688001'));
  console.log('600000.SH →', normalizeTsCode('600000.SH'));
  console.log('sh.600000 →', normalizeTsCode('sh.600000'));
}

main().catch(console.error);
