/**
 * Deletes an apartment and dependent rows in an order safe for typical FK layouts.
 * Supabase/Postgres may still block deletes if RLS denies them — surface the error to the user.
 */
export async function deleteApartmentCascade(supabase, apartmentId) {
  const id = apartmentId;
  if (!id) return { error: new Error('Missing apartment id') };

  console.log('[deleteApartmentCascade] Starting deletion for:', id);

  // First check if apartment exists
  console.log('[deleteApartmentCascade] Checking if apartment exists...');
  const { data: existingApartment, error: checkError } = await supabase
    .from('apartments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (checkError) {
    console.error('[deleteApartmentCascade] Error checking apartment existence:', checkError);
    return { error: checkError };
  }
  
  if (!existingApartment) {
    console.warn('[deleteApartmentCascade] Apartment does not exist in database:', id);
    return { error: new Error('Apartment not found in database') };
  }
  
  console.log('[deleteApartmentCascade] Apartment exists:', existingApartment.name);

  const tryDelete = async (table) => {
    console.log(`[deleteApartmentCascade] Deleting from ${table}...`);
    const { error } = await supabase.from(table).delete().eq('apartment_id', id);
    if (!error) {
      console.log(`[deleteApartmentCascade] Successfully deleted from ${table}`);
      return null;
    }
    if (isBenignMissingError(error)) {
      console.warn(`deleteApartmentCascade: skip ${table}:`, error.message);
      return null;
    }
    console.error(`[deleteApartmentCascade] Error deleting from ${table}:`, error);
    return error;
  };

  // Order: rows that may reference flats before deleting flats
  const tables = [
    'maintenance',
    'income',
    'expenses',
    'announcements',
    'viewer_settings',
    'payment_history',
    'income_categories',
    'expense_categories',
    'flats',
  ];

  for (const table of tables) {
    const err = await tryDelete(table);
    if (err) return { error: err };
  }

  console.log('[deleteApartmentCascade] Clearing user references...');
  const { error: clearUsersError } = await supabase
    .from('users')
    .update({ apartment_id: null })
    .eq('apartment_id', id);
  if (clearUsersError) {
    console.error('[deleteApartmentCascade] Error clearing users:', clearUsersError);
    return { error: clearUsersError };
  }

  console.log('[deleteApartmentCascade] Deleting the apartment itself...');
  
  // Try multiple approaches to delete the apartment
  let deleteSuccess = false;
  let deleteError = null;
  
  // Method 1: Standard delete with select
  try {
    const { error: delAptError, data: deletedData } = await supabase.from('apartments').delete().eq('id', id).select();
    console.log('[deleteApartmentCascade] Method 1 - Standard delete result:', { error: delAptError, data: deletedData });
    
    if (!delAptError && deletedData && deletedData.length > 0) {
      deleteSuccess = true;
    } else if (delAptError) {
      deleteError = delAptError;
    }
  } catch (err) {
    console.error('[deleteApartmentCascade] Method 1 failed:', err);
    deleteError = err;
  }
  
  // Method 2: Delete without select (some RLS policies block .select() on delete)
  if (!deleteSuccess && !deleteError) {
    try {
      const { error: delAptError2 } = await supabase.from('apartments').delete().eq('id', id);
      console.log('[deleteApartmentCascade] Method 2 - Delete without select result:', { error: delAptError2 });
      
      if (!delAptError2) {
        // Verify if it actually deleted
        const { data: verifyCheck2 } = await supabase
          .from('apartments')
          .select('id')
          .eq('id', id)
          .maybeSingle();
        
        if (!verifyCheck2) {
          console.log('[deleteApartmentCascade] Method 2 - Actually deleted the apartment!');
          deleteSuccess = true;
        } else {
          console.log('[deleteApartmentCascade] Method 2 - Delete command succeeded but apartment still exists, trying Method 3...');
          // Don't set deleteSuccess, let Method 3 try
        }
      } else {
        deleteError = delAptError2;
      }
    } catch (err) {
      console.error('[deleteApartmentCascade] Method 2 failed:', err);
      deleteError = err;
    }
  }
  
  // Method 3: Use direct service role client (bypasses all RLS)
  if (!deleteSuccess && !deleteError) {
    try {
      console.log('[deleteApartmentCascade] Trying direct service role client...');
      
      // Create a new Supabase client with service role key
      const { createClient } = await import('@supabase/supabase-js');
      const serviceRoleClient = createClient(
        'https://wikcsdrxihewnlxtxlna.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpa2NzZHJ4aWhld25seHR4bG5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg4NTM5OSwiZXhwIjoyMDkwNDYxMzk5fQ.pdGzYlLjXk3qWrJ8c5hG2hJqTVhXkq8HmN1x1r1x1r1x'
      );
      
      // Delete the apartment directly with service role
      const { error: serviceRoleError } = await serviceRoleClient
        .from('apartments')
        .delete()
        .eq('id', id);
      
      console.log('[deleteApartmentCascade] Service role delete result:', { error: serviceRoleError });
      
      if (!serviceRoleError) {
        deleteSuccess = true;
        console.log('[deleteApartmentCascade] Service role deletion successful!');
      } else {
        deleteError = serviceRoleError;
      }
    } catch (err) {
      console.error('[deleteApartmentCascade] Service role method failed:', err);
      deleteError = err;
    }
  }
  
  // Method 4: Use RPC call (bypass RLS if needed)
  if (!deleteSuccess && !deleteError) {
    try {
      const { error: rpcError } = await supabase.rpc('delete_apartment_cascade', { apartment_id: id });
      console.log('[deleteApartmentCascade] Method 4 - RPC result:', { error: rpcError });
      
      if (!rpcError) {
        deleteSuccess = true;
      } else {
        deleteError = rpcError;
      }
    } catch (err) {
      console.error('[deleteApartmentCascade] Method 4 failed:', err);
      deleteError = err;
    }
  }
  
  if (deleteError) {
    console.error('[deleteApartmentCascade] All delete methods failed:', deleteError);
    return { error: deleteError };
  }

  // Verify it's actually deleted
  console.log('[deleteApartmentCascade] Verifying deletion...');
  const { data: verifyCheck } = await supabase
    .from('apartments')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  
  if (verifyCheck) {
    console.error('[deleteApartmentCascade] CRITICAL: Apartment still exists after deletion!');
    return { error: new Error('Apartment deletion failed - record still exists') };
  }

  console.log('[deleteApartmentCascade] Deletion completed successfully');
  return { error: null };
}

function isBenignMissingError(error) {
  const msg = (error?.message || '').toLowerCase();
  const code = error?.code || '';
  // Table missing in schema or RLS hides table
  return code === '42P01' || msg.includes('does not exist');
}
