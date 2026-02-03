<script setup lang="ts">
import { ref, computed } from 'vue'
import WalletConnect from './components/WalletConnect.vue'
import NetworkSelector from './components/NetworkSelector.vue'
import CheckoutCreator from './components/CheckoutCreator.vue'
import CheckoutList from './components/CheckoutList.vue'
import ApiReference from './components/ApiReference.vue'
import PaymentStats from './components/PaymentStats.vue'
import PaymentQuery from './components/PaymentQuery.vue'
import ExchangeRateDemo from './components/ExchangeRateDemo.vue'

type Page = 'api' | 'create' | 'checkouts' | 'stats' | 'query' | 'rates'

const currentPage = ref<Page>('api')
const sidebarCollapsed = ref(false)

// API URL from environment variable
const apiUrl = computed(() => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  try {
    return new URL(url).host
  } catch {
    return url
  }
})

const navItems = [
  { id: 'api' as Page, label: 'API Reference', icon: 'book' },
  { id: 'create' as Page, label: 'Create Checkout', icon: 'plus' },
  { id: 'checkouts' as Page, label: 'All Checkouts', icon: 'list' },
  { id: 'stats' as Page, label: 'Payment Stats', icon: 'chart' },
  { id: 'query' as Page, label: 'Query Payments', icon: 'search' },
  { id: 'rates' as Page, label: 'Exchange Rates', icon: 'dollar' },
]

function getIconSvg(icon: string): string {
  const icons: Record<string, string> = {
    book: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`,
    plus: `<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`,
    card: `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>`,
    chart: `<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>`,
    menu: `<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>`,
    list: `<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>`,
    search: `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`,
    dollar: `<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>`,
  }
  return icons[icon] || ''
}
</script>

<template>
  <div class="app" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" v-show="!sidebarCollapsed">
          <span class="logo-icon">PG</span>
          <div class="logo-text">
            <span class="logo-title">Payment Gateway</span>
            <span class="logo-badge">Demo</span>
          </div>
        </div>
        <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-html="getIconSvg('menu')"></path>
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="['nav-item', { active: currentPage === item.id }]"
          @click="currentPage = item.id"
          :title="sidebarCollapsed ? item.label : undefined"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <g v-html="getIconSvg(item.icon)"></g>
          </svg>
          <span class="nav-label" v-show="!sidebarCollapsed">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer" v-show="!sidebarCollapsed">
        <div class="api-status">
          <span class="status-dot"></span>
          <span>API: {{ apiUrl }}</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="main-container">
      <!-- Top Bar -->
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ navItems.find(i => i.id === currentPage)?.label }}</h1>
        </div>
        <div class="topbar-right">
          <NetworkSelector />
          <WalletConnect />
        </div>
      </header>

      <!-- Content Area -->
      <main class="content">
        <ApiReference v-if="currentPage === 'api'" />
        <CheckoutCreator v-else-if="currentPage === 'create'" />
        <CheckoutList v-else-if="currentPage === 'checkouts'" />
        <PaymentStats v-else-if="currentPage === 'stats'" />
        <PaymentQuery v-else-if="currentPage === 'query'" />
        <ExchangeRateDemo v-else-if="currentPage === 'rates'" />
      </main>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0a0a12;
  color: #fff;
  min-height: 100vh;
}

.app {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 260px;
  background: #0f0f1a;
  border-right: 1px solid #1a1a2e;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  flex-shrink: 0;
}

.app.sidebar-collapsed .sidebar {
  width: 70px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid #1a1a2e;
  min-height: 70px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #ffee55 0%, #ffd700 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
  color: #000;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #fff;
}

.logo-badge {
  font-size: 0.65rem;
  color: #ffee55;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: #1a1a2e;
  color: #fff;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  color: #888;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: #1a1a2e;
  color: #fff;
}

.nav-item.active {
  background: #ffee5515;
  color: #ffee55;
}

.nav-item svg {
  flex-shrink: 0;
}

.app.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 0.875rem;
}

.sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #1a1a2e;
}

.api-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #666;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Main Container */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #0f0f1a;
  border-bottom: 1px solid #1a1a2e;
  min-height: 70px;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

/* Mobile Responsive */
@media (max-width: 900px) {
  .app {
    flex-direction: column;
  }

  .sidebar {
    width: 100% !important;
    border-right: none;
    border-bottom: 1px solid #1a1a2e;
  }

  .sidebar-header {
    padding: 1rem;
  }

  .sidebar-nav {
    flex-direction: row;
    padding: 0.5rem;
    overflow-x: auto;
    gap: 0.5rem;
  }

  .nav-item {
    padding: 0.75rem 1rem;
    white-space: nowrap;
    flex: none;
  }

  .nav-label {
    display: inline !important;
  }

  .sidebar-footer {
    display: none;
  }

  .topbar {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .topbar-left {
    width: 100%;
    text-align: center;
  }

  .topbar-right {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .content {
    padding: 1rem;
  }
}
</style>
