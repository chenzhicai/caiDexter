"""
AKShare data bridge for Dexter.
Accepts JSON requests via stdin and outputs JSON responses to stdout.

Usage:
  python bridge.py <action> [json_args]

Actions:
  hk_daily         - HK stock daily OHLCV data
  hk_spot          - HK stock spot quote (single ticker)
  hk_company       - HK stock company profile
  hk_financial_indicator - HK stock financial indicators snapshot
  hk_financial_analysis  - HK stock financial analysis (multi-period)
  a_daily          - A-share daily OHLCV data (fallback)
  a_spot           - A-share spot quote (fallback)
  a_indicators     - A-share financial indicators (fallback)
  ping             - Health check
"""

import sys
import json
import warnings
from datetime import date, datetime, timedelta

warnings.filterwarnings("ignore")


def parse_date(s: str | None):
    """Parse a date string to datetime.date. Supports YYYY-MM-DD and YYYYMMDD."""
    if not s:
        return None
    s = s.strip()
    try:
        if "-" in s and len(s) == 10:
            return datetime.strptime(s, "%Y-%m-%d").date()
        if len(s) == 8 and s.isdigit():
            return datetime.strptime(s, "%Y%m%d").date()
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def safe_date(obj):
    """Convert a value to datetime.date if possible."""
    if isinstance(obj, (datetime, date)):
        return obj if isinstance(obj, date) else obj.date()
    if isinstance(obj, str):
        return parse_date(obj)
    return obj

try:
    import akshare as ak
except ImportError:
    print(json.dumps({"error": "AKShare not installed. Run: pip install akshare"}))
    sys.exit(1)


def json_serializer(obj):
    """Handle non-JSON-serializable types (datetime, date, numpy, etc.)."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "item"):  # numpy scalars
        return obj.item()
    if hasattr(obj, "__float__"):
        return float(obj)
    if hasattr(obj, "__int__"):
        return int(obj)
    return str(obj)


def to_records(df) -> list[dict]:
    """Convert a pandas DataFrame to a list of dict records, handling serialization."""
    # Drop rows where all values are NaN
    df = df.dropna(how="all")
    # Replace NaN/NaT with None for clean JSON
    df = df.where(df.notna(), None)
    records = df.to_dict(orient="records")
    return records


def hk_daily(symbol: str, start_date: str = None, end_date: str = None, adjust: str = "qfq"):
    """Get HK stock daily OHLCV data."""
    df = ak.stock_hk_daily(symbol=symbol, adjust=adjust)
    if df is None or df.empty:
        return {"error": f"No daily data found for HK ticker {symbol}"}

    sd = parse_date(start_date) if start_date else None
    ed = parse_date(end_date) if end_date else None
    if sd:
        df = df[df["date"] >= sd]
    if ed:
        df = df[df["date"] <= ed]

    records = to_records(df)
    return {"data": records, "count": len(records)}


def hk_spot(symbol: str):
    """Get HK stock spot quote for a specific ticker."""
    try:
        df = ak.stock_hk_spot_em()
    except Exception:
        # Fallback: try single ticker approach
        return {"error": f"Could not fetch HK spot data for {symbol}"}

    if df is None or df.empty:
        return {"error": "No HK spot data available"}

    # Find the specific ticker
    code_col = next((c for c in df.columns if "代码" in c or "code" in c.lower()), df.columns[0])
    row = df[df[code_col].astype(str).str.strip() == str(symbol).strip()]
    if row.empty:
        return {"error": f"HK ticker {symbol} not found in spot data"}

    records = to_records(row)
    return {"data": records[0] if records else {}}


def hk_company(symbol: str):
    """Get HK stock company profile."""
    try:
        df = ak.stock_hk_company_profile_em(symbol=symbol)
    except Exception as e:
        return {"error": f"Company profile not available for {symbol}: {str(e)}"}

    if df is None or df.empty:
        return {"error": f"No company profile found for {symbol}"}

    records = to_records(df)
    return {"data": records[0] if records else {}}


def hk_financial_indicator(symbol: str):
    """Get HK stock financial indicators snapshot (PE, PB, ROE, EPS, etc.)."""
    try:
        df = ak.stock_hk_financial_indicator_em(symbol=symbol)
    except Exception as e:
        return {"error": f"Financial indicator not available for {symbol}: {str(e)}"}

    if df is None or df.empty:
        return {"error": f"No financial indicator data for {symbol}"}

    records = to_records(df)
    return {"data": records[0] if records else {}}


def hk_financial_analysis(symbol: str):
    """Get HK stock multi-period financial analysis indicators."""
    try:
        df = ak.stock_financial_hk_analysis_indicator_em(symbol=symbol)
    except Exception as e:
        return {"error": f"Financial analysis not available for {symbol}: {str(e)}"}

    if df is None or df.empty:
        return {"error": f"No financial analysis data for {symbol}"}

    records = to_records(df)
    # Sort by report date descending for consistency
    if records and "REPORT_DATE" in records[0]:
        records.sort(key=lambda r: str(r.get("REPORT_DATE", "")), reverse=True)
    return {"data": records, "count": len(records)}


def a_daily(symbol: str, start_date: str = None, end_date: str = None, adjust: str = "qfq"):
    """Get A-share daily OHLCV data (Tushare fallback)."""
    # Convert ticker to AKShare format: sh.600000 or sz.000001
    code = symbol.strip().upper()
    if code.endswith(".SH"):
        akshare_symbol = f"sh{code.replace('.SH', '')}"
    elif code.endswith(".SZ"):
        akshare_symbol = f"sz{code.replace('.SZ', '')}"
    elif code.startswith("SH.") or code.startswith("SZ."):
        akshare_symbol = code.replace(".", "").lower()
    elif code.startswith("6"):
        akshare_symbol = f"sh{code}"
    else:
        akshare_symbol = f"sz{code}"

    try:
        df = ak.stock_zh_a_daily(symbol=akshare_symbol, adjust=adjust)
    except Exception as e:
        return {"error": f"A-share daily data not available for {symbol}: {str(e)}"}

    if df is None or df.empty:
        return {"error": f"No A-share daily data for {symbol}"}

    sd = parse_date(start_date) if start_date else None
    ed = parse_date(end_date) if end_date else None
    if sd:
        df = df[df["date"] >= sd]
    if ed:
        df = df[df["date"] <= ed]

    records = to_records(df)

    # Map to a format compatible with existing Tushare response
    result = []
    for r in records:
        result.append({
            "date": r.get("date", ""),
            "open": r.get("open"),
            "high": r.get("high"),
            "low": r.get("low"),
            "close": r.get("close"),
            "volume": r.get("volume"),
            "amount": r.get("amount"),
        })
    return {"data": result, "count": len(result)}


def a_indicators(symbol: str):
    """Get A-share financial indicators (Tushare fallback)."""
    # AKShare doesn't have a direct equivalent to Tushare's daily_basic
    # Use stock_zh_a_hist for basic metrics
    code = symbol.strip().upper()
    if code.endswith(".SH"):
        akshare_symbol = f"sh{code.replace('.SH', '')}"
    elif code.endswith(".SZ"):
        akshare_symbol = f"sz{code.replace('.SZ', '')}"
    elif code.startswith("SH.") or code.startswith("SZ."):
        akshare_symbol = code.replace(".", "").lower()
    elif code.startswith("6"):
        akshare_symbol = f"sh{code}"
    else:
        akshare_symbol = f"sz{code}"

    try:
        # Get recent daily data
        df = ak.stock_zh_a_daily(symbol=akshare_symbol, adjust="qfq")
    except Exception as e:
        return {"error": f"A-share indicator data not available for {symbol}: {str(e)}"}

    if df is None or df.empty:
        return {"error": f"No A-share indicator data for {symbol}"}

    # Get the latest row for snapshot metrics
    latest = df.tail(1)
    records = to_records(latest)
    if records:
        r = records[0]
        return {"data": {
            "ticker": symbol,
            "date": r.get("date", ""),
            "close": r.get("close"),
            "volume": r.get("volume"),
            "amount": r.get("amount"),
            "turnover": r.get("turnover"),
            "outstanding_share": r.get("outstanding_share"),
        }}
    return {"error": "No recent data"}


ACTIONS = {
    "hk_daily": hk_daily,
    "hk_spot": hk_spot,
    "hk_company": hk_company,
    "hk_financial_indicator": hk_financial_indicator,
    "hk_financial_analysis": hk_financial_analysis,
    "a_daily": a_daily,
    "a_indicators": a_indicators,
    "ping": lambda: {"status": "ok", "akshare_version": ak.__version__},
}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing action argument"}))
        sys.exit(1)

    action = sys.argv[1]

    if action not in ACTIONS:
        print(json.dumps({"error": f"Unknown action: {action}", "available": list(ACTIONS.keys())}))
        sys.exit(1)

    # Parse params from second argument (JSON string)
    params = {}
    if len(sys.argv) >= 3:
        try:
            params = json.loads(sys.argv[2])
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"Invalid JSON params: {str(e)}"}))
            sys.exit(1)

    try:
        result = ACTIONS[action](**params)
        print(json.dumps(result, default=json_serializer, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": f"{action} failed: {str(e)}"}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
