<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useApiEndpoint } from '../composables/useApiEndpoint'

const { apiUrl } = useApiEndpoint()

interface Stats {
  pending: number
  delivered: number
  failed: number
  total: number
}

interface Payment {
  id: number
  txnId: string
  appId: string
  checkoutId: string
  payer: string
  payee: string
  payeeName: string | null
  amount: string
  assetId: string
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  confirmedRound: number
  detectedAt: string
  deliveredAt: string | null
  errorMessage: string | null
}

const stats = ref<Stats | null>(null)
const payments = ref<Payment[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const autoRefresh = ref(true)
let refreshInterval: ReturnType<typeof setInterval> | null = null

async function fetchData() {
  try {
    const [statsRes, paymentsRes] = await Promise.all([
      fetch(apiUrl('/api/payments/stats')),
      fetch(apiUrl('/api/payments/recent?limit=20')),
    ])

    if (!statsRes.ok || !paymentsRes.ok) {
      throw new Error('Failed to fetch data')
    }

    stats.value = await statsRes.json()
    payments.value = await paymentsRes.json()
    error.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch data'
  } finally {
    loading.value = false
  }
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval)
  refreshInterval = setInterval(fetchData, 5000)
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

function formatAmount(microAmount: string): string {
  return (Number(microAmount) / 1_000_000).toFixed(2)
}

function shortenTxnId(txnId: string): string {
  if (!txnId || txnId.length < 16) return txnId
  return `${txnId.slice(0, 8)}...${txnId.slice(-6)}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString()
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'delivered': return '#4ade80'
    case 'pending': return '#fbbf24'
    case 'failed': return '#f87171'
    default: return '#888'
  }
}

onMounted(() => {
  fetchData()
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="payment-stats">
    <div class="header">
      <div class="header-left">
        <h2>Payment Statistics</h2>
        <p class="subtitle">Monitor webhook delivery status</p>
      </div>
      <div class="header-right">
        <button @click="fetchData" class="refresh-btn" :disabled="loading">
          Refresh
        </button>
        <button
          @click="toggleAutoRefresh"
          :class="['auto-refresh-btn', { active: autoRefresh }]"
        >
          Auto {{ autoRefresh ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>

    <div v-if="loading && !stats" class="loading">
      <div class="spinner"></div>
      Loading...
    </div>

    <div v-else-if="error" class="error-box">
      {{ error }}
    </div>

    <template v-else>
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-value">{{ stats?.total || 0 }}</div>
          <div class="stat-label">Total Payments</div>
        </div>
        <div class="stat-card delivered">
          <div class="stat-value">{{ stats?.delivered || 0 }}</div>
          <div class="stat-label">Delivered</div>
          <div class="stat-icon">checkmark</div>
        </div>
        <div class="stat-card pending">
          <div class="stat-value">{{ stats?.pending || 0 }}</div>
          <div class="stat-label">Pending</div>
          <div class="stat-icon">clock</div>
        </div>
        <div class="stat-card failed">
          <div class="stat-value">{{ stats?.failed || 0 }}</div>
          <div class="stat-label">Failed</div>
          <div class="stat-icon">warning</div>
        </div>
      </div>

      <!-- Payments Table -->
      <div class="payments-section">
        <h3>Recent Payments</h3>

        <div v-if="payments.length === 0" class="empty-state">
          No payments recorded yet
        </div>

        <div v-else class="payments-table">
          <div class="table-header">
            <span class="col-status">Status</span>
            <span class="col-txn">Transaction</span>
            <span class="col-checkout">Checkout</span>
            <span class="col-amount">Amount</span>
            <span class="col-attempts">Attempts</span>
            <span class="col-time">Detected</span>
          </div>

          <div
            v-for="payment in payments"
            :key="payment.id"
            class="table-row"
          >
            <span class="col-status">
              <span
                class="status-badge"
                :style="{ backgroundColor: getStatusColor(payment.status) + '22', color: getStatusColor(payment.status), borderColor: getStatusColor(payment.status) + '55' }"
              >
                {{ payment.status }}
              </span>
            </span>
            <span class="col-txn">
              <code :title="payment.txnId">{{ shortenTxnId(payment.txnId) }}</code>
            </span>
            <span class="col-checkout">
              <code>{{ payment.checkoutId }}</code>
            </span>
            <span class="col-amount">
              {{ formatAmount(payment.amount) }} USDC
            </span>
            <span class="col-attempts">
              {{ payment.attempts }}
            </span>
            <span class="col-time">
              {{ formatDate(payment.detectedAt) }}
            </span>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.payment-stats {
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

.header-right {
  display: flex;
  gap: 0.5rem;
}

.refresh-btn, .auto-refresh-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  color: #fff;
}

.refresh-btn:hover:not(:disabled) {
  background: #2a2a3e;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auto-refresh-btn {
  background: transparent;
  border: 1px solid #333;
  color: #666;
}

.auto-refresh-btn.active {
  background: #4ade8022;
  border-color: #4ade8055;
  color: #4ade80;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-card.total .stat-value {
  color: #fff;
}

.stat-card.delivered .stat-value {
  color: #4ade80;
}

.stat-card.pending .stat-value {
  color: #fbbf24;
}

.stat-card.failed .stat-value {
  color: #f87171;
}

/* Payments Table */
.payments-section {
  background: #12121f;
  border: 1px solid #1a1a2e;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 2rem;
}

.payments-section h3 {
  font-size: 1rem;
  font-weight: 600;
  padding: 1rem 1.5rem;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a4e;
  margin: 0;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #555;
}

.payments-table {
  overflow-x: auto;
}

.table-header, .table-row {
  display: grid;
  grid-template-columns: 100px 140px 120px 120px 80px 1fr;
  gap: 1rem;
  padding: 0.875rem 1.5rem;
  align-items: center;
}

.table-header {
  background: #0f0f1a;
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.table-row {
  border-bottom: 1px solid #1a1a2e;
  font-size: 0.875rem;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: #1a1a2e33;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid;
}

.col-txn code, .col-checkout code {
  font-size: 0.8rem;
  color: #a0a0c0;
}

.col-amount {
  color: #4ade80;
  font-weight: 500;
}

.col-attempts {
  color: #888;
}

.col-time {
  color: #666;
  font-size: 0.8rem;
}

/* Flow Diagram */
.flow-section {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  padding: 1.5rem;
}

.flow-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #0f0f1a;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  min-width: 140px;
}

.flow-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  flex-shrink: 0;
}

.flow-icon.blockchain { background: #3b82f633; color: #3b82f6; }
.flow-icon.sqlite { background: #8b5cf633; color: #8b5cf6; }
.flow-icon.retry { background: #fbbf2433; color: #fbbf24; }
.flow-icon.saas { background: #4ade8033; color: #4ade80; }

.flow-text {
  display: flex;
  flex-direction: column;
}

.flow-text strong {
  font-size: 0.85rem;
  color: #fff;
}

.flow-text span {
  font-size: 0.75rem;
  color: #666;
}

.flow-arrow {
  color: #333;
  font-size: 1.5rem;
}

/* Loading & Error */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #1a1a2e;
  border-top-color: #ffee55;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-box {
  background: #ff6b6b22;
  border: 1px solid #ff6b6b55;
  color: #ff6b6b;
  padding: 1rem;
  border-radius: 12px;
}

@media (max-width: 800px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .table-header, .table-row {
    grid-template-columns: 80px 100px 100px 1fr;
  }

  .col-attempts, .col-time {
    display: none;
  }

  .flow-diagram {
    flex-direction: column;
  }

  .flow-arrow {
    transform: rotate(90deg);
  }
}

@media (max-width: 500px) {
  .header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-right {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .stat-value {
    font-size: 2rem;
  }
}
</style>
