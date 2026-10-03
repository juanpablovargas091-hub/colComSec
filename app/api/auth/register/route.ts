import { NextResponse } from "next/server";
import {
  createProvider,
  createSession,
  PROVIDER_COOKIE,
  sessionCookie,
} from "@/lib/portal-server";

// 🚀 Fuerza a Next.js a procesar la solicitud en tiempo real en Vercel (evita el error 500 por caché estática)
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      company?: string;
      email?: string;
      password?: string;
    };

    const company = body.company?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (company.length < 2 || !email.includes("@") || password.length < 8) {
      return NextResponse.json(
        { error: "Complete los datos y use una contraseña de mínimo 8 caracteres." },
        { status: 400 }
      );
    }

    // Llama a la función original que inserta y encripta directamente en la tabla portal_providers en la nube
    const provider = await createProvider(company, email, password);

    // Genera el token interno de sesión segura original de tu proyecto
    const token = await createSession("provider", provider.id, provider.email);

    return NextResponse.json(
      { provider },
      {
        status: 201,
        headers: {
          "Set-Cookie": sessionCookie(PROVIDER_COOKIE, token),
        },
      }
    );
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    console.error("[REGISTRO] Fallo real:", detalle);

    const duplicado = detalle.toLowerCase().includes("duplicate");

    return NextResponse.json(
      {
        error: duplicado
          ? "Ya existe una cuenta con ese correo en tu Supabase."
          : "No fue posible registrar la cuenta en el servidor remoto.",
      },
      { status: duplicado ? 409 : 500 }
    );
  }
}
