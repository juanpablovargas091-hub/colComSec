import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_PORTAL_TOKEN || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const { data: providers, error } = await supabase
      .from('portal_providers')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mapeamos los proveedores para inyectar virtualmente el campo 'document_files'
    // indicando al frontend que el archivo está físicamente disponible si tiene un nombre guardado
    const mapProviders = providers?.map(provider => {
      const docFiles: Record<string, any> = {};
      
      if (provider.document_names) {
        Object.keys(provider.document_names).forEach(key => {
          docFiles[key] = {
            document_name: provider.document_names[key],
            available: true, // Esto activa el botón de descarga en la interfaz
            uploaded_at: provider.updated_at
          };
        });
      }

      return {
        ...provider,
        document_files: docFiles
      };
    });

    return NextResponse.json({ success: true, providers: mapProviders || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
