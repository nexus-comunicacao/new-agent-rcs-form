let currentStep = 1;
const files = { banner: null, logo: null };

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

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    valid = checkField("nome", (v) => v.trim().length > 0) && valid;
    valid = checkField("descricao", (v) => v.trim().length > 0) && valid;
    valid = checkField("website", (v) => v.trim().length > 0 && v.startsWith("http")) && valid;
    valid = checkField("cnpj", (v) => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v.trim())) && valid;
    valid = checkField("privacidade", (v) => v.trim().length > 0 && v.startsWith("http")) && valid;
    valid = checkField("termos", (v) => v.trim().length > 0 && v.startsWith("http")) && valid;
  }

  if (step === 2) {
    const bannerOk = files.banner !== null;
    const logoOk = files.logo !== null;
    document.getElementById("field-banner")?.classList.toggle("has-error", !bannerOk);
    document.getElementById("field-logo")?.classList.toggle("has-error", !logoOk);
    valid = bannerOk && logoOk;
  }

  if (step === 3) {
    const telRegex = /^\+[1-9]\d{7,14}$/;
    valid = checkField("telefone", (v) => telRegex.test(v.trim())) && valid;
    valid = checkField("responsavel", (v) => v.trim().length > 0) && valid;
    valid = checkField("cargo", (v) => v.trim().length > 0) && valid;
    valid = checkField("email", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) && valid;
    valid = checkField("segmento", (v) => v.trim().length > 0) && valid;
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

function setupPhoneField() {
  const phoneInput = document.getElementById("telefone");
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
});

setupPhoneField();

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

function setFile(type, file) {
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
    };
    reader.readAsDataURL(file);
  }
  document.getElementById(`field-${type}`)?.classList.remove("has-error");
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
}

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
    cnpj: document.getElementById("cnpj")?.value.trim() || "",
    privacidade: document.getElementById("privacidade")?.value.trim() || "",
    termos: document.getElementById("termos")?.value.trim() || "",
    telefone: document.getElementById("telefone")?.value.trim() || "",
    responsavel: document.getElementById("responsavel")?.value.trim() || "",
    cargo: document.getElementById("cargo")?.value.trim() || "",
    email: document.getElementById("email")?.value.trim() || "",
    segmento: document.getElementById("segmento")?.value || "",
    adicional: document.getElementById("adicional")?.value.trim() || "",
  };

  try {
    const formData = new FormData();
    Object.entries(campos).forEach(([key, value]) => formData.append(key, value));
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
