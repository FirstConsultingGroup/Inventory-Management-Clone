import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/Utils/types/supabaseClient';
import toast from 'react-hot-toast';

interface UseApprovalDocumentProps {
    /** The standard record ID (if not viewing a pending request) */
    id?: string;
    /** The main module table name to fetch the original record from (e.g. 'customer_mgmt') */
    tableName: string;
    /** A function that can optionally fetch or resolve extra data needed by the module */
    resolveRelations?: (payload: any) => Promise<any>;
}

interface ApprovalRequestDetails {
    requestedBy: string;
    level: number;
    status: string;
    createdAt: string;
    referenceNumber: string | null;
}

export const useApprovalDocument = <T = any>({ id, tableName, resolveRelations }: UseApprovalDocumentProps) => {
    const [searchParams] = useSearchParams();
    const requestId = searchParams.get('request_id');
    const isPending = !!requestId;

    const [data, setData] = useState<T | null>(null);
    const [originalData, setOriginalData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [actionName, setActionName] = useState<string>('');
    const [requestDetails, setRequestDetails] = useState<ApprovalRequestDetails | null>(null);

    useEffect(() => {
        if (!id && !isPending) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                if (isPending) {
                    // 1. Fetch from approval_requests
                    const { data: requestData, error: requestError } = await (supabase as any)
                        .from('approval_requests')
                        .select(`
                            id,
                            payload,
                            current_level,
                            status,
                            created_at,
                            reference_number,
                            actions:action_id(action_name),
                            users:requested_by(first_name, last_name)
                        `)
                        .eq('id', requestId)
                        .single();

                    if (requestError) throw requestError;

                    if (!requestData) {
                        throw new Error('Approval request not found');
                    }

                    const action = Array.isArray(requestData.actions) 
                        ? requestData.actions[0]?.action_name 
                        : (requestData.actions as any)?.action_name || 'Unknown Action';

                    setActionName(action);

                    const requestedByObj = Array.isArray(requestData.users) 
                        ? requestData.users[0] 
                        : (requestData.users as any);

                    setRequestDetails({
                        requestedBy: requestedByObj ? `${requestedByObj.first_name || ''} ${requestedByObj.last_name || ''}`.trim() : 'Unknown',
                        level: requestData.current_level,
                        status: requestData.status,
                        createdAt: requestData.created_at,
                        referenceNumber: requestData.reference_number
                    });

                    let finalPayload = requestData.payload;

                    // 2. Resolve any relationships explicitly passed in the hook call
                    if (resolveRelations) {
                        try {
                            finalPayload = await resolveRelations(finalPayload);
                        } catch (err) {
                            console.error('Failed to resolve relations for payload', err);
                            toast.error('Failed to load all related data for this document');
                        }
                    }

                    // 3. For Edit / Delete, try to fetch the original record and merge
                    if (action === 'Edit' || action === 'Delete') {
                        let recordId = finalPayload.id || finalPayload[`${tableName}_id`] || id;
                        
                        if (!recordId && finalPayload.operations && Array.isArray(finalPayload.operations)) {
                            const op = finalPayload.operations.find((o: any) => o.table === tableName);
                            if (op) {
                                recordId = op.match?.id || op.conditions?.id || op.data?.id;
                            }
                        }

                        if (recordId) {
                            const { data: originalRecord, error: originalError } = await (supabase as any)
                                .from(tableName)
                                .select('*')
                                .eq('id', recordId)
                                .single();

                            if (!originalError && originalRecord) {
                                setOriginalData(originalRecord as T);
                                if (action === 'Edit') {
                                    // Merge original with payload proposed changes
                                    finalPayload = { ...originalRecord, ...finalPayload };
                                } else {
                                    // For delete, we just show the original record
                                    finalPayload = originalRecord;
                                }
                            }
                        }
                    }

                    setData(finalPayload as T);
                } else if (id) {
                    // Standard fetch for non-pending documents
                    const { data: record, error: recordError } = await (supabase as any)
                        .from(tableName)
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (recordError) throw recordError;
                    
                    if (resolveRelations && record) {
                         // Even standard records might need relations resolved if the module doesn't use SQL views
                         const resolved = await resolveRelations(record);
                         setData(resolved as T);
                    } else {
                        setData(record as T);
                    }
                } else {
                    // This block should theoretically be unreachable now due to the early return, but kept for safety.
                    return;
                }
            } catch (err: any) {
                console.error('Error fetching document data:', err);
                setError(err.message || 'Failed to load document');
                toast.error('Failed to load document');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, requestId, isPending, tableName, resolveRelations]);

    return {
        data,
        originalData,
        isPending,
        actionName,
        requestDetails,
        isLoading,
        error
    };
};
