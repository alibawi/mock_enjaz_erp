import { Navigate, Route, Routes } from 'react-router-dom'
import AssetsApp from './modules/assets/AssetsApp'
import { ASSETS_BASE } from './modules/assets/router'
import ContractsApp from './modules/contracts/ContractsApp'
import { CONTRACTS_BASE } from './modules/contracts/router'
import Hub from './shell/Hub'
import { Sidebar } from './shell/Sidebar'

export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path={`${ASSETS_BASE}/*`} element={<AssetsApp />} />
          <Route path={`${CONTRACTS_BASE}/*`} element={<ContractsApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}
