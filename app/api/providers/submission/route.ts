import { NextResponse } from "next/server";
import { readSession, PROVIDER_COOKIE, saveProviderSubmission } from "@/lib/portal-server";

export async function PUT(request: Request) {
  try {
    const session = await readSession(request, PROVIDER_COOKIE, "provider");
    if (!session) return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });

    const body = await request.json();
    console.log("ESTE ES EL BODY QUE LLEGA DESDE EL FRONTEND:", body);
    // Guarda los textos ingresados, categorías y el estado 'draft' o 'submitted' en Supabase
    const updatedProvider = await saveProviderSubmission(session.id, body.submission, body.document_names, body.status);

    return NextResponse.json({ provider: updatedProvider });
  } catch (error: any) {
    // Esto imprimirá el error real en tu terminal negra de VS Code
    console.error("ERROR REAL EN EL PUT:", error); 
    return NextResponse.json({ error: "No fue posible guardar el progreso.", detalles: error.message }, { status: 500 });
  }

}
