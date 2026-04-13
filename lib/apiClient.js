const SUPABASE_URL = 'https://jjgsggmufkpadchkodab.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ3NnZ211ZmtwYWRjaGtvZGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0Njg3MTAsImV4cCI6MjA2MDA0NDcxMH0.V6VxViTuJJdivrKKp51VcLyezeUmFNjLFb4wkVacQOk';

export async function verifyToken(accessToken) {
  if (!accessToken) return false;

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}
