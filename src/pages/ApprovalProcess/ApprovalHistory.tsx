import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, CheckCircle2, XCircle, Clock, Check, X, ShieldAlert, History } from 'lucide-react';
import { supabase } from '@/Utils/types/supabaseClient';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ApprovalRequest {
  id: string;
  reference_number: string;
  module_id: string;
  action_id: string;
  store_id: string;
  company_id: string;
  requested_by: string;
  payload: any;
  current_level: number;
  status: string;
  workflow_snapshot: any;
  created_at: string;
  main_modules: { module_name: string } | null;
  available_actions: { action_name: string } | null;
  store_mgmt: { name: string } | null;
  requested_user: { first_name: string; last_name: string; email: string } | null;
}

interface ApprovalHistoryLog {
  id: string;
  level: number;
  action: string;
  comments: string | null;
  action_date: string;
  approver_id?: string;
  approver: { first_name: string | null; last_name: string | null; email: string | null; } | null;
}

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'dd MMM yyyy, hh:mm a');
};

const getStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
    case 'IN_PROGRESS':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border border-blue-200">In Progress</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
  }
};

const getActionIcon = (action: string) => {
  switch (action.toUpperCase()) {
    case 'APPROVED':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'REJECTED':
      return <X className="h-4 w-4 text-red-600" />;
    case 'SUPER_ADMIN_APPROVED':
    case 'OVERRIDE_APPROVED':
      return <ShieldAlert className="h-4 w-4 text-purple-600" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-600" />;
  }
};

const ApprovalHistory: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSidebarOpen } = useOutletContext<{ isSidebarOpen: boolean }>() || { isSidebarOpen: true };
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ApprovalHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [visualLevel, setVisualLevel] = useState(0);
  const [animationFinished, setAnimationFinished] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (!loading && request) {
      const targetLevel = request.status === 'APPROVED' ? request.current_level + 1 : request.current_level;
      let currentVis = 0;
      
      const advance = () => {
        if (currentVis < targetLevel) {
          currentVis++;
          setVisualLevel(currentVis);
          timeoutId = setTimeout(advance, 1500);
        } else {
          setAnimationFinished(true);
        }
      };
      
      timeoutId = setTimeout(advance, 50);
    }
    
    return () => clearTimeout(timeoutId);
  }, [loading, request]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!id) return;
      
      try {
        // Fetch approval request details and its history logs
        const { data, error } = await supabase
          .from('approval_requests')
          .select(`
            *,
            main_modules ( module_name ),
            available_actions ( action_name ),
            store_mgmt ( name ),
            requested_user:user_mgmt!requested_by ( first_name, last_name, email ),
            approval_history (
              id,
              level,
              action,
              comments,
              action_date,
              approver_id,
              approver:user_mgmt!approver_id ( first_name, last_name, email )
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        
        setRequest(data as unknown as ApprovalRequest);
        
        let historyList = [...(data.approval_history || [])];

        // Find pending users for the current level
        const currentLevelSnapshot = Array.isArray(data.workflow_snapshot) 
          ? (data.workflow_snapshot as any[]).find((s: any) => s.level === data.current_level)
          : null;

        if (currentLevelSnapshot && Array.isArray(currentLevelSnapshot.approval_users) && data.status !== 'APPROVED' && data.status !== 'REJECTED') {
           const rejections = historyList.filter(h => h.action === 'REJECTED');
           const lastRejectionDate = rejections.length > 0 
               ? new Date(Math.max(...rejections.map(r => new Date(r.action_date).getTime())))
               : null;
               
           const currentCycleHistory = lastRejectionDate 
               ? historyList.filter(h => new Date(h.action_date) > lastRejectionDate)
               : historyList;

           const expectedUserIds = currentLevelSnapshot.approval_users.map((u: any) => typeof u === 'string' ? u : (u.id || u));
           const pendingUserIds = expectedUserIds.filter((uid: string) => {
              return !currentCycleHistory.some((h: any) => h.level === data.current_level && h.approver_id === uid);
           });

           if (pendingUserIds.length > 0) {
              const { data: pendingUsers } = await supabase
                .from('user_mgmt')
                .select('id, first_name, last_name, email')
                .in('id', pendingUserIds);

              if (pendingUsers) {
                 pendingUsers.forEach(pu => {
                    historyList.push({
                       id: `pending-${pu.id}`,
                       level: data.current_level,
                       action: 'PENDING',
                       comments: 'Waiting for approval',
                       action_date: '9999-12-31T23:59:59Z',
                       approver_id: pu.id,
                       approver: {
                          first_name: pu.first_name,
                          last_name: pu.last_name,
                          email: pu.email
                       }
                    });
                 });
              }
           }
        }
        
        // Sort history by date descending (newest first)
        const sortedHistory = historyList.sort(
          (a: any, b: any) => new Date(b.action_date).getTime() - new Date(a.action_date).getTime()
        );
        setHistoryLogs(sortedHistory);
        
      } catch (err: any) {
        console.error('Error fetching approval history:', err);
        toast.error('Failed to load approval history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [id]);

  if (loading) {
    return (
      <div className={`p-6 mx-auto space-y-6 ${isSidebarOpen ? 'max-w-7xl' : 'w-full'}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-48 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className={`p-6 mx-auto flex flex-col items-center justify-center min-h-[50vh] ${isSidebarOpen ? 'max-w-7xl' : 'w-full'}`}>
        <History className="h-12 w-12 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Approval Request Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/approval-process')}>
          Back to Approvals
        </Button>
      </div>
    );
  }

  // Parse workflow snapshot to determine total levels and their states
  const totalLevels = Array.isArray(request.workflow_snapshot) ? request.workflow_snapshot.length : 0;
  
  return (
    <div className={`p-6 mx-auto space-y-6 ${isSidebarOpen ? 'max-w-7xl' : 'w-full'}`}>
      {/* Header Navigation */}
      <div className="flex items-center space-x-2 pb-4 border-b border-gray-100">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/approval-process')} className="text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-800">Approval History</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Summary */}
        <Card className="lg:col-span-1 shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-100 py-4">
            <CardTitle className="text-lg font-semibold text-gray-800">Request Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-sm">
            <div>
              <p className="text-gray-500 font-medium mb-1">Reference Number</p>
              <p className="font-semibold">{request.reference_number || 'N/A'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 font-medium mb-1">Module</p>
                <p>{request.main_modules?.module_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Action</p>
                <p>{request.available_actions?.action_name || 'N/A'}</p>
              </div>
            </div>

            <div>
              <p className="text-gray-500 font-medium mb-1">Requested By</p>
              <p>{request.requested_user ? `${request.requested_user.first_name} ${request.requested_user.last_name}` : 'Unknown'}</p>
            </div>

            <div>
              <p className="text-gray-500 font-medium mb-1">Requested Date</p>
              <p>{formatDate(request.created_at)}</p>
            </div>

            {request.store_mgmt?.name && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Store</p>
                <p>{request.store_mgmt.name}</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500 font-medium">Overall Status</span>
                {getStatusBadge(request.status)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Current Level</span>
                <span className="font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {request.current_level} of {totalLevels}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline & Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Workflow Visualization */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 py-4">
              <CardTitle className="text-lg font-semibold text-gray-800">Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 pb-8 flex justify-center overflow-x-auto">
              <div className="flex items-start w-full max-w-3xl px-8 min-w-[300px]">
                {Array.isArray(request.workflow_snapshot) && request.workflow_snapshot.length > 0 ? (
                  <>
                    {request.workflow_snapshot.map((step: any, index: number, arr: any[]) => {
                      const level = step.level || index + 1;
                      
                      const displayLevel = visualLevel;

                      const isCompleted = level < displayLevel || (animationFinished && request.status === 'APPROVED' && level === request.current_level);
                      const isCurrent = level === displayLevel && (!animationFinished || request.status !== 'APPROVED') && request.status !== 'REJECTED';
                      const isRejected = level === displayLevel && animationFinished && request.status === 'REJECTED';

                      let circleColor = "bg-white border-gray-300 text-gray-400";
                      if (isRejected) circleColor = "bg-white border-red-500 text-red-500";
                      else if (isCompleted) circleColor = "bg-green-500 border-green-500 text-white";
                      else if (isCurrent) circleColor = "bg-white border-blue-500 text-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.2)]";

                      const node = (
                        <div key={`node-${index}`} className="flex flex-col items-center relative z-10 bg-white px-2 shrink-0">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors duration-500 ${circleColor}`}>
                            {isCompleted ? <Check className="h-4 w-4" /> : isRejected ? <X className="h-4 w-4" /> : level}
                          </div>
                          <span className={`text-xs mt-2 font-medium transition-colors duration-500 ${isCurrent || isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                            Level {level}
                          </span>
                        </div>
                      );

                      // Line logic based sequentially on visualLevel
                      let targetWidth = '0%';
                      let lineIsPulsing = false;
                      let currentLineColor = 'bg-gray-200';

                      if (visualLevel > level) {
                          targetWidth = '100%';
                          currentLineColor = 'bg-green-500';
                      } else if (visualLevel === level) {
                          if (level < request.current_level || request.status === 'APPROVED') {
                              targetWidth = '100%';
                              currentLineColor = 'bg-blue-400';
                          } else if (request.status !== 'REJECTED') {
                              // It's the actual current level in progress, calculate progress percentage
                              const rejectionsRender = historyLogs.filter((h: any) => h.action === 'REJECTED');
                              const lastRejectionDateRender = rejectionsRender.length > 0 
                                  ? new Date(Math.max(...rejectionsRender.map((r: any) => new Date(r.action_date).getTime())))
                                  : null;
                              const currentCycleRender = lastRejectionDateRender 
                                  ? historyLogs.filter((h: any) => new Date(h.action_date) > lastRejectionDateRender)
                                  : historyLogs;
                              const currentLevelApprovers = step.approval_users?.length || 1;
                              const currentLevelApproved = currentCycleRender.filter((h: any) => h.level === level && h.action === 'APPROVED').length;
                              const progressPercentage = Math.min(95, Math.max(5, (currentLevelApproved / currentLevelApprovers) * 100));
                              
                              targetWidth = `${progressPercentage}%`;
                              currentLineColor = 'bg-blue-400';
                              lineIsPulsing = true;
                          }
                      }

                      const line = (
                        <div key={`line-${index}`} className="flex-1 mt-4 relative z-0 flex items-center -mx-2">
                           <div className="relative w-full h-[2px]">
                               <div className="absolute top-0 bottom-0 left-0 w-full h-0 border-t-2 border-dashed border-gray-300" />
                               <div className="absolute top-0 bottom-0 left-0 transition-[width] duration-[1500ms] ease-out" style={{ width: targetWidth }}>
                                  <div className={`w-full h-full transition-colors duration-500 ${currentLineColor} ${lineIsPulsing ? 'animate-pulse rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`} />
                               </div>
                           </div>
                        </div>
                      );

                      return (
                        <React.Fragment key={`frag-${index}`}>
                          {node}
                          {line}
                        </React.Fragment>
                      );
                    })}

                    {/* End Node */}
                    <div className="flex flex-col items-center relative z-10 bg-white px-2 shrink-0">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors duration-500 ${(animationFinished && request.status === 'APPROVED') ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                        <Check className="h-4 w-4" />
                      </div>
                      <span className={`text-xs mt-2 font-medium transition-colors duration-500 ${(animationFinished && request.status === 'APPROVED') ? 'text-gray-800' : 'text-gray-400'}`}>
                        Complete
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full text-center text-sm text-gray-500">No workflow steps found</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Timeline Table */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-800">Action History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="w-[100px] text-center font-semibold">Level</TableHead>
                      <TableHead className="font-semibold">Approver</TableHead>
                      <TableHead className="font-semibold">Action</TableHead>
                      <TableHead className="font-semibold min-w-[200px]">Comments</TableHead>
                      <TableHead className="font-semibold text-right pr-8">Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center">
                          <div className="flex flex-col items-center text-gray-500">
                            <History className="h-8 w-8 mb-2 opacity-50" />
                            <p>No approval actions recorded yet.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="text-center font-medium">Lvl {log.level}</TableCell>
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              {log.approver
                                ? `${log.approver.first_name || ''} ${log.approver.last_name || ''}`.trim() || 'System / Unknown'
                                : 'System / Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.approver?.email || ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getActionIcon(log.action)}
                              <span className="capitalize font-medium text-gray-700">
                                {log.action.toLowerCase().replace(/_/g, ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            <span className="block truncate max-w-[250px]" title={log.comments || 'No comments'}>
                              {log.comments || <span className="text-gray-400 italic">No comments</span>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-gray-500 tabular-nums pr-8">
                            {log.action === 'PENDING' ? '-' : formatDate(log.action_date)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApprovalHistory;
