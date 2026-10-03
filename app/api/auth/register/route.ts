import { NextResponse } from "next/server";
import {
  createProvider,
  createSession,
  PROVIDER_COOKIE,
} from "@/lib/portal-server";

// 🚀 Forzamos a Next.js a no cachear este endpoint en los servidores de Vercel
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

    // Ejecuta la encriptación manual original en tu tabla portal_providers de Postgres
    const provider = await createProvider(company, email, password);

    // Genera el token interno original de tu proyecto
    const token = await createSession("provider", provider.id, provider.email);

    // Creamos la respuesta JSON estándar
    const response = NextResponse.json({ provider }, { status: 201 });

    // 🚀 SOLUCIÓN EN PRODUCCIÓN: Seteamos la cookie usando el estándar nativo de Next.js
    // Esto evita que Vercel rompa la cabecera 'Set-Cookie' al procesar dominios con HTTPS
    response.cookies.set(PROVIDER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Se activa automáticamente solo en la web en vivo
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 día de duración estándar
    });

    return response;

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
