import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider as AssetsStoreProvider } from './modules/assets/data/store'
import { StoreProvider as ContractsStoreProvider } from './modules/contracts/data/store'
import { StoreProvider as MaintenanceStoreProvider } from './modules/maintenance/data/store'
import './index.css'

// Each module keeps its own store (own localStorage key, seed and data version); they are siblings, not merged.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssetsStoreProvider>
      <ContractsStoreProvider>
        <MaintenanceStoreProvider>
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </HashRouter>
        </MaintenanceStoreProvider>
      </ContractsStoreProvider>
    </AssetsStoreProvider>
  </StrictMode>,
)
