#!/usr/bin/env python3
"""从 Notion 拉取记账数据，生成 GitHub Pages 用的 data/all.json"""
import json, os, time, urllib.request

DATA_SOURCE_ID = "76355758-84c1-4145-8326-3b719402907f"
ENV_FILE = os.path.expanduser("~/.hermes/.env")
NOTION_VERSION = "2025-09-03"
OUTPUT_DIR = os.path.expanduser("~/where-my-money-go/data")

CATEGORY_MAP = {
    "工资": "工资 💰", "拨款": "拨款 💸", "零头": "零头 🪙",
    "房租": "房租 🏠", "游戏": "游戏 🎮", "饮食": "饮食 🍜",
    "大件": "大件 🖥️", "AI": "AI 🤖", "电商": "电商 🛒", "其他": "其他 📦",
}

def load_env():
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line.startswith("NOTION_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return None

def notion_request(method, path, data=None):
    api_key = load_env()
    url = f"https://api.notion.com/v1{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f"API Error: {err_body[:200]}")
        return {"results": []}

def get_all_entries():
    all_results = []
    cursor = None
    while True:
        body = {
            "sorts": [{"property": "日期", "direction": "descending"}],
            "page_size": 100
        }
        if cursor:
            body["start_cursor"] = cursor
        result = notion_request("POST", f"/data_sources/{DATA_SOURCE_ID}/query", body)
        items = result.get("results", [])
        all_results.extend(items)
        if result.get("has_more"):
            cursor = result.get("next_cursor")
            time.sleep(0.5)
        else:
            break
    return all_results

def parse_entry(item):
    props = item.get("properties", {})
    name = ""
    name_field = props.get("Name", {}).get("title", [])
    if name_field:
        name = name_field[0].get("text", {}).get("content", "")
    amount = props.get("金额", {}).get("number", 0) or 0
    currency = "RMB"
    curr_field = props.get("币种", {}).get("select", {})
    if curr_field:
        currency = curr_field.get("name", "RMB")
    entry_type = "支出"
    type_field = props.get("类型", {}).get("select", {})
    if type_field:
        entry_type = type_field.get("name", "支出")
    category = "其他"
    cat_field = props.get("分类", {}).get("select", {})
    if cat_field:
        category = cat_field.get("name", "其他")
    date_str = ""
    date_field = props.get("日期", {}).get("date", {})
    if date_field:
        date_str = date_field.get("start", "")
    note = ""
    note_field = props.get("备注", {}).get("rich_text", [])
    if note_field:
        note = note_field[0].get("text", {}).get("content", "")
    return {"name": name, "amount": amount, "currency": currency,
            "type": entry_type, "category": category, "date": date_str, "note": note}

def fetch_exchange_rate():
    try:
        req = urllib.request.Request(
            "https://open.er-api.com/v6/latest/USD",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data["rates"]["CNY"]
    except:
        return 7.25

def main():
    print("📊 生成 Pages 数据...")
    
    # Fetch data
    raw_entries = get_all_entries()
    parsed = [parse_entry(e) for e in raw_entries 
              if e.get("properties", {}).get("Name", {}).get("title", [])
              and parse_entry(e)["name"]]
    
    # Remove empty-name entries
    parsed = [e for e in parsed if e["name"].strip()]
    
    if not parsed:
        print("⚠️ 拉取到 0 条记录，可能是 API 异常，跳过写入以保护现有数据")
        return
    print(f"📋 读取 {len(parsed)} 条记录")
    
    # Get exchange rate
    rate = fetch_exchange_rate()
    print(f"💱 实时汇率: 1 USD = {rate:.4f} CNY")
    
    # Build output
    from datetime import datetime, timezone, timedelta
    cdt = timezone(timedelta(hours=-5))
    now = datetime.now(cdt).strftime("%Y-%m-%dT%H:%M:%S-05:00")
    
    output = {
        "updatedAt": now,
        "rate": rate,
        "entries": [
            {
                "name": e["name"],
                "amount": e["amount"],
                "currency": e["currency"],
                "type": e["type"],
                "category": CATEGORY_MAP.get(e["category"], e["category"]),
                "date": e["date"],
                "note": e["note"]
            }
            for e in parsed
        ]
    }
    
    # Write
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, "all.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 已写入: {out_path}")
    print(f"📦 共 {len(output['entries'])} 条记录")
    
    # Show summary
    incomes = [e for e in output["entries"] if e["type"] == "收入"]
    expenses = [e for e in output["entries"] if e["type"] == "支出"]
    inc_total = sum(e["amount"] for e in incomes if e["currency"] == "USD")
    exp_total = sum(e["amount"] for e in expenses if e["currency"] == "USD")
    print(f"\n📊 数据摘要 (USD):")
    print(f"  收入: ${inc_total:.2f} ({len(incomes)}笔)")
    print(f"  支出: ${exp_total:.2f} ({len(expenses)}笔)")

if __name__ == "__main__":
    main()
