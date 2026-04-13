import { supabase } from './supabaseClient';

const SUPER_EMAIL = 'admin@societrack.com';
const SUPER_PASSWORD = 'admin123';

/**
 * One-time setup: creates Supabase Auth user + public.users row (super_admin).
 * The old flow inserted a fake id ("superadmin-001") from the anon client, which
 * usually fails (UUID type + RLS). This uses signUp/signIn so RLS sees auth.uid().
 */
export const setupSuperAdmin = async () => {
  try {
    const { data: existingRow, error: existingErr } = await supabase
      .from('users')
      .select('id,email,role')
      .eq('email', SUPER_EMAIL)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (existingErr && existingErr.code !== 'PGRST116') {
      console.error('setupSuperAdmin check:', existingErr);
      return { success: false, error: existingErr.message };
    }

    if (existingRow) {
      return {
        success: true,
        message: 'Superadmin row already exists. Use Super Admin login with the credentials below.',
        credentials: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
      };
    }

    let userId = null;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: SUPER_EMAIL,
      password: SUPER_PASSWORD,
      options: {
        data: { name: 'Super Admin' },
      },
    });

    if (signUpData?.user?.id) {
      userId = signUpData.user.id;
    }

    if (!userId && signUpError) {
      const msg = (signUpError.message || '').toLowerCase();
      const already =
        msg.includes('already') ||
        msg.includes('registered') ||
        signUpError.status === 422;

      if (already) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: SUPER_EMAIL,
          password: SUPER_PASSWORD,
        });
        if (signInError || !signInData?.user?.id) {
          return {
            success: false,
            error:
              signInError?.message ||
              'Auth user may exist with a different password. In Supabase → Authentication → Users, reset password for admin@societrack.com or delete the user and run setup again.',
          };
        }
        userId = signInData.user.id;
      } else {
        return {
          success: false,
          error:
            signUpError.message ||
            'Could not create auth user. Check Supabase Auth settings (e.g. email confirmation) and .env keys.',
        };
      }
    }

    if (!userId) {
      return {
        success: false,
        error:
          'No user id from sign up. If email confirmation is on, confirm the email first or disable confirmations for development in Supabase → Authentication → Providers → Email.',
      };
    }

    const { data: profileRow } = await supabase.from('users').select('id,role,email').eq('id', userId).maybeSingle();

    if (profileRow) {
      if (profileRow.role !== 'super_admin') {
        const { error: upErr } = await supabase
          .from('users')
          .update({ role: 'super_admin', email: SUPER_EMAIL, name: 'Super Admin' })
          .eq('id', userId);
        if (upErr) {
          await supabase.auth.signOut();
          return { success: false, error: upErr.message };
        }
      }
      await supabase.auth.signOut();
      return {
        success: true,
        message: 'Superadmin profile is ready (auth trigger may have created the row).',
        credentials: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
      };
    }

    const row = {
      id: userId,
      email: SUPER_EMAIL,
      role: 'super_admin',
      name: 'Super Admin',
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('users').insert(row);

    if (insertError) {
      if (insertError.code === '23505') {
        await supabase.auth.signOut();
        return {
          success: true,
          message: 'Superadmin profile already present.',
          credentials: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
        };
      }
      await supabase.auth.signOut();
      return {
        success: false,
        error: `${insertError.message} — You may need a DB policy allowing users to insert their own profile, or run the SQL fallback shown on the setup page.`,
      };
    }

    await supabase.auth.signOut();

    return {
      success: true,
      message: 'Superadmin created. Log in at /superadmin with the credentials below.',
      credentials: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
    };
  } catch (error) {
    console.error('Setup error:', error);
    return { success: false, error: error.message || 'Setup failed' };
  }
};
