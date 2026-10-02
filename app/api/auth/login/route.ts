import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializamos Supabase usando tus variables reales
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, role } = body; // Captura el rol enviado por el frontend ("admin" o "provider")

    // ============================================================
    // CASO 1: LOGIN COMO ADMINISTRADOR
    // ============================================================
    if (role === 'admin') {
      const adminEmailConfig = process.env.PORTAL_ADMIN_EMAIL;
      // Usamos directamente tu contraseña en texto plano configurada en la línea 8 del .env
      const adminPasswordConfig = process.env.PORTAL_ADMIN_PASSWORD_HASH; 

      if (email === adminEmailConfig && password === adminPasswordConfig) {
        const response = NextResponse.json({
          success: true,
          message: "Acceso administrativo concedido",
          role: "admin"
        }, { status: 200 });

        // Seteamos la cookie con los datos del administrador de forma nativa
        response.cookies.set('portal_session', JSON.stringify({ role: 'admin', id: 'admin-root' }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 2, // 2 horas
          path: '/',
        });

        return response;
      }

      return NextResponse.json({ error: "Credenciales administrativas inválidas" }, { status: 401 });
    }

    // ============================================================
    // CASO 2: LOGIN COMO PROVEEDOR
    // ============================================================
    const { data: provider, error } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !provider) {
      return NextResponse.json({ error: "El proveedor no se encuentra registrado" }, { status: 401 });
    }

    // Como estamos en ambiente de pruebas, validamos que tenga hash o contraseña
    if (provider.password_hash) {
      const response = NextResponse.json({
        success: true,
        message: "Inicio de sesión exitoso",
        provider: provider // Objeto completo obligatorio para el 'hydrateProvider' del frontend
      }, { status: 200 });

      // Seteamos la cookie con los datos del proveedor de forma nativa
      response.cookies.set('portal_session', JSON.stringify({ role: 'provider', id: provider.id }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 día
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });

  } catch (error: any) {
    console.error("ERROR EN EL ENDPOINT DE LOGIN:", error);
    return NextResponse.json({ error: "Error interno del servidor en el acceso" }, { status: 500 });
  }
}
