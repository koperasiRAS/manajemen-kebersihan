import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verify auth - must be owner
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetId = params.id;

    // Prevent deleting yourself
    if (targetId === user.id) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Get employee name for audit log
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('name, role')
      .eq('id', targetId)
      .single();

    if (!targetUser || targetUser.role !== 'employee') {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 });
    }

    // Delete related records first (order matters for foreign keys)
    await supabaseAdmin.from('cleaning_schedules').delete().eq('user_id', targetId);
    await supabaseAdmin.from('discipline_log').delete().eq('user_id', targetId);
    await supabaseAdmin.from('cleaning_reports').delete().eq('user_id', targetId);
    await supabaseAdmin.from('audit_log').delete().eq('user_id', targetId);

    // Delete from users table
    const { error: deleteError } = await supabaseAdmin.from('users').delete().eq('id', targetId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (authDeleteError) {
      console.error('Failed to delete auth user:', authDeleteError);
      // Don't fail the request - the user record is already deleted
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'user_delete',
      target_type: 'user',
      target_id: targetId,
      details: { name: targetUser.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
