/* ==========================================
   GO / NO-GO - Application Logic
   ========================================== */

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
let currentStep = 1;
const totalSteps = 4;

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

    const formData = collectFormData();
    showLoading();

    try {
        // Paso 1: Calcular nivel de riesgo inicial
        await animateLoadingStep(1);
        const riskScore = calculateRiskScore(formData);

        const hasSensitiveData = formData.dataTypes.some(t =>
            ['sensible', 'confidencial', 'financiero', 'personal'].includes(t)
        );

        // Paso 2: Verificar si es herramienta pre-aprobada
        await animateLoadingStep(2);
        const preApproved = checkPreApproved(formData.aiTool);

        // ¡REGLA ROBUSTA 1!: Una herramienta pre-aprobada NO puede auto-aprobarse si involucra datos sensibles o si su puntaje total exige revisión manual.
        if (preApproved && !hasSensitiveData && riskScore.totalScore < CONFIG.thresholds.manualReviewMinScore) {
            await animateLoadingStep(3);
            await animateLoadingStep(4);
            hideLoading();
            showPreApprovedResult(preApproved, formData);
            return;
        }

        // Paso 3: Análisis basado en reglas (o IA si estuviera activa)
        await animateLoadingStep(3);
        let analysis;

        if (CONFIG.ai && CONFIG.ai.provider !== 'none' && CONFIG.ai.apiKey) {
            analysis = await getAIAnalysis(formData, riskScore);
        } else {
            analysis = getRuleBasedAnalysis(formData, riskScore);
        }

        // Paso 4: Generar resultado
        await animateLoadingStep(4);
        await sleep(500);
        hideLoading();
        showResult(analysis, formData, riskScore);

    } catch (error) {
        console.error('Error during evaluation:', error);
        hideLoading();
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
    let maxLevel = 'bajo';
    const details = [];

    // Data type risk
    formData.dataTypes.forEach(type => {
        const risk = CONFIG.dataRiskLevels[type];
        if (risk) {
            score += risk.score;
            if (risk.score > CONFIG.dataRiskLevels[maxLevel]?.score || 0) {
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
    const hasInternalData = formData.dataTypes.includes('interno');
    const hasOnlyPublicData = formData.dataTypes.every(t => t === 'publico');
    const isPreApproved = checkPreApproved(formData.aiTool);

    let decision, riskLevel, analysis, reasons, recommendations, alternatives;

    // Regla 1: Datos Sensibles siempre derivan a Revisión (Sin importar la herramienta)
    if (hasSensitiveData) {
        decision = 'REVIEW';
        riskLevel = riskScore.maxLevel;
        analysis = `La solicitud involucra datos sensibles, personales, financieros o confidenciales. Por normativas de seguridad, se requiere una revisión humana exhaustiva de la herramienta "${formData.aiTool}" antes de su uso.`;
        reasons = [
            'Procesamiento de datos con clasificación de riesgo alta o crítica',
            'Prevención de fuga de información (Data Loss Prevention)',
            'Cumplimiento normativo y evaluación de Términos de Servicio (ToS)'
        ];
        recommendations = [
            'Bajo ninguna circunstancia ingresar estos datos hasta obtener el GO formal',
            'Documentar qué controles de privacidad ofrece la herramienta solicitada',
            'Explorar si el proceso puede realizarse anonimizando los datos previamente'
        ];
        alternatives = 'Consultar al equipo de Seguridad si herramientas corporativas aprobadas pueden realizar esta tarea de forma on-premise.';

    // Regla 2: Herramientas Nuevas/No Aprobadas pidiendo leer Datos Internos de la empresa
    } else if (!isPreApproved && hasInternalData) {
        decision = 'REVIEW';
        riskLevel = 'medio';
        analysis = `La herramienta "${formData.aiTool}" no se encuentra en el catálogo oficial y solicitas procesar datos internos de la compañía. Se debe analizar la política de retención de datos de esta IA para no exponer nuestra propiedad intelectual.`;
        reasons = [
            'Herramienta no categorizada o no certificada por el departamento de Seguridad',
            'Uso de información empresarial u operativa (Riesgo de entrenamiento no autorizado de modelos)',
            'Necesidad de validar que la IA no usa nuestros prompts para entrenar sus versiones públicas'
        ];
        recommendations = [
            'Verificar si existe una política opt-out de entrenamiento en esta herramienta',
            'Aguardar evaluación de licenciamiento corporativo'
        ];
        alternatives = 'Evaluaremos usar ChatGPT o Google Gemini Enterprise (si aplican) para procesar estos documentos internos de manera segura.';

    // Regla 3: Herramienta Desconocida pidiendo solo Datos Públicos
    } else if (!isPreApproved && hasOnlyPublicData && riskScore.totalScore <= CONFIG.thresholds.autoApproveMaxScore) {
        decision = 'GO';
        riskLevel = 'bajo';
        analysis = `La herramienta "${formData.aiTool}" no está formalmente aprobada para uso corporativo, pero como solo procesará Información Pública, el riesgo para la organización es mínimo. Aprobado bajo tu responsabilidad.`;
        reasons = [
            'Ausencia total de datos empresariales, internos o de clientes',
            'Puntaje de impacto operativo muy bajo en nuestro modelo de evaluación'
        ];
        recommendations = [
            'NO utilizar tu cuenta de correo corporativo para registrarte si no es estrictamente necesario',
            'Usar contraseñas únicas y robustas',
            'Cualquier alteración al caso de uso requerirá una nueva solicitud formal'
        ];
        alternatives = '';

    // Regla 4: Casos extra / Fallback (Alto uso, Alcance grande, etc.)
    } else {
        decision = 'REVIEW';
        riskLevel = riskScore.riskCategory === 'critical' ? 'critico' : 
                     riskScore.riskCategory === 'high' ? 'alto' : 'medio';
        analysis = `Tu solicitud para usar "${formData.aiTool}" requiere evaluación manual debido a su nivel de riesgo global (Alcance operativo, Frecuencia, o Complejidad del caso).`;
        reasons = [
            'El coeficiente de riesgo operativo superó el límite de auto-aprobación',
            'Validación requerida de impacto para el modelo de procesos establecido'
        ];
        recommendations = [
            'Proveer al equipo de seguridad de más casos de uso de esta herramienta si se te solicita',
            'Revisar si es necesaria una licencia corporativa o presupuesto'
        ];
        alternatives = '';
    }

    return { decision, riskLevel, analysis, reasons, recommendations, alternatives };
}

// ─────────────────────────────────────────
// Display Results
// ─────────────────────────────────────────

function showPreApprovedResult(tool, formData) {
    goToStep(4);
    const step4 = document.getElementById('step4');

    step4.innerHTML = `
        <div class="result-container">
            <div class="result-icon go">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 class="go">${CONFIG.messages.preApprovedGo}</h2>
            <p class="result-subtitle">${CONFIG.messages.preApprovedSubtitle}</p>

            <div class="result-details">
                <h3><i class="fas fa-file-alt"></i> Resumen de la Solicitud</h3>
                <div class="detail-row">
                    <span class="detail-label">Solicitante</span>
                    <span class="detail-value">${formData.fullName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Departamento</span>
                    <span class="detail-value">${formData.department}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Herramienta</span>
                    <span class="detail-value">${tool.name}</span>
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
                    <span class="detail-value">${generateRequestId()}</span>
                </div>
            </div>

            <div class="result-analysis">
                <h3><i class="fas fa-info-circle"></i> Condiciones de Uso</h3>
                <p>${tool.conditions}</p>
            </div>

            <div class="result-note">
                <i class="fas fa-lightbulb"></i>
                <strong>Recuerda:</strong> Aunque la herramienta está aprobada, nunca ingreses contraseñas, datos de tarjetas, información personal de clientes u otra información sensible. Si tu caso de uso cambia, llena una nueva solicitud.
            </div>

            <div class="result-actions">
                <button class="btn btn-success" onclick="sendEmailNotification('go', null)">
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
                    <button class="btn btn-success" onclick="sendEmailNotification('go', null)">
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
    window._lastFormData = formData;
    window._lastAnalysis = analysis;
    window._lastRiskScore = riskScore;
    window._lastRequestId = requestId;

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



function sendViaMailto(toEmail, ccEmail, subject, body) {
    let params = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (ccEmail) {
        params += `&cc=${encodeURIComponent(ccEmail)}`;
    }
    window.location.href = `mailto:${encodeURIComponent(toEmail)}?${params}`;
}

async function sendToSecurityTeam() {
    const formData = window._lastFormData || collectFormData();
    const analysis = window._lastAnalysis || {};
    const riskScore = window._lastRiskScore || {};
    const requestId = window._lastRequestId || generateRequestId();

    const subject = `[GO/NO-GO] Solicitud de Revisión - ${formData.aiTool} - ${requestId}`;
    const body = buildEmailBody(formData, analysis, riskScore, requestId, 'review');

    sendViaMailto(CONFIG.company.securityEmail, formData.email, subject, body);
    showToast('Se abrió tu cliente de correo (ej. Outlook) para enviar la solicitud. Por favor, dale a "Enviar".', 'info');
}

async function sendEmailNotification(type) {
    const formData = window._lastFormData || collectFormData();
    const requestId = window._lastRequestId || generateRequestId();

    const subject = `[GO/NO-GO] Comprobante de Aprobación - ${formData.aiTool} - ${requestId}`;
    const body = buildEmailBody(formData, {}, {}, requestId, 'approved');

    sendViaMailto(formData.email, '', subject, body);
    showToast('Se abrió tu cliente de correo para enviarte el comprobante', 'info');
}

// ─────────────────────────────────────────
// PDF Download (print-based)
// ─────────────────────────────────────────

function downloadPDF() {
    window.print();
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
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}" style="margin-right:8px;"></i>${message}`;
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

    // Warn if no AI API key configured
    if (!CONFIG.ai.apiKey) {
        console.info(
            '%c⚡ GO/NO-GO: Modo sin IA activado\n' +
            'Para habilitar análisis con IA, agrega tu API key gratuita de Gemini en js/config.js\n' +
            'Obtén una gratis en: https://aistudio.google.com/apikey',
            'color: #F7941D; font-weight: bold; font-size: 13px;'
        );
    }
});
