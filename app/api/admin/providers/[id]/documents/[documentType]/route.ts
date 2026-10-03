import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN;

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentType: string }> } // 🚀 CORREGIDO: documentType coincide con tu carpeta
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });
  }

  try {
    // 1. Esperamos la resolución asíncrona obligatoria de Next.js 15
    const resolvedParams = await params;
    const providerId = resolvedParams.id;
    const docType = resolvedParams.documentType; // 🚀 Lee el nombre exacto de tu parámetro

    if (!providerId || !docType) {
      return NextResponse.json({ error: 'Parámetros inválidos en la ruta.' }, { status: 400 });
    }

    // 2. Consultamos en Postgres el nombre real del archivo guardado por el usuario
    const { data: provider, error: dbError } = await supabaseAdmin
      .from('portal_providers')
      .select('document_names')
      .eq('id', providerId)
      .single();

    if (dbError || !provider) {
      return NextResponse.json({ error: 'Proveedor no mapeado en la base de datos.' }, { status: 404 });
    }

    const realFileName = provider.document_names?.[docType];

    if (!realFileName) {
      return NextResponse.json({ error: 'Este documento específico no ha sido cargado.' }, { status: 404 });
    }

    // 3. Descarga el binario del archivo desde el bucket de Supabase
    // Nomenclatura exacta de almacenamiento: carpeta_id/nombre_archivo.pdf
    const { data: fileData, error: storageError } = await supabaseAdmin.storage
      .from('licitaciones')
      .download(`${providerId}/${realFileName}`);

    if (storageError || !fileData) {
      console.error("❌ Error Storage:", storageError?.message);
      return NextResponse.json({ error: 'Archivo físico no hallado en el bucket.' }, { status: 404 });
    }

    // 4. Convertimos el archivo a binario seguro para la transmisión HTTP
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Entregamos el PDF forzando la descarga limpia con su nombre original en el navegador
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(realFileName)}"`,
      },
    });

  } catch (error) {
    console.error('❌ Excepción en descarga administrativa:', error);
    return NextResponse.json({ error: 'Fallo interno al procesar el archivo.' }, { status: 500 });
  }
}
