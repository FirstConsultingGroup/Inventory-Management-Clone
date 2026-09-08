import React, { useEffect, useState } from 'react';
import { supabase } from '@/Utils/types/supabaseClient';
import { Clock, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { getApprovalEditPath } from '@/Utils/approvalRoutes';

export const PendingApprovalBanner = () => {
    const [requestData, setRequestData] = useState<any>(null);
    const [actionName, setActionName] = useState<string>('Add');
    const [moduleName, setModuleName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [canEdit, setCanEdit] = useState(false);
    const navigate = useNavigate();
    const { id: entityId } = useParams<{ id: string }>();

    const isEditPage = window.location.pathname.includes('/edit');

    useEffect(() => {
        const fetchRequest = async () => {
            if (isEditPage) {
                setLoading(false);
                return;
            }

            const searchParams = new URLSearchParams(window.location.search);
            const requestId = searchParams.get('request_id');
            
            if (!requestId && !entityId) {
                setLoading(false);
                return;
            }

            try {
                let data: any = null;
                let error: any = null;

                if (requestId) {
                    const result = await supabase
                        .from('approval_requests')
                        .select('*, available_actions(action_name), main_modules(module_name)')
                        .eq('id', requestId)
                        .single();
                    data = result.data;
                    error = result.error;
                } else if (entityId) {
                    const result = await supabase
                        .from('approval_requests')
                        .select('*, available_actions(action_name), main_modules(module_name)')
                        .eq('entity_id', entityId)
                        .in('status', ['PENDING', 'IN_PROGRESS', 'REJECTED'])
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();
                    data = result.data;
                    if (result.error && result.error.code !== 'PGRST116') {
                        error = result.error;
                    }
                }

                if (error) throw error;
                if (!data) {
                    setLoading(false);
                    return;
                }
                
                let requestDataObj: any = data;
                
                // Fetch user data
                if (data?.requested_by) {
                    const { data: userData } = await supabase
                        .from('user_mgmt')
                        .select('first_name, last_name')
                        .eq('id', data.requested_by)
                        .single();
                        
                    if (userData) {
                        requestDataObj.requested_by_user = userData;
                    }
                }
                
                // Fetch Action Name
                let currentActionName = data?.available_actions?.action_name || '';
                if (!currentActionName && data?.action_id) {
                    const { data: actionData } = await supabase
                        .from('available_actions')
                        .select('action_name')
                        .eq('id', data.action_id)
                        .single();
                    if (actionData?.action_name) {
                        currentActionName = actionData.action_name;
                    }
                }
                if (currentActionName) {
                    setActionName(currentActionName);
                }

                // Fetch Module Name
                let currentModuleName = data?.main_modules?.module_name || '';
                if (!currentModuleName && data?.module_id) {
                    const { data: moduleData } = await supabase
                        .from('main_modules')
                        .select('module_name')
                        .eq('id', data.module_id)
                        .single();
                    if (moduleData?.module_name) {
                        currentModuleName = moduleData.module_name;
                    }
                }
                if (currentModuleName) {
                    setModuleName(currentModuleName);
                }

                // Check Edit permissions - only available if module action is 'Add' or 'Edit'
                const isAddOrEdit = ['add', 'edit'].includes((currentActionName || '').trim().toLowerCase());
                const userJson = localStorage.getItem("userData");
                const currentUser = userJson ? JSON.parse(userJson) : null;
                if (currentUser && isAddOrEdit) {
                    if (data.requested_by === currentUser.id) {
                        setCanEdit(true);
                    } else if (data.workflow_snapshot) {
                        const currentStep = Array.isArray(data.workflow_snapshot)
                            ? data.workflow_snapshot.find((s: any) => s.level === data.current_level)
                            : null;
                        if (currentStep?.can_edit_document) {
                            const approvers = currentStep.approval_users?.map((u: any) => typeof u === 'string' ? u : u.id) || [];
                            if (approvers.includes(currentUser.id)) {
                                setCanEdit(true);
                            }
                        }
                    }
                }

                setRequestData(requestDataObj);
            } catch (error) {
                console.error("Error fetching approval request for banner", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequest();
    }, []);

    if (loading || !requestData) return null;

    const requestedBy = requestData.requested_by_user 
        ? `${requestData.requested_by_user.first_name} ${requestData.requested_by_user.last_name}`
        : "Unknown User";

    const dateStr = requestData.created_at ? format(new Date(requestData.created_at), 'M/d/yyyy') : '';

    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md flex items-center justify-between shadow-sm">
            <div className="flex items-center">
                <div className="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                    <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                    <h3 className="text-yellow-800 font-medium text-sm">Pending Approval ({actionName})</h3>
                    <p className="text-yellow-700 text-xs">
                        Requested by <span className="font-semibold">{requestedBy}</span> on {dateStr}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {canEdit && (
                    <Button 
                        size="sm" 
                        variant="outline"
                        className="bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100 shadow-sm"
                        onClick={() => {
                            const path = getApprovalEditPath(moduleName, requestData.entity_id || '', requestData.id);
                            if (path) {
                                navigate(path);
                            }
                        }}
                    >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Document
                    </Button>
                )}
                <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium border border-yellow-200">
                    Level {requestData.current_level}
                </div>
            </div>
        </div>
    );
};