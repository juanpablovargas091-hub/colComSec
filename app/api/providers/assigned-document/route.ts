import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Aseguramos renderizado dinámico en tiempo real para evitar cachés de archivos vacíos
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    // 1. Obtenemos la cookie asíncrona de sesión del proveedor
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('portal_session');

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch (e) {
      sessionData = { role: 'provider', id: sessionCookie.value };
    }

    // 2. Buscamos el registro en la base de datos de Supabase
    const { data: provider, error: dbError } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (dbError || !provider) {
      return NextResponse.json({ error: "No se encontraron datos del proveedor." }, { status: 404 });
    }

    const adminDocName = provider.document_names?.adminDocument;

    // Si el frontend está preguntando exclusivamente por validación mediante un parámetro especial '?check=true'
    const url = new URL(request.url);
    if (url.searchParams.get('check') === 'true') {
      return NextResponse.json({
        success: true,
        document: adminDocName ? {
          document_name: adminDocName,
          available: true,
          uploaded_at: provider.updated_at
        } : null
      }, { status: 200 });
    }

    // ============================================================
    // LA SOLUCIÓN: ENTREGAR EL ARCHIVO PDF BINARIO DIRECTAMENTE
    // ============================================================
    if (!adminDocName) {
      return NextResponse.json({ error: "El archivo no está disponible para descarga." }, { status: 400 });
    }

    // Ruta física del archivo en el Storage de Supabase
    const rutaArchivoStorage = `${sessionData.id}/adminDocument.pdf`;
    console.log(`[USER DESCARGA DIRECTA] Recuperando de Supabase Storage: ${rutaArchivoStorage}`);

    const { data: fileData, error: storageError } = await supabase.storage
      .from('licitaciones') // Verifica que este sea tu bucket real en Supabase
      .download(rutaArchivoStorage);

    if (storageError || !fileData) {
      console.error("Error en Storage de Supabase durante la entrega directa:", storageError);
      return NextResponse.json({ error: "Archivo físico no encontrado en el Storage." }, { status: 404 });
    }

    // Convertimos los datos a un buffer binario limpio, real y legible
    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`[ÉXITO DEFINITIVO] Sirviendo PDF binario real de ${buffer.length} bytes al usuario.`);

    // Retornamos el binario con las cabeceras de adjunto oficiales
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(adminDocName)}"`,
      },
    });

  } catch (error: any) {
    console.error("Error crítico en endpoint de descarga asignado:", error);
    return NextResponse.json({ error: "Error interno en el servidor." }, { status: 500 });
  }
}
