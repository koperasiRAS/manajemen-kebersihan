import { createClient } from '@/lib/supabase/client';
import type { CleaningSchedule } from '@/lib/types';

const supabase = createClient();

export const scheduleService = {
  /**
   * Get schedules for a specific user
   */
  async getUserSchedule(userId: string): Promise<CleaningSchedule[]> {
    const { data, error } = await supabase
      .from('cleaning_schedules')
      .select('*, location:locations(id, name)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('day_of_week', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data || []) as CleaningSchedule[];
  },

  /**
   * Get all schedules (owner)
   */
  async getAll(): Promise<CleaningSchedule[]> {
    const { data, error } = await supabase
      .from('cleaning_schedules')
      .select('*, user:users(id, name), location:locations(id, name)')
      .eq('is_active', true)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('day_of_week', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data || []) as CleaningSchedule[];
  },

  /**
   * Set schedule for an employee
   */
  async setSchedule(userId: string, dayOfWeek?: number, locationId?: string): Promise<void> {
    // This method is deprecated as the UI now handles upserts directly
    // and partial unique indexes prevent simple upsert with onConflict.
    const payload: any = {
      user_id: userId,
      location_id: locationId || null,
      is_active: true,
    };
    if (dayOfWeek !== undefined && dayOfWeek !== null) {
      payload.day_of_week = dayOfWeek;
    }
    
    const { error } = await supabase
      .from('cleaning_schedules')
      .upsert(payload);

    if (error) throw error;
  },

  /**
   * Remove a schedule
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    const { error } = await supabase
      .from('cleaning_schedules')
      .update({ is_active: false })
      .eq('id', scheduleId);

    if (error) throw error;
  },
};
