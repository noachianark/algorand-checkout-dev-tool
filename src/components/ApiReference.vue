<script setup lang="ts">
import { ref } from 'vue'
import { useApiEndpoint } from '../composables/useApiEndpoint'

const { baseUrl } = useApiEndpoint()

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  category: string
  requestBody?: string
  responseExample?: string
}

const endpoints: ApiEndpoint[] = [
  // Checkout endpoints
  {
    method: 'POST',
    path: '/api/checkouts',
    description: 'Create a new checkout for payment',
    category: 'Checkouts',
    requestBody: `// Contract method (via smart contract)
{
  "checkoutId": "CHK-001",
  "method": "contract",
  "appId": "754674671",
  "payeeWallet": "ALGO...",
  "payeeName": "My Store",
  "amount": "1000000",
  "assetId": "10458941",
  "note": "Order #123"
}

// Direct method (wallet-to-wallet transfer)
{
  "checkoutId": "CHK-002",
  "method": "direct",
  "payeeWallet": "ALGO...",
  "payeeName": "My Store",
  "amount": "1000000",
  "assetId": "10458941",
  "expirationDays": 7,
  "note": "Order #456"
}`,
    responseExample: `{
  "id": "CHK-001",
  "status": "pending",
  "paymentUrl": "http://...",
  // status: pending|paid|notified|expired|failed
}`
  },
  {
    method: 'GET',
    path: '/api/checkouts/:id',
    description: 'Get checkout details by ID',
    category: 'Checkouts',
    responseExample: `{
  "id": "CHK-001",
  "status": "notified",
  "amount": "1000000",
  "paidAt": "2024-01-28T10:30:00Z",
  "notifiedAt": "2024-01-28T10:30:05Z",
  "transactionId": "ABCD1234..."
}`
  },
  {
    method: 'GET',
    path: '/api/checkouts',
    description: 'List all checkouts (debugging)',
    category: 'Checkouts',
  },
  {
    method: 'PATCH',
    path: '/api/checkouts/:id/status',
    description: 'Update checkout status (internal)',
    category: 'Checkouts',
  },
  // Payment endpoints
  {
    method: 'GET',
    path: '/api/payments/stats',
    description: 'Get payment delivery statistics',
    category: 'Payments',
    responseExample: `{
  "pending": 2,
  "delivered": 15,
  "failed": 0,
  "total": 17
}`
  },
  {
    method: 'GET',
    path: '/api/payments/recent',
    description: 'Get recent payment records',
    category: 'Payments',
    responseExample: `[
  {
    "txnId": "ABC123...",
    "checkoutId": "CHK-001",
    "status": "delivered",
    "amount": "1000000",
    ...
  }
]`
  },
  {
    method: 'GET',
    path: '/api/payments/txn/:txnId',
    description: 'Get payment by transaction ID',
    category: 'Payments',
  },
  {
    method: 'GET',
    path: '/api/payments/checkout/:checkoutId',
    description: 'Get payments for a checkout',
    category: 'Payments',
  },
  // Exchange Rate endpoints
  {
    method: 'GET',
    path: '/api/exchange-rate/:assetId',
    description: 'Get exchange rate for a single asset',
    category: 'Exchange Rates',
    responseExample: `{
  "assetId": "algorand",
  "symbol": "ALGO",
  "rate": 0.1823,
  "stale": false,
  "cachedAt": "2024-01-28T10:30:00Z"
}`
  },
  {
    method: 'POST',
    path: '/api/exchange-rate/batch',
    description: 'Batch fetch exchange rates for multiple assets',
    category: 'Exchange Rates',
    requestBody: `{
  "assetIds": ["algorand", "usd-coin", "tether"]
}`,
    responseExample: `{
  "rates": {
    "algorand": { "rate": 0.1823, "stale": false, ... },
    "usd-coin": { "rate": 1.0001, "stale": false, ... }
  }
}`
  },
  {
    method: 'GET',
    path: '/api/exchange-rate/asa/mappings',
    description: 'List all supported ASA mappings',
    category: 'Exchange Rates',
    responseExample: `{
  "mappings": [
    {
      "symbol": "ALGO",
      "name": "Algorand",
      "coingeckoId": "algorand",
      "asaIdTestnet": null,
      "asaIdMainnet": null,
      "isNative": true
    },
    {
      "symbol": "USDC",
      "coingeckoId": "usd-coin",
      "asaIdTestnet": "10458941",
      "asaIdMainnet": "31566704"
    }
  ],
  "network": "testnet"
}`
  },
  {
    method: 'GET',
    path: '/api/exchange-rate/asa/lookup/:identifier',
    description: 'Lookup ASA by symbol or ASA ID',
    category: 'Exchange Rates',
    responseExample: `{
  "mapping": {
    "symbol": "USDC",
    "name": "USD Coin",
    "coingeckoId": "usd-coin",
    "asaIdTestnet": "10458941",
    "asaIdMainnet": "31566704"
  },
  "network": "testnet"
}`
  },
  // Config endpoints
  {
    method: 'GET',
    path: '/api/config',
    description: 'Get server configuration',
    category: 'System',
    responseExample: `{
  "network": "testnet"
}`
  },
  {
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint',
    category: 'System',
    responseExample: `{
  "status": "ok",
  "network": "testnet",
  "timestamp": "2024-01-28T..."
}`
  },
]

const categories = [...new Set(endpoints.map(e => e.category))]
const expandedEndpoint = ref<string | null>(null)

function toggleEndpoint(path: string) {
  expandedEndpoint.value = expandedEndpoint.value === path ? null : path
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return '#61affe'
    case 'POST': return '#49cc90'
    case 'PATCH': return '#fca130'
    case 'DELETE': return '#f93e3e'
    default: return '#888'
  }
}
</script>

<template>
  <div class="api-reference">
    <div class="header">
      <h2>API Reference</h2>
      <p class="subtitle">Payment Gateway REST API endpoints</p>
    </div>

    <div class="base-url">
      <span class="label">Base URL</span>
      <code>{{ baseUrl }}</code>
    </div>

    <div v-for="category in categories" :key="category" class="category">
      <h3 class="category-title">{{ category }}</h3>

      <div class="endpoints">
        <div
          v-for="endpoint in endpoints.filter(e => e.category === category)"
          :key="endpoint.path"
          class="endpoint"
          :class="{ expanded: expandedEndpoint === endpoint.path }"
        >
          <div class="endpoint-header" @click="toggleEndpoint(endpoint.path)">
            <span
              class="method-badge"
              :style="{ backgroundColor: getMethodColor(endpoint.method) }"
            >
              {{ endpoint.method }}
            </span>
            <code class="path">{{ endpoint.path }}</code>
            <span class="description">{{ endpoint.description }}</span>
            <span class="toggle-icon">{{ expandedEndpoint === endpoint.path ? '-' : '+' }}</span>
          </div>

          <div v-if="expandedEndpoint === endpoint.path" class="endpoint-details">
            <div v-if="endpoint.requestBody" class="detail-section">
              <h4>Request Body</h4>
              <pre>{{ endpoint.requestBody }}</pre>
            </div>
            <div v-if="endpoint.responseExample" class="detail-section">
              <h4>Response Example</h4>
              <pre>{{ endpoint.responseExample }}</pre>
            </div>
            <div v-if="!endpoint.requestBody && !endpoint.responseExample" class="detail-section">
              <p class="no-details">No additional details available</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="webhook-section">
      <h3>Webhook Callback</h3>
      <p class="webhook-desc">
        When a payment is detected on the blockchain, the subscriber sends a POST request to your configured
        <code>SAAS_WEBHOOK_URL</code> with the following payload:
      </p>
      <pre class="webhook-payload">{
  "appId": "754674671",
  "checkoutId": "CHK-001",
  "transactionId": "ABCD1234...",
  "payer": "ALGO_WALLET_ADDRESS...",
  "payee": "PAYEE_WALLET...",
  "payeeName": "My Store",
  "amount": "1000000",
  "assetId": "10458941",
  "confirmedRound": 12345678,
  "detectedAt": "2024-01-28T10:30:00Z"
}</pre>
    </div>

    <div class="status-section">
      <h3>Checkout Status Flow</h3>
      <p class="status-desc">
        Checkouts progress through the following statuses:
      </p>
      <div class="status-flow">
        <div class="status-item pending">
          <span class="status-name">pending</span>
          <span class="status-meaning">Checkout created, awaiting payment</span>
        </div>
        <div class="status-arrow">→</div>
        <div class="status-item paid">
          <span class="status-name">paid</span>
          <span class="status-meaning">Payment detected on blockchain</span>
        </div>
        <div class="status-arrow">→</div>
        <div class="status-item notified">
          <span class="status-name">notified</span>
          <span class="status-meaning">Webhook delivered to SaaS</span>
        </div>
      </div>
      <div class="status-other">
        <div class="status-item expired">
          <span class="status-name">expired</span>
          <span class="status-meaning">Checkout expired (30min default, or N days for direct)</span>
        </div>
        <div class="status-item failed">
          <span class="status-name">failed</span>
          <span class="status-meaning">Payment or notification failed</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-reference {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
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

.base-url {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.base-url .label {
  color: #666;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.base-url code {
  color: #4ade80;
  font-size: 0.95rem;
}

.category {
  margin-bottom: 2rem;
}

.category-title {
  font-size: 1rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #1a1a2e;
}

.endpoints {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.endpoint {
  background: #12121f;
  border: 1px solid #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.endpoint:hover {
  border-color: #2a2a4e;
}

.endpoint.expanded {
  border-color: #3a3a5e;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.endpoint-header:hover {
  background: #1a1a2e;
}

.method-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  color: #fff;
  min-width: 55px;
  text-align: center;
}

.path {
  color: #fff;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.description {
  color: #666;
  font-size: 0.85rem;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-icon {
  color: #555;
  font-size: 1.25rem;
  width: 24px;
  text-align: center;
}

.endpoint-details {
  padding: 1rem;
  background: #0f0f1a;
  border-top: 1px solid #1a1a2e;
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.detail-section pre {
  background: #1a1a2e;
  border-radius: 6px;
  padding: 1rem;
  font-size: 0.8rem;
  color: #a0a0c0;
  overflow-x: auto;
  margin: 0;
}

.no-details {
  color: #555;
  font-size: 0.85rem;
  font-style: italic;
}

.webhook-section {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.webhook-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #ffee55;
}

.webhook-desc {
  font-size: 0.9rem;
  color: #888;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.webhook-desc code {
  background: #0f0f1a;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  color: #4ade80;
  font-size: 0.85rem;
}

.webhook-payload {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.8rem;
  color: #a0a0c0;
  overflow-x: auto;
  margin: 0;
}

.status-section {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1.5rem;
}

.status-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #22d3ee;
}

.status-desc {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 1rem;
}

.status-flow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.status-arrow {
  color: #555;
  font-size: 1.25rem;
}

.status-item {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  min-width: 120px;
}

.status-item.pending {
  background: #fbbf2422;
  border: 1px solid #fbbf2455;
}

.status-item.paid {
  background: #4ade8022;
  border: 1px solid #4ade8055;
}

.status-item.notified {
  background: #22d3ee22;
  border: 1px solid #22d3ee55;
}

.status-item.expired,
.status-item.failed {
  background: #f8717122;
  border: 1px solid #f8717155;
}

.status-name {
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.status-item.pending .status-name { color: #fbbf24; }
.status-item.paid .status-name { color: #4ade80; }
.status-item.notified .status-name { color: #22d3ee; }
.status-item.expired .status-name,
.status-item.failed .status-name { color: #f87171; }

.status-meaning {
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.25rem;
}

.status-other {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 700px) {
  .endpoint-header {
    flex-wrap: wrap;
  }

  .description {
    order: 4;
    width: 100%;
    margin-top: 0.5rem;
    white-space: normal;
  }

  .toggle-icon {
    order: 3;
  }
}
</style>
