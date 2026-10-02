type PortalEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_PORTAL_TOKEN?: string;
  PORTAL_ADMIN_EMAIL?: string;
  PORTAL_ADMIN_PASSWORD_HASH?: string;
  PORTAL_ADMIN_EMAIL_2?: string;
  PORTAL_ADMIN_PASSWORD_HASH_2?: string;
  PORTAL_PASSWORD_PEPPER?: string;
  PORTAL_SESSION_SECRET?: string;
};

export type PortalProvider = {
  id: string;
  company_name: string;
  email: string;
  status: "draft" | "submitted";
  submission: {
    data?: Record<string, string>;
    categories?: string[];
    authorizations?: Record<string, boolean | string | null>;
  };
  document_names: Record<string, string>;
  document_files: Record<string, {
    document_name: string;
    content_type: string | null;
    file_size: number | null;
    uploaded_at: string | null;
    available: boolean;
  }>;
  created_at: string;
  updated_at: string;
};

type ProviderRow = PortalProvider & { password_hash: string };
type SessionPayload = { role: "provider" | "admin"; id: string; email: string; exp: number };
type CompanyRecord = {
  company_email: string | null;
  legal_name: string | null;
  nit: string | null;
  verification_digit: string | null;
  person_type: string | null;
  company_size: string | null;
  city: string | null;
  department: string | null;
  address: string | null;
  contact_email: string | null;
  phone: string | null;
};
type RepresentativeRecord = {
  full_name: string | null;
  identification_number: string | null;
  email: string | null;
  job_title: string | null;
};
type GraphRow = {
  id: string;
  company_name: string;
  email: string;
  password_hash?: string;
  status: "draft" | "submitted";
  submission?: PortalProvider["submission"];
  document_names?: Record<string, string>;
  created_at: string;
  updated_at: string;
  company?: CompanyRecord | CompanyRecord[] | null;
  representative?: RepresentativeRecord | RepresentativeRecord[] | null;
  offer?: { rup_status: string | null } | Array<{ rup_status: string | null }> | null;
  categories?: Array<{ category: string }>;
  documents?: Array<{
    document_type: string;
    document_name: string;
    storage_path: string | null;
    content_type: string | null;
    file_size: number | null;
    uploaded_at: string | null;
  }>;
  authorizations?: {
    fictitious_data_confirmed: boolean;
    non_official_declaration: boolean;
    accepted_at: string | null;
  } | Array<{
    fictitious_data_confirmed: boolean;
    non_official_declaration: boolean;
    accepted_at: string | null;
  }> | null;
};

export const PROVIDER_COOKIE = "portal_provider";
export const ADMIN_COOKIE = "portal_admin";
export const DOCUMENT_BUCKET = "portal-provider-documents";
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_TYPES = ["camara", "cedulaDoc", "rut", "banco", "financieros"] as const;
export const ADMIN_DOCUMENT_TYPE = "adminDocument";
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type StoredDocumentType = DocumentType | typeof ADMIN_DOCUMENT_TYPE;
const PROVIDER_RECOVERY_SCHEME = "recovery-hmac-sha256";

export function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPES.includes(value as DocumentType);
}

async function config() {
  const runtime = process.env as unknown as PortalEnv;
  const required = [
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PORTAL_TOKEN",
    "PORTAL_ADMIN_EMAIL", "PORTAL_ADMIN_PASSWORD_HASH", "PORTAL_PASSWORD_PEPPER",
    "PORTAL_SESSION_SECRET",
  ] as const;
  for (const key of required) {
    if (!runtime[key]) throw new Error(`Missing runtime configuration: ${key}`);
  }
  return runtime as Required<PortalEnv>;
}

function normalizeEmail(value: string) { return value.trim().toLowerCase(); }

async function hmac(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function hashPassword(password: string) { return hmac((await config()).PORTAL_PASSWORD_PEPPER, password); }

export async function verifyProviderPassword(password: string, storedHash: string) {
  if (!storedHash.startsWith(`${PROVIDER_RECOVERY_SCHEME}$`)) {
    return safeEqual(storedHash, await hashPassword(password));
  }

  const [scheme, salt, digest] = storedHash.split("$");
  if (
    scheme !== PROVIDER_RECOVERY_SCHEME ||
    !/^[0-9a-f]{32}$/.test(salt ?? "") || !/^[0-9a-f]{64}$/.test(digest ?? "")
  ) return false;

  return safeEqual(digest, await hmac(salt, password));
}

/*export async function verifyAdmin(email: string, password: string) {
  const runtime = await config();
  const passwordHash = await hashPassword(password);
  const candidates = [
    [runtime.PORTAL_ADMIN_EMAIL, runtime.PORTAL_ADMIN_PASSWORD_HASH],
    [runtime.PORTAL_ADMIN_EMAIL_2, runtime.PORTAL_ADMIN_PASSWORD_HASH_2],
  ] as Array<[string | undefined, string | undefined]>;
  return candidates.some(([candidateEmail, candidateHash]) => (
    Boolean(candidateEmail && candidateHash) &&
    normalizeEmail(email) === normalizeEmail(candidateEmail) &&
    safeEqual(passwordHash, candidateHash)
  ));
}*/
export async function verifyAdmin(email: string, password: string) {
  const runtime = await config();
  const passwordHash = await hashPassword(password);
  const candidates = [
    [runtime.PORTAL_ADMIN_EMAIL, runtime.PORTAL_ADMIN_PASSWORD_HASH],
    [runtime.PORTAL_ADMIN_EMAIL_2, runtime.PORTAL_ADMIN_PASSWORD_HASH_2],
  ] as Array<[string | undefined, string | undefined]>;
  
  return candidates.some(([candidateEmail, candidateHash]) => (
    Boolean(candidateEmail && candidateHash) &&
    normalizeEmail(email) === normalizeEmail(candidateEmail as string) && // <- Añadimos "as string" aquí
    safeEqual(passwordHash, candidateHash as string) // <- Añadimos "as string" aquí
  ));
}

function encodePayload(payload: SessionPayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SessionPayload;
  } catch { return null; }
}

export async function createSession(role: SessionPayload["role"], id: string, email: string) {
  const payload: SessionPayload = { role, id, email: normalizeEmail(email), exp: Date.now() + 12 * 60 * 60 * 1000 };
  const encoded = encodePayload(payload);
  return `${encoded}.${await hmac((await config()).PORTAL_SESSION_SECRET, encoded)}`;
}

export async function readSession(request: Request, cookieName: string, role: SessionPayload["role"]) {
  const value = (request.headers.get("cookie") ?? "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(signature, await hmac((await config()).PORTAL_SESSION_SECRET, encoded))) return null;
  const payload = decodePayload(encoded);
  return !payload || payload.role !== role || payload.exp < Date.now() ? null : payload;
}

export function sessionCookie(name: string, value: string) { return `${name}=${value}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`; }
export function clearCookie(name: string) { return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`; }

async function supabase(path: string, init: RequestInit = {}) {
  const runtime = await config();
  const response = await fetch(`${runtime.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: runtime.SUPABASE_PUBLISHABLE_KEY,
      "x-portal-api-key": runtime.SUPABASE_PORTAL_TOKEN,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.status === 204 ? null : response.json();
}

async function storage(path: string, init: RequestInit = {}) {
  const runtime = await config();
  const response = await fetch(`${runtime.SUPABASE_URL}/storage/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: runtime.SUPABASE_PUBLISHABLE_KEY,
      "x-portal-api-key": runtime.SUPABASE_PORTAL_TOKEN,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    if (response.status === 402 || details.includes("exceed_egress_quota")) {
      throw new Error("El almacenamiento de Supabase está suspendido por exceso de cuota.");
    }
    throw new Error(`Storage request failed (${response.status}): ${details}`);
  }

  return response;
}

const graphFields = [
  "id", "company_name", "email", "status", "submission", "document_names", "created_at", "updated_at",
  "company:provider_company_information(company_email,legal_name,nit,verification_digit,person_type,company_size,city,department,address,contact_email,phone)",
  "representative:provider_legal_representatives(full_name,identification_number,email,job_title)",
  "offer:provider_offers(rup_status)",
  "categories:provider_offer_categories(category)",
  "documents:provider_documents(document_type,document_name,storage_path,content_type,file_size,uploaded_at)",
  "authorizations:provider_authorizations(fictitious_data_confirmed,non_official_declaration,accepted_at)",
].join(",");

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

function materialize(row: GraphRow): PortalProvider {
  const company = one(row.company);
  const representative = one(row.representative);
  const offer = one(row.offer);
  const authorizations = one(row.authorizations);
  const legacyData = row.submission?.data ?? {};
  const normalizedData: Record<string, string> = {
    companyEmail: company?.company_email ?? legacyData.companyEmail ?? row.email,
    razonSocial: company?.legal_name ?? legacyData.razonSocial ?? row.company_name,
    nit: company?.nit ?? legacyData.nit ?? "",
    digito: company?.verification_digit ?? legacyData.digito ?? "",
    tipo: company?.person_type ?? legacyData.tipo ?? "",
    tamano: company?.company_size ?? legacyData.tamano ?? "",
    ciudad: company?.city ?? legacyData.ciudad ?? "",
    departamento: company?.department ?? legacyData.departamento ?? "",
    direccion: company?.address ?? legacyData.direccion ?? "",
    contacto: company?.contact_email ?? legacyData.contacto ?? "",
    telefono: company?.phone ?? legacyData.telefono ?? "",
    representante: representative?.full_name ?? legacyData.representante ?? "",
    cedula: representative?.identification_number ?? legacyData.cedula ?? "",
    repCorreo: representative?.email ?? legacyData.repCorreo ?? "",
    cargo: representative?.job_title ?? legacyData.cargo ?? "",
    rup: offer?.rup_status ?? legacyData.rup ?? "",
  };
  const documentNames = row.documents?.length
    ? Object.fromEntries(row.documents.map((document) => [document.document_type, document.document_name]))
    : row.document_names ?? {};
  const documentFiles = Object.fromEntries((row.documents ?? []).map((document) => [
    document.document_type,
    {
      document_name: document.document_name,
      content_type: document.content_type,
      file_size: document.file_size,
      uploaded_at: document.uploaded_at,
      available: Boolean(document.storage_path),
    },
  ]));
  return {
    id: row.id,
    company_name: row.company_name,
    email: row.email,
    status: row.status,
    submission: {
      data: normalizedData,
      categories: row.categories?.map((item) => item.category) ?? row.submission?.categories ?? [],
      authorizations: authorizations ? {
        fictitious_data_confirmed: authorizations.fictitious_data_confirmed,
        non_official_declaration: authorizations.non_official_declaration,
        accepted_at: authorizations.accepted_at,
      } : row.submission?.authorizations ?? {},
    },
    document_names: documentNames,
    document_files: documentFiles,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createProvider(company: string, email: string, password: string) {
  const rows = await supabase("portal_providers?select=id", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ company_name: company.trim(), email: normalizeEmail(email), password_hash: await hashPassword(password) }),
  }) as Array<{ id: string }>;
  const provider = rows[0] ? await getProviderById(rows[0].id) : null;
  if (!provider) throw new Error("Provider creation returned no record");
  return provider;
}

export async function getProviderByEmail(email: string): Promise<ProviderRow | null> {
  const select = `${graphFields},password_hash`;
  const rows = await supabase(`portal_providers?select=${encodeURIComponent(select)}&email=eq.${encodeURIComponent(normalizeEmail(email))}&limit=1`) as GraphRow[];
  return rows[0] ? { ...materialize(rows[0]), password_hash: rows[0].password_hash ?? "" } : null;
}

export async function getProviderById(id: string) {
  const rows = await supabase(`portal_providers?select=${encodeURIComponent(graphFields)}&id=eq.${encodeURIComponent(id)}&limit=1`) as GraphRow[];
  return rows[0] ? materialize(rows[0]) : null;
}

export async function listProviders() {
  const rows = await supabase(`portal_providers?select=${encodeURIComponent(graphFields)}&order=created_at.desc&limit=200`) as GraphRow[];
  return rows.map(materialize);
}

export async function saveProviderSubmission(id: string, submission: Record<string, unknown>, documentNames: Record<string, string>, status: PortalProvider["status"]) {
  const data = typeof submission.data === "object" && submission.data ? submission.data : {};
  const categories = Array.isArray(submission.categories) ? submission.categories : [];
  const authorizations = typeof submission.authorizations === "object" && submission.authorizations ? submission.authorizations : {};
  const safeDocumentNames = Object.fromEntries(
    Object.entries(documentNames).filter(([documentType]) => isDocumentType(documentType)),
  );
  const assignedDocumentName = (await getProviderById(id))?.document_names[ADMIN_DOCUMENT_TYPE];
  if (assignedDocumentName) safeDocumentNames[ADMIN_DOCUMENT_TYPE] = assignedDocumentName;
  await supabase("rpc/save_portal_provider_records", {
    method: "POST",
    body: JSON.stringify({
      p_provider_id: id,
      p_data: data,
      p_categories: categories,
      p_document_names: safeDocumentNames,
      p_status: status,
      p_authorizations: authorizations,
    }),
  });
  return getProviderById(id);
}

export async function uploadProviderDocument(
  providerId: string,
  documentType: StoredDocumentType,
  documentName: string,
  contents: ArrayBuffer,
) {
  const storagePath = `${providerId}/${documentType}.pdf`;
  await storage(`object/${DOCUMENT_BUCKET}/${storagePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    },
    body: contents,
  });

  const rows = await supabase("provider_documents?on_conflict=provider_id,document_type", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      provider_id: providerId,
      document_type: documentType,
      document_name: documentName,
      storage_path: storagePath,
      content_type: "application/pdf",
      file_size: contents.byteLength,
      uploaded_at: new Date().toISOString(),
    }),
  }) as Array<{
    document_type: string;
    document_name: string;
    content_type: string;
    file_size: number;
    uploaded_at: string;
  }>;

  const document = rows[0];
  if (!document) throw new Error("Document upload returned no metadata");
  return document;
}

export async function downloadProviderDocument(providerId: string, documentType: StoredDocumentType) {
  const rows = await supabase(
    `provider_documents?select=document_name,storage_path,content_type,file_size` +
    `&provider_id=eq.${encodeURIComponent(providerId)}` +
    `&document_type=eq.${encodeURIComponent(documentType)}&limit=1`,
  ) as Array<{
    document_name: string;
    storage_path: string | null;
    content_type: string | null;
    file_size: number | null;
  }>;
  const document = rows[0];
  if (!document?.storage_path) return null;

  const expectedPath = `${providerId}/${documentType}.pdf`;
  if (document.storage_path !== expectedPath) {
    throw new Error("La ruta del documento no coincide con el proveedor autorizado.");
  }

  const response = await storage(`object/authenticated/${DOCUMENT_BUCKET}/${expectedPath}`);
  return { document, response };
}

export function publicProvider(row: ProviderRow): PortalProvider {
  return {
    id: row.id, company_name: row.company_name, email: row.email, status: row.status,
    submission: row.submission, document_names: row.document_names, document_files: row.document_files,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

export function normalizeCredentials(email: string, password: string) { return { email: normalizeEmail(email), password }; }