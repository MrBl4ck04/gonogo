/* ==========================================
   GO / NO-GO - Application Logic
   ========================================== */

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
let currentStep = 1;
const totalSteps = 4;

// Encapsulated state for last submission (replaces window._last* globals)
const lastSubmission = {
    formData: null,
    analysis: null,
    riskScore: null,
    requestId: null
};

// Rate limiting: prevent rapid repeated submissions
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN_MS = 5000;

// ─────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────

function nextStep(from) {
    if (!validateStep(from)) return;
    goToStep(from + 1);
}

function prevStep(from) {
    goToStep(from - 1);
}

function goToStep(step) {
    // Hide current
    document.getElementById(`step${currentStep}`).classList.remove('active');
    // Show target
    document.getElementById(`step${step}`).classList.add('active');
    currentStep = step;
    updateProgress();
    // Scroll to top of form
    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateProgress() {
    const fill = document.getElementById('progressFill');
    fill.style.width = `${(currentStep / totalSteps) * 100}%`;

    document.querySelectorAll('.step').forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
            stepEl.classList.add('active');
        } else if (stepNum < currentStep) {
            stepEl.classList.add('completed');
        }
    });
}

// ─────────────────────────────────────────
// Validation
// ─────────────────────────────────────────

function validateStep(step) {
    clearErrors();
    let isValid = true;

    if (step === 1) {
        isValid = validateRequired('fullName', 'Ingresa tu nombre completo') &&
                  validateEmail('email', 'Ingresa un correo corporativo válido') &&
                  validateRequired('department', 'Selecciona tu departamento') &&
                  validateRequired('position', 'Ingresa tu cargo');
    } else if (step === 2) {
        isValid = validateRequired('aiTool', 'Ingresa el nombre de la herramienta') &&
                  validateUrl('aiUrl', 'Ingresa una URL válida (ej: https://ejemplo.com)') &&
                  validateRequired('aiCategory', 'Selecciona una categoría');
    } else if (step === 3) {
        isValid = validateRequired('useCase', 'Describe el caso de uso') &&
                  validateRequired('frequency', 'Selecciona la frecuencia de uso') &&
                  validateCheckboxGroup('dataType', 'Selecciona al menos un tipo de dato') &&
                  validateRadioGroup('userScope', 'Selecciona quiénes usarán la herramienta');
    }

    return isValid;
}

function validateRequired(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
        showError(fieldId, message);
        return false;
    }
    return true;
}

function validateEmail(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
        showError(fieldId, message);
        return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(field.value)) {
        showError(fieldId, 'El formato del correo no es válido');
        return false;
    }
    return true;
}

function validateUrl(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) return true; // URL is optional
    try {
        const url = new URL(field.value.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
            showError(fieldId, message);
            return false;
        }
        return true;
    } catch {
        showError(fieldId, message);
        return false;
    }
}

function validateCheckboxGroup(name, message) {
    const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
    if (checked.length === 0) {
        showError('dataType', message);
        return false;
    }
    return true;
}

function validateRadioGroup(name, message) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    if (!checked) {
        showError(name, message);
        return false;
    }
    return true;
}

function showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const field = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = message;
    if (field) field.classList.add('error');
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

// ─────────────────────────────────────────
// AI Tool Detection (pre-approved check)
// ─────────────────────────────────────────

const aiToolInput = document.getElementById('aiTool');
if (aiToolInput) {
    aiToolInput.addEventListener('input', function () {
        const value = this.value.toLowerCase().trim();
        const banner = document.getElementById('approvedBanner');
        const match = CONFIG.approvedTools.find(tool =>
            tool.aliases.some(alias => value.includes(alias) || alias.includes(value))
        );
        if (match && value.length > 2) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    });
}

// Character counter for useCase
const useCaseInput = document.getElementById('useCase');
if (useCaseInput) {
    useCaseInput.addEventListener('input', function () {
        const count = this.value.length;
        document.getElementById('useCaseCount').textContent = count;
        if (count > 500) {
            this.value = this.value.substring(0, 500);
        }
    });
}

// ─────────────────────────────────────────
// Form Submission
// ─────────────────────────────────────────

async function submitForm() {
    if (!validateStep(3)) return;

    // Rate limiting
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
        showToast('Por favor espera unos segundos antes de enviar nuevamente', 'error');
        return;
    }

    // Confirmation dialog
    const formData = collectFormData();
    const hasSensitive = formData.dataTypes.some(t =>
        ['sensible', 'confidencial', 'financiero', 'personal'].includes(t)
    );
    const confirmMsg = hasSensitive
        ? `Estás declarando datos sensibles (${formData.dataTypes.join(', ')}). ¿Deseas enviar la solicitud para "${formData.aiTool}"?`
        : `¿Confirmas el envío de la solicitud para "${formData.aiTool}"?`;
    if (!confirm(confirmMsg)) return;

    lastSubmitTime = now;
    showLoading();

    try {
        // Step 1: Check if pre-approved
        await animateLoadingStep(1);
        const preApproved = checkPreApproved(formData.aiTool);

        if (preApproved) {
            // Even pre-approved tools must be reviewed if sensitive data is involved
            const hasSensitiveData = formData.dataTypes.some(t =>
                ['sensible', 'confidencial', 'financiero', 'personal'].includes(t)
            );

            if (!hasSensitiveData) {
                await animateLoadingStep(2);
                await animateLoadingStep(3);
                await animateLoadingStep(4);
                hideLoading();
                clearFormDraft();
                showPreApprovedResult(preApproved, formData);
                return;
            }
            // If sensitive data → fall through to normal evaluation
        }

        // Step 2: Calculate risk score
        await animateLoadingStep(2);
        const riskScore = calculateRiskScore(formData);

        // Step 3: AI Analysis (if configured) or rule-based
        await animateLoadingStep(3);
        let analysis;

        if (CONFIG.ai.provider !== 'none' && CONFIG.ai.apiKey) {
            analysis = await getAIAnalysis(formData, riskScore);
        } else {
            analysis = getRuleBasedAnalysis(formData, riskScore);
        }

        // Step 4: Generate result
        await animateLoadingStep(4);
        await sleep(500);
        hideLoading();
        clearFormDraft();
        showResult(analysis, formData, riskScore);

    } catch (error) {
        console.error('Error during evaluation:', error);
        hideLoading();
        clearFormDraft();
        // Fallback to rule-based
        const riskScore = calculateRiskScore(formData);
        const analysis = getRuleBasedAnalysis(formData, riskScore);
        showResult(analysis, formData, riskScore);
    }
}

function collectFormData() {
    const dataTypes = Array.from(document.querySelectorAll('input[name="dataType"]:checked'))
        .map(cb => cb.value);
    const userScope = document.querySelector('input[name="userScope"]:checked');
    const requiresPayment = document.querySelector('input[name="requiresPayment"]:checked');

    return {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        department: document.getElementById('department').value,
        position: document.getElementById('position').value.trim(),
        aiTool: document.getElementById('aiTool').value.trim(),
        aiUrl: document.getElementById('aiUrl').value.trim(),
        aiCategory: document.getElementById('aiCategory').value,
        aiVersion: document.getElementById('aiVersion').value.trim(),
        useCase: document.getElementById('useCase').value.trim(),
        expectedBenefit: document.getElementById('expectedBenefit').value.trim(),
        frequency: document.getElementById('frequency').value,
        dataTypes: dataTypes,
        userScope: userScope ? userScope.value : '',
        requiresPayment: requiresPayment ? requiresPayment.value : '',
        additionalNotes: document.getElementById('additionalNotes').value.trim(),
        timestamp: new Date().toISOString()
    };
}

// ─────────────────────────────────────────
// Pre-Approved Check
// ─────────────────────────────────────────

function checkPreApproved(toolName) {
    const normalized = toolName.toLowerCase().trim();
    return CONFIG.approvedTools.find(tool =>
        tool.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))
    );
}

// ─────────────────────────────────────────
// Risk Calculation
// ─────────────────────────────────────────

function calculateRiskScore(formData) {
    let score = 0;
    let maxLevelScore = 0;
    let maxLevel = 'bajo';
    const details = [];

    // Data type risk
    formData.dataTypes.forEach(type => {
        const risk = CONFIG.dataRiskLevels[type];
        if (risk) {
            score += risk.score;
            if (risk.score > maxLevelScore) {
                maxLevelScore = risk.score;
                maxLevel = risk.level;
            }
            details.push({ type, level: risk.level, label: risk.label });
        }
    });

    // Scope risk
    const scopeScores = { individual: 0, equipo: 1, departamento: 2, empresa: 3 };
    score += scopeScores[formData.userScope] || 0;

    // Frequency risk
    const freqScores = {
        'Ocasional': 0, 'Mensual': 0, 'Quincenal': 1,
        'Semanal': 1, 'Varias veces por semana': 2, 'Diario': 2
    };
    score += freqScores[formData.frequency] || 0;

    return {
        totalScore: score,
        maxLevel,
        details,
        riskCategory: score <= CONFIG.thresholds.autoApproveMaxScore ? 'low' :
                       score < CONFIG.thresholds.manualReviewMinScore ? 'medium' :
                       score < 6 ? 'high' : 'critical'
    };
}

// ─────────────────────────────────────────
// AI Analysis (Google Gemini Free API)
// ─────────────────────────────────────────

async function getAIAnalysis(formData, riskScore) {
    const userPrompt = `
Evalúa la siguiente solicitud de uso de herramienta de IA:

SOLICITANTE: ${formData.fullName} (${formData.department}, ${formData.position})
HERRAMIENTA: ${formData.aiTool} (${formData.aiCategory})
URL: ${formData.aiUrl || 'No proporcionada'}
VERSIÓN: ${formData.aiVersion || 'No especificada'}
CASO DE USO: ${formData.useCase}
BENEFICIO ESPERADO: ${formData.expectedBenefit || 'No especificado'}
FRECUENCIA: ${formData.frequency}
TIPOS DE DATOS: ${formData.dataTypes.join(', ')}
ALCANCE: ${formData.userScope}
REQUIERE PAGO: ${formData.requiresPayment}
PUNTAJE DE RIESGO CALCULADO: ${riskScore.totalScore} (${riskScore.riskCategory})
NOTAS: ${formData.additionalNotes || 'Ninguna'}
`;

    try {
        let text;

        if (CONFIG.ai.provider === 'openrouter') {
            // OpenRouter API (compatible con OpenAI)
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.ai.apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'GO/NO-GO Red Enlace'
                },
                body: JSON.stringify({
                    model: CONFIG.ai.model,
                    messages: [
                        { role: 'system', content: CONFIG.ai.systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json();
            text = data.choices?.[0]?.message?.content;

        } else {
            // Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.ai.model}:generateContent?key=${CONFIG.ai.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: CONFIG.ai.systemPrompt + "\n\n" + userPrompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 1024
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        if (!text) throw new Error('Empty response');

        // Parse JSON from response (handle potential markdown wrapping)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const result = JSON.parse(jsonMatch[0]);

        // Override: if critical data types, always REVIEW
        if (riskScore.riskCategory === 'critical' || riskScore.riskCategory === 'high') {
            result.decision = 'REVIEW';
        }

        return result;

    } catch (error) {
        console.warn('AI analysis failed, using rule-based fallback:', error);
        return getRuleBasedAnalysis(formData, riskScore);
    }
}

// ─────────────────────────────────────────
// Rule-Based Analysis (fallback / no API)
// ─────────────────────────────────────────

function getRuleBasedAnalysis(formData, riskScore) {
    const hasSensitiveData = formData.dataTypes.some(t =>
        ['sensible', 'confidencial', 'financiero', 'personal'].includes(t)
    );
    const hasOnlyPublicData = formData.dataTypes.every(t => t === 'publico');

    let decision, riskLevel, analysis, reasons, recommendations, alternatives;

    if (hasSensitiveData) {
        decision = 'REVIEW';
        riskLevel = riskScore.maxLevel;
        analysis = `La solicitud de uso de "${formData.aiTool}" involucra datos sensibles o confidenciales, lo cual requiere una revisión manual por parte del equipo de Seguridad de la Información antes de su aprobación. Se evaluarán las políticas de privacidad de la herramienta y su cumplimiento normativo.`;
        reasons = [
            'La solicitud involucra datos sensibles, personales, financieros o confidenciales',
            'Se requiere verificar las políticas de privacidad y manejo de datos de la herramienta',
            'Necesaria evaluación de cumplimiento normativo y regulatorio'
        ];
        recommendations = [
            'No ingresar datos sensibles hasta recibir aprobación formal',
            'Preparar documentación sobre las políticas de privacidad de la herramienta',
            'Considerar si el caso de uso puede adaptarse para usar solo datos públicos'
        ];
        alternatives = 'Evaluar si ChatGPT o Google Gemini (herramientas aprobadas) pueden cubrir el caso de uso sin necesidad de datos sensibles.';

    } else if (hasOnlyPublicData && riskScore.totalScore <= CONFIG.thresholds.autoApproveMaxScore) {
        decision = 'GO';
        riskLevel = 'bajo';
        analysis = `La solicitud de uso de "${formData.aiTool}" para ${formData.aiCategory.toLowerCase()} con datos públicos presenta un nivel de riesgo bajo. El caso de uso es legítimo y no involucra información sensible de la empresa.`;
        reasons = [
            'Solo se manejarán datos de carácter público',
            'El caso de uso es pertinente para las funciones del solicitante',
            'El nivel de riesgo calculado es bajo'
        ];
        recommendations = [
            'Mantener el uso limitado a datos públicos como se declaró',
            'No compartir credenciales corporativas en la herramienta',
            'Reportar cualquier incidente o comportamiento inusual'
        ];
        alternatives = '';

    } else {
        decision = 'REVIEW';
        riskLevel = riskScore.riskCategory === 'critical' ? 'critico' :
                     riskScore.riskCategory === 'high' ? 'alto' : 'medio';
        analysis = `La solicitud de uso de "${formData.aiTool}" requiere una evaluación adicional por el equipo de Seguridad de la Información. El tipo de datos y/o el alcance del uso necesitan ser revisados antes de otorgar la aprobación.`;
        reasons = [
            'La herramienta no se encuentra en la lista de herramientas pre-aprobadas',
            'El tipo de datos o alcance de uso requiere evaluación adicional',
            'Se necesita verificar la idoneidad de la herramienta para el caso de uso propuesto'
        ];
        recommendations = [
            'Esperar la respuesta del equipo de Seguridad de la Información',
            'Mientras tanto, usar las herramientas aprobadas (ChatGPT, Gemini) si es posible',
            'Tener lista la documentación de la herramienta por si es solicitada'
        ];
        alternatives = 'Considerar usar ChatGPT o Google Gemini como alternativas ya aprobadas.';
    }

    return { decision, riskLevel, analysis, reasons, recommendations, alternatives };
}

// ─────────────────────────────────────────
// Display Results
// ─────────────────────────────────────────

function showPreApprovedResult(tool, formData) {
    goToStep(4);
    const step4 = document.getElementById('step4');
    const requestId = generateRequestId();

    // Store for email functions
    lastSubmission.formData = formData;
    lastSubmission.analysis = null;
    lastSubmission.riskScore = null;
    lastSubmission.requestId = requestId;

    step4.innerHTML = `
        <div class="result-container">
            <div class="result-icon go">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 class="go">${escapeHtml(CONFIG.messages.preApprovedGo)}</h2>
            <p class="result-subtitle">${escapeHtml(CONFIG.messages.preApprovedSubtitle)}</p>

            <div class="result-details">
                <h3><i class="fas fa-file-alt"></i> Resumen de la Solicitud</h3>
                <div class="detail-row">
                    <span class="detail-label">Solicitante</span>
                    <span class="detail-value">${escapeHtml(formData.fullName)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Departamento</span>
                    <span class="detail-value">${escapeHtml(formData.department)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Herramienta</span>
                    <span class="detail-value">${escapeHtml(tool.name)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Estado</span>
                    <span class="badge badge-go"><i class="fas fa-check"></i> APROBADO</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Nivel de Riesgo</span>
                    <span class="badge badge-go"><i class="fas fa-shield-halved"></i> Bajo</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fecha</span>
                    <span class="detail-value">${new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ID Solicitud</span>
                    <span class="detail-value">${requestId}</span>
                </div>
            </div>

            <div class="result-analysis">
                <h3><i class="fas fa-info-circle"></i> Condiciones de Uso</h3>
                <p>${escapeHtml(tool.conditions)}</p>
            </div>

            <div class="result-note">
                <i class="fas fa-lightbulb"></i>
                <strong>Recuerda:</strong> Aunque la herramienta está aprobada, nunca ingreses contraseñas, datos de tarjetas, información personal de clientes u otra información sensible. Si tu caso de uso cambia, llena una nueva solicitud.
            </div>

            <div class="result-actions">
                <button class="btn btn-success" onclick="sendEmailNotification()">
                    <i class="fas fa-envelope"></i> Enviar Comprobante por Correo
                </button>
                <button class="btn btn-secondary" onclick="downloadPDF()">
                    <i class="fas fa-download"></i> Descargar Comprobante
                </button>
                <button class="btn btn-secondary" onclick="resetForm()">
                    <i class="fas fa-plus"></i> Nueva Solicitud
                </button>
            </div>
        </div>
    `;
}

function showResult(analysis, formData, riskScore) {
    goToStep(4);
    const step4 = document.getElementById('step4');
    const isGo = analysis.decision === 'GO';
    const isReview = analysis.decision === 'REVIEW';
    const isNogo = analysis.decision === 'NOGO';

    const statusClass = isGo ? 'go' : isReview ? 'review' : 'nogo';
    const icon = isGo ? 'fa-check-circle' : isReview ? 'fa-clock' : 'fa-times-circle';
    const title = isGo ? CONFIG.messages.goTitle : isReview ? CONFIG.messages.reviewTitle : CONFIG.messages.nogoTitle;
    const subtitle = isGo ? CONFIG.messages.goSubtitle : isReview ? CONFIG.messages.reviewSubtitle : CONFIG.messages.nogoSubtitle;
    const badgeClass = isGo ? 'badge-go' : isReview ? 'badge-review' : 'badge-nogo';
    const badgeText = isGo ? 'APROBADO' : isReview ? 'EN REVISIÓN' : 'NO APROBADO';
    const riskClass = riskScore.riskCategory === 'low' ? 'low' :
                       riskScore.riskCategory === 'medium' ? 'medium' :
                       riskScore.riskCategory === 'high' ? 'high' : 'critical';
    const riskLabel = riskScore.riskCategory === 'low' ? 'Bajo' :
                       riskScore.riskCategory === 'medium' ? 'Medio' :
                       riskScore.riskCategory === 'high' ? 'Alto' : 'Crítico';
    const requestId = generateRequestId();

    step4.innerHTML = `
        <div class="result-container">
            <div class="result-icon ${statusClass}">
                <i class="fas ${icon}"></i>
            </div>
            <h2 class="${statusClass}">${title}</h2>
            <p class="result-subtitle">${subtitle}</p>

            <div class="risk-meter">
                <span style="font-size:13px;color:var(--gray-600);font-weight:500;">Nivel de Riesgo:</span>
                <div class="risk-bar">
                    <div class="risk-fill ${riskClass}"></div>
                </div>
                <span class="risk-label ${riskClass}">${riskLabel}</span>
            </div>

            <div class="result-details">
                <h3><i class="fas fa-file-alt"></i> Resumen de la Solicitud</h3>
                <div class="detail-row">
                    <span class="detail-label">Solicitante</span>
                    <span class="detail-value">${escapeHtml(formData.fullName)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Correo</span>
                    <span class="detail-value">${escapeHtml(formData.email)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Departamento</span>
                    <span class="detail-value">${escapeHtml(formData.department)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Herramienta</span>
                    <span class="detail-value">${escapeHtml(formData.aiTool)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Categoría</span>
                    <span class="detail-value">${escapeHtml(formData.aiCategory)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Estado</span>
                    <span class="badge ${badgeClass}"><i class="fas ${icon}"></i> ${badgeText}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fecha</span>
                    <span class="detail-value">${new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ID Solicitud</span>
                    <span class="detail-value">${requestId}</span>
                </div>
            </div>

            <div class="result-analysis">
                <h3><i class="fas fa-brain"></i> Análisis de Evaluación</h3>
                <p>${escapeHtml(analysis.analysis)}</p>
                ${analysis.reasons ? `
                    <div style="margin-top:16px">
                        <strong style="font-size:13px;color:var(--gray-700);">Factores considerados:</strong>
                        <ul style="margin-top:8px;padding-left:20px;color:var(--gray-600);font-size:14px;line-height:1.8">
                            ${analysis.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${analysis.recommendations ? `
                    <div style="margin-top:16px">
                        <strong style="font-size:13px;color:var(--gray-700);">Recomendaciones:</strong>
                        <ul style="margin-top:8px;padding-left:20px;color:var(--gray-600);font-size:14px;line-height:1.8">
                            ${analysis.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${analysis.alternatives ? `
                    <div style="margin-top:16px;padding:12px;background:var(--primary-light);border-radius:8px;">
                        <strong style="font-size:13px;color:var(--primary-dark);"><i class="fas fa-lightbulb"></i> Alternativas:</strong>
                        <p style="font-size:13px;color:var(--gray-700);margin-top:4px;">${escapeHtml(analysis.alternatives)}</p>
                    </div>
                ` : ''}
            </div>

            ${isReview ? `
                <div class="result-note">
                    <i class="fas fa-envelope"></i>
                    <strong>Próximo paso:</strong> Tu solicitud será enviada automáticamente al equipo de Seguridad de la Información
                    (<strong>${CONFIG.company.securityEmail}</strong>) para su revisión. Recibirás una respuesta en un plazo de 2-3 días hábiles.
                </div>
            ` : ''}

            ${isNogo ? `
                <div class="result-note" style="background:var(--danger-light);">
                    <i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i>
                    <strong>Nota:</strong> Si consideras que esta evaluación es incorrecta o deseas apelar la decisión,
                    puedes contactar directamente al equipo de Seguridad de la Información en
                    <strong>${CONFIG.company.securityEmail}</strong>.
                </div>
            ` : ''}

            <div class="result-actions">
                ${isReview ? `
                    <button class="btn btn-warning" onclick="sendToSecurityTeam()">
                        <i class="fas fa-paper-plane"></i> Enviar a Seguridad de la Información
                    </button>
                ` : ''}
                ${isGo ? `
                    <button class="btn btn-success" onclick="sendEmailNotification()">
                        <i class="fas fa-envelope"></i> Enviar Comprobante
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="downloadPDF()">
                    <i class="fas fa-download"></i> Descargar Comprobante
                </button>
                <button class="btn btn-secondary" onclick="resetForm()">
                    <i class="fas fa-plus"></i> Nueva Solicitud
                </button>
            </div>
        </div>
    `;

    // Store data for email functions
    lastSubmission.formData = formData;
    lastSubmission.analysis = analysis;
    lastSubmission.riskScore = riskScore;
    lastSubmission.requestId = requestId;

    // If REVIEW, auto-send email to security team
    if (isReview) {
        setTimeout(() => sendToSecurityTeam(), 1000);
    }
}

// ─────────────────────────────────────────
// Email Functions (EmailJS + mailto fallback)
// ─────────────────────────────────────────

function buildEmailBody(formData, analysis, riskScore, requestId, type) {
    const fecha = new Date().toLocaleDateString('es-BO', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (type === 'review') {
        return `SOLICITUD DE EVALUACIÓN DE HERRAMIENTA DE IA
============================================
ID Solicitud: ${requestId}
Fecha: ${fecha}

DATOS DEL SOLICITANTE
---------------------
Nombre: ${formData.fullName}
Correo: ${formData.email}
Departamento: ${formData.department}
Cargo: ${formData.position}

HERRAMIENTA SOLICITADA
----------------------
Nombre: ${formData.aiTool}
URL: ${formData.aiUrl || 'No proporcionada'}
Categoría: ${formData.aiCategory}
Versión/Plan: ${formData.aiVersion || 'No especificada'}

CASO DE USO
-----------
Descripción: ${formData.useCase}
Beneficio esperado: ${formData.expectedBenefit || 'No especificado'}
Frecuencia: ${formData.frequency}
Alcance: ${formData.userScope}
Requiere pago: ${formData.requiresPayment}

TIPOS DE DATOS INVOLUCRADOS
----------------------------
${formData.dataTypes.map(t => '- ' + t.charAt(0).toUpperCase() + t.slice(1)).join('\n')}

EVALUACIÓN AUTOMÁTICA
---------------------
Decisión: ${analysis.decision || 'REVIEW'}
Nivel de riesgo: ${analysis.riskLevel || riskScore.riskCategory || 'N/A'}
Puntaje: ${riskScore.totalScore || 'N/A'}

Análisis: ${analysis.analysis || 'Requiere revisión manual'}

Notas adicionales: ${formData.additionalNotes || 'Ninguna'}

============================================
Este correo fue generado automáticamente por el sistema GO/NO-GO de evaluación de herramientas de IA.`;
    }

    return `COMPROBANTE DE APROBACIÓN - USO DE HERRAMIENTA DE IA
=====================================================
ID Solicitud: ${requestId}
Fecha: ${fecha}

Solicitante: ${formData.fullName}
Departamento: ${formData.department}
Herramienta: ${formData.aiTool}
Estado: APROBADO

Condiciones de uso:
- No ingresar datos confidenciales, personales ni financieros
- Reportar cualquier incidente de seguridad
- Si el caso de uso cambia, llenar una nueva solicitud

=====================================================
Sistema GO/NO-GO - Red Enlace`;
}

async function sendEmailAutomatic(toEmail, subject, body, fromName) {
    try {
        const response = await fetch(`https://formsubmit.co/ajax/${toEmail}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                name: fromName || 'Sistema GO/NO-GO',
                _subject: subject,
                message: body,
                _template: 'box'
            })
        });

        const data = await response.json();
        return data.success === 'true' || data.success === true;
    } catch (error) {
        console.warn('FormSubmit send failed:', error);
        return false;
    }
}

function sendViaMailto(toEmail, ccEmail, subject, body) {
    const params = new URLSearchParams();
    if (ccEmail) params.set('cc', ccEmail);
    params.set('subject', subject);
    params.set('body', body);
    window.location.href = `mailto:${toEmail}?${params.toString()}`;
}

async function sendToSecurityTeam() {
    const formData = lastSubmission.formData || collectFormData();
    const analysis = lastSubmission.analysis || {};
    const riskScore = lastSubmission.riskScore || {};
    const requestId = lastSubmission.requestId || generateRequestId();

    const subject = `[GO/NO-GO] Solicitud de Revisión - ${formData.aiTool} - ${requestId}`;
    const body = buildEmailBody(formData, analysis, riskScore, requestId, 'review');

    showToast('Enviando solicitud a Seguridad de la Información...', 'info');
    const sent = await sendEmailAutomatic(
        CONFIG.company.securityEmail,
        subject,
        body,
        formData.fullName
    );

    if (sent) {
        showToast('Solicitud enviada exitosamente a ' + CONFIG.company.securityEmail, 'success');
    } else {
        // Fallback to mailto
        sendViaMailto(CONFIG.company.securityEmail, formData.email, subject, body);
        showToast('Se abrió tu cliente de correo para enviar la solicitud', 'info');
    }
}

async function sendEmailNotification() {
    const formData = lastSubmission.formData || collectFormData();
    const requestId = lastSubmission.requestId || generateRequestId();

    const subject = `[GO/NO-GO] Solicitud Aprobada - ${formData.aiTool} - ${requestId}`;
    const body = buildEmailBody(formData, {}, {}, requestId, 'approved');

    showToast('Enviando comprobante...', 'info');
    const sent = await sendEmailAutomatic(
        formData.email,
        subject,
        body,
        'Sistema GO/NO-GO - Red Enlace'
    );

    if (sent) {
        showToast('Comprobante enviado exitosamente a ' + formData.email, 'success');
    } else {
        sendViaMailto(formData.email, '', subject, body);
        showToast('Se abrió tu cliente de correo con el comprobante', 'info');
    }
}

// ─────────────────────────────────────────
// PDF Download (print-based)
// ─────────────────────────────────────────

function downloadPDF() {
    const resultEl = document.querySelector('#step4 .result-container');
    if (!resultEl) {
        window.print();
        return;
    }

    // Use html2pdf.js if available, otherwise fall back to print
    if (typeof html2pdf === 'undefined') {
        window.print();
        return;
    }

    const requestId = lastSubmission.requestId || 'GONG';
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `${requestId}_GO-NOGO.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Clone the element to avoid modifying the visible DOM
    const clone = resultEl.cloneNode(true);
    // Hide action buttons in PDF
    const actions = clone.querySelector('.result-actions');
    if (actions) actions.style.display = 'none';

    showToast('Generando PDF...', 'info');
    html2pdf().set(opt).from(clone).save().then(() => {
        showToast('PDF descargado exitosamente', 'success');
    });
}

// ─────────────────────────────────────────
// Loading Animation
// ─────────────────────────────────────────

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('active');
    // Reset steps
    document.querySelectorAll('.loading-step').forEach(el => {
        el.classList.remove('active', 'done');
        el.querySelector('i').className = 'fas fa-circle';
    });
    document.getElementById('ls1').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

async function animateLoadingStep(stepNum) {
    await sleep(600);
    const steps = document.querySelectorAll('.loading-step');

    // Mark previous as done
    for (let i = 0; i < stepNum - 1; i++) {
        steps[i].classList.remove('active');
        steps[i].classList.add('done');
        steps[i].querySelector('i').className = 'fas fa-check-circle';
    }

    // Mark current as active
    if (stepNum <= steps.length) {
        steps[stepNum - 1].classList.add('active');
        steps[stepNum - 1].querySelector('i').className = 'fas fa-spinner fa-spin';
    }

    // Update loading text
    const texts = [
        'Verificando herramienta en lista aprobada',
        'Analizando caso de uso y tipo de datos',
        'Evaluando nivel de riesgo',
        'Generando resultado final'
    ];
    document.getElementById('loadingText').textContent = texts[stepNum - 1] || '';
}

// ─────────────────────────────────────────
// localStorage Persistence
// ─────────────────────────────────────────
const STORAGE_KEY = 'gonogo_form_draft';

function saveFormDraft() {
    try {
        const fields = {};
        ['fullName', 'email', 'department', 'position', 'aiTool', 'aiUrl',
         'aiCategory', 'aiVersion', 'useCase', 'expectedBenefit', 'frequency',
         'additionalNotes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) fields[id] = el.value;
        });
        fields.dataTypes = Array.from(document.querySelectorAll('input[name="dataType"]:checked')).map(cb => cb.value);
        const userScope = document.querySelector('input[name="userScope"]:checked');
        fields.userScope = userScope ? userScope.value : '';
        const payment = document.querySelector('input[name="requiresPayment"]:checked');
        fields.requiresPayment = payment ? payment.value : '';
        fields.currentStep = currentStep;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    } catch { /* localStorage may be unavailable */ }
}

function restoreFormDraft() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const fields = JSON.parse(raw);

        ['fullName', 'email', 'department', 'position', 'aiTool', 'aiUrl',
         'aiCategory', 'aiVersion', 'useCase', 'expectedBenefit', 'frequency',
         'additionalNotes'].forEach(id => {
            const el = document.getElementById(id);
            if (el && fields[id]) el.value = fields[id];
        });
        if (fields.dataTypes) {
            fields.dataTypes.forEach(val => {
                const cb = document.querySelector(`input[name="dataType"][value="${val}"]`);
                if (cb) cb.checked = true;
            });
        }
        if (fields.userScope) {
            const radio = document.querySelector(`input[name="userScope"][value="${fields.userScope}"]`);
            if (radio) radio.checked = true;
        }
        if (fields.requiresPayment) {
            const radio = document.querySelector(`input[name="requiresPayment"][value="${fields.requiresPayment}"]`);
            if (radio) radio.checked = true;
        }
        // Update character counter
        const useCaseEl = document.getElementById('useCase');
        if (useCaseEl) {
            document.getElementById('useCaseCount').textContent = useCaseEl.value.length;
        }
        // Trigger AI tool detection
        const aiToolEl = document.getElementById('aiTool');
        if (aiToolEl && aiToolEl.value) {
            aiToolEl.dispatchEvent(new Event('input'));
        }
    } catch { /* ignore parse errors */ }
}

function clearFormDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ─────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRequestId() {
    const date = new Date();
    const prefix = 'GONG';
    const datePart = date.getFullYear().toString().slice(-2) +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${datePart}-${random}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function resetForm() {
    document.getElementById('gonogoForm').reset();
    document.getElementById('approvedBanner').style.display = 'none';
    document.getElementById('useCaseCount').textContent = '0';
    clearFormDraft();
    goToStep(1);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
        color: white;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideUp 0.3s ease;
        max-width: 400px;
    `;
    const icon = document.createElement('i');
    icon.className = `fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`;
    icon.style.marginRight = '8px';
    toast.appendChild(icon);
    toast.appendChild(document.createTextNode(message));
    document.body.appendChild(toast);

    // Add animation keyframe
    if (!document.getElementById('toastAnimation')) {
        const style = document.createElement('style');
        style.id = 'toastAnimation';
        style.textContent = `
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ─────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateProgress();

    // Restore form draft from localStorage
    restoreFormDraft();

    // Auto-save form on input changes
    const form = document.getElementById('gonogoForm');
    if (form) {
        form.addEventListener('input', saveFormDraft);
        form.addEventListener('change', saveFormDraft);
    }

    // Clear draft on successful submission (after result is shown)
    // Draft is cleared via resetForm() or after showing result

    // Log mode info
    if (CONFIG.ai.provider === 'none' || !CONFIG.ai.apiKey) {
        console.info(
            '%c⚡ GO/NO-GO: Modo basado en reglas activado',
            'color: #F7941D; font-weight: bold; font-size: 13px;'
        );
    }
});
