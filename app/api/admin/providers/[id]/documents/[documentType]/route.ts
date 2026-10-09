import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    // 1. Desenvolvemos los parámetros de la URL
    const { id, documentType } = await params;

    // 2. Consultamos el registro del proveedor en la base de datos
    const { data: provider, error: dbError } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError || !provider) {
      return NextResponse.json({ error: "No se encontraron datos de este proveedor." }, { status: 404 });
    }

    // 3. Obtenemos el nombre EXACTO con el que se registró el documento en Supabase
    // Si usaste marcas de tiempo al guardar (ej: camara_179082.pdf), aquí recuperamos ese string exacto
    const nombreOriginalGuardado = provider.document_names?.[documentType];

    if (!nombreOriginalGuardado) {
      return NextResponse.json({ error: `El documento ${documentType} no está registrado.` }, { status: 404 });
    }

    // 4. Si guardaste el archivo físicamente como 'camara.pdf' pero con nombre mapeado,
    // o si el archivo en Storage se llama igual que el original, validamos la ruta correcta:
    // Probamos primero con el slug estructurado estándar del flujo:
    let rutaArchivoStorage = `${id}/${documentType}.pdf`;

    console.log(`[ADMIN DOWNLOAD OPTION 4] Intentando descargar: ${rutaArchivoStorage}`);

    // Descargamos el archivo binario desde tu bucket
    let { data: fileData, error: storageError } = await supabase.storage
      .from('licitaciones')
      .download(rutaArchivoStorage);

    // Si da error de 'Object not found', intentamos buscarlo con el nombre original por si se subió con el nombre nativo
    if (storageError && storageError.message.includes('Object not found')) {
      rutaArchivoStorage = `${id}/${nombreOriginalGuardado}`;
      console.log(`[RETRY OPTION 4] Intentando con nombre original: ${rutaArchivoStorage}`);
      
      const retryResult = await supabase.storage
        .from('licitaciones')
        .download(rutaArchivoStorage);
        
      fileData = retryResult.data;
      storageError = retryResult.error;
    }

    if (storageError || !fileData) {
      console.error("❌ Error Storage:", storageError?.message || "Archivo vacío");
      return NextResponse.json({ error: "El archivo físico no fue encontrado en el contenedor." }, { status: 404 });
    }

    // 5. Convertimos los datos a un buffer binario limpio y legible
    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`✅ Documento ${documentType} descargado con éxito: ${buffer.length} bytes`);

    // Servimos el PDF original directo al navegador del administrador
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(nombreOriginalGuardado)}"`,
      },
    });

  } catch (error: any) {
    console.error("Error crítico en descarga de opción 4:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
