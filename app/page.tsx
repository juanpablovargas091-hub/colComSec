"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";

type View = "access" | "portal" | "admin";
type DocumentFile = {
  document_name: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  available: boolean;
};
type Account = {
  id: string;
  company: string;
  email: string;
  assignedDocument: DocumentFile | null;
  authorizations: Record<string, boolean | string | null>;
};
type Provider = {
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
  document_files?: Record<string, DocumentFile>;
  created_at: string;
  updated_at: string;
};

const steps = ["Información de la empresa", "Representante legal", "Oferta y experiencia", "Documentos requeridos", "Autorizaciones"];
const categories = ["Alimentos y productos alimentarios", "Dotaciones e insumos", "Servicios logísticos y operativos", "Servicios de mantenimiento", "Elementos pedagógicos o educativos", "Otro"];
const documents = [
  ["camara", "Cámara de Comercio"],
  ["cedulaDoc", "Fotocopia cédula del Representante Legal"],
  ["rut", "RUT actualizado"],
  ["banco", "Certificación bancaria reciente"],
  ["financieros", "Estados financieros del último año"],
] as const;
const assignedDocumentType = "adminDocument";

const initialData: Record<string, string> = {
  companyEmail: "", razonSocial: "", nit: "", digito: "", tipo: "", tamano: "", ciudad: "", departamento: "", direccion: "", contacto: "", telefono: "", representante: "", cedula: "", repCorreo: "", cargo: "", rup: "",
};

function Stripe() {
  return <div className="stripe" aria-hidden="true"><i /><i /><i /></div>;
}

function Brand({ small = false }: { small?: boolean }) {
  return <div className="brand"><Image src="/logo-cce.png" alt="Colombia Compra Eficiente" width={small ? 124 : 168} height={small ? 60 : 81} quality={100} priority unoptimized /><div><strong>SECOP · Portal de Proveedores</strong><span>Colombia Compra Eficiente</span></div></div>;
}

function Notice() {
  return <div className="notice"><strong>PORTAL CAUTIVO INTERNO</strong><span>Use únicamente este portal cautivo.</span></div>;
}

function accountFrom(provider: Provider): Account {
  return {
    id: provider.id,
    company: provider.company_name,
    email: provider.email,
    assignedDocument: provider.document_files?.[assignedDocumentType] ?? null,
    authorizations: provider.submission?.authorizations ?? {},
  };
}

export default function Home() {
  const [view, setView] = useState<View>("access");
  const [account, setAccount] = useState<Account | null>(null);
  const [data, setData] = useState(initialData);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  const hydrateProvider = useCallback((provider: Provider) => {
    const savedData = provider.submission?.data ?? {};
    setAccount(accountFrom(provider));
    setData({ ...initialData, ...savedData, razonSocial: savedData.razonSocial || provider.company_name, companyEmail: savedData.companyEmail || provider.email });
    setFiles(provider.document_names ?? {});
    setSelectedCategories(provider.submission?.categories ?? []);
    setSubmitted(provider.status === "submitted");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session: { role: "provider" | "admin" | null; provider?: Provider }) => {
        if (!active) return;
        if (session.role === "admin") setView("admin");
        if (session.role === "provider" && session.provider) { hydrateProvider(session.provider); setView("portal"); }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoadingSession(false); });
    return () => { active = false; };
  }, [hydrateProvider]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setView("access"); setAccount(null); setData(initialData); setFiles({}); setSelectedCategories([]); setSubmitted(false);
  }

  if (loadingSession) return <main><Notice /><div className="loading-page"><div className="spinner" /><p>Validando la sesión interna…</p></div></main>;

  return (
    <main>
      <Notice />
      {view === "access" && <Access onProvider={(provider) => { hydrateProvider(provider); setView("portal"); }} onAdmin={() => setView("admin")} />}
      {view === "portal" && <Portal account={account} data={data} files={files} categories={selectedCategories} submitted={submitted} setData={setData} setFiles={setFiles} setCategories={setSelectedCategories} onSubmit={() => setSubmitted(true)} onExit={logout} />}
      {view === "admin" && <Admin onExit={logout} />}
    </main>
  );
}

function Access({ onProvider, onAdmin }: { onProvider: (provider: Provider) => void; onAdmin: () => void }) {
  return (
    <div className="access-grid">
      <section className="hero"><Brand /><div className="hero-content"><div className="hero-visual"><div className="hero-visual-identity"><Image src="/logo-cce.png" alt="Agencia Nacional de Contratación Pública Colombia Compra Eficiente" width={530} height={256} sizes="240px" quality={100} className="hero-visual-logo" priority unoptimized /><span>Portal de proveedores</span><Stripe /></div><Image src="/provider-support-photo-hd.png" alt="Asesora brindando atención digital a proveedores" width={1672} height={941} sizes="(max-width: 900px) 100vw, 360px" quality={100} className="hero-visual-photo" priority unoptimized /></div><p className="eyebrow">Entorno de contratc · 2026</p><h1>Vincúlese como proveedor del Estado en el SECOP</h1><p>registro Interno de empresas, diligenciamiento y revisión del flujo documental.</p></div><div className="hero-foot"><Stripe /><span>Auditoría funcional · Datos ingresados verificados</span></div></section>
      <section className="access-side"><div className="mobile-brand"><Brand small /></div><div className="access-card"><Stripe /><AccessForm onProvider={onProvider} onAdmin={onAdmin} /></div><small>Agencia Nacional de Contratación Pública · Colombia Compra Eficiente</small></section>
    </div>
  );
}

function AccessForm({ onProvider, onAdmin }: { onProvider: (provider: Provider) => void; onAdmin: () => void }) {
  const [mode, setMode] = useState<"register" | "login" | "admin">("register");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (mode === "register" && (!company.trim() || !email.trim() || password.length < 8)) { setError("Complete los campos y use una contraseña de mínimo 8 caracteres."); return; }
    if (mode !== "register" && (!email.trim() || !password)) { setError("Ingrese el correo y la contraseña."); return; }
    setBusy(true);
    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { company: company.trim(), email: email.trim(), password } : { role: mode === "admin" ? "admin" : "provider", email: email.trim(), password }),
      });
      const result = await response.json() as { error?: string; provider?: Provider };
      if (!response.ok) throw new Error(result.error || "No fue posible completar el acceso.");
      if (mode === "admin") onAdmin(); else if (result.provider) onProvider(result.provider);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible completar el acceso.");
    } finally { setBusy(false); }
  }

  const changeMode = (next: "register" | "login" | "admin") => { setMode(next); setError(""); setPassword(""); };
  return (
    <form className="form" onSubmit={submit}>
      <span className="pill">{mode === "admin" ? "Licitacion directa" : "Datos"}</span>
      <h2>{mode === "register" ? "Crear cuenta de proveedor" : mode === "login" ? "Iniciar sesión" : "Acceso administrativo"}</h2>
      <p>{mode === "admin" ? "Ingrese las credenciales administrativas autorizadas." : mode === "register" ? "Registre una empresa aparecerá de inmediato en el panel." : "Ingrese con una cuenta de proveedor registrada."}</p>
      {mode === "register" && <Field label="Nombre de la empresa"><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Ej. Empresa Demo S.A.S." /></Field>}
      <Field label={mode === "admin" ? "Correo administrativo" : "Correo"}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={mode === "admin" ? "administrador@entidad.gov.co" : "demo@ejemplo.com"} autoComplete="username" /></Field>
      <Field label={mode === "admin" ? "Contraseña" : "Contraseña temporal"}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Ingrese su contraseña"} autoComplete={mode === "register" ? "new-password" : "current-password"} /></Field>
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>{busy ? "Validando…" : mode === "register" ? "Crear cuenta" : mode === "login" ? "Ingresar al portal" : "Ingresar al panel"}</button>
      {mode !== "admin" ? <><p className="switch">{mode === "register" ? "¿Ya creó una cuenta?" : "¿No tiene cuenta?"} <button type="button" onClick={() => changeMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Iniciar sesión" : "Registrarse"}</button></p><button className="link-button" type="button" onClick={() => changeMode("admin")}>Abrir panel administrativo</button></> : <button className="link-button" type="button" onClick={() => changeMode("login")}>Volver al acceso de proveedores</button>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Header({ onExit }: { onExit: () => void }) { return <header><Stripe /><div className="header-inner"><Brand small /><button className="secondary" onClick={onExit}>Cerrar sesión</button></div></header>; }

function Portal({ account, data, files, categories: chosen, submitted, setData, setFiles, setCategories, onSubmit, onExit }: {
  account: Account | null; data: Record<string, string>; files: Record<string, string>; categories: string[]; submitted: boolean;
  setData: (value: Record<string, string>) => void; setFiles: (value: Record<string, string>) => void; setCategories: (value: string[]) => void; onSubmit: () => void; onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"tray" | "form">(submitted ? "tray" : "form");
  const [accepted, setAccepted] = useState([
    Boolean(account?.authorizations.fictitious_data_confirmed),
    Boolean(account?.authorizations.non_official_declaration),
  ]);
  const [assignedDocument, setAssignedDocument] = useState<DocumentFile | null>(account?.assignedDocument ?? null);
  const [refreshingDocument, setRefreshingDocument] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null);
  const patch = (key: string, value: string) => setData({ ...data, [key]: value });
  const progress = Math.round(((step + 1) / steps.length) * 100);

  useEffect(() => {
    setAssignedDocument(account?.assignedDocument ?? null);
    setAccepted([
      Boolean(account?.authorizations.fictitious_data_confirmed),
      Boolean(account?.authorizations.non_official_declaration),
    ]);
  }, [account]);

  useEffect(() => {
    if (submitted) setTab("tray");
  }, [submitted]);

  const refreshAssignedDocument = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshingDocument(true);
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const session = await response.json() as { role: "provider" | "admin" | null; provider?: Provider };
      const sessionProvider = session.provider;
      if (response.ok && session.role === "provider" && sessionProvider && sessionProvider.id === account?.id) {
        setAssignedDocument(sessionProvider.document_files?.[assignedDocumentType] ?? null);
      }
    } finally {
      if (showLoading) setRefreshingDocument(false);
    }
  }, [account?.id]);

  useEffect(() => {
    if (!submitted || tab !== "tray") return;
    void refreshAssignedDocument();
    const interval = window.setInterval(() => { void refreshAssignedDocument(); }, 15000);
    const onFocus = () => { void refreshAssignedDocument(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [refreshAssignedDocument, submitted, tab]);

  async function save(status: "draft" | "submitted") {
    const response = await fetch("/api/providers/submission", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission: {
          data,
          categories: chosen,
          authorizations: {
            fictitious_data_confirmed: accepted[0],
            non_official_declaration: accepted[1],
          },
        },
        document_names: files,
        status,
      }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "No fue posible guardar el formulario.");
  }

  async function next() {
    if (submitted) {
      if (step === steps.length - 1) setTab("tray");
      else setStep(step + 1);
      return;
    }
    const invalid = [!data.razonSocial || !data.nit || !data.ciudad || !data.contacto, !data.representante || !data.cedula || !data.repCorreo, chosen.length === 0 || !data.rup, documents.some(([key]) => !files[key]), !accepted[0] || !accepted[1]][step];
    if (invalid) { setError("Complete los campos requeridos para continuar."); return; }
    setError(""); setSaving(true);
    try { const finalStep = step === steps.length - 1; await save(finalStep ? "submitted" : "draft"); if (finalStep) onSubmit(); else setStep(step + 1); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el formulario."); }
    finally { setSaving(false); }
  }

  return (
    <div className="page"><Header onExit={onExit} /><div className="portal-grid">
      <aside className="profile"><div className="avatar">{(account?.company || "D")[0].toUpperCase()}</div><h3>{data.razonSocial || account?.company || "Empresa demo"}</h3><p>{account?.email || "demo@ejemplo.com"}</p><span className={`status${submitted ? " submitted" : ""}`}>{submitted ? "Postulación enviada" : "Borrador guardado"}</span><hr /><dl className="profile-details"><div><dt>Empresa</dt><dd>{data.razonSocial || account?.company || "—"}</dd></div><div><dt>Representante legal</dt><dd>{data.representante || "Por diligenciar"}</dd></div><div><dt>Identificación</dt><dd>{data.cedula || "Por diligenciar"}</dd></div></dl><small>El avance queda disponible al volver a iniciar sesión.</small></aside>
      <div className="portal-content">
        {submitted && <nav className="portal-tabs" aria-label="Panel del usuario"><button className={tab === "tray" ? "active" : ""} onClick={() => setTab("tray")}>Mi bandeja</button><button className={tab === "form" ? "active" : ""} onClick={() => { setTab("form"); setStep(0); }}>Formulario (solo lectura)</button></nav>}
        {submitted && tab === "tray" ? <section className="user-tray"><article className="tray-summary"><span className="tray-check">✓</span><h1>Tu documentación fue enviada con éxito</h1>
        <p>Tu información permanece disponible en el panel. Consulta aquí los documentos de que el administrador publique para tu usuario.</p></article><article className="tray-document">
          <div className="tray-document-heading">
</div>{assignedDocument?.available ? <div className="assigned-file"><div><strong>{assignedDocument.document_name}</strong>
<span>{assignedDocument.uploaded_at ? `Publicado el ${new Date(assignedDocument.uploaded_at).toLocaleString("es-CO")}` : "Documento disponible"}</span></div>
<a className="primary download-assigned" href="/api/providers/assigned-document" download={assignedDocument.document_name}>Descargar documento PDF</a></div> : 
<div className="document-postulacion-box" style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', marginTop: '20px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Documento de la postulación</h3>
    
    <button 
      type="button" 
      className="btn-actualizar" 
      disabled={refreshingDocument}
      onClick={() => void refreshAssignedDocument(true)}
      style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '4px', cursor: 'pointer' }}
    >
      {refreshingDocument ? "Actualizando…" : "Actualizar"}
    </button>
  </div>

  {assignedDocument?.available ? (
    <div className="admin-assigned-file" style={{ padding: '16px', border: '1px solid #bfdbfe', borderRadius: '6px', backgroundColor: '#eff6ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <strong style={{ color: '#1e40af', display: 'block' }}>{assignedDocument.document_name}</strong>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Documento emitido para su revisión y firma digital o física.</p>
      </div>
      <a 
        className="download-document" 
        href="/api/providers/assigned-document?download=true"
        style={{ backgroundColor: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}
      >
        Descargar PDF para Firmar
      </a>
    </div>
  ) : (
    <div className="user-upload-signed-zone" style={{ padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
        <strong>Espacio liberado para radicación:</strong> Adjunte aquí el documento de postulación definitivo debidamente firmado, escaneado y con huella en formato PDF.
      </p>
      
      <label 
        className={`primary user-upload-button${uploadingDocument === 'adminDocument' ? " disabled" : ""}`} 
        style={{ 
          alignSelf: 'flex-start', 
          cursor: 'pointer',
          display: 'inline-block',
          padding: '10px 20px',
          textAlign: 'center'
        }}
      >
        {uploadingDocument === 'adminDocument' ? "Subiendo archivo firmado…" : "Subir documento firmado y huellado"}
        
        <input 
          type="file" 
          accept=".pdf,application/pdf" 
          disabled={uploadingDocument === 'adminDocument'} 
          style={{ display: 'none' }} 
          onChange={(event) => { 
            const file = event.target.files?.[0];
            if (!file) return;

            if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith('.pdf')) {
              alert("Seleccione únicamente documentos en formato PDF.");
              return;
            }
            if (file.size === 0 || file.size > 4 * 1024 * 1024) {
              alert("El documento PDF debe pesar máximo 4 MB.");
              return;
            }

            const uploadSignedDocument = async () => {
              try {
                const form = new FormData();
                form.append("file", file);
                
                const response = await fetch(`/api/providers/documents/adminDocument`, {
                  method: "POST",
                  headers: {
                    "X-Provider-Id": account?.id || "" 
                  },
                  body: form,
                });
                
                if (response.ok) {
                  setFiles({ ...files, adminDocument: file.name });
                  void refreshAssignedDocument(true);
                } else {
                  console.error("No fue posible cargar el documento firmado.");
                }
              } catch (err) {
                console.error("Error en la petición de subida:", err);
              }
            };

            void uploadSignedDocument();
            event.currentTarget.value = ""; 
          }} 
        />
      </label>

      <small style={{ fontSize: '12px', color: '#94a3b8' }}>Solo formato PDF, máximo 4 MB.</small>
    </div>
  )}
</div>

}</article></section> : <section className="wizard">{submitted && <p className="read-only-notice">Esta postulación ya fue enviada. La información se muestra en modo solo lectura.</p>}<div className="wizard-title"><div><p>Paso {step + 1} de {steps.length}</p><h1>{steps[step]}</h1></div><strong>{submitted ? 100 : progress}%</strong></div><div className="progress"><i style={{ width: `${submitted ? 100 : progress}%` }} /></div>
          
          <ol>{steps.map((item, index) => <li key={item} className={index === step ? "active" : index < step || submitted ? "done" : ""}><span>{index < step || submitted && index !== step ? "✓" : index + 1}</span>{item}</li>)}</ol>
          <fieldset className="step-body read-only-fields" disabled={submitted}>{step === 0 && <Company data={data} patch={patch} />}{step === 1 && <Representative data={data} patch={patch} />}{step === 2 && <Offer data={data} patch={patch} chosen={chosen} setChosen={setCategories} />}{step === 3 && <Docs files={files} setFiles={setFiles} uploading={uploadingDocument} onUploading={setUploadingDocument} onError={setError} />}{step === 4 && <div className="checks"><label><input type="checkbox" checked={accepted[0]} onChange={(event) => setAccepted([event.target.checked, accepted[1]])} /><span><strong>Autorización simulada.</strong> Confirmo que solo utilicé datos reales y veridicos.</span></label><label><input type="checkbox" checked={accepted[1]} onChange={(event) => setAccepted([accepted[0], event.target.checked])} /><span><strong>Declaración.</strong> Comprendo que esta demostración no radica una solicitud oficial.</span></label></div>}{error && <p className="error">{error}</p>}</fieldset>
          <div className="wizard-actions"><button className="secondary" disabled={step === 0 || saving || Boolean(uploadingDocument)} onClick={() => setStep(step - 1)}>Anterior</button><button className="primary" disabled={saving || Boolean(uploadingDocument)} onClick={next}>{submitted ? step === 4 ? "Volver a mi bandeja" : "Siguiente" : uploadingDocument ? "Subiendo documento…" : saving ? "Guardando…" : step === 4 ? "Finalizar simulación" : "Guardar y continuar"}</button></div>
        </section>}
      </div>
    </div></div>
  );
}

function Company({ data, patch }: StepComponentProps) {
  return <div className="fields"><Field label="Correo electrónico"><input type="email" value={data.companyEmail} onChange={(event) => patch("companyEmail", event.target.value)} /></Field><Field label="Razón social"><input value={data.razonSocial} onChange={(event) => patch("razonSocial", event.target.value)} /></Field><Field label="NIT "><input value={data.nit} onChange={(event) => patch("nit", event.target.value.replace(/\D/g, ""))} placeholder="900123456" /></Field><Field label="Dígito"><input maxLength={1} value={data.digito} onChange={(event) => patch("digito", event.target.value.replace(/\D/g, ""))} /></Field><Field label="Tipo de persona"><Select value={data.tipo} options={["Persona jurídica", "Persona natural comerciante"]} onChange={(value) => patch("tipo", value)} /></Field><Field label="Tamaño empresarial"><Select value={data.tamano} options={["Microempresa", "Pequeña empresa", "Mediana empresa", "Grande"]} onChange={(value) => patch("tamano", value)} /></Field><Field label="Ciudad"><input value={data.ciudad} onChange={(event) => patch("ciudad", event.target.value)} /></Field><Field label="Departamento"><input value={data.departamento} onChange={(event) => patch("departamento", event.target.value)} /></Field><Field label="Dirección "><input value={data.direccion} onChange={(event) => patch("direccion", event.target.value)} /></Field><Field label="Correo de contacto"><input type="email" value={data.contacto} onChange={(event) => patch("contacto", event.target.value)} /></Field><Field label="Teléfono "><input value={data.telefono} onChange={(event) => patch("telefono", event.target.value)} /></Field></div>;
}

type StepComponentProps = { data: Record<string, string>; patch: (key: string, value: string) => void };
function Representative({ data, patch }: StepComponentProps) { return <div className="fields"><Field label="Nombre "><input value={data.representante} onChange={(event) => patch("representante", event.target.value)} /></Field><Field label="Cédula"><input value={data.cedula} onChange={(event) => patch("cedula", event.target.value.replace(/\D/g, ""))} /></Field><Field label="Correo"><input type="email" value={data.repCorreo} onChange={(event) => patch("repCorreo", event.target.value)} /></Field><Field label="Cargo"><input value={data.cargo} onChange={(event) => patch("cargo", event.target.value)} /></Field></div>; }
function Offer({ data, patch, chosen, setChosen }: StepComponentProps & { chosen: string[]; setChosen: (value: string[]) => void }) { const toggle = (item: string) => setChosen(chosen.includes(item) ? chosen.filter((value) => value !== item) : [...chosen, item]); return <div className="offer"><div className="choices">{categories.map((item) => <label key={item} className={chosen.includes(item) ? "checked" : ""}><input type="checkbox" checked={chosen.includes(item)} onChange={() => toggle(item)} />{item}</label>)}</div><Field label="¿Cuenta con RUP vigente?"><Select value={data.rup} options={["Sí", "No"]} onChange={(value) => patch("rup", value)} /></Field></div>; }
function Docs({
  files,
  setFiles,
  uploading,
  onUploading,
  onError,
}: {
  files: Record<string, string>;
  setFiles: (value: Record<string, string>) => void;
  uploading: string | null;
  onUploading: (value: string | null) => void;
  onError: (value: string) => void;
}) {
  async function upload(key: string, file: File | undefined) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
      onError("Seleccione únicamente documentos en formato PDF.");
      return;
    }
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      onError("Cada documento PDF debe pesar máximo 4 MB.");
      return;
    }

    onError("");
    onUploading(key);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/providers/documents/${encodeURIComponent(key)}`, {
        method: "POST",
        body: form,
      });
      const result = await response.json() as {
        error?: string;
        document?: { document_name: string };
      };
      if (!response.ok || !result.document) {
        throw new Error(result.error || "No fue posible cargar el documento PDF.");
      }
      setFiles({ ...files, [key]: result.document.document_name });
    } catch (uploadError) {
      onError(uploadError instanceof Error ? uploadError.message : "No fue posible cargar el documento PDF.");
    } finally {
      onUploading(null);
    }
  }

  return <div className="docs"><p className="safe"><strong>Almacenamiento privado.</strong> Cada documento PDF se guarda de forma protegida en Supabase y podrá descargarse desde el panel administrativo. Máximo 4 MB por archivo.</p>{documents.map(([key, label]) => <label className={`doc${files[key] ? " uploaded" : ""}${uploading === key ? " uploading" : ""}`} key={key}><span><strong>{label}</strong><small>{uploading === key ? "Subiendo PDF a almacenamiento privado…" : files[key] || "Seleccione un PDF de hasta 4 MB"}</small></span><em>{uploading === key ? "Subiendo…" : files[key] ? "Cambiar PDF" : "Subir PDF"}</em><input type="file" accept=".pdf,application/pdf" disabled={Boolean(uploading)} onChange={(event) => { void upload(key, event.target.files?.[0]); }} /></label>)}</div>;
}
function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Seleccione una opción</option>{options.map((item) => <option key={item}>{item}</option>)}</select>; }

function AdminLine({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="record-line"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function RecordSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="record-section"><h3>{title}</h3><div>{children}</div></article>;
}

function DocumentLine({
  provider,
  documentType,
  label,
}: {
  provider: Provider;
  documentType: string;
  label: string;
}) {
  const name = provider.document_names?.[documentType];
  const document = provider.document_files?.[documentType];
  const href = `/api/admin/providers/${encodeURIComponent(provider.id)}/documents/${encodeURIComponent(documentType)}`;

  return <div className="record-line document-record"><span>{label}</span><div className="document-record-value"><strong>{name || "No registrado"}</strong>{document?.available ? <a className="download-document" href={href} download={name}>Descargar PDF</a> : name ? <small>Archivo pendiente de carga</small> : null}</div></div>;
}

function Admin({ onExit }: { onExit: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAssignedDocument, setUploadingAssignedDocument] = useState(false);
  const [assignedDocumentError, setAssignedDocumentError] = useState("");
  const [error, setError] = useState("");
  const [deletingProvider, setDeletingProvider] = useState(false);

  const loadProviders = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/providers", { cache: "no-store" });
      const result = await response.json() as { error?: string; providers?: Provider[] };
      if (!response.ok) throw new Error(result.error || "No fue posible consultar los proveedores.");
      
      const next = result.providers ?? []; 
      setProviders(next); 
      
      const currentId = selectedId;
      setSelectedId(null);
      setTimeout(() => setSelectedId(currentId), 10);

    } catch (requestError) { 
      setError(requestError instanceof Error ? requestError.message : "No fue posible consultar los proveedores."); 
    } finally { 
      setLoading(false); 
    }
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/providers", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { error?: string; providers?: Provider[] };
        if (!response.ok) throw new Error(result.error || "No fue posible consultar los proveedores.");
        return result.providers ?? [];
      })
      .then((next) => {
        if (!active) return;
        setProviders(next);
        if (next.length > 0) {
          setSelectedId(next[0].id);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "No fue posible consultar los proveedores.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function uploadAssignedDocument(providerId: string, file: File | undefined) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
      setAssignedDocumentError("Seleccione únicamente un documento PDF.");
      return;
    }
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      setAssignedDocumentError("El documento PDF debe pesar máximo 4 MB.");
      return;
    }

    setAssignedDocumentError("");
    setUploadingAssignedDocument(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}/assigned-document`, {
        method: "POST",
        body: form,
      });
      const result = await response.json() as { error?: string; provider?: Provider };
      if (!response.ok || !result.provider) throw new Error(result.error || "No fue posible cargar el documento al usuario.");
      const updatedProvider = result.provider;
      setProviders((current) => current.map((provider) => provider.id === providerId ? updatedProvider : provider));
    } catch (uploadError) {
      setAssignedDocumentError(uploadError instanceof Error ? uploadError.message : "No fue posible cargar el documento al usuario.");
    } finally {
      setUploadingAssignedDocument(false);
    }
  }

  const [deletingAssignedDocument, setDeletingAssignedDocument] = useState(false);

  const deleteAssignedDocument = async (providerId: string) => {
    setDeletingAssignedDocument(true);
    try {
      const response = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}/assigned-document`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        setProviders((current) => 
          current.map((provider) => 
            provider.id === providerId ? result.provider : provider
          )
        );
      } else {
        console.error("No fue posible liberar el espacio en el servidor.");
      }
    } catch (error) {
      console.error("Error de conexión al intentar liberar el espacio:", error);
    } finally {
      setDeletingAssignedDocument(false);
    }
  };

  const handleFullDeleteProvider = async (providerId: string, companyName: string) => {
    const confirmDelete = window.confirm(
      `¿Estás absolutamente seguro de eliminar a "${companyName}" por completo?\n\nEsta acción es irreversible: eliminará permanentemente todos sus registros en Postgres y purgará los archivos PDFs asociados en Supabase Storage.`
    );

    if (!confirmDelete) return;

    setDeletingProvider(true);
    try {
      const response = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('La empresa y sus archivos asociados han sido eliminados del sistema de forma definitiva.');
        
        const remainingProviders = providers.filter((p) => p.id !== providerId);
        setProviders(remainingProviders);
        if (remainingProviders.length > 0) {
          setSelectedId(remainingProviders[0].id);
        } else {
          setSelectedId(null);
        }
      } else {
        alert(`Error: ${result.error || 'No se pudo completar la eliminación completa del proveedor.'}`);
      }
    } catch (err) {
      console.error("Error durante la petición de eliminación completa:", err);
      alert('Ocurrió un error de conexión al intentar purgar la empresa.');
    } finally {
      setDeletingProvider(false);
    }
  };

  const selected = providers.find((provider) => provider.id === selectedId) ?? null;
  const selectedData = selected?.submission?.data ?? {};
  const selectedCategories = selected?.submission?.categories ?? [];
  const selectedAuthorizations = selected?.submission?.authorizations ?? {};
  
  const selectedAssignedDocument = selected?.document_names?.[assignedDocumentType] 
  ? { document_name: selected.document_names[assignedDocumentType], available: true, uploaded_at: selected.updated_at }
  : null;

  const submittedCount = providers.filter((provider) => provider.status === "submitted").length;
  return (
    <div className="page"><Header onExit={onExit} /><div className="admin">
      <div className="admin-title"><div><p className="eyebrow">Vista privada</p><h1>Panel administrativo de auditoría</h1><p>Todos los proveedores registrados en la base interna.</p></div><div className="admin-controls"><span className="pill">Supabase conectado</span><button className="secondary" onClick={loadProviders} disabled={loading}>{loading ? "Consultando…" : "Actualizar"}</button></div></div>
      <div className="metrics"><article><strong>{providers.length}</strong><span>Proveedores registrados</span></article><article><strong>{submittedCount}</strong><span>Simulaciones finalizadas</span></article><article><strong>{providers.length - submittedCount}</strong><span>Borradores guardados</span></article></div>
      {error && <p className="error">{error}</p>}
      <div className="admin-grid"><section className="provider-list" aria-label="Proveedores registrados"><div className="provider-list-head"><h2>Registros</h2><span>{providers.length}</span></div>
        {loading && !providers.length ? <p className="empty-state">Cargando proveedores…</p> : providers.length === 0 ? <p className="empty-state">Aún no hay proveedores registrados.</p> : providers.map((provider) => <button key={provider.id} className={`provider-row ${provider.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(provider.id)}>
        <span className="provider-avatar">{provider.company_name ? provider.company_name[0]?.toUpperCase() : "P"}</span><span><strong>{provider.company_name}</strong><small>{provider.email}</small></span><em className={`status ${provider.status}`}>{provider.status === "submitted" ? "Finalizado" : "Borrador"}</em></button>)}
      </section><section className="audit-card provider-detail">{selected ? <>
        <div className="audit-head"><div><h2>{selected.company_name}</h2><p>{selected.email}</p></div><span className="status">{selected.status === "submitted" ? "Recorrido finalizado" : "Borrador guardado"}</span></div>
        <div className="record-sections">
          <RecordSection title="1. Información de la empresa">
            <AdminLine label="Correo de la cuenta" value={selected.email} />
            <AdminLine label="Correo empresarial" value={selectedData.companyEmail} />
            <AdminLine label="Razón social" value={selectedData.razonSocial} />
            <AdminLine label="NIT " value={selectedData.nit ? `${selectedData.nit}-${selectedData.digito || "0"}` : "—"} />
            <AdminLine label="Tipo de persona" value={selectedData.tipo} />
            <AdminLine label="Tamaño empresarial" value={selectedData.tamano} />
            <AdminLine label="Ciudad" value={selectedData.ciudad} />
            <AdminLine label="Departamento" value={selectedData.departamento} />
            <AdminLine label="Dirección " value={selectedData.direccion} />
            <AdminLine label="Correo de contacto" value={selectedData.contacto} />
            <AdminLine label="Teléfono " value={selectedData.telefono} />
          </RecordSection>
          <RecordSection title="2. Representante legal">
            <AdminLine label="Nombre" value={selectedData.representante} />
            <AdminLine label="Identificación" value={selectedData.cedula} />
            <AdminLine label="Correo" value={selectedData.repCorreo} />
            <AdminLine label="Cargo" value={selectedData.cargo} />
          </RecordSection>
          <RecordSection title="3. Oferta y experiencia">
            <AdminLine label="RUP vigente" value={selectedData.rup} />
            {selectedCategories.length ? selectedCategories.map((category, index) => <AdminLine key={category} label={`Categoría \${index + 1}`} value={category} />) : <AdminLine label="Categorías" value="—" />}
          </RecordSection>
          <RecordSection title="4. Documentos registrados">
            {documents.map(([key, label]) => <DocumentLine key={key} provider={selected} documentType={key} label={label} />)}
          </RecordSection>
          <RecordSection title="5. Autorizaciones">
            <AdminLine label="Uso exclusivo de datos segun corresponde la ley" value={selectedAuthorizations.fictitious_data_confirmed ? "Confirmado" : "Pendiente"} />
            <AdminLine label="Reconoce que no es una radicación oficial" value={selectedAuthorizations.non_official_declaration ? "Confirmado" : "Pendiente"} />
            <AdminLine label="Fecha de aceptación" value={typeof selectedAuthorizations.accepted_at === "string" ? new Date(selectedAuthorizations.accepted_at).toLocaleString("es-CO") : "—"} />
          </RecordSection>
          <RecordSection title="6. Contrato">
          <div className="admin-assigned-document">
            <p>Adjunte un PDF exclusivo para este usuario. El archivo quedará disponible en su bandeja personal.</p>
            
            {selectedAssignedDocument?.available && (
              <div className="admin-assigned-file">
                <strong>{selectedAssignedDocument.document_name}</strong>
                <span>{selectedAssignedDocument.uploaded_at ? `Cargado el \${new Date(selectedAssignedDocument.uploaded_at).toLocaleString("es-CO")}` : "Documento cargado"}</span>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <a 
                    className="download-document" 
                    href={`/api/admin/providers/\${encodeURIComponent(selected.id)}/assigned-document`} 
                    download={selectedAssignedDocument.document_name}
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    Descargar PDF
                  </a>
                  
                  <button 
                    type="button"
                    className="delete-document-button"
                    disabled={deletingAssignedDocument}
                    onClick={() => void deleteAssignedDocument(selected.id)}
                    style={{ 
                      flex: 1, 
                      backgroundColor: '#dc2626', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    {deletingAssignedDocument ? "Eliminando…" : "Eliminar y Liberar"}
                  </button>
                </div>
              </div>
            )}

            {assignedDocumentError && <p className="error">{assignedDocumentError}</p>}
            <label 
              className={`primary admin-upload-button ${uploadingAssignedDocument || deletingAssignedDocument ? "disabled" : ""}`}
              style={{ cursor: 'pointer', display: 'inline-block', textAlign: 'center' }}
            >
              {uploadingAssignedDocument ? "Cargando documento…" : selectedAssignedDocument?.available ? "Reemplazar documento del usuario" : "Cargar documento al usuario"}
              <input 
                type="file" 
                accept=".pdf,application/pdf" 
                style={{ display: 'none' }} // 🚀 ESTA LÍNEA OCULTA EL TEXTO MONTADO DEFINITIVAMENTE
                disabled={uploadingAssignedDocument || deletingAssignedDocument} 
                onChange={(event) => { void uploadAssignedDocument(selected.id, event.target.files?.[0]); event.currentTarget.value = ""; }} 
              />
            </label>
            <small>Solo PDF, máximo 4 MB.</small>
          </div>
        </RecordSection>

          <RecordSection title="Control del registro">
            <AdminLine label="Estado" value={selected.status === "submitted" ? "Finalizado" : "Borrador"} />
            <AdminLine label="Creado" value={new Date(selected.created_at).toLocaleString("es-CO")} />
            <AdminLine label="Última actualización" value={new Date(selected.updated_at).toLocaleString("es-CO")} />
          </RecordSection>

          <RecordSection title="⚠️ Zona de Peligro Administrativa">
            <div style={{ 
              padding: '16px', 
              border: '1px solid #fecaca', 
              borderRadius: '6px', 
              backgroundColor: '#fef2f2',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px' 
            }}>
              <p style={{ fontSize: '13px', color: '#991b1b', margin: 0, lineHeight: '1.4' }}>
                <strong>Atención:</strong> Al hacer clic en el botón de abajo se eliminará por completo la cuenta comercial de <strong>{selected.company_name}</strong> de Postgres y se vaciará su respectivo directorio privado dentro del bucket <em>licitaciones</em> de Supabase.
              </p>
              <button
                type="button"
                disabled={deletingProvider}
                onClick={() => void handleFullDeleteProvider(selected.id, selected.company_name)}
                style={{
                  width: '100%',
                  backgroundColor: '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: deletingProvider ? 'not-allowed' : 'pointer',
                  opacity: deletingProvider ? 0.6 : 1,
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => !deletingProvider && (e.currentTarget.style.backgroundColor = '#991b1b')}
                onMouseOut={(e) => !deletingProvider && (e.currentTarget.style.backgroundColor = '#b91c1c')}
              >
                {deletingProvider ? "Purgando empresa y archivos..." : "Eliminar Empresa por Completo"}
              </button>
            </div>
          </RecordSection>
        </div>
        <p className="safe">Los formularios se almacenan en tablas relacionadas y los documentos PDF se conservan en un contenedor privado de Supabase. La descarga requiere una sesión administrativa autorizada.</p>
      </> : <div className="empty-state"><h2>Seleccione un proveedor</h2><p>El detalle del registro aparecerá aquí.</p></div>}</section></div>
    </div></div>
  );
}