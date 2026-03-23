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
    // Configuración de análisis (Sistema de Reglas)
    // ─────────────────────────────────────────
    ai: {
        provider: "none", // Desactivado para usar exclusivamente el motor de reglas
        apiKey: "", 
        model: "",
        SystemPrompt: ""
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
