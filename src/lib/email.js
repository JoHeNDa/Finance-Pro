import { supabase } from './supabase';

export async function sendEmailNotification({
  to,
  subject,
  htmlBody,
  organizationName = '',
}) {
  try {
    // This calls a Supabase Edge Function (we'll create it next)
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, htmlBody, organizationName },
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    return null;
  }
}

export function formatTransactionEmail(tx, action, organizationName) {
  const date = new Date(tx.date).toLocaleDateString();
  const amount = tx.amount.toLocaleString();
  const vat = (tx.vat_amount || 0).toLocaleString();
  
  const emailTemplates = {
    CREATE: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">💰 New Transaction Added</h2>
        <p><strong>Organization:</strong> ${organizationName}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Type:</strong> ${tx.type}</p>
        <p><strong>Particular:</strong> ${tx.particular}</p>
        <p><strong>Amount:</strong> ${tx.type === 'Revenue' ? '£' : '-'}${amount}</p>
        <p><strong>VAT:</strong> £${vat}</p>
        <p><strong>Payment Mode:</strong> ${tx.payment_mode}</p>
        ${tx.description ? `<p><strong>Description:</strong> ${tx.description}</p>` : ''}
        <hr style="margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">This is an automated notification from IUS Finances.</p>
      </div>
    `,
    UPDATE: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">✏️ Transaction Updated</h2>
        <p><strong>Organization:</strong> ${organizationName}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Type:</strong> ${tx.type}</p>
        <p><strong>Particular:</strong> ${tx.particular}</p>
        <p><strong>Amount:</strong> ${tx.type === 'Revenue' ? '£' : '-'}${amount}</p>
        <p><strong>VAT:</strong> £${vat}</p>
        <p><strong>Payment Mode:</strong> ${tx.payment_mode}</p>
        <hr style="margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">This is an automated notification from IUS Finances.</p>
      </div>
    `,
    DELETE: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c62828;">🗑️ Transaction Deleted</h2>
        <p><strong>Organization:</strong> ${organizationName}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Type:</strong> ${tx.type}</p>
        <p><strong>Particular:</strong> ${tx.particular}</p>
        <p><strong>Amount:</strong> ${tx.type === 'Revenue' ? '£' : '-'}${amount}</p>
        <p><strong>VAT:</strong> £${vat}</p>
        <hr style="margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">This is an automated notification from IUS Finances.</p>
      </div>
    `,
  };
  
  return emailTemplates[action] || emailTemplates.CREATE;
}