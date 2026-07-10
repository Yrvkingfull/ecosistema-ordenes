import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['yleon@padovasac.com', 'yrvingleon@hotmail.com', 'admin@padova.com'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Falta el email a invitar' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel' });
  }

  // Verificamos la identidad de quien llama usando su propio token (cliente con anon key)
  const callerClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  if (!ADMIN_EMAILS.includes(userData.user.email)) {
    return res.status(403).json({ error: 'Solo un superadministrador puede invitar usuarios' });
  }

  // La invitación real solo puede hacerse con el service role key (cliente admin)
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, user: data.user });
}
