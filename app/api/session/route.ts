import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('portal_session');

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ role: null, provider: null }, { status: 200 });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch (e) {
      sessionData = { role: 'provider', id: sessionCookie.value };
    }

    if (sessionData.role === 'admin') {
      return NextResponse.json({ role: 'admin', provider: null }, { status: 200 });
    }

    // Consultamos el proveedor en tiempo real en Supabase
    const { data: provider, error } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (error || !provider) {
      return NextResponse.json({ role: null, provider: null }, { status: 200 });
    }

    // ============================================================
    // LA SOLUCIÓN: MAPEAMOS LOS METADATOS QUE TU FRONTEND BUSCA
    // ============================================================
    const adminDocName = provider.document_names?.adminDocument;
    
    // Construimos virtualmente el objeto 'document_files' y la propiedad 'assigned_document'
    // para que coincida exactamente con las validaciones de tu componente Home.tsx
    const docFiles: Record<string, any> = {};
    let assignedDocumentObj = null;

    if (adminDocName) {
      assignedDocumentObj = {
        document_name: adminDocName,
        available: true,
        uploaded_at: provider.updated_at
      };
      docFiles['adminDocument'] = assignedDocumentObj;
    }

    // Creamos el objeto del proveedor enriquecido con las variables que activan la interfaz
    const enrichedProvider = {
      ...provider,
      document_files: docFiles,
      assigned_document: assignedDocumentObj // Mapeo directo para el bloque del paso 6
    };

    return NextResponse.json({
      role: 'provider',
      provider: enrichedProvider
    }, { status: 200 });

  } catch (error: any) {
    console.error("ERROR EN EL ENDPOINT DE SESIÓN:", error);
    return NextResponse.json({ role: null, provider: null, error: error.message }, { status: 200 });
  }
}
