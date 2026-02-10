<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAlgorand } from '../composables/useAlgorand'
import { useApiEndpoint } from '../composables/useApiEndpoint'
import algosdk from 'algosdk'

const { apiUrl } = useApiEndpoint()

interface Checkout {
  id: string
  appId: string
  payeeWallet: string
  payeeName: string
  amount: string
  assetId: string
  note: string
  status: string
}

const { connectedAccount, isConnected, algodClient, signAndSendTransactions } = useAlgorand()

const checkout = ref<Checkout | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const paying = ref(false)
const showDetails = ref(true)

const formattedAmount = computed(() => {
  if (!checkout.value) return '0'
  return (Number(checkout.value.amount) / 1_000_000).toFixed(2)
})

const contractAddress = computed(() => {
  if (!checkout.value) return ''
  try {
    return algosdk.getApplicationAddress(BigInt(checkout.value.appId)).toString()
  } catch {
    return 'Invalid App ID'
  }
})

const transactionPreview = computed(() => {
  if (!checkout.value || !connectedAccount.value) return null

  return {
    txn1: {
      type: 'Asset Transfer',
      from: connectedAccount.value,
      to: contractAddress.value,
      amount: `${formattedAmount.value} USDC`,
      assetId: checkout.value.assetId,
    },
    txn2: {
      type: 'Application Call',
      appId: checkout.value.appId,
      method: 'payCheckout(axfer,string,address,string,uint64,string)void',
      args: [
        { name: 'payment', value: 'Asset Transfer (grouped)' },
        { name: 'checkoutId', value: checkout.value.id },
        { name: 'payeeWallet', value: checkout.value.payeeWallet },
        { name: 'payeeName', value: checkout.value.payeeName || '(none)' },
        { name: 'expectedAmount', value: checkout.value.amount },
        { name: 'note', value: checkout.value.note || '(none)' },
      ],
    },
  }
})

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const checkoutId = params.get('checkoutId')
  if (!checkoutId) {
    error.value = 'No checkout ID provided. Add ?checkoutId=XXX to the URL.'
    return
  }

  loading.value = true
  try {
    const res = await fetch(apiUrl(`/api/checkouts/${checkoutId}`))
    if (!res.ok) throw new Error('Checkout not found')
    checkout.value = await res.json()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load checkout'
  } finally {
    loading.value = false
  }
})

async function payCheckout() {
  if (!checkout.value || !connectedAccount.value) return

  paying.value = true
  error.value = null
  success.value = null

  try {
    const suggestedParams = await algodClient.value.getTransactionParams().do()
    const appId = BigInt(checkout.value.appId)
    const assetId = BigInt(checkout.value.assetId)
    const amount = BigInt(checkout.value.amount)
    const appAddr = algosdk.getApplicationAddress(appId).toString()

    // 1. Asset transfer to contract
    const assetTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: connectedAccount.value,
      receiver: appAddr,
      assetIndex: assetId,
      amount: amount,
      suggestedParams,
    })

    // 2. App call to payCheckout method using ARC-4 encoding
    // Method signature: payCheckout(axfer,string,address,string,uint64,string)void
    const abiMethod = new algosdk.ABIMethod({
      name: 'payCheckout',
      args: [
        { type: 'axfer', name: 'payment' },
        { type: 'string', name: 'checkoutId' },
        { type: 'address', name: 'payeeWallet' },
        { type: 'string', name: 'payeeName' },
        { type: 'uint64', name: 'expectedAmount' },
        { type: 'string', name: 'note' },
      ],
      returns: { type: 'void' },
    })

    // Encode ABI arguments (axfer is passed as transaction reference, not as arg)
    const checkoutIdEncoded = (abiMethod.args[1]!.type as algosdk.ABIType).encode(checkout.value.id)
    const payeeEncoded = (abiMethod.args[2]!.type as algosdk.ABIType).encode(checkout.value.payeeWallet)
    const payeeNameEncoded = (abiMethod.args[3]!.type as algosdk.ABIType).encode(checkout.value.payeeName || '')
    const amountEncoded = (abiMethod.args[4]!.type as algosdk.ABIType).encode(amount)
    const noteEncoded = (abiMethod.args[5]!.type as algosdk.ABIType).encode(checkout.value.note || '')

    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      sender: connectedAccount.value,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [
        abiMethod.getSelector(),  // 4-byte method selector
        checkoutIdEncoded,
        payeeEncoded,
        payeeNameEncoded,
        amountEncoded,
        noteEncoded,
      ],
      foreignAssets: [assetId],
      accounts: [checkout.value.payeeWallet],
      suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true },
    })

    // Group transactions
    algosdk.assignGroupID([assetTxn, appCallTxn])

    const txId = await signAndSendTransactions([assetTxn, appCallTxn])
    success.value = txId

    // Reload checkout to show updated status
    setTimeout(async () => {
      const res = await fetch(apiUrl(`/api/checkouts/${checkout.value!.id}`))
      if (res.ok) checkout.value = await res.json()
    }, 2000)
  } catch (e) {
    console.error('Payment error:', e)
    error.value = e instanceof Error ? e.message : 'Payment failed'
  } finally {
    paying.value = false
  }
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
</script>

<template>
  <div class="payment-form">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      Loading checkout...
    </div>

    <div v-else-if="error && !checkout" class="error-box">{{ error }}</div>

    <div v-else-if="checkout" class="payment-container">
      <!-- Checkout Card -->
      <div class="checkout-card">
        <div class="card-header">
          <h2>Checkout Payment</h2>
          <span :class="['status-badge', checkout.status]">{{ checkout.status }}</span>
        </div>

        <div class="amount-display">
          <span class="amount">{{ formattedAmount }}</span>
          <span class="currency">USDC</span>
        </div>

        <div class="checkout-details">
          <div class="detail-row">
            <span class="label">Checkout ID</span>
            <span class="value">{{ checkout.id }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Payee</span>
            <span class="value">{{ checkout.payeeName || shortenAddress(checkout.payeeWallet) }}</span>
          </div>
          <div v-if="checkout.note" class="detail-row">
            <span class="label">Note</span>
            <span class="value">{{ checkout.note }}</span>
          </div>
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>

        <div v-if="success" class="success-box">
          <div class="success-icon">✓</div>
          <div class="success-content">
            <strong>Payment Successful!</strong>
            <div class="tx-id">
              Transaction: <code>{{ shortenAddress(success) }}</code>
            </div>
          </div>
        </div>

        <button
          v-if="checkout.status === 'pending'"
          @click="payCheckout"
          :disabled="!isConnected || paying"
          class="pay-btn"
        >
          <span v-if="paying" class="btn-loading">
            <span class="spinner small"></span>
            Processing...
          </span>
          <span v-else-if="!isConnected">Connect Wallet First</span>
          <span v-else>Pay Now</span>
        </button>

        <div v-else class="paid-notice">
          This checkout has been {{ checkout.status }}.
        </div>
      </div>

      <!-- Smart Contract Details -->
      <div class="contract-panel">
        <div class="panel-header" @click="showDetails = !showDetails">
          <span class="panel-title">
            <span class="icon">📜</span>
            Smart Contract Details
          </span>
          <span class="toggle">{{ showDetails ? '−' : '+' }}</span>
        </div>

        <div v-show="showDetails" class="panel-body">
          <div class="contract-info">
            <div class="info-row">
              <span class="label">Contract Name</span>
              <span class="value">CheckoutPayment</span>
            </div>
            <div class="info-row">
              <span class="label">App ID</span>
              <span class="value mono">{{ checkout.appId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Contract Address</span>
              <span class="value mono small">{{ contractAddress }}</span>
            </div>
            <div class="info-row">
              <span class="label">Asset ID (USDC)</span>
              <span class="value mono">{{ checkout.assetId }}</span>
            </div>
          </div>

          <!-- Transaction Preview -->
          <div v-if="transactionPreview && isConnected" class="tx-preview">
            <h4>Transaction Preview</h4>
            <p class="tx-desc">This payment requires signing an atomic group of 2 transactions:</p>

            <div class="tx-card">
              <div class="tx-header">
                <span class="tx-number">1</span>
                <span class="tx-type">{{ transactionPreview.txn1.type }}</span>
              </div>
              <div class="tx-body">
                <div class="tx-row">
                  <span>From</span>
                  <code>{{ shortenAddress(transactionPreview.txn1.from) }}</code>
                </div>
                <div class="tx-row">
                  <span>To (Contract)</span>
                  <code>{{ shortenAddress(transactionPreview.txn1.to) }}</code>
                </div>
                <div class="tx-row highlight">
                  <span>Amount</span>
                  <code>{{ transactionPreview.txn1.amount }}</code>
                </div>
              </div>
            </div>

            <div class="tx-card">
              <div class="tx-header">
                <span class="tx-number">2</span>
                <span class="tx-type">{{ transactionPreview.txn2.type }}</span>
              </div>
              <div class="tx-body">
                <div class="tx-row">
                  <span>App ID</span>
                  <code>{{ transactionPreview.txn2.appId }}</code>
                </div>
                <div class="tx-row">
                  <span>Method</span>
                  <code class="method">{{ transactionPreview.txn2.method }}</code>
                </div>
                <div class="tx-args">
                  <span class="args-label">Arguments:</span>
                  <div v-for="arg in transactionPreview.txn2.args" :key="arg.name" class="arg-row">
                    <span class="arg-name">{{ arg.name }}</span>
                    <code class="arg-value">{{ arg.name === 'payeeWallet' ? shortenAddress(arg.value) : arg.value }}</code>
                  </div>
                </div>
              </div>
            </div>

            <div class="tx-flow">
              <div class="flow-step">
                <span class="flow-icon">💰</span>
                <span>USDC sent to contract</span>
              </div>
              <div class="flow-arrow">→</div>
              <div class="flow-step">
                <span class="flow-icon">📝</span>
                <span>Contract verifies & forwards</span>
              </div>
              <div class="flow-arrow">→</div>
              <div class="flow-step">
                <span class="flow-icon">🏪</span>
                <span>Payee receives USDC</span>
              </div>
            </div>
          </div>

          <div v-else-if="!isConnected" class="connect-prompt">
            Connect your wallet to preview transactions
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-form {
  max-width: 600px;
  margin: 0 auto;
}

.payment-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.checkout-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid #2a2a4e;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.status-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.pending {
  background: #fbbf2433;
  color: #fbbf24;
  border: 1px solid #fbbf2455;
}

.status-badge.paid {
  background: #4ade8033;
  color: #4ade80;
  border: 1px solid #4ade8055;
}

.amount-display {
  text-align: center;
  margin: 1.5rem 0;
}

.amount {
  font-size: 3.5rem;
  font-weight: 700;
  color: #fff;
}

.currency {
  font-size: 1.5rem;
  color: #4ade80;
  margin-left: 0.5rem;
  font-weight: 500;
}

.checkout-details {
  background: #0f0f1a;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid #1a1a2e;
}

.label {
  color: #666;
  font-size: 0.875rem;
}

.value {
  color: #fff;
  font-weight: 500;
}

.value.mono {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
}

.pay-btn {
  width: 100%;
  padding: 1.25rem;
  font-size: 1.1rem;
  font-weight: bold;
  background: linear-gradient(135deg, #ffee55 0%, #ffd700 100%);
  color: #000;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.pay-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 238, 85, 0.3);
}

.pay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.error-box {
  background: #ff6b6b22;
  border: 1px solid #ff6b6b55;
  color: #ff6b6b;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.success-box {
  background: #4ade8022;
  border: 1px solid #4ade8055;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.success-icon {
  width: 32px;
  height: 32px;
  background: #4ade80;
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.success-content {
  flex: 1;
}

.success-content strong {
  color: #4ade80;
  display: block;
  margin-bottom: 0.25rem;
}

.tx-id {
  font-size: 0.85rem;
  color: #888;
}

.tx-id code {
  color: #a0a0c0;
}

.paid-notice {
  text-align: center;
  color: #666;
  padding: 1rem;
  background: #1a1a2e;
  border-radius: 12px;
}

/* Contract Panel */
.contract-panel {
  background: #12121f;
  border-radius: 12px;
  border: 1px solid #1a1a2e;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background 0.2s;
}

.panel-header:hover {
  background: #1a1a2e;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
}

.icon {
  font-size: 1.1rem;
}

.toggle {
  color: #666;
  font-size: 1.25rem;
}

.panel-body {
  padding: 0 1.25rem 1.25rem;
  border-top: 1px solid #1a1a2e;
}

.contract-info {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid #1a1a2e;
}

.info-row .value.small {
  font-size: 0.75rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Transaction Preview */
.tx-preview {
  margin-top: 1.25rem;
}

.tx-preview h4 {
  font-size: 0.9rem;
  color: #fff;
  margin-bottom: 0.5rem;
}

.tx-desc {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 1rem;
}

.tx-card {
  background: #0f0f1a;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  border: 1px solid #1a1a2e;
}

.tx-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #1a1a2e;
}

.tx-number {
  width: 24px;
  height: 24px;
  background: #ffee55;
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
}

.tx-type {
  font-weight: 600;
  font-size: 0.875rem;
}

.tx-body {
  padding: 0.75rem 1rem;
}

.tx-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.8rem;
}

.tx-row span {
  color: #666;
}

.tx-row code {
  color: #a0a0c0;
  font-size: 0.8rem;
}

.tx-row.highlight code {
  color: #4ade80;
  font-weight: 600;
}

.tx-row code.method {
  font-size: 0.7rem;
  color: #ffee55;
}

.tx-args {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #2a2a4e;
}

.args-label {
  font-size: 0.75rem;
  color: #555;
  display: block;
  margin-bottom: 0.5rem;
}

.arg-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.75rem;
}

.arg-name {
  color: #888;
}

.arg-value {
  color: #a0a0c0;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Flow Diagram */
.tx-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #0a0a12;
  border-radius: 8px;
  flex-wrap: wrap;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: #888;
  text-align: center;
}

.flow-icon {
  font-size: 1.25rem;
}

.flow-arrow {
  color: #4ade80;
  font-weight: bold;
}

.connect-prompt {
  text-align: center;
  padding: 2rem;
  color: #555;
  font-size: 0.9rem;
  margin-top: 1rem;
}

/* Loading */
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

.spinner.small {
  width: 18px;
  height: 18px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 500px) {
  .checkout-card {
    padding: 1.5rem;
  }

  .amount {
    font-size: 2.5rem;
  }

  .currency {
    font-size: 1.25rem;
  }

  .tx-flow {
    flex-direction: column;
  }

  .flow-arrow {
    transform: rotate(90deg);
  }
}
</style>
