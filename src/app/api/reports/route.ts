import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/utils';
import { MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const photo = formData.get('photo') as File | null;
    const notes = formData.get('notes') as string | null;

    // Validate photo
    if (!photo) {
      return NextResponse.json(
        { error: 'Photo is required.' },
        { status: 400 }
      );
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(photo.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted: JPG, PNG, WebP.' },
        { status: 400 }
      );
    }

    if (photo.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit.' },
        { status: 400 }
      );
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('cleaning_reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('submission_date', today);

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: 'Maximum daily cleaning reports reached (3).' },
        { status: 400 }
      );
    }

    // Upload photo
    const ext = photo.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('cleaning-photos')
      .upload(fileName, photo, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload photo.' },
        { status: 500 }
      );
    }

    // Insert report
    const sanitizedNotes = notes ? sanitizeInput(notes) : null;

    const { data: report, error: insertError } = await supabase
      .from('cleaning_reports')
      .insert({
        user_id: user.id,
        photo_url: fileName,
        notes: sanitizedNotes,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error('Report submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if owner
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('cleaning_reports')
      .select('*, user:users(id, name)')
      .order('submitted_at', { ascending: false })
      .limit(200);

    if (profile?.role !== 'owner') {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: data });
  } catch (error) {
    console.error('Report fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
