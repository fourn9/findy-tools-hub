export type ToolCategory =
  | 'CI/CD'
  | 'モニタリング'
  | 'セキュリティ'
  | 'コミュニケーション'
  | 'プロジェクト管理'
  | 'ドキュメント'
  | 'データベース'
  | 'クラウドインフラ'
  | 'IDE/エディタ'
  | 'テスト'

export type ContractStatus = 'active' | 'trial' | 'pending' | 'expired' | 'cancelled'

export type RequestStatus = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'contracted'

export type BillingCycle = 'monthly' | 'yearly'

export interface Review {
  id: string
  userId: string
  userName: string
  userRole: string
  rating: number
  title: string
  body: string
  pros: string[]
  cons: string[]
  createdAt: string
  helpful: number
}

export interface PricingPlan {
  name: string
  price: number
  cycle: BillingCycle
  currency: 'JPY' | 'USD'
  perSeat: boolean
  features: string[]
}

export interface Tool {
  id: string
  name: string
  category: ToolCategory
  logoUrl: string
  description: string
  shortDescription: string
  website: string
  rating: number
  reviewCount: number
  reviews: Review[]
  pricingPlans: PricingPlan[]
  tags: string[]
  isPopular: boolean
  isFindyVerified: boolean
}

export interface Contract {
  id: string
  toolId: string
  toolName: string
  toolLogo: string
  status: ContractStatus
  plan: string
  seats: number
  usedSeats: number
  monthlyAmount: number
  billingCycle: BillingCycle
  startDate: string
  renewalDate: string
  owner: string
  department: string
}

export interface AccountMember {
  id: string
  name: string
  email: string
  role: string
  department: string
  assignedTools: string[]
  lastActive: string
}

export interface ProcurementRequest {
  id: string
  toolId: string
  toolName: string
  toolLogo: string
  requesterId: string
  requesterName: string
  status: RequestStatus
  reason: string
  expectedSeats: number
  monthlyBudget: number
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  updatedAt: string
  approverName?: string
  approverComment?: string
}

export interface SpendRecord {
  month: string
  amount: number
  breakdown: { toolId: string; toolName: string; amount: number }[]
}

export interface VersionInfo {
  toolId: string
  toolName: string
  currentVersion: string
  latestVersion: string
  releaseDate: string
  changelogUrl: string
  hasUpdate: boolean
}
