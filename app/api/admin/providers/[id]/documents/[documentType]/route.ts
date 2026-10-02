import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    // Desenvolvemos los parámetros dinámicos (ID del proveedor y tipo de documento)
    const { id, documentType } = await params;

    // Construimos la ruta exacta con la que guardamos el archivo en el Storage
    const rutaArchivoStorage = `${id}/${documentType}.pdf`;

    console.log(`[DOWNLOAD] Administrador descargando: ${rutaArchivoStorage}`);

    // Descargamos el archivo binario directamente del bucket de Supabase
    const { data, error } = await supabase.storage
      .from('licitaciones') // Cambia 'licitaciones' si tu Bucket se llama diferente
      .download(rutaArchivoStorage);

    if (error || !data) {
      console.error("Error al descargar desde Supabase Storage:", error);
      return NextResponse.json({ error: "El archivo no se encuentra en el almacenamiento." }, { status: 404 });
    }

    // Convertimos los datos descargados en un buffer binario ejecutable
    const buffer = Buffer.from(await data.arrayBuffer());

    // Retornamos el archivo PDF con las cabeceras de descarga correspondientes
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${documentType}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error("Error crítico en descarga administrativa:", error);
    return NextResponse.json({ error: "Falla interna al recuperar el archivo PDF." }, { status: 500 });
  }
}
