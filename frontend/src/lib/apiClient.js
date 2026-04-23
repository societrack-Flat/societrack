import { supabase } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Get auth token from Supabase (only for authentication)
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// Generic API call function
const apiCall = async (endpoint, options = {}) => {
  const token = await getAuthToken();
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      let errBody = {};
      try {
        errBody = await response.json();
      } catch {
        /* ignore */
      }
      const detail = errBody.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
        : typeof detail === 'string'
          ? detail
          : (detail && JSON.stringify(detail)) || errBody.message || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    
    // If backend is not running, throw a more user-friendly error
    if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error('Backend server is not running. Please start the backend server first.');
    }
    
    throw error;
  }
};

// Auth API
export const authApi = {
  getProfile: async (userId) => {
    return apiCall(`/api/auth/profile?user_id=${userId}`);
  },

  updateProfile: async (userId, profileData) => {
    return apiCall(`/api/auth/profile?user_id=${userId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  getSession: async () => {
    return apiCall('/api/auth/session');
  },
};

// Apartments API
export const apartmentApi = {
  // Get all apartments for a user
  getApartments: async (userId, activeApartmentId = null, excludeApartmentId = null) => {
    const params = new URLSearchParams({ user_id: userId });
    if (activeApartmentId) params.append('active_apartment_id', activeApartmentId);
    if (excludeApartmentId) params.append('exclude_apartment_id', excludeApartmentId);
    
    return apiCall(`/api/apartments?${params}`);
  },

  // Get user apartments (simpler version)
  getUserApartments: async (userId) => {
    return apiCall(`/api/apartments/user/${userId}`);
  },

  // Create a new apartment
  createApartment: async (apartmentData, userId) => {
    return apiCall(`/api/apartments?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(apartmentData),
    });
  },

  // Update an apartment
  updateApartment: async (apartmentId, apartmentData) => {
    return apiCall(`/api/apartments/${apartmentId}`, {
      method: 'PUT',
      body: JSON.stringify(apartmentData),
    });
  },

  // Delete an apartment
  deleteApartment: async (apartmentId) => {
    return apiCall(`/api/apartments/${apartmentId}`, {
      method: 'DELETE',
    });
  },

  // Set active apartment
  setActiveApartment: async (apartmentId, userId) => {
    return apiCall(`/api/apartments/${apartmentId}/set-active?user_id=${userId}`, {
      method: 'PATCH',
    });
  },
};

// Storage API (for file uploads)
export const storageApi = {
  uploadFile: async (file, path) => {
    // For now, we'll still use Supabase for storage since it's complex to move
    // But this can be moved to backend later
    const { data, error } = await supabase.storage
      .from('apartments')
      .upload(path, file);
    
    if (error) throw error;
    return data;
  },

  deleteFile: async (path) => {
    const { error } = await supabase.storage
      .from('apartments')
      .remove([path]);
    
    if (error) throw error;
  },

  getPublicUrl: async (path) => {
    const { data } = supabase.storage
      .from('apartments')
      .getPublicUrl(path);
    
    return data.publicUrl;
  },
};

/** Razorpay: order + verify (signatures verified on server). */
export const paymentsApi = {
  createRazorpayOrder: (body) =>
    apiCall('/api/payments/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyRazorpayPayment: (body) =>
    apiCall('/api/payments/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export default { authApi, apartmentApi, storageApi, paymentsApi };
