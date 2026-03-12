import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Catalog } from './pages/Catalog'
import { ToolDetail } from './pages/ToolDetail'
import { Procurement } from './pages/Procurement'
import { Contracts } from './pages/Contracts'
import { Accounts } from './pages/Accounts'
import { Versions } from './pages/Versions'
import { SpendAnalysis } from './pages/SpendAnalysis'
import { Optimization } from './pages/Optimization'
import { AiCostOptimization } from './pages/AiCostOptimization'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/:id" element={<ToolDetail />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/versions" element={<Versions />} />
          <Route path="/spend" element={<SpendAnalysis />} />
          <Route path="/optimization" element={<Optimization />} />
          <Route path="/ai-cost" element={<AiCostOptimization />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
