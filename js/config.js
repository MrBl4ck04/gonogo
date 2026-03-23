/* ==========================================
   GO / NO-GO - Configuration
   ==========================================
   Edita este archivo para personalizar las reglas
   de evaluación y las herramientas aprobadas.
   ========================================== */

const CONFIG = {
    // ─────────────────────────────────────────
    // Información de la empresa
    // ─────────────────────────────────────────
    company: {
        name: "Red Enlace",
        securityEmail: "franz.carvajal01@gmail.com",
        notificationEmail: "franz.carvajal01@gmail.com",
        domain: "redenlace.com.bo"
    },

    // ─────────────────────────────────────────
    // Herramientas de IA Pre-aprobadas
    // Si el usuario solicita una de estas, se
    // aprueba automáticamente (GO directo)
    // ─────────────────────────────────────────
    approvedTools: [
        {
            name: "ChatGPT",
            aliases: ["chatgpt", "chat gpt", "openai", "gpt", "gpt-4", "gpt-4o", "gpt4", "chatgpt (openai)"],
            conditions: "No ingresar datos confidenciales, personales ni financieros. Uso general permitido.",
            url: "https://chat.openai.com"
        },
        {
            name: "Google Gemini",
            aliases: ["gemini", "google gemini", "bard", "google bard", "gemini pro", "gemini ultra"],
            conditions: "No ingresar datos confidenciales, personales ni financieros. Uso general permitido.",
            url: "https://gemini.google.com"
        }
    ],

    // ─────────────────────────────────────────
    // Clasificación de niveles de riesgo
    // por tipo de dato
    // ─────────────────────────────────────────
    dataRiskLevels: {
        "publico": { level: "bajo", score: 0, label: "Bajo" },
        "interno": { level: "medio", score: 1, label: "Medio" },
        "personal": { level: "alto", score: 3, label: "Alto" },
        "financiero": { level: "alto", score: 3, label: "Alto" },
        "confidencial": { level: "critico", score: 5, label: "Crítico" },
        "sensible": { level: "critico", score: 5, label: "Crítico" }
    },

    // ─────────────────────────────────────────
    // Umbrales de decisión
    // ─────────────────────────────────────────
    thresholds: {
        // Puntaje máximo para aprobación automática
        autoApproveMaxScore: 1,
        // Puntaje que requiere revisión manual obligatoria
        manualReviewMinScore: 3
    },

    // ─────────────────────────────────────────
    // Configuración de la IA de análisis
    // Google Gemini API - Tier gratuito
    // 15 requests/min, sin tarjeta de crédito
    //
    // Para obtener tu API key gratis:
    // 1. Ve a https://aistudio.google.com/apikey
    // 2. Crea una API key (gratis, sin tarjeta)
    // 3. Pégala abajo
    // ─────────────────────────────────────────
    ai: {
        provider: "openrouter", // "openrouter" | "gemini" | "none" (sin IA, solo reglas)
        apiKey: "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",
        model: "nvidia/nemotron-3-super-120b-a12b:free", // Modelo gratuito en OpenRouter (120B params)
        // Prompt del sistema para el análisis
        systemPrompt: `Eres un analista de seguridad de la información y gobernanza de IA de la empresa Red Enlace.
Tu tarea es evaluar solicitudes de uso de herramientas de inteligencia artificial.

CONTEXTO:
- Las únicas herramientas pre-aprobadas son: ChatGPT y Google Gemini (para uso general sin datos sensibles)
- La empresa maneja datos financieros y de transacciones
- Se debe cumplir con regulaciones de protección de datos

CRITERIOS DE EVALUACIÓN:
1. SEGURIDAD: ¿La herramienta tiene políticas claras de privacidad? ¿Almacena datos de usuarios?
2. PERTINENCIA: ¿El caso de uso es legítimo y beneficioso para el trabajo?
3. RIESGO DE DATOS: ¿Los datos que se ingresarán son apropiados para una herramienta externa?
4. ALTERNATIVAS: ¿Podría usarse una herramienta ya aprobada en su lugar?

RESPONDE EN FORMATO JSON EXACTO (sin markdown, sin backticks):
{
    "decision": "GO" | "REVIEW" | "NOGO",
    "riskLevel": "bajo" | "medio" | "alto" | "critico",
    "analysis": "Análisis breve de 2-3 oraciones",
    "reasons": ["razón 1", "razón 2", "razón 3"],
    "recommendations": ["recomendación 1", "recomendación 2"],
    "alternatives": "Herramientas alternativas ya aprobadas (si aplica)"
}

REGLAS:
- Si involucra datos sensibles, personales, financieros o confidenciales → SIEMPRE "REVIEW" (revisión manual)
- Si la herramienta es poco conocida o no tiene políticas claras → "REVIEW"
- Si el caso de uso es claramente legítimo con datos públicos → puede ser "GO"
- Si la herramienta tiene riesgos evidentes de seguridad → "NOGO"
- En caso de duda, prefiere "REVIEW" sobre "GO"`
    },

    // ─────────────────────────────────────────
    // Mensajes personalizables
    // ─────────────────────────────────────────
    messages: {
        goTitle: "¡GO! — Solicitud Aprobada",
        goSubtitle: "Tu solicitud ha sido aprobada automáticamente",
        reviewTitle: "EN REVISIÓN — Derivado a Seguridad",
        reviewSubtitle: "Tu solicitud requiere revisión del equipo de Seguridad de la Información",
        nogoTitle: "NO-GO — Solicitud No Aprobada",
        nogoSubtitle: "La herramienta no cumple con los criterios de seguridad requeridos",
        preApprovedGo: "¡GO! — Herramienta Pre-Aprobada",
        preApprovedSubtitle: "Esta herramienta ya está autorizada para uso en la empresa"
    }
};
