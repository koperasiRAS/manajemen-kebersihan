import { createClient } from '@/lib/supabase/client';
import type { User } from '@/lib/types';

const supabase = createClient();

export const userService = {
  /**
   * Get all employees (owner only)
   */
  async getAllEmployees(includeInactive = false): Promise<User[]> {
    let query = supabase
      .from('users')
      .select('*')
      .eq('role', 'employee')
      .order('name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as User[];
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data as User;
  },

  /**
   * Create a new employee (owner only)
   * Creates both auth user and users table entry
   */
  async createEmployee(
    email: string,
    password: string,
    name: string,
    phoneNumber?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Call server-side API to create user (needs service role)
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone_number: phoneNumber }),
      });

      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to create employee' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Deactivate/activate an employee
   */
  async toggleActive(userId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Update employee details
   */
  async updateEmployee(userId: string, updates: { name?: string; phone_number?: string }): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
  },
};
