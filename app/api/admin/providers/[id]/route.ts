import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Forzamos a Next.js a no usar caché estática en este endpoint administrativo
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN;

// Inicialización segura del cliente administrativo
const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // En Next.js 15 params es una Promesa
) {
  // 1. Validar que las variables de entorno existan en este hilo del servidor
  if (!supabaseAdmin) {
    console.error("❌ ERROR SEVERO: Las variables de entorno no están cargadas en el backend.");
    return NextResponse.json(
      { error: 'Configuración del servidor incompleta. Verifique el archivo .env.local' }, 
      { status: 500 }
    );
  }

  // 2. Esperar la resolución de los parámetros de la ruta
  const resolvedParams = await params;
  const providerId = resolvedParams.id;

  if (!providerId) {
    return NextResponse.json({ error: 'ID del proveedor requerido' }, { status: 400 });
  }

  try {
    // 3. Listar archivos dentro del directorio del proveedor en Supabase Storage
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('licitaciones')
      .list(providerId);

    if (listError) {
      console.error('Error al listar archivos del Storage:', listError);
      return NextResponse.json({ error: 'Error al acceder al almacenamiento de archivos' }, { status: 500 });
    }

    // 4. Eliminar los archivos físicos si el directorio contiene elementos
    if (files && files.length > 0) {
      const filesToDelete = files.map((file) => `${providerId}/${file.name}`);
      
      const { error: deleteStorageError } = await supabaseAdmin.storage
        .from('licitaciones')
        .remove(filesToDelete);

      if (deleteStorageError) {
        console.error('Error al eliminar archivos del Storage:', deleteStorageError);
        return NextResponse.json({ error: 'Error al limpiar los archivos físicos del servidor' }, { status: 500 });
      }
    } // 🚀 LLAVE CORREGIDA AQUÍ

    // 5. Eliminar el registro maestro de la base de datos relacional (Postgres)
    const { error: deleteDbError } = await supabaseAdmin
      .from('portal_providers')
      .delete()
      .eq('id', providerId);

    if (deleteDbError) {
      console.error('Error al eliminar de Postgres:', deleteDbError);
      return NextResponse.json({ error: 'Error al eliminar el registro de la base de datos' }, { status: 500 });
    }

    // 6. Respuesta exitosa sincronizada en caliente con la UI
    return NextResponse.json({ success: true, message: 'Proveedor y archivos purgados correctamente' }, { status: 200 });

  } catch (error) {
    console.error('Excepción atrapada en el endpoint de eliminación:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
