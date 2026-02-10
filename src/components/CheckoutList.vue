<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface Checkout {
  id: string
  appId: string
  merchantWallet: string
  merchantName: string
  amount: string
  assetId: string
  note: string
  method: string
  status: 'pending' | 'paid' | 'notified' | 'failed' | 'expired'
  createdAt: string
  expiresAt: string
  paidAt?: string
  transactionId?: string
  notifiedAt?: string
  paymentUrl: string
}

const checkouts = ref<Checkout[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const statusFilter = ref<string>('all')
const searchQuery = ref('')

const filteredCheckouts = computed(() => {
  let result = checkouts.value

  // Filter by status
  if (statusFilter.value !== 'all') {
    result = result.filter(c => c.status === statusFilter.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      c.id.toLowerCase().includes(query) ||
      c.merchantName.toLowerCase().includes(query) ||
      c.merchantWallet.toLowerCase().includes(query)
    )
  }

  return result
})

const statusCounts = computed(() => {
  const counts = { all: 0, pending: 0, paid: 0, notified: 0, expired: 0, failed: 0 }
  for (const c of checkouts.value) {
    counts.all++
    counts[c.status]++
  }
  return counts
})

async function fetchCheckouts() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/api/checkouts')
    if (!res.ok) throw new Error('Failed to fetch checkouts')
    checkouts.value = await res.json()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch'
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'notified': return '#22d3ee'  // Cyan for fully completed
    case 'paid': return '#4ade80'       // Green for paid
    case 'pending': return '#fbbf24'    // Yellow for pending
    case 'expired': return '#f87171'
    case 'failed': return '#f87171'
    default: return '#888'
  }
}

function copyPaymentUrl(url: string) {
  navigator.clipboard.writeText(window.location.origin + url)
}

function openPaymentUrl(url: string) {
  window.open(url, '_blank')
}

onMounted(fetchCheckouts)
</script>

<template>
  <div class="checkout-list">
    <div class="header">
      <div class="header-left">
        <h2>Checkouts</h2>
        <p class="subtitle">View and manage all checkout records</p>
      </div>
      <div class="header-right">
        <button @click="fetchCheckouts" class="refresh-btn" :disabled="loading">
          Refresh
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by ID, merchant..."
        />
      </div>
      <div class="status-filters">
        <button
          v-for="status in ['all', 'pending', 'paid', 'notified', 'expired', 'failed']"
          :key="status"
          :class="['filter-btn', { active: statusFilter === status }]"
          @click="statusFilter = status"
        >
          {{ status }}
          <span class="count">{{ statusCounts[status as keyof typeof statusCounts] }}</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && checkouts.length === 0" class="loading">
      <div class="spinner"></div>
      Loading checkouts...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-box">{{ error }}</div>

    <!-- Empty State -->
    <div v-else-if="filteredCheckouts.length === 0" class="empty-state">
      <div class="empty-icon">:/</div>
      <p v-if="checkouts.length === 0">No checkouts created yet</p>
      <p v-else>No checkouts match your filters</p>
    </div>

    <!-- Checkout Cards -->
    <div v-else class="checkout-grid">
      <div
        v-for="checkout in filteredCheckouts"
        :key="checkout.id"
        class="checkout-card"
      >
        <div class="card-header">
          <code class="checkout-id">{{ checkout.id }}</code>
          <span
            class="status-badge"
            :style="{
              backgroundColor: getStatusColor(checkout.status) + '22',
              color: getStatusColor(checkout.status),
              borderColor: getStatusColor(checkout.status) + '55'
            }"
          >
            {{ checkout.status }}
          </span>
        </div>

        <div class="card-body">
          <div class="amount-row">
            <span class="amount">{{ formatAmount(checkout.amount) }}</span>
            <span class="currency">USDC</span>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="label">Merchant</span>
              <span class="value">{{ checkout.merchantName || shortenAddress(checkout.merchantWallet) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Method</span>
              <span :class="['value', 'method-tag', checkout.method || 'contract']">
                {{ checkout.method === 'direct' ? 'Direct' : 'Contract' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Created</span>
              <span class="value">{{ formatDate(checkout.createdAt) }}</span>
            </div>
            <div v-if="checkout.status === 'pending'" class="detail-row">
              <span class="label">Expires in</span>
              <span class="value expires">{{ getTimeRemaining(checkout.expiresAt) }}</span>
            </div>
            <div v-if="checkout.paidAt" class="detail-row">
              <span class="label">Paid at</span>
              <span class="value">{{ formatDate(checkout.paidAt) }}</span>
            </div>
            <div v-if="checkout.notifiedAt" class="detail-row">
              <span class="label">Notified at</span>
              <span class="value notified">{{ formatDate(checkout.notifiedAt) }}</span>
            </div>
            <div v-if="checkout.transactionId" class="detail-row">
              <span class="label">Transaction</span>
              <code class="value txn">{{ shortenAddress(checkout.transactionId) }}</code>
            </div>
          </div>
        </div>

        <div v-if="checkout.status === 'pending'" class="card-actions">
          <button @click="copyPaymentUrl(checkout.paymentUrl)" class="action-btn">
            Copy URL
          </button>
          <button @click="openPaymentUrl(checkout.paymentUrl)" class="action-btn primary">
            Open Payment
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkout-list {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
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

.refresh-btn {
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2a2a3e;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Filters */
.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
}

.search-box input:focus {
  outline: none;
  border-color: #ffee55;
}

.search-box input::placeholder {
  color: #555;
}

.status-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid #2a2a4e;
  border-radius: 6px;
  color: #888;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: capitalize;
}

.filter-btn:hover {
  background: #1a1a2e;
}

.filter-btn.active {
  background: #ffee5522;
  border-color: #ffee5555;
  color: #ffee55;
}

.filter-btn .count {
  margin-left: 0.35rem;
  opacity: 0.6;
}

/* Loading & States */
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

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #555;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Checkout Grid */
.checkout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.checkout-card {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #12121f;
  border-bottom: 1px solid #2a2a4e;
}

.checkout-id {
  font-size: 0.85rem;
  color: #a0a0c0;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid;
}

.card-body {
  padding: 1rem;
}

.amount-row {
  text-align: center;
  margin-bottom: 1rem;
}

.amount {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
}

.currency {
  font-size: 1rem;
  color: #4ade80;
  margin-left: 0.5rem;
}

.details {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0;
  font-size: 0.8rem;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid #1a1a2e;
}

.detail-row .label {
  color: #666;
}

.detail-row .value {
  color: #fff;
}

.detail-row .value.expires {
  color: #fbbf24;
}

.detail-row .value.notified {
  color: #22d3ee;
}

.detail-row .value.txn {
  color: #a0a0c0;
  font-size: 0.75rem;
}

.method-tag {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}

.method-tag.direct {
  background: #4ade8022;
  color: #4ade80;
}

.method-tag.contract {
  background: #a78bfa22;
  color: #a78bfa;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #2a2a4e;
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:not(.primary) {
  background: transparent;
  border: 1px solid #333;
  color: #888;
}

.action-btn:not(.primary):hover {
  background: #333;
  color: #fff;
}

.action-btn.primary {
  background: #ffee55;
  border: none;
  color: #000;
  font-weight: 600;
}

.action-btn.primary:hover {
  background: #ffe033;
}

@media (max-width: 600px) {
  .header {
    flex-direction: column;
    gap: 1rem;
  }

  .filters {
    flex-direction: column;
  }

  .status-filters {
    justify-content: flex-start;
  }

  .checkout-grid {
    grid-template-columns: 1fr;
  }
}
</style>
