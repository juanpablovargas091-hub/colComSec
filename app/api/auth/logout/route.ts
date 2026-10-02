import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log("[AUTH LOGOUT] Destruyendo cookie de sesión del portal...");

    // 1. Obtenemos el almacén de cookies de Next.js
    const cookieStore = await cookies();

    // 2. Eliminamos de forma definitiva la cookie 'portal_session'
    cookieStore.delete('portal_session');

    // 3. Respondemos con un éxito rotundo para que el frontend regrese a la vista 'access'
    return NextResponse.json({
      success: true,
      message: "Sesión cerrada correctamente."
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error crítico en el endpoint de logout:", error);
    return NextResponse.json({ error: "No fue posible cerrar la sesión en el servidor." }, { status: 500 });
  }
}
