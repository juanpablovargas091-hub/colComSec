import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// 1. FUNCIÓN GET: DESCARGA DEL ADMINISTRADOR
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Volvemos a 'id'
) {
  try {
    const { id } = await params;

    const { data: provider, error: dbError } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError || !provider) {
      return NextResponse.json({ error: "No se encontraron datos de este proveedor." }, { status: 404 });
    }

    const adminDocName = provider.document_names?.adminDocument || 'documento_asignado.pdf';
    const rutaArchivoStorage = `${id}/adminDocument.pdf`;

    console.log(`[ADMIN GET] Descargando desde Storage para el ID: ${id}`);

    const { data: fileData, error: storageError } = await supabase.storage
      .from('licitaciones')
      .download(rutaArchivoStorage);

    if (storageError || !fileData) {
      console.error("Error en Storage de Supabase:", storageError);
      return NextResponse.json({ error: "El archivo físico no existe en el contenedor." }, { status: 404 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${adminDocName}"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// 2. FUNCIÓN POST: CARGA DEL ADMINISTRADOR
// ============================================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Volvemos a 'id'
) {
  try {
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No se recibió un documento PDF válido." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const nombreUnicoArchivo = `${id}/adminDocument.pdf`;

    console.log(`[ADMIN POST] Guardando documento asignado para el ID: ${id}`);

    const { error: storageError } = await supabase.storage
      .from('licitaciones')
      .upload(nombreUnicoArchivo, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { data: currentProvider, error: selectError } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError || !currentProvider) {
      return NextResponse.json({ error: "No se encontró el proveedor." }, { status: 404 });
    }

    const currentNames = currentProvider.document_names || {};
    const updatedNames = {
      ...currentNames,
      adminDocument: file.name
    };

    const { data: updatedProvider, error: updateError } = await supabase
      .from('portal_providers')
      .update({ document_names: updatedNames })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const docFiles: Record<string, any> = {};
    if (updatedProvider.document_names) {
      Object.keys(updatedProvider.document_names).forEach(key => {
        docFiles[key] = {
          document_name: updatedProvider.document_names[key],
          available: true,
          uploaded_at: updatedProvider.updated_at
        };
      });
    }

    return NextResponse.json({
      success: true,
      provider: {
        ...updatedProvider,
        document_files: docFiles
      }
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


// ============================================================
// 3. FUNCIÓN DELETE: ELIMINAR DOCUMENTO Y LIBERAR EL ESPACIO
// ============================================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Desenvolvemos el ID del proveedor de forma asíncrona
    const { id } = await params;

    const rutaArchivoStorage = `${id}/adminDocument.pdf`;
    console.log(`[ADMIN DELETE] Liberando espacio para el Proveedor: ${id}`);

    // 2. Eliminamos el archivo físico del bucket de Supabase Storage de forma segura
    const { error: storageError } = await supabase.storage
      .from('licitaciones') // Verifica si tu Bucket se llama diferente
      .remove([rutaArchivoStorage]);

    if (storageError) {
      console.warn("Aviso en Storage (puede que el archivo no existiera físicamente):", storageError.message);
    }

    // 3. Consultamos el registro actual del proveedor en la base de datos
    const { data: currentProvider, error: selectError } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError || !currentProvider) {
      return NextResponse.json({ error: "No se encontró el proveedor en la base de datos." }, { status: 404 });
    }

    // 4. Removemos la clave 'adminDocument' de su columna 'document_names' (dejándola limpia)
    const updatedNames = { ...currentProvider.document_names };
    delete updatedNames.adminDocument; // Eliminamos la propiedad por completo

    // 5. Actualizamos la base de datos con el objeto JSON ya limpio
    const { data: updatedProvider, error: updateError } = await supabase
      .from('portal_providers')
      .update({ document_names: updatedNames })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error("Error al limpiar la base de datos:", updateError);
      return NextResponse.json({ error: `Falla al limpiar metadatos: ${updateError.message}` }, { status: 500 });
    }

    // 6. Construimos el mapa virtual de archivos (excluyendo el del administrador)
    // para indicarle al frontend de React que el espacio quedó vacío
    const docFiles: Record<string, any> = {};
    if (updatedProvider.document_names) {
      Object.keys(updatedProvider.document_names).forEach(key => {
        if (key !== 'adminDocument') {
          docFiles[key] = {
            document_name: updatedProvider.document_names[key],
            available: true,
            uploaded_at: updatedProvider.updated_at
          };
        }
      });
    }

    // Retornamos el objeto del proveedor completamente reseteado en esa sección
    return NextResponse.json({
      success: true,
      message: "Espacio liberado y documento eliminado exitosamente.",
      provider: {
        ...updatedProvider,
        document_files: docFiles,
        assigned_document: null // Forzamos al frontend a volver al estado vacío original
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error crítico en el DELETE del administrador:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
