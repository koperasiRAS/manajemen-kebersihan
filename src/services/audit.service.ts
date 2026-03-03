import { createClient } from '@/lib/supabase/client';
import type { AuditLogEntry } from '@/lib/types';

const supabase = createClient();

export const auditService = {
  /**
   * Log an action to the audit trail
   */
  async log(
    action: string,
    targetType?: string,
    targetId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user?.id || null,
        action,
        target_type: targetType || null,
        target_id: targetId || null,
        details: details || null,
      });
    } catch (error) {
      console.warn('[Audit] Failed to log action:', error);
      // Don't throw — audit logging should never break the app
    }
  },

  /**
   * Get audit logs (owner only)
   */
  async getLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, user:users(id, name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as AuditLogEntry[];
  },

  /**
   * Get audit logs filtered by action type
   */
  async getLogsByAction(action: string, limit = 50): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, user:users(id, name)')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AuditLogEntry[];
  },
};
