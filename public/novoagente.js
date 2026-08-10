let currentStep = 1;
const files = { banner: null, logo: null };

// Whitelabel branding (override via ?wl=slug). Values denormalizadas — slug + name
// vão junto no payload pra Nexus saber de qual revenda é a solicitação sem ter
// que fazer lookup (RcsRequest mora em outra connection Mongo que os whitelabels).
const BRANDS = {
  default: {
    slug: "default",
    name: "NEXUS Comunicação",
    logo: "./assets/logo-nexus.svg",
    accent: "oklch(0.728 0.1849 50.22)",
    supportEmail: "contato@nexuscomunicacao.com.br",
  },
  agendecomia: {
    slug: "agendecomia",
    name: "Agende com IA",
    logo: "./assets/logo-agendecomia.png",
    accent: "#1AAB07",
    supportEmail: "noreply@agendecomia.com.br",
  },
  msend: {
    slug: "msend",
    name: "MSend",
    logo: "./assets/logo-msend.svg",
    accent: "#E8213A",
    supportEmail: "contato@msend.com.br",
  },
};

// Mapeamento hostname → slug. Cada revenda aponta um subdomínio próprio
// (ex.: agente.agendecomia.com.br) pro projeto Vercel — Apache/Vercel
// resolve, o JS lê o host e aplica o branding sem precisar de ?wl= na URL,
// pra não expor o domínio Nexus pro cliente da revenda. ?wl= continua
// funcionando como fallback pra preview/dev.
const HOST_TO_SLUG = {
  "agente.agendecomia.com": "agendecomia",
};

const brand = (() => {
  try {
    const host = (window.location.hostname || "").toLowerCase();
    const fromHost = HOST_TO_SLUG[host];
    if (fromHost && BRANDS[fromHost]) return BRANDS[fromHost];
    const slug = new URLSearchParams(window.location.search).get("wl") || "default";
    return BRANDS[slug] || BRANDS.default;
  } catch {
    return BRANDS.default;
  }
})();

// "Responsável pelo atendimento" lista o time comercial da Nexus — o cliente de
// uma revenda não conhece esses nomes, então o campo só existe na versão default.
const isNexusBrand = brand.slug === "default";

function applyBranding() {
  if (!isNexusBrand) {
    ["field-atendimento", "rv-row-atendimento"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  document.documentElement.style.setProperty("--accent", brand.accent);
  document.title = `Abertura de Agente RCS - ${brand.name}`;
  const logoEl = document.querySelector(".logo-image");
  if (logoEl) {
    logoEl.src = brand.logo;
    logoEl.alt = brand.name;
  }
  const platformEl = document.getElementById("brand-platform-name");
  if (platformEl) platformEl.textContent = brand.name;
  const supportNameEl = document.getElementById("brand-support-name");
  if (supportNameEl) supportNameEl.textContent = brand.name;
  const supportLinkEl = document.getElementById("brand-support-link");
  if (supportLinkEl) {
    supportLinkEl.href = `mailto:${brand.supportEmail}`;
    supportLinkEl.textContent = brand.supportEmail;
  }
}

applyBranding();

const IMAGE_SPECS = {
  banner: { width: 1440, height: 448, maxBytes: 200 * 1024, label: "banner" },
  logo: { width: 224, height: 224, maxBytes: 200 * 1024, label: "logotipo" },
};

function formatKB(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

function setUploadError(type, message) {
  const errorEl = document.getElementById(`${type}-error`);
  const fieldEl = document.getElementById(`field-${type}`);
  if (errorEl) {
    errorEl.textContent = message || (type === "banner" ? "Por favor, envie o banner do agente." : "Por favor, envie o logotipo.");
  }
  if (fieldEl) fieldEl.classList.toggle("has-error", Boolean(message));
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

async function validateImageFile(type, file) {
  const spec = IMAGE_SPECS[type];
  if (!spec) return { ok: true };

  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return { ok: false, message: `Formato inválido. Envie um arquivo PNG ou JPG do ${spec.label}.` };
  }

  if (file.size > spec.maxBytes) {
    return {
      ok: false,
      message: `Arquivo muito grande (${formatKB(file.size)}). O ${spec.label} deve ter no máximo 200 KB.`,
    };
  }

  try {
    const { width, height } = await readImageDimensions(file);
    if (width !== spec.width || height !== spec.height) {
      return {
        ok: false,
        message: `Dimensões inválidas (${width} × ${height} px). O ${spec.label} deve ter exatamente ${spec.width} × ${spec.height} px.`,
      };
    }
  } catch (err) {
    return { ok: false, message: "Não foi possível ler a imagem enviada." };
  }

  return { ok: true };
}

function goToStep(target) {
  if (target > currentStep && !validateStep(currentStep)) return;

  for (let i = 1; i <= 4; i += 1) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.classList.remove("active", "done");
    if (i < target) dot.classList.add("done");
    if (i === target) dot.classList.add("active");
  }

  document.querySelectorAll(".step-panel").forEach((panel) => panel.classList.remove("active"));
  const targetPanel = document.getElementById(`step-${target}`);
  if (targetPanel) targetPanel.classList.add("active");

  if (target === 4) populateReview();

  currentStep = target;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    valid = checkField("nome", (v) => v.trim().length > 0) && valid;
    valid = checkField("descricao", (v) => v.trim().length > 0) && valid;
    valid = checkField("website", (v) => v.trim().length > 0 && v.startsWith("http")) && valid;
    valid = checkField("telefonePerfil", (v) => PHONE_REGEX.test(v.trim())) && valid;
    valid = checkField("emailPerfil", (v) => EMAIL_REGEX.test(v.trim())) && valid;
    valid = checkField("cnpj", (v) => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v.trim())) && valid;
    valid = checkField("privacidade", (v) => v.trim().length > 0 && v.startsWith("http")) && valid;
    valid = checkField("termos", (v) => v.trim().length > 0 && v.startsWith("http")) && valid;
  }

  if (step === 2) {
    const bannerOk = files.banner !== null;
    const logoOk = files.logo !== null;
    if (!bannerOk) setUploadError("banner", "Por favor, envie o banner do agente.");
    if (!logoOk) setUploadError("logo", "Por favor, envie o logotipo.");
    valid = bannerOk && logoOk;
  }

  if (step === 3) {
    valid = checkField("telefone", (v) => PHONE_REGEX.test(v.trim())) && valid;
    valid = checkField("responsavel", (v) => v.trim().length > 0) && valid;
    valid = checkField("cargo", (v) => v.trim().length > 0) && valid;
    valid = checkField("email", (v) => EMAIL_REGEX.test(v.trim())) && valid;
    valid = checkField("segmento", (v) => v.trim().length > 0) && valid;
    if (isNexusBrand) {
      valid = checkField("atendimento", (v) => v.trim().length > 0) && valid;
    }
    valid = checkField("adicional", (v) => v.trim().length > 0) && valid;
  }

  return valid;
}

function checkField(id, validator) {
  const el = document.getElementById(id);
  const fieldEl = document.getElementById(`field-${id}`);
  const ok = Boolean(el && validator(el.value));
  if (fieldEl) fieldEl.classList.toggle("has-error", !ok);
  return ok;
}

function normalizePhoneValue(value) {
  if (!value) return "";

  let normalized = value.replace(/[^\d+]/g, "");
  if (normalized.startsWith("+")) {
    normalized = `+${normalized.slice(1).replace(/\+/g, "")}`;
  } else {
    normalized = normalized.replace(/\+/g, "");
  }

  return normalized;
}

function setupPhoneField(id) {
  const phoneInput = document.getElementById(id);
  if (!phoneInput) return;

  phoneInput.addEventListener("focus", () => {
    if (!phoneInput.value.trim()) {
      phoneInput.value = "+55";
    }
  });

  phoneInput.addEventListener("input", () => {
    phoneInput.value = normalizePhoneValue(phoneInput.value);
  });
}

document.addEventListener("input", (event) => {
  const field = event.target.closest(".field");
  if (field) field.classList.remove("has-error");
  updatePreview();
});

["telefonePerfil", "telefone"].forEach(setupPhoneField);

function applyCnpjMask(value) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

function setupCnpjField() {
  const cnpjInput = document.getElementById("cnpj");
  if (!cnpjInput) return;
  cnpjInput.addEventListener("input", () => {
    cnpjInput.value = applyCnpjMask(cnpjInput.value);
  });
}

setupCnpjField();

function handleFileSelect(input, type) {
  if (input.files && input.files[0]) {
    setFile(type, input.files[0]);
  }
}

function handleDragOver(event, el) {
  event.preventDefault();
  el.classList.add("dragover");
}

function handleDragLeave(el) {
  el.classList.remove("dragover");
}

function handleDrop(event, type) {
  event.preventDefault();
  const area = document.getElementById(`upload-${type}`);
  if (area) area.classList.remove("dragover");
  const file = event.dataTransfer?.files?.[0];
  if (file) setFile(type, file);
}

function clearFile(type) {
  files[type] = null;
  const input = document.getElementById(type);
  if (input) input.value = "";
  const areaEl = document.getElementById(`upload-${type}`);
  if (areaEl) areaEl.classList.remove("has-file");
  const previewEl = document.getElementById(`${type}-preview`);
  if (previewEl) previewEl.src = "";
  const nameEl = document.getElementById(`${type}-name`);
  if (nameEl) {
    nameEl.textContent = "";
    nameEl.style.display = "none";
  }
  updatePreview();
}

async function setFile(type, file) {
  const validation = await validateImageFile(type, file);
  if (!validation.ok) {
    clearFile(type);
    setUploadError(type, validation.message);
    return;
  }

  files[type] = file;
  const nameEl = document.getElementById(`${type}-name`);
  if (nameEl) {
    nameEl.textContent = `Arquivo: ${file.name}`;
    nameEl.style.display = "block";
  }
  const areaEl = document.getElementById(`upload-${type}`);
  const previewEl = document.getElementById(`${type}-preview`);
  if (previewEl && areaEl) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewEl.src = e.target.result;
      areaEl.classList.add("has-file");
      updatePreview();
    };
    reader.readAsDataURL(file);
  }
  setUploadError(type, "");
}

function populateReview() {
  const setValue = (id, value) => {
    const el = document.getElementById(`rv-${id}`);
    if (!el) return;
    el.textContent = value || "-";
    el.className = `review-value${value ? "" : " empty"}`;
  };

  const cargo = document.getElementById("cargo")?.value || "";
  const responsavel = document.getElementById("responsavel")?.value || "";

  setValue("nome", document.getElementById("nome")?.value || "");
  setValue("descricao", document.getElementById("descricao")?.value || "");
  setValue("website", document.getElementById("website")?.value || "");
  setValue("telefonePerfil", document.getElementById("telefonePerfil")?.value || "");
  setValue("emailPerfil", document.getElementById("emailPerfil")?.value || "");
  setValue("cnpj", document.getElementById("cnpj")?.value || "");
  setValue("privacidade", document.getElementById("privacidade")?.value || "");
  setValue("termos", document.getElementById("termos")?.value || "");
  setValue("banner", files.banner ? files.banner.name : "");
  setValue("logo", files.logo ? files.logo.name : "");

  const rvBannerImg = document.getElementById("rv-banner-img");
  const rvLogoImg = document.getElementById("rv-logo-img");
  const bannerSrc = document.getElementById("banner-preview")?.src || "";
  const logoSrc = document.getElementById("logo-preview")?.src || "";

  if (rvBannerImg) {
    rvBannerImg.src = bannerSrc;
    rvBannerImg.style.display = bannerSrc ? "block" : "none";
  }
  if (rvLogoImg) {
    rvLogoImg.src = logoSrc;
    rvLogoImg.style.display = logoSrc ? "block" : "none";
  }

  setValue("telefone", document.getElementById("telefone")?.value || "");
  setValue("responsavel", `${responsavel}${cargo ? ` (${cargo})` : ""}`.trim());
  setValue("email", document.getElementById("email")?.value || "");
  setValue("segmento", document.getElementById("segmento")?.value || "");
  if (isNexusBrand) setValue("atendimento", document.getElementById("atendimento")?.value || "");
}

const PREVIEW_PLACEHOLDERS = {
  nome: "Nome do agente",
  desc: "Descrição do agente",
  telefone: "+5511999999999",
  email: "contato@suaempresa.com.br",
  website: "https://www.suaempresa.com.br",
};

function setPreviewText(id, value, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || placeholder;
  el.classList.toggle("pv-empty", !value);
}

function setPreviewImage(el, src) {
  if (!el) return;
  el.style.backgroundImage = src ? `url("${src}")` : "";
}

// Preview do perfil do agente: espelha ao vivo o que o cliente digita na etapa 1
// e os arquivos da etapa 2. Sem logo, cai na inicial do nome de exibição.
function updatePreview() {
  const nome = document.getElementById("nome")?.value.trim() || "";
  const descricao = document.getElementById("descricao")?.value.trim() || "";
  const website = document.getElementById("website")?.value.trim() || "";
  const telefone = document.getElementById("telefonePerfil")?.value.trim() || "";
  const email = document.getElementById("emailPerfil")?.value.trim() || "";

  setPreviewText("pv-nome", nome, PREVIEW_PLACEHOLDERS.nome);
  setPreviewText("pv-desc", descricao, PREVIEW_PLACEHOLDERS.desc);
  setPreviewText("pv-telefone", telefone, PREVIEW_PLACEHOLDERS.telefone);
  setPreviewText("pv-email", email, PREVIEW_PLACEHOLDERS.email);
  setPreviewText("pv-website", website, PREVIEW_PLACEHOLDERS.website);

  const logoSrc = files.logo ? document.getElementById("logo-preview")?.src || "" : "";
  const bannerSrc = files.banner ? document.getElementById("banner-preview")?.src || "" : "";
  const avatar = document.getElementById("pv-avatar");
  if (avatar) {
    setPreviewImage(avatar, logoSrc);
    avatar.textContent = logoSrc ? "" : nome ? nome[0].toUpperCase() : "";
  }

  setPreviewImage(document.getElementById("pv-banner"), bannerSrc);
}

updatePreview();

const CONFIG = {
  API_URL: "/api/novo-agente",
};

async function submitForm() {
  if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
    goToStep(1);
    return;
  }

  const btn = document.getElementById("btn-submit");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Enviando...';
  }

  const campos = {
    nome: document.getElementById("nome")?.value.trim() || "",
    descricao: document.getElementById("descricao")?.value.trim() || "",
    website: document.getElementById("website")?.value.trim() || "",
    telefonePerfil: document.getElementById("telefonePerfil")?.value.trim() || "",
    emailPerfil: document.getElementById("emailPerfil")?.value.trim() || "",
    cnpj: document.getElementById("cnpj")?.value.trim() || "",
    privacidade: document.getElementById("privacidade")?.value.trim() || "",
    termos: document.getElementById("termos")?.value.trim() || "",
    telefone: document.getElementById("telefone")?.value.trim() || "",
    responsavel: document.getElementById("responsavel")?.value.trim() || "",
    cargo: document.getElementById("cargo")?.value.trim() || "",
    email: document.getElementById("email")?.value.trim() || "",
    segmento: document.getElementById("segmento")?.value || "",
    atendimento: isNexusBrand ? document.getElementById("atendimento")?.value || "" : "",
    adicional: document.getElementById("adicional")?.value.trim() || "",
  };

  try {
    const formData = new FormData();
    Object.entries(campos).forEach(([key, value]) => formData.append(key, value));
    formData.append("whitelabelSlug", brand.slug);
    formData.append("whitelabelName", brand.name);
    if (files.banner) formData.append("banner", files.banner);
    if (files.logo) formData.append("logo", files.logo);

    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao salvar dados");
    }

    const result = await response.json().catch(() => ({}));

    showSuccess();
  } catch (error) {
    console.error("Erro no envio:", error);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Tentar novamente";
    }
  }
}

function showSuccess() {
  document.querySelectorAll(".step-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(".success-panel")?.classList.add("active");
  const progress = document.querySelector(".progress-wrap");
  if (progress) progress.style.opacity = "0.3";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

["nome", "descricao"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;

  const field = el.closest(".field");
  if (!field) return;

  const max = Number(el.getAttribute("maxlength"));
  if (!max) return;

  const hint = field.querySelector(".field-hint");
  if (!hint) return;

  const counter = document.createElement("div");
  counter.className = "field-hint";
  counter.style.marginTop = "4px";

  const updateCounter = () => {
    counter.textContent = `${el.value.length}/${max}`;
  };

  hint.insertAdjacentElement("afterend", counter);
  el.addEventListener("input", updateCounter);
  updateCounter();
});

window.goToStep = goToStep;
window.handleFileSelect = handleFileSelect;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.submitForm = submitForm;
