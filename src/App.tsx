import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Catalog } from './pages/Catalog'
import { ToolDetail } from './pages/ToolDetail'
import { Procurement } from './pages/Procurement'
import { Contracts } from './pages/Contracts'
import { Accounts } from './pages/Accounts'
import { SpendAnalysis } from './pages/SpendAnalysis'
import { AiCostOptimization } from './pages/AiCostOptimization'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ai-cost" element={<AiCostOptimization />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/spend" element={<SpendAnalysis />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/:id" element={<ToolDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
