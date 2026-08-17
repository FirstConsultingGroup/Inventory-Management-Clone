import { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import toast from "react-hot-toast";

type ExportCSVParams<T> = {
  reportTitle: string;
  headers: string[];
  rowMapper: (row: T) => (string | number)[];
  supabaseClient: SupabaseClient;
  fetcher?: () => Promise<T[]>; // Optional custom fetcher
  rpcName?: string;             // Optional RPC name
  rpcParams?: Record<string, any>; // RPC params
  onError?: (error: any) => void;
};

export async function exportSupabaseTableToCSV<T>({
  reportTitle,
  headers,
  rowMapper,
  supabaseClient,
  fetcher,
  rpcName,
  rpcParams,
  onError,
}: ExportCSVParams<T>) {
  try {
    let resultData: T[] = [];

    if (fetcher) {
      resultData = await fetcher();
    } else if (rpcName) {
      const { data, error }: any = await supabaseClient.rpc(rpcName, rpcParams);
      if (error) throw error;
      resultData = data?.data || [];
    } else {
      throw new Error('Either `fetcher` or `rpcName` must be provided.');
    }

    const rows = resultData.map(rowMapper);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    const filename = `${reportTitle.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${reportTitle} export completed successfully!`);
  } catch (err) {
    console.error('CSV Export Error:', err);
    onError?.(err);
  }
}
