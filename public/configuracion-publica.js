// CAHOS cloud: la clave publishable identifica la aplicación, no concede acceso a los datos.
// Las consultas SINAVE NO se activan hasta validar agente central, usuarios y permisos.
window.SUIVE_CONFIG = Object.freeze({
  supabaseUrl: "https://lywrtuibmzzsylfbybqo.supabase.co",
  supabasePublishableKey: "sb_publishable_MW2u0v8hucbGgaW5Aol7lA_3mcoFhIy",
  healthPath: "/functions/v1/cahos-api/health",
  apiBaseUrl: "https://lywrtuibmzzsylfbybqo.supabase.co/functions/v1/cahos-api", // Requiere JWT personal y pertenencia habilitada
  backendPhase: "protected_schema_ready"
});
