import { ref, computed } from 'vue'

export type EndpointId = 'local' | 'test' | 'production'

interface EndpointConfig {
  name: string
  url: string
}

const endpoints: Record<EndpointId, EndpointConfig> = {
  local: { name: 'Local', url: 'http://localhost:3001' },
  test: { name: 'Test', url: 'https://cloudoverturecheckout-production.up.railway.app' },
  production: { name: 'Production', url: '' },
}

// Restore from localStorage or default to 'local'
const stored = localStorage.getItem('api-endpoint') as EndpointId | null
const currentEndpoint = ref<EndpointId>(stored && endpoints[stored] ? stored : 'local')

export function useApiEndpoint() {
  const endpoint = computed(() => endpoints[currentEndpoint.value])
  const baseUrl = computed(() => endpoint.value.url)

  function switchEndpoint(id: EndpointId) {
    currentEndpoint.value = id
    localStorage.setItem('api-endpoint', id)
  }

  /** Build a full API URL. Accepts a path like '/api/checkouts' */
  function apiUrl(path: string): string {
    return baseUrl.value + path
  }

  return {
    endpointId: currentEndpoint,
    endpoint,
    baseUrl,
    endpoints,
    switchEndpoint,
    apiUrl,
  }
}
