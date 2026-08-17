import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    CheckCircle,
    Clock,
    FileText,
    UserCheck,
    Award,
    ArrowLeft,
    CalendarCheck,
    RotateCcw,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/Utils/types/supabaseClient'

interface ApprovalStatus {
    status: string
    trail: string
    sequence_no: number
    isFinalized: boolean
    approvedBy?: string
    rejectedBy?: string
    date?: string
    comment?: string
    allApprovers?: string[]
}

function SalesReturnApprovalView() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [approvalSteps, setApprovalSteps] = useState<ApprovalStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [returnNumber, setReturnNumber] = useState('')
    const [userMap, setUserMap] = useState<Record<string, string>>({})

    useEffect(() => {
        const fetchSalesReturn = async () => {
            if (!id) {
                setError('No Sales Return ID provided.')
                setLoading(false)
                return
            }

            try {
                setLoading(true)

                const { data, error } = await supabase
                    .from('sales_return')
                    .select('sales_return_number, approval_status')
                    .eq('id', id)
                    .single()

                if (error) throw error

                let steps: ApprovalStatus[] = []

                if (Array.isArray(data.approval_status)) {
                    steps = data.approval_status
                        .filter(
                            (s: any) =>
                                s &&
                                typeof s === 'object' &&
                                typeof s.status === 'string' &&
                                typeof s.trail === 'string'
                        )
                        .map((s: any) => ({
                            status: s.status,
                            trail: s.trail,
                            sequence_no: s.sequence_no,
                            isFinalized: s.isFinalized,
                            approvedBy: s.approvedBy,
                            rejectedBy: s.rejectedBy,
                            date: s.date,
                            comment: s.comment,
                        }))
                }

                setApprovalSteps(steps)
                setReturnNumber(data.sales_return_number || '')

                const userIds = Array.from(
                    new Set(
                        steps
                            .flatMap(s => [s.approvedBy, s.rejectedBy])
                            .filter((uid): uid is string => typeof uid === 'string')
                    )
                )

                if (userIds.length > 0) {
                    const { data: users } = await supabase
                        .from('user_mgmt')
                        .select('id, first_name, last_name')
                        .in('id', userIds)

                    if (Array.isArray(users)) {
                        const map: Record<string, string> = {}
                        users.forEach(u => {
                            map[u.id] = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                        })
                        setUserMap(map)
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch sales return.')
            } finally {
                setLoading(false)
            }
        }

        fetchSalesReturn()
    }, [id])

    const getLevelIcon = (status: string, trail: string) => {
        const colorClass = trail === 'Approved'
            ? 'text-green-600'
            : trail === 'Rejected'
                ? 'text-red-600'
                : 'text-yellow-500'

        if (status.includes('Created')) {
            return <FileText className={`w-6 h-6 ${colorClass}`} />
        } else if (status.includes('Fully Approved') || (status.includes('Approved') && !status.includes('Level'))) {
            return <CheckCircle className={`w-6 h-6 ${colorClass}`} />
        } else if (status.includes('Approved')) {
            return <UserCheck className={`w-6 h-6 ${colorClass}`} />
        } else if (status.includes('Pending')) {
            return <Clock className={`w-6 h-6 ${colorClass}`} />
        } else if (status.includes('Rejected')) {
            return <RotateCcw className={`w-6 h-6 text-red-600`} />
        } else if (status.includes('In Progress')) {
            return <CalendarCheck className={`w-6 h-6 ${colorClass}`} />
        } else {
            return <Award className="w-6 h-6 text-blue-600" />
        }
    }

    const getLevelNumber = (status: string) => {
        const match = status.match(/Level (\d+)/)
        return match ? Number(match[1]) : null
    }

    const getDisplaySteps = (steps: ApprovalStatus[]) => {
        const latestByLevel: Record<number, ApprovalStatus & { allApprovers?: string[] }> = {}
        const approversByLevel: Record<number, string[]> = {}
        let stopAtLevel: number | null = null

        for (const step of steps) {
            const level = getLevelNumber(step.status)
            if (level === null) continue

            if (!approversByLevel[level]) {
                approversByLevel[level] = []
            }

            const uid = step.approvedBy || step.rejectedBy
            if (uid && !approversByLevel[level].includes(uid)) {
                approversByLevel[level].push(uid)
            }

            if (step.trail === 'Rejected' && (stopAtLevel === null || level < stopAtLevel)) {
                stopAtLevel = level
            }
        }

        for (const step of steps) {
            const level = getLevelNumber(step.status)
            if (level === null) continue

            if (!latestByLevel[level] || step.sequence_no > latestByLevel[level].sequence_no) {
                latestByLevel[level] = {
                    ...step,
                    allApprovers: approversByLevel[level] || [],
                }
            }
        }

        const sortedLevels = Object.keys(latestByLevel).map(Number).sort((a, b) => a - b)
        const display: ApprovalStatus[] = []

        for (const level of sortedLevels) {
            if (stopAtLevel !== null && level > stopAtLevel) break
            display.push(latestByLevel[level])
            if (latestByLevel[level].trail === 'Rejected') break
        }

        return display
    }

    const displaySteps = getDisplaySteps(approvalSteps)

    const completedSteps = approvalSteps.filter(s => s.trail === 'Approved').length
    const totalSteps = approvalSteps.length
    const remainingSteps = totalSteps - completedSteps

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <Card className="min-h-[85vh] shadow-sm">
                    <CardHeader className="rounded-t-lg border-b pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center space-x-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(-1)}
                                    className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
                                >
                                    <ArrowLeft className="h-5 w-5 text-blue-600" />
                                </Button>
                                <div>
                                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                        Sales Return Approval View
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Track approval workflows for sales returns
                                    </CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <div className="space-y-8">
                            {/* Title */}
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-gray-900 mb-2">
                                    Sales Return Approval Workflow
                                </h2>
                                <p className="text-gray-600">
                                    Track the progress of your sales return through each approval level
                                </p>
                                <p className="mt-5 text-sm text-gray-900">
                                    Sales Return{' '}
                                    <span className="font-semibold">{returnNumber}</span>
                                </p>
                            </div>

                            {/* Loading / Error */}
                            {loading ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                </div>
                            ) : error ? (
                                <div className="text-center text-red-600 font-medium py-8">{error}</div>
                            ) : displaySteps.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <FileText className="h-12 w-12 text-gray-300 mb-3" />
                                    <p className="text-base font-medium text-gray-500">No approval steps found</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        The approval workflow has not started yet for this sales return
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Approval Steps Timeline */}
                                    <div className="relative w-full pt-5 pb-10">
                                        {/* Horizontal Line */}
                                        <div className="absolute top-11 left-0 right-0 h-0.5 bg-gray-300" />

                                        {/* Steps */}
                                        <div className="flex justify-center items-start w-full relative px-4 gap-x-6">
                                            {displaySteps.map((step, idx) => {
                                                const IconComponent = getLevelIcon(step.status, step.trail)

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex flex-col items-center text-center w-45"
                                                    >
                                                        {/* Icon */}
                                                        <div
                                                            className={`z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 border-white shadow-md
                                                                ${step.trail === 'Approved'
                                                                    ? 'bg-green-100'
                                                                    : step.trail === 'Rejected'
                                                                        ? 'bg-red-200'
                                                                        : step.trail === 'In Progress'
                                                                            ? 'bg-blue-100'
                                                                            : 'bg-gray-200'
                                                                }`}
                                                        >
                                                            {IconComponent}
                                                        </div>

                                                        {/* Status Card */}
                                                        <div
                                                            className={`mt-4 px-4 py-4 rounded-lg text-xs font-medium w-45
                                                                ${step.trail === 'Approved'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : step.trail === 'Rejected'
                                                                        ? 'bg-red-200 text-red-800'
                                                                        : step.trail === 'In Progress'
                                                                            ? 'bg-blue-100 text-blue-800'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            <div className="font-semibold mb-1">{step.status}</div>

                                                            {/* Comment */}
                                                            {step.comment && (
                                                                <div className="text-[10px] mt-1 italic opacity-75 truncate">
                                                                    "{step.comment}"
                                                                </div>
                                                            )}

                                                            {/* Approvers */}
                                                            {step.allApprovers && step.allApprovers.length > 0 && (
                                                                <div className="text-[10px] mt-2 space-y-1">
                                                                    {step.allApprovers.map((approverId, i) => (
                                                                        <div key={i} className="truncate">
                                                                            {step.trail === 'Approved' && (
                                                                                <span className="text-green-700">
                                                                                    ✓ {userMap[approverId] || approverId}
                                                                                </span>
                                                                            )}
                                                                            {step.trail === 'Rejected' && (
                                                                                <span className="text-red-700">
                                                                                    ✗ {userMap[approverId] || approverId}
                                                                                </span>
                                                                            )}
                                                                            {step.trail !== 'Approved' && step.trail !== 'Rejected' && (
                                                                                <span className="text-gray-700">
                                                                                    {userMap[approverId] || approverId}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Current Status Summary */}
                                    <div className="mt-2 p-6 bg-gray-50 rounded-lg flex flex-col items-center">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h3>
                                        <div className="flex justify-center w-full">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-auto">
                                                <div className="bg-white p-8 rounded-xl border min-w-[220px] max-w-[320px] text-base shadow-md">
                                                    <div className="flex items-center space-x-2">
                                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                                        <span className="font-medium text-green-800">Completed</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {completedSteps} out of {totalSteps} steps
                                                    </p>
                                                </div>
                                                <div className="bg-white p-8 rounded-xl border min-w-[220px] max-w-[320px] text-base shadow-md">
                                                    <div className="flex items-center space-x-2">
                                                        <Award className="w-5 h-5 text-blue-600" />
                                                        <span className="font-medium text-blue-800">Remaining</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {remainingSteps} steps to complete
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default SalesReturnApprovalView