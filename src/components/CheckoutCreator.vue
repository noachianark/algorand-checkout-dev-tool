<script setup lang="ts">
import { computed, ref } from 'vue'

// API URL from environment variable
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface CheckoutResponse {
  id: string
  appId: string
  merchantWallet: string
  amount: string
  assetId: string
  callbackUrl: string
  status: string
  paymentUrl: string
  createdAt: string
}

const form = ref({
  checkoutId: `CHK-${Date.now()}`,
  method: 'direct' as 'contract' | 'direct',
  appId: '754674671',
  merchantWallet: 'FXC3F4IFAST3VTUVL4TSYNROIHF675QDYX4YEKBU3CD3NZZQAYX3BPOH5A',
  merchantName: 'Demo Store',
  amount: '1000000',
  assetId: '10458941',
  note: '',
})

const loading = ref(false)
const response = ref<CheckoutResponse | null>(null)
const error = ref<string | null>(null)
const copied = ref(false)

const formattedAmount = computed(() => {
  const amt = Number(form.value.amount) / 1_000_000
  return isNaN(amt) ? '0.00' : amt.toFixed(2)
})

const requestBody = computed(() => {
  const body: Record<string, string> = { ...form.value }
  if (form.value.method === 'direct') {
    delete body.appId
  }
  return JSON.stringify(body, null, 2)
})

// Full payment URL (API base + relative path)
const fullPaymentUrl = computed(() => {
  if (!response.value?.paymentUrl) return ''
  return apiBaseUrl + response.value.paymentUrl
})

async function createCheckout() {
  loading.value = true
  error.value = null
  response.value = null

  try {
    const body: Record<string, string> = { ...form.value }
    if (form.value.method === 'direct') {
      delete body.appId
    }

    const res = await fetch('/api/checkouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`)
    }

    response.value = data
    // Generate new checkout ID for next request
    form.value.checkoutId = `CHK-${Date.now()}`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Request failed'
  } finally {
    loading.value = false
  }
}

function openPaymentUrl() {
  if (fullPaymentUrl.value) {
    window.open(fullPaymentUrl.value, '_blank')
  }
}

function copyPaymentUrl() {
  if (fullPaymentUrl.value) {
    navigator.clipboard.writeText(fullPaymentUrl.value)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  }
}

function generateCheckoutId() {
  form.value.checkoutId = `CHK-${Date.now()}`
}
</script>

<template>
  <div class="checkout-creator">
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <span class="method-badge">POST</span>
          <code>/api/checkouts</code>
        </div>
        <span class="subtitle">Simulate J2EE Server Request</span>
      </div>

      <div class="panel-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Checkout ID</label>
            <div class="input-with-button">
              <input v-model="form.checkoutId" type="text" placeholder="CHK-001" />
              <button @click="generateCheckoutId" class="icon-btn" title="Generate new ID">
                ↻
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Payment Method</label>
            <div class="method-toggle">
              <button
                :class="['toggle-btn', { active: form.method === 'direct' }]"
                @click="form.method = 'direct'"
              >
                Direct Transfer
              </button>
              <button
                :class="['toggle-btn', { active: form.method === 'contract' }]"
                @click="form.method = 'contract'"
              >
                Smart Contract
              </button>
            </div>
          </div>

          <div v-if="form.method === 'contract'" class="form-group">
            <label>App ID</label>
            <input v-model="form.appId" type="text" placeholder="1033" />
          </div>

          <div class="form-group full-width">
            <label>Merchant Wallet</label>
            <input
              v-model="form.merchantWallet"
              type="text"
              placeholder="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
            />
          </div>

          <div class="form-group">
            <label>Merchant Name</label>
            <input v-model="form.merchantName" type="text" placeholder="My Store" />
          </div>

          <div class="form-group">
            <label>Amount (micro-USDC)</label>
            <div class="input-with-hint">
              <input v-model="form.amount" type="text" placeholder="10000000" />
              <span class="hint">= {{ formattedAmount }} USDC</span>
            </div>
          </div>

          <div class="form-group">
            <label>Asset ID</label>
            <input v-model="form.assetId" type="text" placeholder="10458941" />
          </div>

          <div class="form-group full-width">
            <label>Note (Optional)</label>
            <input
              v-model="form.note"
              type="text"
              placeholder="Order #123, Product XYZ"
            />
          </div>
        </div>

        <div class="request-preview">
          <div class="preview-header">
            <span>Request Body</span>
          </div>
          <pre>{{ requestBody }}</pre>
        </div>

        <button
          @click="createCheckout"
          :disabled="loading"
          class="send-btn"
        >
          {{ loading ? 'Sending...' : 'Send Request' }}
        </button>
      </div>
    </div>

    <!-- Response Panel -->
    <div v-if="error || response" class="panel response-panel">
      <div class="panel-header">
        <div class="panel-title">
          <span :class="['status-badge', error ? 'error' : 'success']">
            {{ error ? 'Error' : '201 Created' }}
          </span>
          <span>Response</span>
        </div>
      </div>

      <div class="panel-body">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <template v-else-if="response">
          <div class="response-preview">
            <pre>{{ JSON.stringify(response, null, 2) }}</pre>
          </div>

          <div class="payment-url-box">
            <label>Payment URL</label>
            <div class="url-actions">
              <code class="url">{{ fullPaymentUrl }}</code>
              <div class="url-buttons">
                <button @click="copyPaymentUrl" class="action-btn">
                  {{ copied ? '✓ Copied' : 'Copy' }}
                </button>
                <button @click="openPaymentUrl" class="action-btn primary">
                  Open Payment Page →
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkout-creator {
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.panel {
  background: #1a1a2e;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #2a2a4e;
}

.panel-header {
  padding: 1rem 1.5rem;
  background: #12121f;
  border-bottom: 1px solid #2a2a4e;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
}

.panel-title code {
  font-size: 0.95rem;
  color: #a0a0c0;
}

.subtitle {
  font-size: 0.8rem;
  color: #666;
}

.method-badge {
  background: #4ade80;
  color: #000;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.status-badge.success {
  background: #4ade80;
  color: #000;
}

.status-badge.error {
  background: #ff6b6b;
  color: #000;
}

.panel-body {
  padding: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 0.8rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input {
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  color: #fff;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
}

.form-group input:focus {
  outline: none;
  border-color: #ffee55;
}

.form-group input::placeholder {
  color: #444;
}

.method-toggle {
  display: flex;
  gap: 0;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
}

.toggle-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #0f0f1a;
  border: none;
  color: #666;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:not(:last-child) {
  border-right: 1px solid #333;
}

.toggle-btn.active {
  background: #ffee5522;
  color: #ffee55;
}

.toggle-btn:hover:not(.active) {
  background: #1a1a2e;
  color: #aaa;
}

.input-with-button {
  display: flex;
  gap: 0.5rem;
}

.input-with-button input {
  flex: 1;
}

.icon-btn {
  background: #333;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  width: 42px;
  cursor: pointer;
  font-size: 1.1rem;
}

.icon-btn:hover {
  background: #444;
}

.input-with-hint {
  position: relative;
}

.input-with-hint input {
  width: 100%;
  padding-right: 100px;
}

.input-with-hint .hint {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #4ade80;
  font-size: 0.85rem;
  font-weight: 500;
}

.request-preview {
  margin-top: 1.5rem;
  background: #0f0f1a;
  border-radius: 8px;
  overflow: hidden;
}

.preview-header {
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.request-preview pre,
.response-preview pre {
  padding: 1rem;
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
  color: #a0a0c0;
  overflow-x: auto;
}

.send-btn {
  margin-top: 1.5rem;
  width: 100%;
  padding: 1rem;
  background: #ffee55;
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #ffe033;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.response-panel .panel-body {
  padding: 1rem 1.5rem 1.5rem;
}

.response-preview {
  background: #0f0f1a;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.error-message {
  background: #ff6b6b22;
  border: 1px solid #ff6b6b;
  color: #ff6b6b;
  padding: 1rem;
  border-radius: 8px;
}

.payment-url-box {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #4ade8044;
}

.payment-url-box label {
  font-size: 0.75rem;
  color: #4ade80;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 0.75rem;
}

.url-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.url {
  display: block;
  padding: 0.75rem;
  background: #1a1a2e;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #a0a0c0;
  word-break: break-all;
}

.url-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:not(.primary) {
  background: transparent;
  border: 1px solid #444;
  color: #fff;
}

.action-btn:not(.primary):hover {
  background: #333;
}

.action-btn.primary {
  background: #4ade80;
  border: none;
  color: #000;
}

.action-btn.primary:hover {
  background: #3ecf70;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: 1;
  }

  .url-buttons {
    flex-direction: column;
  }
}
</style>
