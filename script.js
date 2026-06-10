const state = {
    view: 'all',
    currency: 'USD',
    rate: 6.72,
    data: null,
    allData: null,
    activeCategory: null,
    weekOffset: 0,
    monthOffset: 0,
    page: 0,
    pageSize: 10,
};

const CATEGORY_ORDER = [
    "工资 💰", "拨款 💸", "零头 🪙", 
    "房租 🏠", "游戏 🎮", "饮食 🍜", "大件 🖥️", "AI 🤖", "电商 🛒", "其他 📦"
];

let expenseChartInstance = null;

const DOM = {
    tabs: document.querySelectorAll('.tab-btn'),
    tabIndicator: document.querySelector('.tab-indicator'),
    btnUSD: document.getElementById('btn-usd'),
    btnRMB: document.getElementById('btn-rmb'),
    currencyIndicator: document.querySelector('.currency-indicator'),
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
    clearFilter: document.getElementById('clear-filter'),
    themePickerBtn: document.getElementById('theme-picker-btn'),
    themeDropdown: document.getElementById('theme-dropdown'),
    incomeTrend: document.querySelector('.summary-card.income .card-trend'),
    incomeCompare: document.querySelector('.summary-card.income .card-compare'),
    expenseTrend: document.querySelector('.summary-card.expense .card-trend'),
    expenseCompare: document.querySelector('.summary-card.expense .card-compare'),
    netTrend: document.querySelector('.summary-card.net .card-trend'),
    netCompare: document.querySelector('.summary-card.net .card-compare'),
    prevBtn: document.getElementById('prev-period'),
    nextBtn: document.getElementById('next-period')
};

const MOCK_DATA = {
    updatedAt: "2026-05-17T10:00:00-05:00",
    rate: 6.72,
    entries: [
        { name: "DeepSeek AI", amount: 600, currency: "RMB", type: "支出", category: "AI 🤖", date: "2026-05-16", note: "API" },
        { name: "房租", amount: 1350, currency: "USD", type: "支出", category: "房租 🏠", date: "2026-05-01", note: "月租" },
        { name: "Weee! 超市", amount: 124.5, currency: "USD", type: "支出", category: "饮食 🍜", date: "2026-05-14", note: "买菜" },
        { name: "工资", amount: 750, currency: "USD", type: "收入", category: "工资 💰", date: "2026-05-15", note: "助教" },
        { name: "Steam", amount: 248, currency: "RMB", type: "支出", category: "游戏 🎮", date: "2026-05-12", note: "游戏" },
        { name: "拨款", amount: 15000, currency: "RMB", type: "收入", category: "拨款 💸", date: "2026-05-05", note: "生活费" },
        { name: "显示器", amount: 899, currency: "USD", type: "支出", category: "大件 🖥️", date: "2026-05-08", note: "设备升级" }
    ]
};

async function init() {
    initTheme();
    bindEvents();
    // 初始设置指示器位置
    setTimeout(() => {
        updateTabIndicator(document.querySelector('.tab-btn.active'));
        updateCurrencyIndicator(document.querySelector('.currency-btn.active'));
    }, 50);

    await loadLiveExchangeRate();
    await loadFinancialData();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'violet';
    applyTheme(savedTheme);
}

function applyTheme(themeName) {
    // Remove all theme classes
    document.body.classList.remove('theme-violet', 'theme-sharp', 'theme-minimal', 'theme-neon', 'theme-sunset');
    // Remove light-mode/dark-mode (legacy)
    document.body.classList.remove('light-mode', 'dark-mode');
    // Add new theme
    if (themeName !== 'violet') {
        document.body.classList.add('theme-' + themeName);
    }
    localStorage.setItem('theme', themeName);
    // Update dropdown active state
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === themeName);
    });
    // Re-render chart (colors may have changed)
    if (state.data) {
        renderDashboard();
    }
}

async function loadLiveExchangeRate() {
    const CACHE_KEY = 'rate_cache';
    const TIME_KEY = 'rate_time';
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const cachedRate = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);

    if (cachedRate && cachedTime && (Date.now() - parseInt(cachedTime) < ONE_DAY)) {
        state.rate = parseFloat(cachedRate);
        DOM.rateDisplay.textContent = `实时汇率: ${state.rate.toFixed(4)}`;
        return;
    }
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (response.ok) {
            const apiData = await response.json();
            if (apiData && apiData.rates && apiData.rates.CNY) {
                state.rate = parseFloat(apiData.rates.CNY);
                localStorage.setItem(CACHE_KEY, state.rate);
                localStorage.setItem(TIME_KEY, Date.now());
                DOM.rateDisplay.textContent = `实时汇率: ${state.rate.toFixed(4)}`;
                return;
            }
        }
    } catch (e) {}
    state.rate = cachedRate ? parseFloat(cachedRate) : 6.72;
    DOM.rateDisplay.textContent = `基准汇率: ${state.rate.toFixed(4)}`;
}

async function loadFinancialData() {
    try {
        let response = await fetch('data/all.json').catch(() => null);
        let rawData = (response && response.ok) ? await response.json() : MOCK_DATA;
        state.allData = rawData;
        DOM.updateTime.textContent = `数据时间: ${new Date(rawData.updatedAt).toLocaleDateString()}`;
        processDataView();
    } catch (error) {
        console.error("加载故障:", error);
    }
}

function getWeekRange(offset) {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const curMonday = new Date(now);
    curMonday.setDate(now.getDate() + diffToMonday);
    curMonday.setHours(0, 0, 0, 0);
    const monday = new Date(curMonday);
    monday.setDate(curMonday.getDate() + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const jan1 = new Date(monday.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((monday - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return {
        start: monday,
        end: sunday,
        label: `W${weekNum}周 (${String(monday.getMonth()+1).padStart(2,'0')}.${String(monday.getDate()).padStart(2,'0')}-${String(sunday.getMonth()+1).padStart(2,'0')}.${String(sunday.getDate()).padStart(2,'0')})`,
        startStr: monday.toISOString().slice(0, 10),
        endStr: sunday.toISOString().slice(0, 10),
    };
}

function getMonthRange(offset) {
    const now = new Date();
    const month = now.getMonth() + offset;
    const year = now.getFullYear() + Math.floor(month / 12);
    const realMonth = ((month % 12) + 12) % 12;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
        label: `${firstDay.getFullYear()}年 ${String(firstDay.getMonth()+1).padStart(2,'0')}月`,
        startStr: `${firstDay.getFullYear()}-${String(firstDay.getMonth()+1).padStart(2,'0')}-01`,
        endStr: `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`,
        prefix: `${firstDay.getFullYear()}-${String(firstDay.getMonth()+1).padStart(2,'0')}`,
    };
}

function processDataView() {
    let entries = [...state.allData.entries];
    if (state.view === 'monthly') {
        DOM.periodNav.style.display = 'flex';
        const m = getMonthRange(state.monthOffset);
        DOM.periodLabel.textContent = m.label;
        entries = entries.filter(e => e.date.startsWith(m.prefix));
        const allDates = state.allData.entries.map(e => e.date).sort();
        const earliest = new Date(allDates[0] + 'T00:00:00');
        const curMonth = new Date().getMonth() + new Date().getFullYear() * 12;
        const earlyMonth = earliest.getMonth() + earliest.getFullYear() * 12;
        const earliestOffset = earlyMonth - curMonth;
        DOM.prevBtn.disabled = state.monthOffset <= earliestOffset;
        DOM.nextBtn.disabled = state.monthOffset >= 0;
    } else if (state.view === 'weekly') {
        DOM.periodNav.style.display = 'flex';
        const w = getWeekRange(state.weekOffset);
        DOM.periodLabel.textContent = w.label;
        entries = entries.filter(e => e.date >= w.startStr && e.date <= w.endStr);
        const allDates = state.allData.entries.map(e => e.date).sort();
        const earliest = new Date(allDates[0] + 'T00:00:00');
        const now = new Date();
        const eDay = earliest.getDay();
        const eMon = new Date(earliest); eMon.setDate(earliest.getDate() - (eDay === 0 ? 6 : eDay - 1));
        const nDay = now.getDay();
        const nMon = new Date(now); nMon.setDate(now.getDate() - (nDay === 0 ? 6 : nDay - 1));
        const toWN = (d) => { const j1 = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d - j1) / 86400000 + j1.getDay() + 1) / 7) + d.getFullYear() * 53; };
        const earliestWkOffset = toWN(eMon) - toWN(nMon);
        DOM.prevBtn.disabled = state.weekOffset <= earliestWkOffset;
        DOM.nextBtn.disabled = state.weekOffset >= 0;
    } else {
        DOM.periodNav.style.display = 'none';
    }
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    state.data = { ...state.allData, entries };
    state.activeCategory = null; 
    renderDashboard();
}

function updateTabIndicator(activeBtn) {
    if (!DOM.tabIndicator || !activeBtn) return;
    DOM.tabIndicator.style.width = `${activeBtn.offsetWidth}px`;
    DOM.tabIndicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

function updateCurrencyIndicator(activeBtn) {
    if (!DOM.currencyIndicator || !activeBtn) return;
    DOM.currencyIndicator.style.width = `${activeBtn.offsetWidth}px`;
    DOM.currencyIndicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

function bindEvents() {
    window.addEventListener('resize', () => {
        updateTabIndicator(document.querySelector('.tab-btn.active'));
        updateCurrencyIndicator(document.querySelector('.currency-btn.active'));
    });

    DOM.themePickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.themeDropdown.classList.toggle('open');
    });

    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            applyTheme(e.currentTarget.dataset.theme);
            DOM.themeDropdown.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-picker')) {
            DOM.themeDropdown.classList.remove('open');
        }
    });

    DOM.btnUSD.addEventListener('click', (e) => changeReportingCurrency('USD', e.target));
    DOM.btnRMB.addEventListener('click', (e) => changeReportingCurrency('RMB', e.target));

    DOM.tabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOM.tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            updateTabIndicator(e.target);
            state.view = e.target.dataset.view;
            state.weekOffset = 0;
            state.monthOffset = 0;
            state.page = 0;
            processDataView();
        });
    });

    document.getElementById('prev-period').addEventListener('click', () => {
        if (state.view === 'weekly') { state.weekOffset--; processDataView(); }
        else if (state.view === 'monthly') { state.monthOffset--; processDataView(); }
    });
    document.getElementById('next-period').addEventListener('click', () => {
        if (state.view === 'weekly') { state.weekOffset++; processDataView(); }
        else if (state.view === 'monthly') { state.monthOffset++; processDataView(); }
    });

    DOM.clearFilter.addEventListener('click', () => {
        state.activeCategory = null;
        state.page = 0;
        renderDashboard();
    });
}

function changeReportingCurrency(curr, targetBtn) {
    state.currency = curr;
    document.querySelectorAll('.currency-btn').forEach(btn => btn.classList.remove('active'));
    targetBtn.classList.add('active');
    updateCurrencyIndicator(targetBtn);
    renderDashboard();
}

function calcValue(amount, originalCurrency) {
    if (originalCurrency === state.currency) return amount;
    if (state.currency === 'USD' && originalCurrency === 'RMB') return amount / state.rate;
    if (state.currency === 'RMB' && originalCurrency === 'USD') return amount * state.rate;
    return amount;
}

function formatExecutiveCurrency(val) {
    const opt = { style: 'currency', currency: state.currency, minimumFractionDigits: 2 };
    return new Intl.NumberFormat(state.currency === 'USD' ? 'en-US' : 'zh-CN', opt).format(val);
}

function renderExpenseChart(categoryStats) {
    const isDark = !document.body.classList.contains('theme-minimal');
    const labelColor = isDark ? '#8E8E93' : '#636366';

    const expenseCategories = Object.keys(categoryStats).filter(
        k => categoryStats[k].count > 0 && categoryStats[k].type === '支出'
    );
    const dataValues = expenseCategories.map(k => categoryStats[k].amount.toFixed(2));
    
    const labelsWithAmounts = expenseCategories.map(k => {
        return `${k} - ${formatExecutiveCurrency(categoryStats[k].amount)}`;
    });

    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (expenseChartInstance) {
        expenseChartInstance.data.labels = labelsWithAmounts;
        expenseChartInstance.data.datasets[0].data = dataValues;
        expenseChartInstance.options.plugins.legend.labels.color = labelColor;
        expenseChartInstance.data.datasets[0].borderColor = isDark ? 'rgba(11, 11, 20, 0.8)' : 'rgba(242, 242, 247, 0.8)';
        expenseChartInstance.update();
        return;
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labelsWithAmounts,
            datasets: [{
                data: dataValues,
                backgroundColor: [
                    '#FB7185', '#FBBF24', '#A78BFA', '#60A5FA', '#34D399', '#F472B6', '#818CF8', '#FCA5A5', '#FCD34D', '#C084FC'
                ],
                borderColor: isDark ? 'rgba(11, 11, 20, 0.8)' : 'rgba(242, 242, 247, 0.8)',
                borderWidth: 3,
                hoverOffset: 10,
                hoverBorderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 800,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        color: labelColor,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: { size: 13, weight: '600', family: "'Inter', sans-serif" }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(11, 11, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDark ? '#F5F5F7' : '#1C1C1E',
                    bodyColor: isDark ? '#A78BFA' : '#7C3AED',
                    borderColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 12,
                    titleFont: { weight: '700' },
                    bodyFont: { weight: '600' }
                }
            }
        }
    });
}

function updateTrend(cardEl, current, prev, label) {
    const trendEl = cardEl.querySelector('.card-trend');
    const compareEl = cardEl.querySelector('.card-compare');
    if (!trendEl && !compareEl) return;
    if (!prev || prev === 0) {
        if (trendEl) trendEl.style.display = 'none';
        if (compareEl) compareEl.style.display = 'none';
        return;
    }
    const pct = ((current - prev) / Math.abs(prev) * 100);
    const arrow = pct >= 0 ? '↑' : '↓';
    if (trendEl) {
        trendEl.textContent = `${arrow}`;
        trendEl.style.display = '';
        trendEl.style.color = pct >= 0 ? '#34D399' : '#FB7185';
    }
    if (compareEl) {
        compareEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% ${label}`;
        compareEl.style.display = '';
    }
}

function renderDashboard() {
    if (!state.data) return;
    let entries = state.data.entries;
    
    if (state.activeCategory) {
        entries = entries.filter(e => e.category === state.activeCategory);
        DOM.filterTip.style.display = 'flex';
        DOM.currentFilter.textContent = state.activeCategory;
    } else {
        DOM.filterTip.style.display = 'none';
    }

    let income = 0, expense = 0;
    let categoryStats = {};
    CATEGORY_ORDER.forEach(c => { categoryStats[c] = { amount: 0, count: 0, type: CATEGORY_ORDER.indexOf(c) <= 2 ? '收入' : '支出' }; });

    state.data.entries.forEach(item => {
        let val = calcValue(item.amount, item.currency);
        if (item.type === '收入') income += val;
        if (item.type === '支出') expense += val;
        if (categoryStats[item.category]) {
            categoryStats[item.category].amount += val;
            categoryStats[item.category].count += 1;
        } else {
            categoryStats[item.category] = { amount: val, count: 1, type: item.type };
        }
    });

    DOM.totalIncome.textContent = formatExecutiveCurrency(income);
    DOM.totalExpense.textContent = formatExecutiveCurrency(expense);
    let net = income - expense;
    DOM.netBalance.textContent = formatExecutiveCurrency(net);
    DOM.netBalance.parentElement.classList.toggle('negative', net < 0);

    // Update summary card trend/compare based on view
    const summaryCards = document.querySelectorAll('.summary-card');
    if (state.view === 'all') {
        summaryCards[0].querySelector('.card-trend').style.display = 'none';
        summaryCards[0].querySelector('.card-compare').style.display = 'none';
        if (income > 0) {
            const expPct = (expense / income * 100).toFixed(0);
            summaryCards[1].querySelector('.card-compare').textContent = `${expPct}% of income`;
        }
        summaryCards[2].querySelector('.card-trend').style.display = 'none';
        summaryCards[2].querySelector('.card-compare').style.display = 'none';
    } else if (state.view === 'weekly') {
        const prevW = getWeekRange(state.weekOffset - 1);
        const prevEntries = state.allData.entries.filter(e => e.date >= prevW.startStr && e.date <= prevW.endStr);
        let prevInc = 0, prevExp = 0;
        prevEntries.forEach(i => { let v = calcValue(i.amount, i.currency); if (i.type === '收入') prevInc += v; else prevExp += v; });
        updateTrend(summaryCards[0], income, prevInc, 'vs last week');
        updateTrend(summaryCards[1], expense, prevExp, 'vs last week');
        updateTrend(summaryCards[2], net, prevInc - prevExp, 'vs last week');
    } else if (state.view === 'monthly') {
        const prevM = getMonthRange(state.monthOffset - 1);
        const prevEntries = state.allData.entries.filter(e => e.date.startsWith(prevM.prefix));
        let prevInc = 0, prevExp = 0;
        prevEntries.forEach(i => { let v = calcValue(i.amount, i.currency); if (i.type === '收入') prevInc += v; else prevExp += v; });
        updateTrend(summaryCards[0], income, prevInc, 'vs last month');
        updateTrend(summaryCards[1], expense, prevExp, 'vs last month');
        updateTrend(summaryCards[2], net, prevInc - prevExp, 'vs last month');
    }

    renderExpenseChart(categoryStats);

    DOM.categoryContainer.innerHTML = '';
    let activeList = Object.keys(categoryStats).filter(k => categoryStats[k].count > 0);
    activeList.sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));

    activeList.forEach(cat => {
        let stat = categoryStats[cat];
        let card = document.createElement('div');
        card.className = `category-card ${state.activeCategory === cat ? 'active-filter' : ''}`;
        card.innerHTML = `
            <div class="cat-header">
                <span class="cat-name">${cat}</span>
                <span class="cat-count">${stat.count} 笔</span>
            </div>
            <div class="cat-amount ${stat.type === '收入' ? 'cat-income' : 'cat-expense'}">
                ${formatExecutiveCurrency(stat.amount)}
            </div>
        `;
        card.addEventListener('click', () => {
            state.activeCategory = state.activeCategory === cat ? null : cat;
            state.page = 0;
            renderDashboard();
        });
        DOM.categoryContainer.appendChild(card);
    });

    DOM.recordsBody.innerHTML = '';
    const totalPages = Math.ceil(entries.length / state.pageSize);
    if (state.page >= totalPages) state.page = Math.max(0, totalPages - 1);
    const start = state.page * state.pageSize;
    const pageEntries = entries.slice(start, start + state.pageSize);

    pageEntries.forEach(item => {
        let val = calcValue(item.amount, item.currency);
        let tr = document.createElement('tr');
        let colorClass = item.type === '收入' ? 'cat-income' : 'cat-expense';
        let sign = item.type === '收入' ? '+' : '-';
        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${item.name}</td>
            <td>${item.category}</td>
            <td class="td-amount ${colorClass}">${sign}${formatExecutiveCurrency(val)}</td>
            <td class="td-note">${item.note || '-'}</td>
        `;
        DOM.recordsBody.appendChild(tr);
    });

    // Pagination controls
    renderPagination(entries.length, totalPages);
}

function renderPagination(total, totalPages) {
    let container = document.getElementById('pagination-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pagination-container';
        container.className = 'pagination-bar';
        document.querySelector('.table-wrapper').after(container);
    }

    if (totalPages <= 1) {
        container.innerHTML = total > 0 ? `<span class="pagination-info">共 ${total} 条记录</span>` : '';
        return;
    }

    const start = state.page * state.pageSize + 1;
    const end = Math.min((state.page + 1) * state.pageSize, total);

    container.innerHTML = `
        <span class="pagination-info">第 ${start}-${end} 条，共 ${total} 条</span>
        <div class="pagination-controls">
            <button class="pagination-btn" id="page-first" ${state.page === 0 ? 'disabled' : ''} title="首页">«</button>
            <button class="pagination-btn" id="page-prev" ${state.page === 0 ? 'disabled' : ''} title="上一页">‹</button>
            <span class="pagination-page">${state.page + 1} / ${totalPages}</span>
            <button class="pagination-btn" id="page-next" ${state.page >= totalPages - 1 ? 'disabled' : ''} title="下一页">›</button>
            <button class="pagination-btn" id="page-last" ${state.page >= totalPages - 1 ? 'disabled' : ''} title="末页">»</button>
        </div>
    `;

    document.getElementById('page-first').addEventListener('click', () => { state.page = 0; renderDashboard(); });
    document.getElementById('page-prev').addEventListener('click', () => { state.page = Math.max(0, state.page - 1); renderDashboard(); });
    document.getElementById('page-next').addEventListener('click', () => { state.page = Math.min(totalPages - 1, state.page + 1); renderDashboard(); });
    document.getElementById('page-last').addEventListener('click', () => { state.page = totalPages - 1; renderDashboard(); });
}

document.addEventListener('DOMContentLoaded', init);
