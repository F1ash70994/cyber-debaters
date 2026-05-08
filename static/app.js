const i18n = window.AppI18n;
const t = (key, values) => i18n.t(key, values);

const DEFAULT_SETTINGS = {
  templates: {
    prompt_template: "",
    round_prompt_template: "",
    answer_length_prompts: {
      concise: "",
      medium: "",
      detailed: "",
    },
  },
  models: [],
  styles: [],
  skills: [],
  mcps: [],
};

const DEFAULT_AGENTS = [
  {
    name: t("agent.defaultProName"),
    role: t("agent.defaultProRole"),
    model_config_id: "",
    style_id: "",
    prompt: t("agent.defaultProPrompt"),
    mcp_ids: [],
    skill_ids: [],
  },
  {
    name: t("agent.defaultConName"),
    role: t("agent.defaultConRole"),
    model_config_id: "",
    style_id: "",
    prompt: t("agent.defaultConPrompt"),
    mcp_ids: [],
    skill_ids: [],
  },
];

const form = document.querySelector("#debateForm");
const settingsForm = document.querySelector("#settingsForm");
const agentList = document.querySelector("#agentList");
const modelList = document.querySelector("#modelList");
const styleList = document.querySelector("#styleList");
const skillList = document.querySelector("#skillList");
const mcpList = document.querySelector("#mcpList");
const agentTemplate = document.querySelector("#agentTemplate");
const modelTemplate = document.querySelector("#modelTemplate");
const styleTemplate = document.querySelector("#styleTemplate");
const skillTemplate = document.querySelector("#skillTemplate");
const mcpTemplate = document.querySelector("#mcpTemplate");
const addAgentButton = document.querySelector("#addAgentButton");
const addModelButton = document.querySelector("#addModelButton");
const addStyleButton = document.querySelector("#addStyleButton");
const addSkillButton = document.querySelector("#addSkillButton");
const addMcpButton = document.querySelector("#addMcpButton");
const agentCountInput = document.querySelector("#agentCount");
const answerLengthSelect = document.querySelector("#answerLength");
const languageSelect = document.querySelector("#languageSelect");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const clearButton = document.querySelector("#clearButton");
const previewPromptButton = document.querySelector("#previewPromptButton");
const hidePromptPreviewButton = document.querySelector("#hidePromptPreviewButton");
const statusPill = document.querySelector("#statusPill");
const roundsNode = document.querySelector("#rounds");
const modelLibraryHint = document.querySelector("#modelLibraryHint");
const settingsRoundPrompt = document.querySelector("#settingsRoundPrompt");
const settingsPromptTemplate = document.querySelector("#settingsPromptTemplate");
const settingsLengthConcise = document.querySelector("#settingsLengthConcise");
const settingsLengthMedium = document.querySelector("#settingsLengthMedium");
const settingsLengthDetailed = document.querySelector("#settingsLengthDetailed");
const settingsMessage = document.querySelector("#settingsMessage");
const promptPreview = document.querySelector("#promptPreview");
const promptPreviewMeta = document.querySelector("#promptPreviewMeta");
const promptPreviewContent = document.querySelector("#promptPreviewContent");
const settingsPromptRendered = document.querySelector("#settingsPromptRendered");
const settingsSaveState = document.querySelector("#settingsSaveState");
const unsavedSettingsDialog = document.querySelector("#unsavedSettingsDialog");
const settingsSidebar = document.querySelector("#settingsSidebar");
const settingsSidebarToggleButton = document.querySelector("#settingsSidebarToggleButton");
const settingsSidebarExpandButton = document.querySelector("#settingsSidebarExpandButton");
const promptPlaceholderHelp = document.querySelector("#promptPlaceholderHelp");

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

let appSettings = cloneData(DEFAULT_SETTINGS);
let abortController = null;
let speechNodes = new Map();
let speechMarkdown = new Map();
let isRenderingSettings = false;
let isSettingsDirty = false;
let currentStatusKey = "status.ready";
let lastScrollY = window.scrollY;

function setText(selector, key, values) {
  const node = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (node) node.textContent = t(key, values);
}

function setAttr(selector, attr, key, values) {
  const node = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (node) node.setAttribute(attr, t(key, values));
}

function setLabelText(controlSelector, key) {
  const control = document.querySelector(controlSelector);
  const label = control?.closest("label");
  const textNode = [...(label?.childNodes || [])].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = `\n                  ${t(key)}\n                  `;
}

function setStatus(key, mode = "") {
  currentStatusKey = key;
  statusPill.textContent = t(key);
  statusPill.className = `status-pill ${mode}`.trim();
}

function setSettingsMessage(text, mode = "") {
  settingsMessage.textContent = text;
  settingsMessage.className = `settings-message ${mode}`.trim();
}

function setSettingsDirty(isDirty) {
  isSettingsDirty = isDirty;
  if (!settingsSaveState) return;
  settingsSaveState.textContent = t(isDirty ? "settings.saveStateUnsaved" : "settings.saveStateSaved");
  settingsSaveState.className = `save-state ${isDirty ? "unsaved" : "saved"}`;
}

function markSettingsChanged() {
  if (isRenderingSettings) return;
  setSettingsDirty(true);
}

function getModels() {
  return appSettings.models || [];
}

function getStyles() {
  return appSettings.styles || [];
}

function getSkills() {
  return appSettings.skills || [];
}

function getMcps() {
  return appSettings.mcps || [];
}

function getTemplates() {
  return appSettings.templates || DEFAULT_SETTINGS.templates;
}

function modelLabel(model) {
  return `${model.name} (${model.provider} / ${model.model})`;
}

function resourceLabel(resource) {
  return resource.name;
}

function answerLengthLabel(value) {
  const labels = {
    concise: "精简",
    medium: "适中",
    detailed: "详细",
  };
  return labels[value] || value;
}

function syncAgentTitles() {
  syncCardTitles(agentList, "agent.fallbackName");
  agentCountInput.value = agentList.children.length;
}

function syncCardTitles(listNode, fallbackKey) {
  [...listNode.children].forEach((card, index) => {
    const title = card.querySelector("h3");
    const nameInput = card.querySelector('[data-field="name"]');
    title.textContent = nameInput.value || t(fallbackKey, { index: index + 1 });
  });
}

function syncModelTitles() {
  syncCardTitles(modelList, "model.fallbackName");
}

function syncStyleTitles() {
  syncCardTitles(styleList, "style.fallbackName");
}

function syncSkillTitles() {
  syncCardTitles(skillList, "skill.fallbackName");
}

function syncMcpTitles() {
  syncCardTitles(mcpList, "mcp.fallbackName");
}

function setField(card, field, value) {
  const node = card.querySelector(`[data-field="${field}"]`);
  if (node?.classList.contains("multi-select")) return;
  if (node) node.value = value ?? "";
}

function fillModelSelect(select, selectedId = "") {
  const models = getModels();
  select.innerHTML = "";
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = modelLabel(model);
    select.appendChild(option);
  }
  select.value = models.some((model) => model.id === selectedId) ? selectedId : models[0]?.id || "";
}

function fillStyleSelect(select, selectedId = "") {
  const styles = getStyles();
  select.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = t("style.noStyle");
  select.appendChild(emptyOption);
  for (const style of styles) {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = resourceLabel(style);
    select.appendChild(option);
  }
  select.value = styles.some((style) => style.id === selectedId) ? selectedId : "";
}

function defaultStyleId() {
  return getStyles()[0]?.id || "";
}

function fillMultiSelect(select, resources, selectedIds = []) {
  const selected = new Set(selectedIds || []);
  select.innerHTML = "";
  select.classList.remove("open");
  const button = document.createElement("button");
  button.className = "multi-select-button";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = '<span class="multi-select-label"></span><span class="multi-select-arrow">⌄</span>';

  const menu = document.createElement("div");
  menu.className = "multi-select-menu";
  menu.hidden = true;

  if (!resources.length) {
    const empty = document.createElement("div");
    empty.className = "multi-select-empty";
    empty.textContent = select.dataset.emptyLabel || t("hint.none");
    menu.appendChild(empty);
  } else {
    for (const resource of resources) {
      const option = document.createElement("label");
      option.className = "multi-select-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = resource.id;
      checkbox.checked = selected.has(resource.id);
      checkbox.addEventListener("change", () => {
        updateMultiSelectLabel(select);
        updateSettingsPromptRendered();
        if (select.closest("#settingsForm")) markSettingsChanged();
      });
      const text = document.createElement("span");
      text.textContent = resourceLabel(resource);
      option.append(checkbox, text);
      menu.appendChild(option);
    }
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setMultiSelectOpen(select, !select.classList.contains("open"));
  });
  menu.addEventListener("click", (event) => event.stopPropagation());
  select.append(button, menu);
  updateMultiSelectLabel(select);
}

function readMultiSelect(select) {
  if (!select) return [];
  return [...select.querySelectorAll('input[type="checkbox"]:checked')].map((option) => option.value);
}

function updateMultiSelectLabel(select) {
  const label = select.querySelector(".multi-select-label");
  const selectedLabels = [...select.querySelectorAll('input[type="checkbox"]:checked')].map(
    (option) => option.nextElementSibling?.textContent || option.value,
  );
  label.textContent = selectedLabels.length ? selectedLabels.join("、") : select.dataset.placeholder || t("hint.notSelected");
  label.title = selectedLabels.join("、");
}

function setMultiSelectOpen(select, isOpen) {
  closeMultiSelects(select);
  const menu = select.querySelector(".multi-select-menu");
  const button = select.querySelector(".multi-select-button");
  select.classList.toggle("open", isOpen);
  if (menu) menu.hidden = !isOpen;
  if (button) button.setAttribute("aria-expanded", String(isOpen));
}

function closeMultiSelects(except = null) {
  document.querySelectorAll(".multi-select.open").forEach((select) => {
    if (select === except) return;
    select.classList.remove("open");
    select.querySelector(".multi-select-menu").hidden = true;
    select.querySelector(".multi-select-button").setAttribute("aria-expanded", "false");
  });
}

function refreshAgentModelSelects() {
  [...agentList.querySelectorAll('[data-field="model_config_id"]')].forEach((select) => {
    fillModelSelect(select, select.value);
  });
  [...agentList.querySelectorAll('[data-field="style_id"]')].forEach((select) => {
    const selectedId = select.value || (select.dataset.styleTouched ? "" : defaultStyleId());
    fillStyleSelect(select, selectedId);
  });
  [...agentList.querySelectorAll('[data-field="skill_ids"]')].forEach((select) => {
    fillMultiSelect(select, getSkills(), readMultiSelect(select));
  });
  [...agentList.querySelectorAll('[data-field="mcp_ids"]')].forEach((select) => {
    fillMultiSelect(select, getMcps(), readMultiSelect(select));
  });
  modelLibraryHint.textContent = [
    t("hint.library", {
      models: getModels().map((model) => model.name).join("、"),
      styles: getStyles().length,
      skills: getSkills().length,
      mcps: getMcps().length,
    }),
  ].join("");
}

function addAgent(config = {}) {
  const fragment = agentTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".agent-card");
  const index = agentList.children.length + 1;
  const defaults = {
    name: t("agent.fallbackName", { index }),
    role: "",
    model_config_id: getModels()[0]?.id || "",
    style_id: defaultStyleId(),
    prompt: "",
    mcp_ids: [],
    skill_ids: [],
  };
  const merged = { ...defaults, ...config };

  Object.entries(merged).forEach(([field, value]) => setField(card, field, value));
  fillModelSelect(card.querySelector('[data-field="model_config_id"]'), merged.model_config_id);
  const styleSelect = card.querySelector('[data-field="style_id"]');
  fillStyleSelect(styleSelect, merged.style_id);
  styleSelect.addEventListener("change", () => {
    styleSelect.dataset.styleTouched = "true";
    updateSettingsPromptRendered();
  });
  fillMultiSelect(card.querySelector('[data-field="mcp_ids"]'), getMcps(), merged.mcp_ids);
  fillMultiSelect(card.querySelector('[data-field="skill_ids"]'), getSkills(), merged.skill_ids);
  card.querySelector(".remove-agent").addEventListener("click", () => {
    if (agentList.children.length <= 1) return;
    card.remove();
    syncAgentTitles();
  });
  card.querySelector('[data-field="name"]').addEventListener("input", syncAgentTitles);
  agentList.appendChild(card);
  translateAgentCard(card);
  syncAgentTitles();
}

function readAgent(card) {
  const value = (field) => card.querySelector(`[data-field="${field}"]`).value.trim();
  return {
    name: value("name"),
    role: value("role"),
    model_config_id: value("model_config_id"),
    style_id: value("style_id"),
    prompt: value("prompt"),
    mcp_ids: readMultiSelect(card.querySelector('[data-field="mcp_ids"]')),
    skill_ids: readMultiSelect(card.querySelector('[data-field="skill_ids"]')),
  };
}

function addModel(config = {}) {
  const fragment = modelTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".model-card");
  const index = modelList.children.length + 1;
  const defaults = {
    id: crypto.randomUUID ? crypto.randomUUID() : `model-${Date.now()}-${index}`,
    name: t("model.fallbackName", { index }),
    provider: "mock",
    model: "mock-pro",
    api_key: "",
    base_url: "",
    temperature: 0.7,
    max_tokens: 800,
  };
  const merged = { ...defaults, ...config };
  card.dataset.modelId = merged.id;

  Object.entries(merged).forEach(([field, value]) => setField(card, field, value));
  card.querySelector(".remove-model").addEventListener("click", () => {
    if (modelList.children.length <= 1) return;
    card.remove();
    syncModelTitles();
    markSettingsChanged();
  });
  card.querySelector('[data-field="name"]').addEventListener("input", syncModelTitles);
  modelList.appendChild(card);
  translateModelCard(card);
  syncModelTitles();
}

function readModel(card) {
  const value = (field) => card.querySelector(`[data-field="${field}"]`).value.trim();
  return {
    id: card.dataset.modelId,
    name: value("name"),
    provider: value("provider"),
    model: value("model"),
    api_key: value("api_key"),
    base_url: value("base_url"),
    temperature: Number(value("temperature") || 0.7),
    max_tokens: Number(value("max_tokens") || 800),
  };
}

function addStyle(config = {}) {
  const fragment = styleTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".resource-card");
  const index = styleList.children.length + 1;
  const defaults = {
    id: crypto.randomUUID ? crypto.randomUUID() : `style-${Date.now()}-${index}`,
    name: t("style.fallbackName", { index }),
    prompt: "",
  };
  const merged = { ...defaults, ...config };
  card.dataset.resourceId = merged.id;

  Object.entries(merged).forEach(([field, value]) => setField(card, field, value));
  card.querySelector(".remove-style").addEventListener("click", () => {
    card.remove();
    syncStyleTitles();
    updateSettingsPromptRendered();
    markSettingsChanged();
  });
  card.querySelector('[data-field="name"]').addEventListener("input", syncStyleTitles);
  styleList.appendChild(card);
  translateStyleCard(card);
  syncStyleTitles();
}

function readStyle(card) {
  const value = (field) => card.querySelector(`[data-field="${field}"]`).value.trim();
  return {
    id: card.dataset.resourceId,
    name: value("name"),
    prompt: value("prompt"),
  };
}

function addSkill(config = {}) {
  const fragment = skillTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".resource-card");
  const index = skillList.children.length + 1;
  const defaults = {
    id: crypto.randomUUID ? crypto.randomUUID() : `skill-${Date.now()}-${index}`,
    name: t("skill.fallbackName", { index }),
    prompt: "",
  };
  const merged = { ...defaults, ...config };
  card.dataset.resourceId = merged.id;

  Object.entries(merged).forEach(([field, value]) => setField(card, field, value));
  card.querySelector(".remove-skill").addEventListener("click", () => {
    card.remove();
    syncSkillTitles();
    updateSettingsPromptRendered();
    markSettingsChanged();
  });
  card.querySelector('[data-field="name"]').addEventListener("input", syncSkillTitles);
  skillList.appendChild(card);
  translateSkillCard(card);
  syncSkillTitles();
}

function readSkill(card) {
  const value = (field) => card.querySelector(`[data-field="${field}"]`).value.trim();
  return {
    id: card.dataset.resourceId,
    name: value("name"),
    prompt: value("prompt"),
  };
}

function addMcp(config = {}) {
  const fragment = mcpTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".resource-card");
  const index = mcpList.children.length + 1;
  const defaults = {
    id: crypto.randomUUID ? crypto.randomUUID() : `mcp-${Date.now()}-${index}`,
    name: t("mcp.fallbackName", { index }),
    description: "",
    config: "",
  };
  const merged = { ...defaults, ...config };
  card.dataset.resourceId = merged.id;

  Object.entries(merged).forEach(([field, value]) => setField(card, field, value));
  card.querySelector(".remove-mcp").addEventListener("click", () => {
    card.remove();
    syncMcpTitles();
    updateSettingsPromptRendered();
    markSettingsChanged();
  });
  card.querySelector('[data-field="name"]').addEventListener("input", syncMcpTitles);
  mcpList.appendChild(card);
  translateMcpCard(card);
  syncMcpTitles();
}

function readMcp(card) {
  const value = (field) => card.querySelector(`[data-field="${field}"]`).value.trim();
  return {
    id: card.dataset.resourceId,
    name: value("name"),
    description: value("description"),
    config: value("config"),
  };
}

function setSelectOptionText(select, value, key) {
  const option = select?.querySelector(`option[value="${value}"]`);
  if (option) option.textContent = t(key);
}

function setFieldLabel(card, field, key) {
  const node = card.querySelector(`[data-field="${field}"]`);
  const label = node?.closest("label");
  const textNode = [...(label?.childNodes || [])].find((item) => item.nodeType === Node.TEXT_NODE && item.textContent.trim());
  if (textNode) textNode.textContent = `\n          ${t(key)}\n          `;
}

function messageForLanguage(language, key) {
  const parts = key.split(".");
  let value = i18n.messages[language];
  for (const part of parts) value = value?.[part];
  return value;
}

function replaceIfKnownDefault(node, key) {
  if (!node) return;
  const knownValues = i18n.languages.map((language) => messageForLanguage(language, key)).filter(Boolean);
  if (knownValues.includes(node.value)) node.value = t(key);
}

function translateEditableDefaults() {
  replaceIfKnownDefault(document.querySelector("#topic"), "debate.defaultTopic");
  const firstAgent = agentList.children[0];
  const secondAgent = agentList.children[1];
  replaceIfKnownDefault(firstAgent?.querySelector('[data-field="name"]'), "agent.defaultProName");
  replaceIfKnownDefault(firstAgent?.querySelector('[data-field="role"]'), "agent.defaultProRole");
  replaceIfKnownDefault(firstAgent?.querySelector('[data-field="prompt"]'), "agent.defaultProPrompt");
  replaceIfKnownDefault(secondAgent?.querySelector('[data-field="name"]'), "agent.defaultConName");
  replaceIfKnownDefault(secondAgent?.querySelector('[data-field="role"]'), "agent.defaultConRole");
  replaceIfKnownDefault(secondAgent?.querySelector('[data-field="prompt"]'), "agent.defaultConPrompt");
  syncAgentTitles();
}

function translateAgentCard(card) {
  setAttr(card.querySelector(".remove-agent"), "aria-label", "agent.delete");
  setFieldLabel(card, "name", "agent.name");
  setFieldLabel(card, "role", "agent.role");
  setFieldLabel(card, "model_config_id", "agent.modelConfig");
  setFieldLabel(card, "style_id", "agent.style");
  setFieldLabel(card, "prompt", "agent.prompt");
  const mcpSelect = card.querySelector('[data-field="mcp_ids"]');
  const skillSelect = card.querySelector('[data-field="skill_ids"]');
  const mcpLabel = mcpSelect?.closest(".field-label")?.querySelector("span");
  const skillLabel = skillSelect?.closest(".field-label")?.querySelector("span");
  if (mcpLabel) mcpLabel.textContent = t("agent.mcp");
  if (skillLabel) skillLabel.textContent = t("agent.skills");
  if (mcpSelect) {
    mcpSelect.dataset.placeholder = t("agent.noMcp");
    mcpSelect.dataset.emptyLabel = t("agent.noMcpOptions");
    fillMultiSelect(mcpSelect, getMcps(), readMultiSelect(mcpSelect));
  }
  if (skillSelect) {
    skillSelect.dataset.placeholder = t("agent.noSkill");
    skillSelect.dataset.emptyLabel = t("agent.noSkillOptions");
    fillMultiSelect(skillSelect, getSkills(), readMultiSelect(skillSelect));
  }
}

function translateModelCard(card) {
  setAttr(card.querySelector(".remove-model"), "aria-label", "model.delete");
  setFieldLabel(card, "name", "model.configName");
  setFieldLabel(card, "provider", "model.provider");
  setFieldLabel(card, "model", "model.model");
  setFieldLabel(card, "api_key", "model.apiKey");
  setFieldLabel(card, "base_url", "model.baseUrl");
  setFieldLabel(card, "temperature", "model.temperature");
  setFieldLabel(card, "max_tokens", "model.maxTokens");
  const provider = card.querySelector('[data-field="provider"]');
  setSelectOptionText(provider, "mock", "model.providerMock");
  setSelectOptionText(provider, "openai", "model.providerOpenAI");
  setSelectOptionText(provider, "anthropic", "model.providerAnthropic");
  setSelectOptionText(provider, "openai_compatible", "model.providerOpenAICompatible");
  setSelectOptionText(provider, "deepseek", "model.providerDeepSeek");
  setSelectOptionText(provider, "qwen", "model.providerQwen");
  setSelectOptionText(provider, "moonshot", "model.providerMoonshot");
  setSelectOptionText(provider, "local", "model.providerLocal");
  const baseUrl = card.querySelector('[data-field="base_url"]');
  if (baseUrl) baseUrl.placeholder = t("settings.optional");
}

function translateStyleCard(card) {
  setAttr(card.querySelector(".remove-style"), "aria-label", "style.delete");
  setFieldLabel(card, "name", "style.name");
  setFieldLabel(card, "prompt", "style.prompt");
}

function translateSkillCard(card) {
  setAttr(card.querySelector(".remove-skill"), "aria-label", "skill.delete");
  setFieldLabel(card, "name", "skill.name");
  setFieldLabel(card, "prompt", "skill.prompt");
}

function translateMcpCard(card) {
  setAttr(card.querySelector(".remove-mcp"), "aria-label", "mcp.delete");
  setFieldLabel(card, "name", "mcp.name");
  setFieldLabel(card, "description", "mcp.description");
  setFieldLabel(card, "config", "mcp.config");
  const config = card.querySelector('[data-field="config"]');
  if (config) config.placeholder = t("settings.mcpConfigPlaceholder");
}

function updateExistingDebateText() {
  roundsNode.querySelector(".empty-state")?.replaceChildren(document.createTextNode(t("debate.empty")));
  roundsNode.querySelectorAll(".round-block").forEach((block) => {
    const round = block.dataset.round;
    const title = block.querySelector(".round-title");
    if (title) title.textContent = t("debate.roundTitle", { round });
  });
  speechNodes.forEach((speech, key) => {
    const [round] = key.split("::");
    const label = speech.querySelector(".speech-round-label");
    if (label) label.textContent = t("debate.roundSpeech", { round });
    const promptButton = speech.querySelector(".prompt-toggle-button");
    if (promptButton) promptButton.textContent = t("speech.prompt");
    const status = speech.querySelector(".speech-status")?.dataset.status || "";
    setSpeechStatus(speech, status);
  });
}

function applyTranslations({ updateEditableDefaults = false } = {}) {
  const language = i18n.getLanguage();
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t("app.title");
  setText(".topbar h1", "app.title");
  setText(".topbar p", "app.subtitle");
  setAttr(".language-switch", "aria-label", "language.label");
  setText(".language-switch span", "language.label");
  languageSelect.value = language;
  setSelectOptionText(languageSelect, "zh", "language.zh");
  setSelectOptionText(languageSelect, "en", "language.en");
  setAttr(".page-tabs", "aria-label", "nav.label");
  document.querySelectorAll(".back-to-top-button").forEach((button) => setAttr(button, "aria-label", "nav.backTop"));
  setText('[data-view="debateView"]', "nav.debate");
  setText('[data-view="settingsView"]', "nav.settings");
  setStatus(currentStatusKey, statusPill.classList.contains("running") ? "running" : statusPill.classList.contains("done") ? "done" : statusPill.classList.contains("error") ? "error" : "");

  const debateHeadings = document.querySelectorAll("#debateView .config-panel .section-heading h2");
  setText(debateHeadings[0], "debate.settings");
  setText(debateHeadings[1], "debate.agentConfig");
  setLabelText("#topic", "debate.topic");
  setLabelText("#totalRounds", "debate.totalRounds");
  setLabelText("#answerLength", "debate.answerLength");
  setSelectOptionText(answerLengthSelect, "concise", "debate.answerConcise");
  setSelectOptionText(answerLengthSelect, "medium", "debate.answerMedium");
  setSelectOptionText(answerLengthSelect, "detailed", "debate.answerDetailed");
  setLabelText("#agentCount", "debate.agentCount");
  setText("#addAgentButton", "debate.addAgent");
  setText(".result-panel > .section-heading h2", "debate.process");
  setText("#startButton", "debate.start");
  setText("#previewPromptButton", "debate.previewPrompt");
  setText("#stopButton", "debate.stop");
  setText("#clearButton", "debate.clear");
  setText("#promptPreview h2", "debate.promptPreview");
  setText("#hidePromptPreviewButton", "debate.collapse");

  setAttr("#settingsSidebar", "aria-label", "settings.collapseSidebar");
  setText(".sidebar-header h2", "settings.title");
  setText(".sidebar-header p", "settings.description");
  setAttr("#settingsSidebarToggleButton", "aria-label", "settings.collapseSidebar");
  setAttr("#settingsSidebarExpandButton", "aria-label", "settings.expandSidebar");
  setAttr(".settings-sidebar-nav", "aria-label", "settings.categoryLabel");
  const navItems = document.querySelectorAll(".settings-sidebar-nav a");
  setText(navItems[0]?.querySelector(".nav-title"), "settings.modelConfig");
  setText(navItems[0]?.querySelector(".nav-detail"), "settings.modelDetail");
  setText(navItems[1]?.querySelector(".nav-title"), "settings.templateConfig");
  setText(navItems[1]?.querySelector(".nav-detail"), "settings.templateDetail");
  setText(navItems[2]?.querySelector(".nav-title"), "settings.capabilityConfig");
  setText(navItems[2]?.querySelector(".nav-detail"), "settings.capabilityDetail");
  setText("#settingsModelSection h2", "settings.modelConfig");
  setText("#addModelButton", "settings.addModel");
  setText("#saveSettingsButton", "settings.save");
  setSettingsDirty(isSettingsDirty);
  setText("#settingsTemplateSection > .section-block > .section-heading h2", "settings.templateConfig");
  setLabelText("#settingsPromptTemplate", "settings.promptTemplate");
  setText("#settingsPromptRenderedTitle", "settings.renderedPrompt");
  setText(".placeholder-help h3", "settings.placeholders");
  promptPlaceholderHelp.textContent = t("prompt.placeholders").join("、");
  setLabelText("#settingsRoundPrompt", "settings.roundPromptTemplate");
  setText(".template-group h3", "settings.answerLengthPromptTemplate");
  setLabelText("#settingsLengthConcise", "debate.answerConcise");
  setLabelText("#settingsLengthMedium", "debate.answerMedium");
  setLabelText("#settingsLengthDetailed", "debate.answerDetailed");
  setText(document.querySelectorAll("#settingsTemplateSection .section-heading h2")[1], "settings.styleConfig");
  setText("#addStyleButton", "settings.addStyle");
  setText("#settingsCapabilitySection .section-block:nth-child(1) h2", "settings.skillsConfig");
  setText("#addSkillButton", "settings.importSkill");
  setText("#settingsCapabilitySection .section-block:nth-child(2) h2", "settings.mcpsConfig");
  setText("#addMcpButton", "settings.importMcp");
  setText("#unsavedSettingsTitle", "settings.unsavedTitle");
  setText("#unsavedSettingsBody", "settings.unsavedBody");
  setText('[data-unsaved-action="save"]', "settings.unsavedSave");
  setText('[data-unsaved-action="stash"]', "settings.unsavedStash");
  setText('[data-unsaved-action="discard"]', "settings.unsavedDiscard");
  setText('[data-unsaved-action="cancel"]', "settings.unsavedCancel");

  document.querySelectorAll(".agent-card").forEach(translateAgentCard);
  document.querySelectorAll(".model-card").forEach(translateModelCard);
  document.querySelectorAll(".style-list .resource-card").forEach(translateStyleCard);
  document.querySelectorAll(".skill-list .resource-card").forEach(translateSkillCard);
  document.querySelectorAll(".mcp-list .resource-card").forEach(translateMcpCard);
  if (updateEditableDefaults) translateEditableDefaults();
  refreshAgentModelSelects();
  syncModelTitles();
  syncStyleTitles();
  syncSkillTitles();
  syncMcpTitles();
  updateExistingDebateText();
}

function renderSettings() {
  isRenderingSettings = true;
  const templates = getTemplates();
  const lengthPrompts = { ...DEFAULT_SETTINGS.templates.answer_length_prompts, ...(templates.answer_length_prompts || {}) };
  settingsPromptTemplate.value = templates.prompt_template ?? "";
  promptPlaceholderHelp.textContent = t("prompt.placeholders").join("、");
  settingsRoundPrompt.value = templates.round_prompt_template ?? "";
  settingsLengthConcise.value = lengthPrompts.concise ?? "";
  settingsLengthMedium.value = lengthPrompts.medium ?? "";
  settingsLengthDetailed.value = lengthPrompts.detailed ?? "";
  modelList.innerHTML = "";
  styleList.innerHTML = "";
  skillList.innerHTML = "";
  mcpList.innerHTML = "";
  getModels().forEach(addModel);
  getStyles().forEach(addStyle);
  getSkills().forEach(addSkill);
  getMcps().forEach(addMcp);
  refreshAgentModelSelects();
  applyTranslations();
  updateSettingsPromptRendered();
  isRenderingSettings = false;
}

function renderTemplate(template, values) {
  return String(template ?? "").replace(/\{(\w+)}/g, (match, key) => {
    if (Object.hasOwn(values, key)) return values[key];
    return match;
  });
}

function cleanPrompt(prompt) {
  const lines = prompt.split("\n").map((line) => line.replace(/\s+$/g, ""));
  const cleaned = [];
  let blankCount = 0;
  for (const line of lines) {
    if (line) {
      cleaned.push(line);
      blankCount = 0;
      continue;
    }
    blankCount += 1;
    if (blankCount <= 1) cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}

function formatTextSection(title, value) {
  const text = value.trim();
  return text ? `${title}：\n${text}` : "";
}

function formatStyleSection(value) {
  const text = value.trim();
  if (!text) return "";
  if (text.startsWith("说话风格：") || text.startsWith("说话风格:")) return text;
  return `说话风格：\n${text}`;
}

function formatPlainItems(values) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => `- ${value}`)
    .join("\n");
}

function joinResourceText(name, description) {
  const text = description.trim();
  return text ? `${name}：${text}` : name;
}

function buildPromptTemplateRenderValues() {
  const settings = buildSettingsPayload();
  const agent = agentList.children[0] ? readAgent(agentList.children[0]) : DEFAULT_AGENTS[0];
  const currentRound = 1;
  const totalRounds = Number(document.querySelector("#totalRounds").value || 1);
  const answerLength = answerLengthSelect.value;
  const styles = new Map(settings.styles.map((style) => [style.id, style]));
  const skills = new Map(settings.skills.map((skill) => [skill.id, skill]));
  const mcps = new Map(settings.mcps.map((mcp) => [mcp.id, mcp]));
  const style = styles.get(agent.style_id);
  const selectedStyle = style ? (style.prompt.trim() || style.name) : "";
  const selectedSkills = formatPlainItems(
    (agent.skill_ids || []).map((id) => {
      const skill = skills.get(id);
      return skill ? joinResourceText(skill.name, skill.prompt) : "";
    }),
  );
  const selectedMcps = formatPlainItems(
    (agent.mcp_ids || []).map((id) => {
      const mcp = mcps.get(id);
      return mcp ? joinResourceText(mcp.name, mcp.description) : "";
    }),
  );
  const values = {
    current_round: currentRound,
    total_rounds: totalRounds,
    agent_name: agent.name,
    role: agent.role || "未指定",
    topic: document.querySelector("#topic").value.trim(),
    agent_prompt: (agent.prompt || "").trim(),
    answer_length: answerLength,
    answer_length_label: answerLengthLabel(answerLength),
  };
  const roundPrompt = renderTemplate(settings.templates.round_prompt_template, values);
  const answerLengthPrompt = renderTemplate(settings.templates.answer_length_prompts[answerLength] || "", values);

  return {
    ...values,
    style: selectedStyle,
    skills: selectedSkills,
    mcps: selectedMcps,
    round_prompt: roundPrompt,
    answer_length_prompt: answerLengthPrompt,
    style_section: formatStyleSection(selectedStyle),
    skills_section: formatTextSection("可用 Skills", selectedSkills),
    mcps_section: formatTextSection("可用 MCPs", selectedMcps),
  };
}

function buildPromptUserMessage(topic) {
  return `辩题：${topic}\n\n当前辩论历史：\n暂无历史发言。\n\n请根据你的角色、立场和配置，完成本轮发言。`;
}

function formatPromptMessagesForDisplay(messages) {
  return messages.map((message) => `[${message.role}]\n${message.content}`).join("\n\n---\n\n");
}

function updateSettingsPromptRendered() {
  if (!settingsPromptRendered) return;
  const values = buildPromptTemplateRenderValues();
  const systemPrompt = cleanPrompt(renderTemplate(settingsPromptTemplate.value, values));
  settingsPromptRendered.textContent = formatPromptMessagesForDisplay([
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: buildPromptUserMessage(values.topic),
    },
  ]);
}

function buildPayload() {
  return {
    topic: document.querySelector("#topic").value.trim(),
    total_rounds: Number(document.querySelector("#totalRounds").value),
    answer_length: answerLengthSelect.value,
    agents: [...agentList.children].map(readAgent),
  };
}

function clearRounds() {
  roundsNode.innerHTML = `<div class="empty-state">${escapeHtml(t("debate.empty"))}</div>`;
  speechNodes = new Map();
  speechMarkdown = new Map();
}

function ensureRound(round) {
  roundsNode.querySelector(".empty-state")?.remove();
  let block = roundsNode.querySelector(`[data-round="${round}"]`);
  if (!block) {
    block = document.createElement("section");
    block.className = "round-block";
    block.dataset.round = round;
    block.innerHTML = `<div class="round-title">${escapeHtml(t("debate.roundTitle", { round }))}</div>`;
    roundsNode.appendChild(block);
  }
  return block;
}

function appendMessage(message) {
  const block = ensureRound(message.round);
  const speech = document.createElement("article");
  speech.className = `speech ${message.error ? "error" : ""}`.trim();
  const content = message.error || message.content || "";
  speech.innerHTML = `
    <div class="speech-meta">
      <div class="speech-meta-text">
        <span class="agent-name"></span>
        <span class="speech-round-label">${escapeHtml(t("debate.roundSpeech", { round: message.round }))}</span>
      </div>
      <div class="speech-meta-actions">
        <span class="speech-status" hidden aria-live="polite">
          <span class="speech-spinner" aria-hidden="true"></span>
          <span class="speech-status-text"></span>
        </span>
        <button class="prompt-toggle-button" type="button" hidden>${escapeHtml(t("speech.prompt"))}</button>
      </div>
    </div>
    <div class="speech-prompt" hidden><pre></pre></div>
    <div class="speech-content"></div>
  `;
  speech.querySelector(".agent-name").textContent = message.agent_name;
  setSpeechPrompt(speech, message.prompt_messages || []);
  updateSpeechContent(speech, content, Boolean(message.error));
  setSpeechStatus(speech, message.error ? "error" : "");
  block.appendChild(speech);
  speech.scrollIntoView({ behavior: "smooth", block: "nearest" });
  speechNodes.set(messageKey(message), speech);
  speechMarkdown.set(messageKey(message), content);
  return speech;
}

function messageKey(message) {
  return `${message.round}::${message.agent_name}`;
}

function ensureSpeech(message) {
  const key = messageKey(message);
  if (speechNodes.has(key)) {
    const speech = speechNodes.get(key);
    setSpeechPrompt(speech, message.prompt_messages || []);
    return speech;
  }
  const speech = appendMessage({
    round: message.round,
    agent_name: message.agent_name,
    content: "",
    prompt_messages: message.prompt_messages || [],
  });
  setSpeechStatus(speech, "waiting");
  return speech;
}

function appendDelta(message) {
  const speech = ensureSpeech(message);
  const key = messageKey(message);
  const nextContent = `${speechMarkdown.get(key) || ""}${message.delta || ""}`;
  speechMarkdown.set(key, nextContent);
  updateSpeechContent(speech, nextContent);
  setSpeechStatus(speech, "streaming");
  speech.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function finalizeMessage(message) {
  const speech = ensureSpeech(message);
  const key = messageKey(message);
  if (message.error) {
    speech.classList.add("error");
    speechMarkdown.set(key, message.error);
    updateSpeechContent(speech, message.error, true);
    setSpeechStatus(speech, "error");
  } else if ((speechMarkdown.get(key) || "") !== message.content) {
    const finalContent = message.content || t("debate.noContent");
    speechMarkdown.set(key, finalContent);
    updateSpeechContent(speech, finalContent);
  }
  if (!message.error) setSpeechStatus(speech, "");
}

function setSpeechStatus(speech, status) {
  const statusNode = speech.querySelector(".speech-status");
  const textNode = speech.querySelector(".speech-status-text");
  if (!statusNode || !textNode) return;

  const labels = {
    waiting: t("speech.waiting"),
    streaming: t("speech.streaming"),
    error: t("speech.error"),
  };
  speech.classList.toggle("loading", status === "waiting" || status === "streaming");
  statusNode.dataset.status = status;
  textNode.textContent = labels[status] || "";
  statusNode.hidden = !labels[status];
}

function clearActiveSpeechStatuses() {
  speechNodes.forEach((speech) => {
    if (speech.classList.contains("loading")) setSpeechStatus(speech, "");
  });
}

function setSpeechPrompt(speech, promptMessages = []) {
  const text = formatPromptMessages(promptMessages);
  const button = speech.querySelector(".prompt-toggle-button");
  const panel = speech.querySelector(".speech-prompt");
  const pre = panel?.querySelector("pre");
  if (!button || !panel || !pre) return;
  if (!text) {
    button.hidden = true;
    panel.hidden = true;
    return;
  }

  pre.textContent = text;
  button.hidden = false;
  if (button.dataset.bound) return;
  button.dataset.bound = "true";
  button.addEventListener("click", () => {
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    button.classList.toggle("active", isHidden);
  });
}

function formatPromptMessages(messages = []) {
  return messages
    .filter((message) => message?.role && typeof message.content === "string")
    .map((message) => `[${message.role}]\n${message.content}`)
    .join("\n\n---\n\n");
}

function updateSpeechContent(speech, markdown, isError = false) {
  const contentNode = speech.querySelector(".speech-content");
  if (isError) {
    contentNode.textContent = markdown;
    return;
  }
  contentNode.innerHTML = renderMarkdown(markdown || "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) return parsed.href;
  } catch {
    return "";
  }
  return "";
}

function renderMarkdown(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const html = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("");
    html.push(`<${list.type}>${items}</${list.type}>`);
    list = null;
  };

  const flushBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      flushBlocks();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const language = fenceMatch[1] ? ` data-language="${escapeHtml(fenceMatch[1])}"` : "";
      html.push(`<pre><code${language}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushBlocks();
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      flushBlocks();
      const headers = parseTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      const head = headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("");
      const body = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`)
        .join("");
      html.push(`<div class="markdown-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushBlocks();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushBlocks();
      const quoteLines = [quoteMatch[1]];
      while (index + 1 < lines.length) {
        const nextQuote = lines[index + 1].match(/^>\s?(.*)$/);
        if (!nextQuote) break;
        quoteLines.push(nextQuote[1]);
        index += 1;
      }
      html.push(`<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const type = unorderedMatch ? "ul" : "ol";
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push(unorderedMatch ? unorderedMatch[1] : orderedMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushBlocks();
  return html.join("") || "";
}

function isMarkdownTableStart(lines, index) {
  if (!lines[index]?.includes("|") || !lines[index + 1]?.includes("|")) return false;
  const separatorCells = parseTableRow(lines[index + 1]);
  return separatorCells.length > 1 && separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInlineMarkdown(text) {
  const tokens = [];
  const stash = (html) => {
    const token = `\uE000${tokens.length}\uE000`;
    tokens.push(html);
    return token;
  };

  let working = text.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  working = working.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (_, label, rawUrl) => {
    const url = sanitizeUrl(rawUrl);
    const labelHtml = escapeHtml(label);
    if (!url) return labelHtml;
    return stash(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${labelHtml}</a>`);
  });

  let html = escapeHtml(working);
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  html = html.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  tokens.forEach((tokenHtml, index) => {
    html = html.replaceAll(`\uE000${index}\uE000`, tokenHtml);
  });
  return html;
}

function setRunning(isRunning) {
  startButton.disabled = isRunning;
  stopButton.disabled = !isRunning;
  addAgentButton.disabled = isRunning;
}

function parseSseChunk(buffer, onEvent) {
  const events = buffer.split("\n\n");
  const rest = events.pop() ?? "";
  for (const rawEvent of events) {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) continue;
    onEvent(JSON.parse(dataLines.join("\n")));
  }
  return rest;
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) throw new Error(t("settings.loadFailed", { status: response.status }));
    appSettings = normalizeClientSettings(await response.json());
  } catch (error) {
    setSettingsMessage(error.message || String(error), "error");
    return false;
  }
  renderSettings();
  setSettingsDirty(false);
  return true;
}

function normalizeClientSettings(settings) {
  const normalized = cloneData(DEFAULT_SETTINGS);
  normalized.models = settings.models || [];
  normalized.styles = settings.styles || [];
  normalized.skills = settings.skills || [];
  normalized.mcps = settings.mcps || [];
  normalized.templates = {
    ...DEFAULT_SETTINGS.templates,
    ...(settings.templates || {}),
  };
  if (settings.round_prompt_template && !settings.templates?.round_prompt_template) {
    normalized.templates.round_prompt_template = settings.round_prompt_template;
  }
  normalized.templates.answer_length_prompts = {
    ...DEFAULT_SETTINGS.templates.answer_length_prompts,
    ...(settings.templates?.answer_length_prompts || {}),
  };
  return normalized;
}

function buildSettingsPayload() {
  return {
    templates: {
      prompt_template: settingsPromptTemplate.value,
      round_prompt_template: settingsRoundPrompt.value,
      answer_length_prompts: {
        concise: settingsLengthConcise.value,
        medium: settingsLengthMedium.value,
        detailed: settingsLengthDetailed.value,
      },
    },
    models: [...modelList.children].map(readModel),
    styles: [...styleList.children].map(readStyle),
    skills: [...skillList.children].map(readSkill),
    mcps: [...mcpList.children].map(readMcp),
  };
}

async function saveSettings(event) {
  event.preventDefault();
  const shouldRefreshPromptPreview = !promptPreview.hidden;
  return persistSettings({ refreshPromptPreview: shouldRefreshPromptPreview });
}

async function persistSettings({
  refreshPromptPreview = false,
  preserveScroll = true,
  renderAfterSave = true,
} = {}) {
  const payload = buildSettingsPayload();

  try {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || t("settings.saveFailed", { status: response.status }));
    }
    appSettings = normalizeClientSettings(await response.json());
    if (renderAfterSave) renderSettings();
    setSettingsDirty(false);
    setSettingsMessage("");
    if (refreshPromptPreview) await previewPrompt({ preserveScroll });
    return true;
  } catch (error) {
    setSettingsMessage(error.message || String(error), "error");
    return false;
  }
}

async function previewPrompt(options = {}) {
  promptPreview.hidden = false;
  roundsNode.querySelector(".empty-state")?.remove();
  promptPreviewMeta.textContent = t("preview.loading");
  promptPreviewContent.textContent = "";
  if (!options.preserveScroll) promptPreview.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await fetch("/api/prompt/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...buildPayload(),
        current_round: 1,
        agent_index: 0,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || t("preview.failedStatus", { status: response.status }));
    }
    renderPromptPreview(await response.json());
    if (!options.preserveScroll) promptPreview.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    promptPreviewMeta.textContent = t("preview.failed");
    promptPreviewContent.textContent = error.message || String(error);
    if (!options.preserveScroll) promptPreview.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderPromptPreview(preview) {
  promptPreviewMeta.textContent = [
    `${t("preview.agent")}：${preview.agent_name}`,
    `${t("preview.provider")}：${preview.provider}`,
    `${t("preview.model")}：${preview.model_name}`,
    `${t("preview.topic")}：${preview.topic}`,
    `${t("preview.rounds")}：${preview.current_round}/${preview.total_rounds}`,
    `${t("preview.answerLength")}：${preview.answer_length_label}`,
  ].join(" | ");
  promptPreviewContent.textContent = preview.messages
    .map((message) => `[${message.role}]\n${message.content}`)
    .join("\n\n---\n\n");
}

async function startDebate(event) {
  event.preventDefault();
  clearRounds();
  setStatus("status.running", "running");
  setRunning(true);
  abortController = new AbortController();

  try {
    const response = await fetch("/api/debate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || t("errors.requestFailed", { status: response.status }));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = parseSseChunk(buffer, (payload) => {
        if (payload.type === "message_started") ensureSpeech(payload.message);
        if (payload.type === "message_delta") appendDelta(payload.message);
        if (payload.type === "message") finalizeMessage(payload.message);
        if (payload.type === "done") setStatus("status.completed", "done");
      });
    }

    if (currentStatusKey === "status.running") setStatus("status.completed", "done");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("status.stopped");
      clearActiveSpeechStatuses();
    } else {
      setStatus("status.error", "error");
      clearActiveSpeechStatuses();
      appendMessage({ round: 1, agent_name: t("debate.system"), error: error.message || String(error) });
    }
  } finally {
    abortController = null;
    setRunning(false);
  }
}

function switchView(viewId) {
  document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === viewId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function currentViewId() {
  return document.querySelector(".view.active")?.id || "debateView";
}

function showUnsavedSettingsDialog() {
  return new Promise((resolve) => {
    if (!unsavedSettingsDialog) {
      resolve("cancel");
      return;
    }

    unsavedSettingsDialog.hidden = false;
    const buttons = [...unsavedSettingsDialog.querySelectorAll("[data-unsaved-action]")];
    const cleanup = (choice) => {
      buttons.forEach((button) => button.removeEventListener("click", onClick));
      document.removeEventListener("keydown", onKeydown);
      unsavedSettingsDialog.hidden = true;
      resolve(choice);
    };
    const onClick = (event) => cleanup(event.currentTarget.dataset.unsavedAction);
    const onKeydown = (event) => {
      if (event.key === "Escape") cleanup("cancel");
    };

    buttons.forEach((button) => button.addEventListener("click", onClick));
    document.addEventListener("keydown", onKeydown);
    buttons[0]?.focus();
  });
}

async function handleSettingsLeave() {
  const choice = await showUnsavedSettingsDialog();
  if (choice === "save") {
    return persistSettings({ refreshPromptPreview: !promptPreview.hidden });
  }
  if (choice === "stash") {
    return true;
  }
  if (choice === "discard") {
    return loadSettings();
  }
  return false;
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetView = button.dataset.view;
      if (targetView === currentViewId()) return;
      if (currentViewId() === "settingsView" && targetView === "debateView" && isSettingsDirty) {
        const canLeave = await handleSettingsLeave();
        if (!canLeave) return;
      }
      switchView(targetView);
    });
  });
}

function setSettingsSidebarCollapsed(isCollapsed) {
  settingsForm.classList.toggle("sidebar-collapsed", isCollapsed);
  settingsSidebar.setAttribute("aria-hidden", String(isCollapsed));
  settingsSidebarExpandButton.hidden = !isCollapsed;
}

function bindSettingsSidebar() {
  settingsSidebarToggleButton.addEventListener("click", () => setSettingsSidebarCollapsed(true));
  settingsSidebarExpandButton.addEventListener("click", () => setSettingsSidebarCollapsed(false));
}

function bindBackToTopButtons() {
  const buttons = [...document.querySelectorAll(".back-to-top-button")];
  buttons.forEach((button) => {
    button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  });
  window.addEventListener(
    "scroll",
    () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastScrollY) < 4) return;
      const isScrollingDown = currentY > lastScrollY;
      buttons.forEach((button) => button.classList.toggle("collapsed", isScrollingDown));
      lastScrollY = currentY;
    },
    { passive: true },
  );
}

addAgentButton.addEventListener("click", () => addAgent());
addModelButton.addEventListener("click", () => {
  addModel();
  markSettingsChanged();
});
addStyleButton.addEventListener("click", () => {
  addStyle();
  markSettingsChanged();
});
addSkillButton.addEventListener("click", () => {
  addSkill();
  markSettingsChanged();
});
addMcpButton.addEventListener("click", () => {
  addMcp();
  markSettingsChanged();
});
languageSelect.addEventListener("change", () => {
  i18n.setLanguage(languageSelect.value);
  applyTranslations({ updateEditableDefaults: true });
  updateSettingsPromptRendered();
});
agentCountInput.addEventListener("change", () => {
  const targetCount = Math.max(1, Math.min(12, Number(agentCountInput.value || 1)));
  while (agentList.children.length < targetCount) addAgent();
  while (agentList.children.length > targetCount) agentList.lastElementChild.remove();
  syncAgentTitles();
  updateSettingsPromptRendered();
});
stopButton.addEventListener("click", () => abortController?.abort());
clearButton.addEventListener("click", clearRounds);
previewPromptButton.addEventListener("click", previewPrompt);
hidePromptPreviewButton.addEventListener("click", () => {
  promptPreview.hidden = true;
});
document.addEventListener("click", () => closeMultiSelects());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMultiSelects();
});
form.addEventListener("submit", startDebate);
form.addEventListener("input", updateSettingsPromptRendered);
form.addEventListener("change", updateSettingsPromptRendered);
settingsForm.addEventListener("submit", saveSettings);
settingsForm.addEventListener("input", () => {
  updateSettingsPromptRendered();
  markSettingsChanged();
});
settingsForm.addEventListener("change", () => {
  updateSettingsPromptRendered();
  markSettingsChanged();
});
bindTabs();
bindSettingsSidebar();
bindBackToTopButtons();

DEFAULT_AGENTS.forEach(addAgent);
applyTranslations({ updateEditableDefaults: true });
updateSettingsPromptRendered();
loadSettings();
