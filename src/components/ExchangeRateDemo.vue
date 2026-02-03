<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface AsaMapping {
  id: number
  symbol: string
  name: string
  decimals: number
  coingeckoId: string
  asaIdTestnet: string | null
  asaIdMainnet: string | null
  isNative: boolean
}

interface ExchangeRateResponse {
  assetId: string
  symbol?: string
  rate: number
  stale: boolean
  cachedAt: string | null
  error?: string
}

const asaMappings = ref<AsaMapping[]>([])
const exchangeRates = ref<Map<string, ExchangeRateResponse>>(new Map())
const loading = ref(false)
const error = ref<string | null>(null)
const network = ref<string>('testnet')
const autoRefresh = ref(false)
const lastUpdated = ref<string | null>(null)

// Custom lookup state
const lookupInput = ref('')
const lookupResult = ref<ExchangeRateResponse | null>(null)
const lookupLoading = ref(false)
const lookupError = ref<string | null>(null)

let refreshInterval: ReturnType<typeof setInterval> | null = null

async function fetchAsaMappings() {
  try {
    const res = await fetch('/api/exchange-rate/asa/mappings')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    asaMappings.value = data.mappings
    network.value = data.network
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch ASA mappings'
  }
}

async function fetchAllRates() {
  if (asaMappings.value.length === 0) return

  loading.value = true
  error.value = null

  try {
    // Use batch endpoint for efficiency
    const coingeckoIds = asaMappings.value.map(m => m.coingeckoId)
    const res = await fetch('/api/exchange-rate/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: coingeckoIds }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const newRates = new Map<string, ExchangeRateResponse>()

    for (const [key, value] of Object.entries(data.rates)) {
      newRates.set(key, value as ExchangeRateResponse)
    }

    exchangeRates.value = newRates
    lastUpdated.value = new Date().toISOString()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch exchange rates'
  } finally {
    loading.value = false
  }
}

async function lookupRate() {
  if (!lookupInput.value.trim()) return

  lookupLoading.value = true
  lookupError.value = null
  lookupResult.value = null

  try {
    const res = await fetch(`/api/exchange-rate/${encodeURIComponent(lookupInput.value.trim())}`)
    if (!res.ok) {
      if (res.status === 503) {
        const data = await res.json()
        lookupResult.value = data
        lookupError.value = data.error || 'Rate unavailable'
        return
      }
      throw new Error(`HTTP ${res.status}`)
    }

    lookupResult.value = await res.json()
  } catch (e) {
    lookupError.value = e instanceof Error ? e.message : 'Lookup failed'
  } finally {
    lookupLoading.value = false
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value

  if (autoRefresh.value) {
    refreshInterval = setInterval(fetchAllRates, 60000) // Refresh every 60s (matches cache TTL)
  } else if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

function formatPrice(rate: number): string {
  if (rate === 0) return 'N/A'
  if (rate >= 1) return `$${rate.toFixed(2)}`
  return `$${rate.toFixed(6)}`
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Never'
  const date = new Date(iso)
  return date.toLocaleTimeString()
}

function getAsaId(mapping: AsaMapping): string {
  const id = network.value === 'mainnet' ? mapping.asaIdMainnet : mapping.asaIdTestnet
  return id || (mapping.isNative ? 'Native' : 'N/A')
}

onMounted(async () => {
  await fetchAsaMappings()
  await fetchAllRates()
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="exchange-rate-demo">
    <div class="header">
      <h2>Exchange Rates</h2>
      <p class="subtitle">Real-time ASA to USD exchange rates via CoinGecko</p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button
        class="btn"
        :class="{ active: autoRefresh }"
        @click="toggleAutoRefresh"
      >
        <span class="icon">{{ autoRefresh ? '⏸' : '▶' }}</span>
        {{ autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF' }}
      </button>
      <button class="btn" @click="fetchAllRates" :disabled="loading">
        <span class="icon">↻</span>
        Refresh Now
      </button>
      <div class="network-badge">
        <span class="dot" :class="network"></span>
        {{ network }}
      </div>
    </div>

    <!-- Error display -->
    <div v-if="error" class="error-box">
      {{ error }}
    </div>

    <!-- Rates Table -->
    <div class="rates-section">
      <div class="section-header">
        <h3>Supported Assets</h3>
        <span v-if="lastUpdated" class="last-updated">
          Updated: {{ formatTime(lastUpdated) }}
        </span>
      </div>

      <div class="rates-table">
        <div class="table-header">
          <span class="col symbol">Symbol</span>
          <span class="col name">Name</span>
          <span class="col price">USD Price</span>
          <span class="col asa">ASA ID ({{ network }})</span>
          <span class="col status">Status</span>
        </div>

        <div v-if="loading && asaMappings.length === 0" class="loading">
          Loading...
        </div>

        <div
          v-for="mapping in asaMappings"
          :key="mapping.id"
          class="table-row"
        >
          <span class="col symbol">
            <span class="symbol-badge" :class="{ native: mapping.isNative }">
              {{ mapping.symbol }}
            </span>
          </span>
          <span class="col name">{{ mapping.name }}</span>
          <span class="col price">
            {{ formatPrice(exchangeRates.get(mapping.coingeckoId)?.rate || 0) }}
          </span>
          <span class="col asa">
            <code>{{ getAsaId(mapping) }}</code>
          </span>
          <span class="col status">
            <span
              v-if="exchangeRates.get(mapping.coingeckoId)?.stale"
              class="status-badge stale"
            >
              Stale
            </span>
            <span v-else class="status-badge fresh">Fresh</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Custom Lookup -->
    <div class="lookup-section">
      <h3>Rate Lookup</h3>
      <p class="lookup-desc">
        Query exchange rate by ASA ID, symbol, or CoinGecko ID
      </p>

      <div class="lookup-form">
        <input
          v-model="lookupInput"
          type="text"
          placeholder="e.g., USDC, 10458941, algorand"
          @keyup.enter="lookupRate"
        />
        <button class="btn primary" @click="lookupRate" :disabled="lookupLoading">
          {{ lookupLoading ? 'Looking up...' : 'Lookup' }}
        </button>
      </div>

      <div v-if="lookupError" class="lookup-error">
        {{ lookupError }}
      </div>

      <div v-if="lookupResult" class="lookup-result">
        <div class="result-card">
          <div class="result-row">
            <span class="result-label">Asset ID</span>
            <span class="result-value">{{ lookupResult.assetId }}</span>
          </div>
          <div v-if="lookupResult.symbol" class="result-row">
            <span class="result-label">Symbol</span>
            <span class="result-value">{{ lookupResult.symbol }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">USD Price</span>
            <span class="result-value price">{{ formatPrice(lookupResult.rate) }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Cached At</span>
            <span class="result-value">{{ formatTime(lookupResult.cachedAt) }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Status</span>
            <span class="result-value">
              <span :class="['status-badge', lookupResult.stale ? 'stale' : 'fresh']">
                {{ lookupResult.stale ? 'Stale' : 'Fresh' }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- API Info -->
    <div class="api-info">
      <h3>API Endpoints</h3>
      <div class="endpoint-list">
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/api/exchange-rate/:assetId</code>
          <span class="desc">Get rate for single asset</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <code>/api/exchange-rate/batch</code>
          <span class="desc">Batch fetch multiple rates</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/api/exchange-rate/asa/mappings</code>
          <span class="desc">List all ASA mappings</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/api/exchange-rate/asa/lookup/:identifier</code>
          <span class="desc">Lookup ASA by symbol or ID</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exchange-rate-demo {
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  margin-bottom: 1.5rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 0.95rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: #2a2a4e;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.active {
  background: #4ade8022;
  border-color: #4ade80;
  color: #4ade80;
}

.btn.primary {
  background: #ffee55;
  border-color: #ffee55;
  color: #000;
}

.btn.primary:hover:not(:disabled) {
  background: #ffd700;
}

.icon {
  font-size: 0.9rem;
}

.network-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #0f0f1a;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.testnet {
  background: #fbbf24;
}

.dot.mainnet {
  background: #4ade80;
}

.dot.localnet {
  background: #60a5fa;
}

.error-box {
  background: #f8717122;
  border: 1px solid #f87171;
  border-radius: 8px;
  padding: 1rem;
  color: #f87171;
  margin-bottom: 1.5rem;
}

.rates-section {
  background: #0f0f1a;
  border: 1px solid #1a1a2e;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.last-updated {
  font-size: 0.75rem;
  color: #666;
}

.rates-table {
  border: 1px solid #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 100px 1fr 120px 150px 80px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  align-items: center;
}

.table-header {
  background: #1a1a2e;
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  border-top: 1px solid #1a1a2e;
  font-size: 0.9rem;
}

.table-row:hover {
  background: #1a1a2e44;
}

.col.price {
  font-family: 'SF Mono', Monaco, monospace;
  color: #4ade80;
  font-weight: 500;
}

.col.asa code {
  font-size: 0.8rem;
  color: #888;
}

.symbol-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #2a2a4e;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
}

.symbol-badge.native {
  background: #ffee5522;
  color: #ffee55;
}

.status-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.fresh {
  background: #4ade8022;
  color: #4ade80;
}

.status-badge.stale {
  background: #fbbf2422;
  color: #fbbf24;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.lookup-section {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.lookup-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.lookup-desc {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 1rem;
}

.lookup-form {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.lookup-form input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #0f0f1a;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
}

.lookup-form input:focus {
  outline: none;
  border-color: #ffee55;
}

.lookup-error {
  background: #f8717122;
  border: 1px solid #f87171;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: #f87171;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.lookup-result {
  margin-top: 1rem;
}

.result-card {
  background: #0f0f1a;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  padding: 1rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #1a1a2e;
}

.result-row:last-child {
  border-bottom: none;
}

.result-label {
  color: #666;
  font-size: 0.85rem;
}

.result-value {
  font-size: 0.9rem;
}

.result-value.price {
  color: #4ade80;
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 500;
}

.api-info {
  background: #0f0f1a;
  border: 1px solid #1a1a2e;
  border-radius: 12px;
  padding: 1.25rem;
}

.api-info h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.endpoint {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: #1a1a2e;
  border-radius: 6px;
}

.method {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: bold;
  min-width: 45px;
  text-align: center;
}

.method.get {
  background: #61affe;
  color: #fff;
}

.method.post {
  background: #49cc90;
  color: #fff;
}

.endpoint code {
  font-size: 0.85rem;
  color: #fff;
}

.endpoint .desc {
  color: #666;
  font-size: 0.8rem;
  margin-left: auto;
}

@media (max-width: 800px) {
  .table-header,
  .table-row {
    grid-template-columns: 80px 1fr 100px;
  }

  .col.asa,
  .col.status {
    display: none;
  }

  .endpoint .desc {
    display: none;
  }
}
</style>
