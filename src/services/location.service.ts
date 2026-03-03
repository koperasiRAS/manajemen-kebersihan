import { createClient } from '@/lib/supabase/client';
import type { Location } from '@/lib/types';

const supabase = createClient();

export const locationService = {
  /**
   * Get all active locations
   */
  async getAll(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as Location[];
  },

  /**
   * Get all locations including inactive (owner)
   */
  async getAllIncludingInactive(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data || []) as Location[];
  },

  /**
   * Create a new location
   */
  async create(name: string, description?: string): Promise<Location> {
    const { data, error } = await supabase
      .from('locations')
      .insert({ name, description: description || null })
      .select()
      .single();

    if (error) throw error;
    return data as Location;
  },

  /**
   * Toggle location active status
   */
  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },
};
