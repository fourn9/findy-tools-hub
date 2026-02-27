import { ContractStatus, RequestStatus } from '../types'

const contractStatusMap: Record<ContractStatus, { label: string; className: string }> = {
  active: { label: '利用中', className: 'bg-green-100 text-green-700' },
  trial: { label: 'トライアル', className: 'bg-blue-100 text-blue-700' },
  pending: { label: '手続き中', className: 'bg-yellow-100 text-yellow-700' },
  expired: { label: '期限切れ', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'キャンセル', className: 'bg-gray-100 text-gray-600' },
}

const requestStatusMap: Record<RequestStatus, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-600' },
  reviewing: { label: '審査中', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '承認済み', className: 'bg-blue-100 text-blue-700' },
  rejected: { label: '却下', className: 'bg-red-100 text-red-700' },
  contracted: { label: '契約済み', className: 'bg-green-100 text-green-700' },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { label, className } = contractStatusMap[status]
  return <span className={`badge ${className}`}>{label}</span>
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { label, className } = requestStatusMap[status]
  return <span className={`badge ${className}`}>{label}</span>
}
