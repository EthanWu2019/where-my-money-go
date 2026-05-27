#!/bin/bash
set -e
echo "========================================="
echo "📊 海绵酱账户更新 — $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "========================================="

# 1. 生成数据
cd ~/where-my-money-go
python3 generate_data.py

# 2. Git 提交推送
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "✅ 无变化，跳过推送"
else
  git add -A
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
  git commit -m "📊 自动更新记账数据 — $TIMESTAMP"
  echo "🚀 推送至 GitHub Pages..."
  git push origin main
  echo "✅ 推送成功！"
fi

echo ""
echo "✨ 更新完成！"
