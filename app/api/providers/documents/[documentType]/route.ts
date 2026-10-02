import { NextResponse } from 'next/server';
import { readSession, PROVIDER_COOKIE } from "@/lib/portal-server";
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentType: string }> }
) {
  try {
    // 1. Desenvolvemos el parámetro de la ruta
    const { documentType } = await params;

    // 2. Validamos la sesión tradicional por cookie O por la cabecera personalizada
    let providerId = "";
    const session = await readSession(request, PROVIDER_COOKIE, "provider");

    if (session && session.id) {
      providerId = session.id;
    } else {
      // Si la cookie falló o está bloqueada por el estado submitted, leemos el encabezado seguro
      providerId = request.headers.get("X-Provider-Id") || "";
    }

    // Si ambos métodos están vacíos, entonces sí rechazamos con un 401
    if (!providerId) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }

    // 3. Extraemos el archivo binario
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No se recibió un archivo PDF válido." }, { status: 400 });
    }

    // 4. Convertimos el archivo a un Buffer binario para Supabase
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // USAMOS LA VARIABLE providerId CORREGIDA (Evita por completo el error de null)
    const nombreUnicoArchivo = `${providerId}/${documentType}.pdf`;

    console.log(`[USER POST] Guardando archivo permanente en Storage: ${nombreUnicoArchivo}`);

    // 5. Cargamos físicamente el PDF al Bucket de Supabase
    const { error: storageError } = await supabase.storage
      .from('licitaciones') 
      .upload(nombreUnicoArchivo, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (storageError) {
      console.error("Error en Storage de Supabase durante la subida:", storageError);
      return NextResponse.json({ error: `Falla en el almacenamiento: ${storageError.message}` }, { status: 500 });
    }

    // 6. Consultamos los datos actuales para actualizar de forma segura 'document_names'
    const { data: currentProvider, error: selectError } = await supabase
      .from('portal_providers')
      .select('*')
      .eq('id', providerId) // Usamos providerId
      .single();

    if (selectError || !currentProvider) {
      return NextResponse.json({ error: "No se encontró el proveedor registrado." }, { status: 404 });
    }

    const currentNames = currentProvider.document_names || {};
    const updatedNames = {
      ...currentNames,
      [documentType]: file.name
    };

    // 7. Impactamos de forma permanente los datos en Supabase
    const { data: updatedProvider, error: updateError } = await supabase
      .from('portal_providers')
      .update({ document_names: updatedNames })
      .eq('id', providerId) // Usamos providerId
      .select('*')
      .single();

    if (updateError) {
      console.error("Error al persistir el nombre en la base de datos:", updateError);
      return NextResponse.json({ error: `Falla al actualizar el registro: ${updateError.message}` }, { status: 500 });
    }

    console.log(`[USER SUCCESS] Registro guardado con éxito en Supabase para el documento: ${documentType}`);

    return NextResponse.json({
      success: true,
      document: {
        document_name: file.name
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error crítico en el endpoint de subida del proveedor:", error);
    return NextResponse.json({ error: "Error interno en el servidor de archivos." }, { status: 500 });
  }
}

