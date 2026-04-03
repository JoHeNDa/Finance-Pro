import { supabase } from './supabase';

export async function logAuditEvent({
  organizationId,
  userId,
  action,
  entityType,
  entityId,
  oldData = null,
  newData = null,
}) {
  try {
    // Get IP and user agent from the client
    const ipAddress = await fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => data.ip)
      .catch(() => null);
    
    const userAgent = navigator.userAgent;
    
    await supabase
      .from('audit_logs')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}