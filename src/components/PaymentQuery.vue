<script setup lang="ts">
import { ref } from 'vue'

interface Payment {
  id: number
  txnId: string
  appId: string
  checkoutId: string
  payer: string
  merchant: string
  merchantName: string | null
  amount: string
  assetId: string
  note: string | null
  confirmedRound: number
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  lastAttemptAt: string | null
  deliveredAt: string | null
  errorMessage: string | null
  detectedAt: string
  createdAt: string
}

const queryType = ref<'txn' | 'checkout'>('txn')
const queryValue = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const results = ref<Payment[]>([])
const searched = ref(false)

async function search() {
  if (!queryValue.value.trim()) {
    error.value = 'Please enter a search value'
    return
  }

  loading.value = true
  error.value = null
  results.value = []
  searched.value = true

  try {
    const endpoint = queryType.value === 'txn'
      ? `/api/payments/txn/${encodeURIComponent(queryValue.value)}`
      : `/api/payments/checkout/${encodeURIComponent(queryValue.value)}`

    const res = await fetch(endpoint)

    if (res.status === 404) {
      results.value = []
      return
    }

    if (!res.ok) {
      throw new Error('Failed to fetch payment')
    }

    const data = await res.json()
    // txn endpoint returns single payment, checkout returns array
    results.value = Array.isArray(data) ? data : [data]
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Search failed'
  } finally {
    loading.value = false
  }
}

function formatAmount(microAmount: string): string {
  return (Number(microAmount) / 1_000_000).toFixed(2)
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'delivered': return '#4ade80'
    case 'pending': return '#fbbf24'
    case 'failed': return '#f87171'
    default: return '#888'
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}
</script>

<template>
  <div class="payment-query">
    <div class="header">
      <h2>Payment Query</h2>
      <p class="subtitle">Search payments by transaction ID or checkout ID</p>
    </div>

    <!-- Search Form -->
    <div class="search-form">
      <div class="query-type-tabs">
        <button
          :class="['tab', { active: queryType === 'txn' }]"
          @click="queryType = 'txn'"
        >
          By Transaction ID
        </button>
        <button
          :class="['tab', { active: queryType === 'checkout' }]"
          @click="queryType = 'checkout'"
        >
          By Checkout ID
        </button>
      </div>

      <div class="search-input-row">
        <input
          v-model="queryValue"
          type="text"
          :placeholder="queryType === 'txn' ? 'Enter transaction ID...' : 'Enter checkout ID...'"
          @keyup.enter="search"
        />
        <button @click="search" :disabled="loading" class="search-btn">
          {{ loading ? 'Searching...' : 'Search' }}
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-box">{{ error }}</div>

    <!-- Results -->
    <div v-if="searched && !loading" class="results-section">
      <h3>
        Results
        <span class="result-count">({{ results.length }} found)</span>
      </h3>

      <div v-if="results.length === 0" class="empty-state">
        <p>No payments found for this {{ queryType === 'txn' ? 'transaction' : 'checkout' }} ID</p>
      </div>

      <div v-else class="results-list">
        <div
          v-for="payment in results"
          :key="payment.id"
          class="payment-card"
        >
          <div class="card-header">
            <div class="header-left">
              <span
                class="status-badge"
                :style="{
                  backgroundColor: getStatusColor(payment.status) + '22',
                  color: getStatusColor(payment.status),
                  borderColor: getStatusColor(payment.status) + '55'
                }"
              >
                {{ payment.status }}
              </span>
              <span class="payment-id">#{{ payment.id }}</span>
            </div>
            <div class="amount">
              {{ formatAmount(payment.amount) }}
              <span class="currency">USDC</span>
            </div>
          </div>

          <div class="card-body">
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Transaction ID</span>
                <div class="value-with-copy">
                  <code :title="payment.txnId">{{ shortenAddress(payment.txnId) }}</code>
                  <button @click="copyToClipboard(payment.txnId)" class="copy-btn" title="Copy">
                    copy
                  </button>
                </div>
              </div>

              <div class="info-item">
                <span class="label">Checkout ID</span>
                <code>{{ payment.checkoutId }}</code>
              </div>

              <div class="info-item">
                <span class="label">App ID</span>
                <code>{{ payment.appId }}</code>
              </div>

              <div class="info-item">
                <span class="label">Confirmed Round</span>
                <span>{{ payment.confirmedRound.toLocaleString() }}</span>
              </div>

              <div class="info-item">
                <span class="label">Payer</span>
                <div class="value-with-copy">
                  <code :title="payment.payer">{{ shortenAddress(payment.payer) }}</code>
                  <button @click="copyToClipboard(payment.payer)" class="copy-btn" title="Copy">
                    copy
                  </button>
                </div>
              </div>

              <div class="info-item">
                <span class="label">Merchant</span>
                <span>{{ payment.merchantName || shortenAddress(payment.merchant) }}</span>
              </div>

              <div class="info-item">
                <span class="label">Detected At</span>
                <span>{{ formatDate(payment.detectedAt) }}</span>
              </div>

              <div class="info-item">
                <span class="label">Delivered At</span>
                <span :class="{ success: payment.deliveredAt }">
                  {{ formatDate(payment.deliveredAt) }}
                </span>
              </div>

              <div class="info-item">
                <span class="label">Webhook Attempts</span>
                <span>{{ payment.attempts }}</span>
              </div>

              <div v-if="payment.note" class="info-item full-width">
                <span class="label">Note</span>
                <span>{{ payment.note }}</span>
              </div>

              <div v-if="payment.errorMessage" class="info-item full-width error">
                <span class="label">Error</span>
                <span>{{ payment.errorMessage }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="quick-links">
      <h3>Quick Links</h3>
      <div class="links-grid">
        <a href="/api/payments/stats" target="_blank" class="link-card">
          <span class="link-icon">stats</span>
          <span class="link-text">
            <strong>Payment Stats</strong>
            <span>GET /api/payments/stats</span>
          </span>
        </a>
        <a href="/api/payments/recent" target="_blank" class="link-card">
          <span class="link-icon">list</span>
          <span class="link-text">
            <strong>Recent Payments</strong>
            <span>GET /api/payments/recent</span>
          </span>
        </a>
        <a href="/api/checkouts" target="_blank" class="link-card">
          <span class="link-icon">cart</span>
          <span class="link-text">
            <strong>All Checkouts</strong>
            <span>GET /api/checkouts</span>
          </span>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-query {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.subtitle {
  color: #666;
  font-size: 0.9rem;
}

/* Search Form */
.search-form {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.query-type-tabs {
  display: flex;
  border-bottom: 1px solid #2a2a4e;
}

.tab {
  flex: 1;
  padding: 1rem;
  background: transparent;
  border: none;
  color: #666;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: #12121f;
  color: #fff;
}

.tab.active {
  background: #12121f;
  color: #ffee55;
  border-bottom: 2px solid #ffee55;
  margin-bottom: -1px;
}

.search-input-row {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
}

.search-input-row input {
  flex: 1;
  padding: 0.875rem 1rem;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #fff;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
}

.search-input-row input:focus {
  outline: none;
  border-color: #ffee55;
}

.search-input-row input::placeholder {
  color: #555;
  font-family: inherit;
}

.search-btn {
  padding: 0.875rem 1.5rem;
  background: #ffee55;
  border: none;
  border-radius: 8px;
  color: #000;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover:not(:disabled) {
  background: #ffe033;
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Error */
.error-box {
  background: #ff6b6b22;
  border: 1px solid #ff6b6b55;
  color: #ff6b6b;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

/* Results */
.results-section {
  margin-bottom: 2rem;
}

.results-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.result-count {
  color: #666;
  font-weight: 400;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  background: #12121f;
  border: 1px solid #1a1a2e;
  border-radius: 12px;
  color: #555;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.payment-card {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: #12121f;
  border-bottom: 1px solid #2a2a4e;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid;
}

.payment-id {
  color: #666;
  font-size: 0.85rem;
}

.amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}

.amount .currency {
  font-size: 0.85rem;
  color: #4ade80;
  margin-left: 0.25rem;
}

.card-body {
  padding: 1.25rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item.error {
  background: #ff6b6b11;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #ff6b6b33;
}

.info-item .label {
  font-size: 0.7rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-item code {
  font-size: 0.85rem;
  color: #a0a0c0;
}

.info-item .success {
  color: #4ade80;
}

.value-with-copy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.copy-btn {
  padding: 0.2rem 0.4rem;
  background: #333;
  border: none;
  border-radius: 4px;
  color: #888;
  font-size: 0.65rem;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #444;
  color: #fff;
}

/* Quick Links */
.quick-links {
  background: #12121f;
  border: 1px solid #1a1a2e;
  border-radius: 12px;
  padding: 1.25rem;
}

.quick-links h3 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #888;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.link-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s;
}

.link-card:hover {
  border-color: #3a3a5e;
  background: #222240;
}

.link-icon {
  width: 36px;
  height: 36px;
  background: #0f0f1a;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  color: #ffee55;
}

.link-text {
  display: flex;
  flex-direction: column;
}

.link-text strong {
  font-size: 0.85rem;
  color: #fff;
}

.link-text span {
  font-size: 0.7rem;
  color: #666;
}

@media (max-width: 600px) {
  .search-input-row {
    flex-direction: column;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
}
</style>
