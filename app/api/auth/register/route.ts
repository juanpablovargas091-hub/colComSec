import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN;

// Inicializamos con la llave administrativa para forzar la creación sin restricciones en Vercel
const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }) 
  : null;

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    console.error("❌ BACKEND: Variables de entorno no disponibles en /api/auth/register");
    return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });
  }

  try {
    const { company, email, password } = await request.json();

    if (!email || !password || !company) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios.' }, { status: 400 });
    }

    // 1. Crear el usuario en la autenticación oficial de Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // 🚀 Fuerza el marcado de correo verificado directamente desde el backend administrativo
      user_metadata: { company_name: company.trim() }
    });

    if (authError) {
      console.error("❌ Error en Supabase Auth:", authError.message);
      return NextResponse.json({ error: `Error de autenticación: ${authError.message}` }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'No se pudo generar el usuario.' }, { status: 500 });
    }

    // 2. Insertar el registro inicial en la tabla pública de proveedores
    const { error: dbError } = await supabaseAdmin
      .from('portal_providers')
      .insert([
        {
          id: authData.user.id, // Sincroniza el ID de autenticación con el de la tabla relacional
          company_name: company.trim(),
          email: email.trim().toLowerCase(),
          status: 'draft',
          submission: { data: { razonSocial: company.trim(), companyEmail: email.trim().toLowerCase() }, categories: [], authorizations: {} },
          document_names: {}
        }
      ]);

    if (dbError) {
      console.error("❌ Error en Tabla portal_providers de Postgres:", dbError.message);
      
      // Intento de limpieza preventiva en Auth si falla la inserción en la base de datos
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json({ error: `Error de base de datos: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Proveedor registrado correctamente.' }, { status: 200 });

  } catch (error) {
    console.error('❌ Excepción crítica en el endpoint de registro:', error);
    return NextResponse.json({ error: 'Fallo interno crítico en el servidor de registro.' }, { status: 500 });
  }
}
