import { supabase } from './supabase';

export async function exportTransactions(organizationId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  
  // Create CSV
  const headers = ['Date', 'Type', 'Particular', 'Description', 'Amount', 'VAT', 'Payment Mode', 'Recorded By', 'Receipt URL', 'Timestamp'];
  const rows = data.map(tx => [
    tx.date,
    tx.type,
    tx.particular,
    tx.description || '',
    tx.amount,
    tx.vat_amount || 0,
    tx.payment_mode,
    tx.user_id,
    tx.receipt_url || '',
    tx.timestamp,
  ]);
  
  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_backup_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  return { success: true, count: data.length };
}