import React, { useEffect, useState } from 'react';
import { supabase } from '@/Utils/types/supabaseClient';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

export const PendingApprovalBanner = () => {
    const [requestData, setRequestData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequest = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const requestId = searchParams.get('request_id');
            if (!requestId) {
                setLoading(false);
                return;
            }

            try {
                // Fetch approval request
                const { data, error } = await supabase
                    .from('approval_requests')
                    .select('*')
                    .eq('id', requestId)
                    .single();

                if (error) throw error;
                
                let requestDataObj: any = data;
                if (data?.requested_by) {
                    const { data: userData } = await supabase
                        .from('user_mgmt')
                        .select('first_name, last_name')
                        .eq('id', data.requested_by)
                        .single();
                        
                    if (userData) {
                        requestDataObj = {
                            ...data,
                            requested_by_user: userData
                        };
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

    let actionLabel = "Add";
    try {
        const payload = typeof requestData.payload === 'string' ? JSON.parse(requestData.payload) : requestData.payload;
        if (payload?.operations?.length) {
             const opType = payload.operations[0].type;
             if (opType === 'update') {
                 if (payload.operations[0].data?.is_active === false) {
                     actionLabel = 'Delete';
                 } else {
                     actionLabel = 'Edit';
                 }
             } else if (opType === 'insert') {
                 actionLabel = 'Add';
             }
        }
    } catch(e) {}

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
                    <h3 className="text-yellow-800 font-medium text-sm">Pending Approval ({actionLabel})</h3>
                    <p className="text-yellow-700 text-xs">
                        Requested by <span className="font-semibold">{requestedBy}</span> on {dateStr}
                    </p>
                </div>
            </div>
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium border border-yellow-200">
                Level {requestData.current_level}
            </div>
        </div>
    );
};
