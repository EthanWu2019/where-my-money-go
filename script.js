// 全局状态
const state = {
    view: 'all', // 'all', 'weekly', 'monthly'
    currency: 'USD', // 'USD', 'RMB'
    rate: 1,
    data: null, // 当前视图的数据
    allData: null, // 缓存的总数据
    activeCategory: null,
    currentDateStr: '2026-05-16', // 模拟当前日期用于周/月计算，实际可使用 new Date()
};

// 分类排序规则（根据需求文档）
const CATEGORY_ORDER = [
    "工资 💰", "拨款 💸", "零头 🪙", 
    "房租 🏠", "游戏 🎮", "饮食 🍜", "大件 🖥️", "AI 🤖", "电商 🛒", "其他 📦"
];

// DOM 元素
const DOM = {
    tabs: document.querySelectorAll('.tab-btn'),
    btnUSD: document.getElementById('btn-usd'),
    btnRMB: document.getElementById('btn-rmb'),
    rateDisplay: document.getElementById('exchange-rate'),
    updateTime: document.getElementById('update-time'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    netBalance: document.getElementById('net-balance'),
    categoryContainer: document.getElementById('category-container'),
    recordsBody: document.getElementById('records-body'),
    periodNav: document.getElementById('period-nav'),
    periodLabel: document.getElementById('current-period-label'),
    filterTip: document.getElementById('filter-tip'),
    currentFilter: document.getElementById('current-filter'),
    clearFilter: document.getElementById('clear-filter')
};

// 兜底测试数据：以防本地双击 index.html 存在跨域问题导致无数据显示
const MOCK_DATA = {
    updatedAt: "2026-05-16T19:30:00-05:00",
    rate: 7.25,
    entries: [
        { name: "DeepSeek AI Token", amount: 400, currency: "RMB", type: "支出", category: "AI 🤖", date: "2026-05-16", note: "API充值" },
        { name: "WashU 附近房租", amount: 1200, currency: "USD", type: "支出", category: "房租 🏠", date: "2026-05-01", note: "5月房租" },
        { name: "Weee! 亚洲超市", amount: 85.5, currency: "USD", type: "支出", category: "饮食 🍜", date: "2026-05-10", note: "买菜" },
        { name: "兼职工资", amount: 500, currency: "USD", type: "收入", category: "工资 💰", date: "2026-05-15", note: "助教工资" },
        { name: "Steam 游戏", amount: 298, currency: "RMB", type: "支出", category: "游戏 🎮", date: "2026-05-12", note: "打折买的" },
        { name: "爸妈生活费", amount: 20000, currency: "RMB", type: "收入", category: "拨款 💸", date: "2026-05-05", note: "感谢老妈" }
    ]
};

// 初始化
async function init() {
    bindEvents();
    await loadData('all');
}

// 绑定事件
function bindEvents() {
    // 货币切换
    DOM.btnUSD.addEventListener('click', () => setCurrency('USD'));
    DOM.btnRMB.addEventListener('click', () => setCurrency('RMB'));

    // Tab 切换
    DOM.tabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOM.tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            state.view = e.target.dataset.view;
            loadData(state.view);
        });
    });

    // 清除筛选
    DOM.clearFilter.addEventListener('click', () => {
        state.activeCategory = null;
        render();
    });

    // 简单模拟前后翻页行为（前端纯计算演示）
    document.getElementById('prev-period').addEventListener('click', () => alert("此处可根据实际 JSON 文件路径（如 2026-04.json）扩展加载逻辑"));
    document.getElementById('next-period').addEventListener('click', () => alert("此处可根据实际 JSON 文件路径扩展加载逻辑"));
}

// 加载数据
async function loadData(view) {
    try {
        // 在实际部署中，这里应该 fetch(`data/all.json`) 或 fetch(`data/monthly/2026-05.json`)
        // 为了确保拿走代码就能预览效果，优先尝试 fetch，失败则用 MOCK_DATA
        let res = await fetch(`data/all.json`).catch(() => null);
        let rawData;
        
        if (res && res.ok) {
            rawData = await res.json();
        } else {
            console.log("未检测到 data/all.json，使用演示数据。");
            rawData = MOCK_DATA;
        }

        state.allData = rawData;
        state.rate = rawData.rate || 7.25;
        
        DOM.rateDisplay.textContent = `实时汇率: ${state.rate}`;
        DOM.updateTime.textContent = `最后更新: ${new Date(rawData.updatedAt).toLocaleString()}`;
        
        // 模拟本地过滤周报/月报逻辑 (实际情况如果是独立文件，请直接替换 state.data)
        processViewData();

    } catch (error) {
        console.error("加载数据失败", error);
    }
}

// 处理当前视图的数据切片
function processViewData() {
    let entries = [...state.allData.entries];
    
    if (state.view === 'monthly') {
        DOM.periodNav.style.display = 'flex';
        DOM.periodLabel.textContent = "📅 2026年5月";
        entries = entries.filter(e => e.date.startsWith('2026-05'));
    } else if (state.view === 'weekly') {
        DOM.periodNav.style.display = 'flex';
        DOM.periodLabel.textContent = "📅 第W20周 (05-11 ~ 05-17)";
        // 简易过滤演示
        entries = entries.filter(e => e.date >= '2026-05-11' && e.date <= '2026-05-17');
    } else {
        DOM.periodNav.style.display = 'none';
    }

    // 按日期降序
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    state.data = { ...state.allData, entries };
    
    // 视图切换时清除分类筛选
    state.activeCategory = null; 
    render();
}

// 设置货币并重绘
function setCurrency(curr) {
    state.currency = curr;
    if (curr === 'USD') {
        DOM.btnUSD.classList.add('active');
        DOM.btnRMB.classList.remove('active');
    } else {
        DOM.btnRMB.classList.add('active');
        DOM.btnUSD.classList.remove('active');
    }
    render();
}

// 金额转换核心逻辑
function convertAmount(amount, originalCurrency) {
    if (originalCurrency === state.currency) return amount;
    if (state.currency === 'USD' && originalCurrency === 'RMB') return amount / state.rate;
    if (state.currency === 'RMB' && originalCurrency === 'USD') return amount * state.rate;
    return amount;
}

// 格式化货币显示
function formatMoney(amount) {
    const locale = state.currency === 'USD' ? 'en-US' : 'zh-CN';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: state.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// 主渲染函数
function render() {
    if (!state.data) return;

    let entries = state.data.entries;
    
    // 应用分类筛选
    if (state.activeCategory) {
        entries = entries.filter(e => e.category === state.activeCategory);
        DOM.filterTip.style.display = 'inline';
        DOM.currentFilter.textContent = state.activeCategory;
    } else {
        DOM.filterTip.style.display = 'none';
    }

    // 1. 计算汇总
    let income = 0, expense = 0;
    
    // 构建分类统计字典
    let categoryStats = {};
    CATEGORY_ORDER.forEach(c => categoryStats[c] = { amount: 0, count: 0, type: CATEGORY_ORDER.indexOf(c) <= 2 ? '收入' : '支出' });

    state.data.entries.forEach(item => {
        let converted = convertAmount(item.amount, item.currency);
        
        if (item.type === '收入') income += converted;
        if (item.type === '支出') expense += converted;

        // 无论是否筛选，分类卡片的统计数据应基于当前周期内的所有数据
        if (categoryStats[item.category]) {
            categoryStats[item.category].amount += converted;
            categoryStats[item.category].count += 1;
        } else {
            // 处理未在列表中的分类
            categoryStats[item.category] = { amount: converted, count: 1, type: item.type };
        }
    });

    // 渲染汇总卡片
    DOM.totalIncome.textContent = formatMoney(income);
    DOM.totalExpense.textContent = formatMoney(expense);
    let net = income - expense;
    DOM.netBalance.textContent = formatMoney(net);
    DOM.netBalance.parentElement.classList.toggle('negative', net < 0);

    // 2. 渲染分类卡片
    DOM.categoryContainer.innerHTML = '';
    
    // 对存在的分类进行排序渲染
    let existingCategories = Object.keys(categoryStats).filter(k => categoryStats[k].count > 0);
    existingCategories.sort((a, b) => {
        let idxA = CATEGORY_ORDER.indexOf(a);
        let idxB = CATEGORY_ORDER.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
    });

    existingCategories.forEach(cat => {
        let stat = categoryStats[cat];
        let card = document.createElement('div');
        card.className = `category-card ${state.activeCategory === cat ? 'active-filter' : ''}`;
        card.innerHTML = `
            <div class="cat-header">
                <span class="cat-name">${cat}</span>
                <span class="cat-count">${stat.count} 笔</span>
            </div>
            <div class="cat-amount ${stat.type === '收入' ? 'cat-income' : 'cat-expense'}">
                ${formatMoney(stat.amount)}
            </div>
        `;
        card.addEventListener('click', () => {
            state.activeCategory = state.activeCategory === cat ? null : cat;
            render();
        });
        DOM.categoryContainer.appendChild(card);
    });

    // 3. 渲染记录表格
    DOM.recordsBody.innerHTML = '';
    entries.forEach(item => {
        let converted = convertAmount(item.amount, item.currency);
        let tr = document.createElement('tr');
        tr.className = item.type === '收入' ? 'row-income' : 'row-expense';
        
        let colorClass = item.type === '收入' ? 'cat-income' : 'cat-expense';
        let sign = item.type === '收入' ? '+' : '-';

        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${item.name}</td>
            <td>${item.category}</td>
            <td class="td-amount ${colorClass}">${sign}${formatMoney(converted)}</td>
            <td class="td-note">${item.note || '-'}</td>
        `;
        DOM.recordsBody.appendChild(tr);
    });
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);