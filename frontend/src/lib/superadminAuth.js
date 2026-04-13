import { supabase } from './supabaseClient';

export const authenticateSuperAdmin = async (email, password) => {
  try {
    // Sign in first so RLS allows reading your own `users` row (anon cannot read it before login).
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData?.user) {
      return { success: false, error: 'Invalid superadmin credentials' };
    }

    const uid = authData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'super_admin') {
      await supabase.auth.signOut();
      return {
        success: false,
        error:
          profile && profile.role !== 'super_admin'
            ? 'This account is not a super admin'
            : 'Invalid superadmin credentials',
      };
    }

    return {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: 'super_admin',
        name: profile.name || 'Super Admin'
      },
    };
  } catch (error) {
    console.error('Superadmin authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
};

export const createSuperAdminUser = async () => {
  try {
    // Check if superadmin already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@societrack.com')
      .eq('role', 'super_admin')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingUser) {
      return { success: true, message: 'Superadmin already exists' };
    }

    // Create superadmin user in users table (without password column)
    const { error } = await supabase
      .from('users')
      .insert({
        id: 'superadmin-001',
        email: 'admin@societrack.com',
        role: 'super_admin',
        name: 'Super Admin',
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return { 
      success: true, 
      message: 'Superadmin created successfully',
      credentials: {
        email: 'admin@societrack.com',
        password: 'admin123'
      }
    };
  } catch (error) {
    console.error('Error creating superadmin:', error);
    return { success: false, error: error.message };
  }
};
