(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  const PENDING_KEY = "asistente-sios-pending-action";
  const PANEL_STATE_KEY = "asistente-sios-panel-state";
  const CATALOG_STORAGE_KEY = "asistente-sios-codigario";
  const PANEL_STATE_VERSION = 3;
  const PANEL_MIN_WIDTH = 130;
  const PANEL_DEFAULT_WIDTH = 160;
  const PANEL_PREVIOUS_DEFAULT_WIDTH = 140;
  const PANEL_MIN_HEIGHT = 320;
  const PANEL_MARGIN = 0;
  const ASSISTANT_RAIL_WIDTH = 0;
  let currentTemplates = [];
  const diagnosticErrors = [];

  function textStatus(root, message) {
    const status = root.querySelector("[data-status]");
    if (status) status.textContent = message;
    const summary = root.querySelector("[data-status-summary]");
    if (summary) {
      const normalized = String(message || "").toLowerCase();
      const state = normalized.includes("error") || normalized.includes("no se pudo") ? "Error" :
        normalized.includes("complet") || normalized.includes("guardad") || normalized.includes("seleccionada") ? "Listo" : "Esperando";
      summary.textContent = `Estado — ${state}`;
    }
  }

  function setAuthResult(root, message, kind) {
    const box = root.querySelector("[data-resultado-autorizacion]");
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || "";
    box.classList.toggle("ok", kind === "ok");
    box.classList.toggle("error", kind === "error");
  }

  function rememberError(error) {
    diagnosticErrors.push({
      message: error?.message || String(error),
      at: new Date().toISOString()
    });
    if (diagnosticErrors.length > 8) {
      diagnosticErrors.shift();
    }
  }

  function setStepEnabled(root, step, enabled) {
    const section = root.querySelector(`[data-step="${step}"]`);
    if (String(step) === "3") {
      section?.classList.remove("disabled");
      section?.classList.toggle("templates-disabled", !enabled);
      section?.querySelectorAll("[data-template-apply], [data-elemento-id]").forEach((control) => {
        control.disabled = !enabled;
      });
      return;
    }
    section?.classList.toggle("disabled", !enabled);
    section?.querySelectorAll("input, button").forEach((control) => {
      control.disabled = !enabled;
    });
  }

  function applySiosDock(panel) {
    const width = Math.round(panel.getBoundingClientRect().width || PANEL_DEFAULT_WIDTH);
    const offset = ASSISTANT_RAIL_WIDTH + width;
    const html = document.documentElement;
    const body = document.body;
    if (!html.dataset.siosAssistantDocked) {
      html.dataset.siosAssistantDocked = "1";
      html.dataset.siosAssistantOriginalMarginLeft = html.style.marginLeft || "";
      html.dataset.siosAssistantOriginalWidth = html.style.width || "";
      if (body) {
        body.dataset.siosAssistantOriginalMarginLeft = body.style.marginLeft || "";
        body.dataset.siosAssistantOriginalWidth = body.style.width || "";
      }
    }
    html.style.marginLeft = `${offset}px`;
    html.style.width = `calc(100% - ${offset}px)`;
    if (body) {
      body.style.marginLeft = "0";
      body.style.width = "auto";
    }
  }

  function removeSiosDock() {
    const html = document.documentElement;
    const body = document.body;
    if (!html.dataset.siosAssistantDocked) return;
    html.style.marginLeft = html.dataset.siosAssistantOriginalMarginLeft || "";
    html.style.width = html.dataset.siosAssistantOriginalWidth || "";
    if (body) {
      body.style.marginLeft = body.dataset.siosAssistantOriginalMarginLeft || "";
      body.style.width = body.dataset.siosAssistantOriginalWidth || "";
      delete body.dataset.siosAssistantOriginalMarginLeft;
      delete body.dataset.siosAssistantOriginalWidth;
    }
    delete html.dataset.siosAssistantDocked;
    delete html.dataset.siosAssistantOriginalMarginLeft;
    delete html.dataset.siosAssistantOriginalWidth;
  }

  function openPanel(root) {
    const panel = root.querySelector("[data-panel]");
    panel.hidden = false;
    restorePanelState(panel);
    root.querySelector(".sios-launcher").hidden = true;
    applySiosDock(panel);
  }

  function closePanel(root) {
    root.querySelector("[data-panel]").hidden = true;
    root.querySelector(".sios-launcher").hidden = false;
    removeSiosDock();
  }

  function ensureConfirmationVisible(root) {
    const body = root.querySelector("[data-panel-body]");
    const step = root.querySelector('[data-step="4"]');
    if (!body || !step) return;

    const bodyRect = body.getBoundingClientRect();
    const stepRect = step.getBoundingClientRect();
    if (stepRect.top < bodyRect.top) {
      body.scrollTop += stepRect.top - bodyRect.top;
    } else if (stepRect.bottom > bodyRect.bottom) {
      body.scrollTop += stepRect.bottom - bodyRect.bottom;
    }
  }

  function renderDiagnostics(root) {
    const diagnostics = SIOS.obtenerDiagnostico();
    const screen = diagnostics.screen || {};
    const safe = {
      screen: {
        type: screen.type,
        label: screen.label,
        title: screen.title,
        formActionPath: String(screen.formAction || "").split("?")[0]
      },
      authorizationLookup: diagnostics.authorizationLookup,
      templateExecution: SIOS.obtenerDiagnosticoPlantilla?.() || null,
      errors: diagnosticErrors,
      controls: diagnostics.controls.map((control) => ({
        id: control.id,
        found: control.found,
        tag: control.tag,
        type: control.type,
        visible: control.visible,
        options: control.options
      }))
    };
    root.querySelector("[data-diagnostico]").textContent = JSON.stringify(safe, null, 2);
  }

  function normalizeSearch(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function templateMatches(template, query) {
    if (!query) return true;
    const haystack = [
      template.nombre,
      template.categoria,
      ...(template.items || []).flatMap((item) => [item.codigo, item.descripcion, item.observacion])
    ].map(normalizeSearch).join(" ");
    return haystack.includes(query);
  }

  function renderTemplates(root, templates, query = "") {
    currentTemplates = templates;
    const frequent = root.querySelector("[data-plantillas]");
    const list = root.querySelector("[data-template-list]");
    const empty = root.querySelector("[data-empty-templates]");
    frequent.textContent = "";
    if (list) list.textContent = "";
    const normalizedQuery = normalizeSearch(query);
    const visible = templates.filter((template) => template.activo && templateMatches(template, normalizedQuery));

    for (const item of visible.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"))) {
      const row = document.createElement("div");
      row.className = "template-card";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.nombre;
      button.title = `Aplicar ${item.nombre}`;
      button.dataset.templateApply = item.id;
      row.append(button);

      const quick = document.createElement("button");
      quick.type = "button";
      quick.className = "template-edit-icon";
      quick.title = "Editar cantidades u observaciones antes de aplicar";
      quick.setAttribute("aria-label", `Editar ${item.nombre} antes de aplicar`);
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
      body.setAttribute("d", "M4 20h4l11-11-4-4L4 16v4Z");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", "m13.5 6.5 4 4");
      icon.append(body, line);
      quick.append(icon);
      quick.dataset.templateQuick = item.id;
      row.append(quick);
      frequent.append(row);
    }
    if (empty) {
      empty.hidden = visible.length > 0;
      empty.textContent = normalizedQuery
        ? "Sin resultados para esta búsqueda."
        : "Todavía no hay plantillas. Cree una o importe un respaldo.";
    }

    for (const item of templates) {
      if (!list) break;
      const row = document.createElement("div");
      row.className = "template-list-row";
      const label = document.createElement("span");
      label.textContent = `${item.nombre} · ${item.activo ? "activa" : "inactiva"}`;
      row.append(label);
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "Editar";
      edit.dataset.templateEdit = item.id;
      row.append(edit);
      list.append(row);
    }

    const step = root.querySelector('[data-step="3"]');
    const enabled = !step?.classList.contains("templates-disabled");
    step?.querySelectorAll("[data-template-apply]").forEach((control) => {
      control.disabled = !enabled;
    });
  }

  async function copyDiagnostics(root) {
    renderDiagnostics(root);
    const text = root.querySelector("[data-diagnostico]").textContent;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.documentElement.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function formatMatch(match) {
    const parts = [match.displayNumber || match.authorizationNumber];
    parts.push(match.medStatus || "Estado MED no disponible");
    if (match.date) parts.push(`Fecha: ${match.date}`);
    return parts.join(" · ");
  }

  function renderMatches(root, matches, onSelect) {
    const box = root.querySelector("[data-matches]");
    box.textContent = "";
    box.hidden = false;

    for (const match of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.dataset.selectRowId = match.rowId;
      button.textContent = formatMatch(match);
      button.addEventListener("click", () => onSelect(match));
      box.append(button);
    }
  }

  function clearMatches(root) {
    const box = root.querySelector("[data-matches]");
    box.textContent = "";
    box.hidden = true;
  }

  function savePendingAction(action) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...action, requestedAt: Date.now() }));
  }

  function peekPendingAction() {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
  }

  function clearPendingAction() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForPendingDetail(pending, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start <= timeoutMs) {
      if (SIOS.detallePlantillaDisponible?.(pending.expectedAuthorization)) return true;
      await wait(150);
    }
    return false;
  }

  function getPanelState() {
    try {
      return JSON.parse(sessionStorage.getItem(PANEL_STATE_KEY) || "{}");
    } catch (error) {
      sessionStorage.removeItem(PANEL_STATE_KEY);
      return {};
    }
  }

  function savePanelState(panel) {
    const rect = panel.getBoundingClientRect();
    sessionStorage.setItem(PANEL_STATE_KEY, JSON.stringify({
      version: PANEL_STATE_VERSION,
      width: Math.round(rect.width),
      scrollTop: Math.round(panel.querySelector("[data-panel-body]")?.scrollTop || 0)
    }));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getPanelLimits() {
    return {
      maxWidth: Math.max(PANEL_MIN_WIDTH, window.innerWidth - ASSISTANT_RAIL_WIDTH - PANEL_MARGIN * 2),
      maxHeight: Math.max(PANEL_MIN_HEIGHT, window.innerHeight - PANEL_MARGIN * 2)
    };
  }

  function applyPanelGeometry(panel, geometry, persist = true) {
    const limits = getPanelLimits();
    const width = clamp(Number(geometry.width || panel.offsetWidth || PANEL_DEFAULT_WIDTH), PANEL_MIN_WIDTH, limits.maxWidth);
    panel.style.width = `${width}px`;
    panel.style.height = "100vh";
    panel.style.left = `${ASSISTANT_RAIL_WIDTH}px`;
    panel.style.top = "0";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    if (!panel.hidden) applySiosDock(panel);
    if (persist) savePanelState(panel);
  }

  function restorePanelState(panel) {
    const state = getPanelState();
    const storedWidth = Number(state.width);
    const width = state.version === PANEL_STATE_VERSION ? storedWidth :
      state.version === 2 ? (storedWidth === PANEL_PREVIOUS_DEFAULT_WIDTH ? PANEL_DEFAULT_WIDTH : storedWidth) :
        storedWidth > PANEL_PREVIOUS_DEFAULT_WIDTH ? PANEL_DEFAULT_WIDTH : storedWidth;
    applyPanelGeometry(panel, { width: width || PANEL_DEFAULT_WIDTH }, false);
    const body = panel.querySelector("[data-panel-body]");
    if (body && Number.isFinite(Number(state.scrollTop))) body.scrollTop = Number(state.scrollTop);
  }

  function initPanelMovement(root) {
    const panel = root.querySelector("[data-panel]");
    const resizeHandle = root.querySelector("[data-resize-handle]");
    const body = root.querySelector("[data-panel-body]");
    let active = null;

    const finishInteraction = () => {
      if (!active) return;
      savePanelState(panel);
      active = null;
      document.removeEventListener("pointermove", moveInteraction);
      document.removeEventListener("pointerup", finishInteraction);
      document.removeEventListener("pointercancel", finishInteraction);
    };
    const moveInteraction = (event) => {
      if (!active) return;
      event.preventDefault();
      applyPanelGeometry(panel, { width: active.startWidth + event.clientX - active.startX }, false);
    };
    resizeHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      active = { startX: event.clientX, startWidth: panel.getBoundingClientRect().width };
      event.preventDefault();
      document.addEventListener("pointermove", moveInteraction);
      document.addEventListener("pointerup", finishInteraction);
      document.addEventListener("pointercancel", finishInteraction);
    });
    body?.addEventListener("scroll", () => savePanelState(panel), { passive: true });
    window.addEventListener("resize", () => {
      if (!panel.hidden) applyPanelGeometry(panel, getPanelState(), true);
    });
  }

  function createTemplateItemEditor(item, index, removable = true, addAction = "template-item-add") {
    const wrap = document.createElement("div");
    wrap.className = "template-item";
    wrap.dataset.itemIndex = String(index);
    // Conserva campos tecnicos (descripcionSeleccionModal, etc.) que ya no se muestran.
    wrap.dataset.original = JSON.stringify(item || {});
    const field = (labelText, fieldName, attributes = {}) => {
      const label = document.createElement("label");
      label.append(document.createTextNode(labelText));
      const input = document.createElement("input");
      input.dataset.itemField = fieldName;
      Object.entries(attributes).forEach(([name, value]) => input.setAttribute(name, value));
      label.append(input);
      return label;
    };
    const searchField = () => {
      const label = document.createElement("label");
      label.append(document.createTextNode("Buscar elemento"));
      const search = document.createElement("div");
      search.className = "template-item-search";
      const input = document.createElement("input");
      input.dataset.itemField = "buscarElemento";
      input.placeholder = "Escriba código o nombre del elemento...";
      input.autocomplete = "off";
      const options = document.createElement("div");
      options.className = "template-item-options";
      options.dataset.itemSearchOptions = "";
      options.hidden = true;
      search.append(input, options);
      label.append(search);
      return label;
    };
    const grid = (...children) => {
      const container = document.createElement("div");
      container.className = "template-item-grid";
      container.append(...children);
      return container;
    };
    const fields = document.createElement("div");
    fields.className = "template-item-fields";
    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "template-item-summary";
    summary.dataset.action = "template-item-expand";
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "template-item-remove";
    removeButton.dataset.action = "template-item-remove";
    removeButton.disabled = !removable;
    removeButton.title = "Eliminar ítem";
    removeButton.setAttribute("aria-label", "Eliminar ítem");
    const trashIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    trashIcon.setAttribute("viewBox", "0 0 24 24");
    trashIcon.setAttribute("aria-hidden", "true");
    const trashBody = document.createElementNS("http://www.w3.org/2000/svg", "path");
    trashBody.setAttribute("d", "M5 7h14l-1 13H6L5 7Zm3-3h8l1 3H7l1-3Zm2 6v7m4-7v7");
    trashIcon.append(trashBody);
    removeButton.append(trashIcon);

    fields.append(
      searchField(),
      grid(
        field("Código", "codigo", { type: "text", inputmode: "numeric" }),
        field("Cantidad", "cantidad", { type: "number", min: "1", step: "1" })
      ),
      field("Descripción", "descripcion", { type: "text" }),
      field("Descripción detallada de prótesis", "descripcionProtesis", { type: "text", placeholder: "-" }),
      grid(
        field("Prioridad", "prioridad", { type: "text", placeholder: "ALTA" }),
        field("Lugar de entrega", "lugarEntrega", { type: "text" })
      ),
      field("Observación", "observacion", { type: "text" })
    );
    wrap.append(summary, removeButton, fields);
    wrap.querySelector('[data-item-field="codigo"]').value = item.codigo || "";
    wrap.querySelector('[data-item-field="descripcion"]').value = item.descripcion || "";
    wrap.querySelector('[data-item-field="cantidad"]').value = item.cantidad ?? 1;
    wrap.querySelector('[data-item-field="observacion"]').value = item.observacion || "";
    wrap.querySelector('[data-item-field="descripcionProtesis"]').value = item.descripcionProtesis ?? "-";
    wrap.querySelector('[data-item-field="prioridad"]').value = item.prioridad ?? "ALTA";
    wrap.querySelector('[data-item-field="lugarEntrega"]').value = item.lugarEntrega || "";
    setTemplateItemCollapsed(wrap, Boolean(item.codigo && item.descripcion));
    return wrap;
  }

  function setTemplateItemCollapsed(row, collapsed) {
    const fields = row.querySelector(".template-item-fields");
    const summary = row.querySelector(".template-item-summary");
    const code = row.querySelector('[data-item-field="codigo"]')?.value.trim() || "";
    const description = row.querySelector('[data-item-field="descripcion"]')?.value.trim() || "";
    const hasSelection = Boolean(code && description);
    const shouldCollapse = Boolean(collapsed);
    if (hasSelection || shouldCollapse) row.dataset.showItemSummary = "true";
    const showSummary = row.dataset.showItemSummary === "true";
    if (summary) {
      const marker = shouldCollapse ? "▶" : "▼";
      summary.textContent = hasSelection ? `${marker} ${code} — ${description}` : `${marker} Ítem sin seleccionar`;
      summary.title = "Haga clic para editar este ítem";
      summary.hidden = !showSummary;
    }
    if (fields) fields.hidden = shouldCollapse;
    row.classList.toggle("is-collapsed", shouldCollapse);
  }

  function updateTemplateItemControls(container) {
    const rows = Array.from(container?.querySelectorAll(":scope > .template-item") || []);
    rows.forEach((row, index) => {
      row.dataset.itemIndex = String(index);
      const remove = row.querySelector('[data-action="template-item-remove"]');
      if (remove) remove.disabled = rows.length <= 1;
    });
  }

  function completeTemplateItem(row) {
    const code = row?.querySelector('[data-item-field="codigo"]')?.value.trim();
    const description = row?.querySelector('[data-item-field="descripcion"]')?.value.trim();
    if (!code || !description) throw new Error("Seleccione un elemento antes de agregar otro ítem.");
    setTemplateItemCollapsed(row, true);
  }

  function collectItemsFrom(root, containerSelector) {
    return Array.from(root.querySelectorAll(`${containerSelector} .template-item`)).map((row, index) => {
      let original = {};
      try { original = JSON.parse(row.dataset.original || "{}"); } catch { original = {}; }
      const codigo = row.querySelector('[data-item-field="codigo"]').value.trim();
      const descripcion = row.querySelector('[data-item-field="descripcion"]').value.trim();
      const keepModal = original.codigo === codigo && original.descripcionSeleccionModal;
      return {
        ...original,
        codigo,
        descripcion,
        cantidad: Number(row.querySelector('[data-item-field="cantidad"]').value),
        observacion: row.querySelector('[data-item-field="observacion"]').value.trim(),
        descripcionProtesis: row.querySelector('[data-item-field="descripcionProtesis"]').value.trim(),
        prioridad: row.querySelector('[data-item-field="prioridad"]').value.trim(),
        lugarEntrega: row.querySelector('[data-item-field="lugarEntrega"]').value.trim(),
        descripcionSeleccionModal: keepModal ? original.descripcionSeleccionModal : descripcion,
        orden: index + 1
      };
    });
  }

  function fillTemplateForm(root, template) {
    const form = root.querySelector("[data-template-form]");
    form.hidden = false;
    form.dataset.active = template.activo !== false ? "true" : "false";
    // Conserva campos de plantilla que ya no se muestran (observacionGeneral, lateralidad, etc.).
    form.dataset.original = JSON.stringify(template || {});
    root.querySelector("[data-template-id]").value = template.id || "";
    root.querySelector("[data-template-nombre]").value = template.nombre || "";
    root.querySelector("[data-template-categoria]").value = template.categoria || "";
    const items = root.querySelector("[data-template-items]");
    items.textContent = "";
    (template.items?.length ? template.items : [{ cantidad: 1, orden: 1 }])
      .forEach((item, index) => items.append(createTemplateItemEditor(item, index)));
    updateTemplateItemControls(items);
    const body = root.querySelector("[data-panel-body]");
    if (body) {
      const bodyRect = body.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      if (formRect.top < bodyRect.top) {
        body.scrollTop += formRect.top - bodyRect.top;
      } else if (formRect.bottom > bodyRect.bottom) {
        body.scrollTop += formRect.bottom - bodyRect.bottom;
      }
    }
  }

  function collectTemplateFromForm(root, options = {}) {
    const form = root.querySelector("[data-template-form]");
    const id = root.querySelector("[data-template-id]").value.trim();
    let original = {};
    try { original = JSON.parse(form.dataset.original || "{}"); } catch { original = {}; }

    return {
      ...original,
      id: options.newId ? "" : id,
      nombre: root.querySelector("[data-template-nombre]").value.trim(),
      categoria: root.querySelector("[data-template-categoria]").value.trim(),
      activo: options.active ?? form.dataset.active !== "false",
      items: collectItemsFrom(root, "[data-template-items]")
    };
  }

  function fillQuickDialog(root, template, mode = "apply") {
    const dialog = root.querySelector("[data-quick-dialog]");
    const creating = mode === "create";
    dialog.dataset.mode = mode;
    dialog.dataset.template = JSON.stringify(template);
    root.querySelector("[data-quick-template-id]").value = template.id;
    root.querySelector("[data-quick-title]").textContent = creating ? "Nueva plantilla" : "Ajustar y aplicar";
    root.querySelector("[data-quick-help]").textContent = creating ?
      "Configure los ítems y guarde la nueva plantilla." :
      "Ajuste los ítems y guarde cambios sin aplicarlos, o aplíquelos ahora.";
    root.querySelector('[data-action="quick-apply"]').hidden = creating;
    root.querySelector("[data-quick-save-changes]").hidden = creating || !template.id;
    root.querySelector("[data-quick-save]").textContent = creating ? "Guardar plantilla y cerrar" : "Guardar como nueva";
    root.querySelector('[data-action="quick-delete"]').hidden = creating || !template.id;
    const items = root.querySelector("[data-quick-items]");
    items.textContent = "";
    template.items.forEach((item, index) => items.append(createTemplateItemEditor(item, index, true, "quick-item-add")));
    if (!creating) items.querySelectorAll(":scope > .template-item").forEach((row) => setTemplateItemCollapsed(row, true));
    updateTemplateItemControls(items);
    dialog.showModal();
  }

  function collectQuickTemplate(root) {
    const dialog = root.querySelector("[data-quick-dialog]");
    const base = JSON.parse(dialog.dataset.template || "{}");
    base.items = collectItemsFrom(root, "[data-quick-items]");
    return base;
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.documentElement.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function formatBackupTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }

  async function autoDownloadTemplateBackup(reason = "cambio") {
    const templates = await SIOS.plantillasStorage.export();
    downloadJson(`asistente-sios-plantillas-auto-${reason}-${formatBackupTimestamp()}.json`, templates);
    return templates;
  }

  function settleAppModal(root, value) {
    const modal = root.querySelector("[data-app-modal]");
    if (!modal || !modal.open) return;
    const resolve = modal._resolve;
    modal._resolve = null;
    modal.close();
    resolve?.(value);
  }

  function showAppModal(root, { title, message, inputLabel = "", inputValue = "", acceptText = "Aceptar" }) {
    const modal = root.querySelector("[data-app-modal]");
    const inputWrap = root.querySelector("[data-app-modal-input-wrap]");
    const input = root.querySelector("[data-app-modal-input]");
    if (!modal || !inputWrap || !input) return Promise.resolve(null);
    modal._resolve?.(null);
    root.querySelector("[data-app-modal-title]").textContent = title;
    root.querySelector("[data-app-modal-message]").textContent = message;
    root.querySelector("[data-app-modal-input-label]").textContent = inputLabel;
    inputWrap.hidden = !inputLabel;
    input.value = inputValue;
    root.querySelector('[data-app-modal-action="accept"]').textContent = acceptText;
    modal.showModal();
    if (inputLabel) window.setTimeout(() => input.focus(), 0);
    return new Promise((resolve) => { modal._resolve = resolve; });
  }

  function requestConfirmation(root, message) {
    return showAppModal(root, { title: "Confirmar acción", message, acceptText: "Confirmar" });
  }

  function requestTemplateName(root, suggested) {
    return showAppModal(root, {
      title: "Guardar como nueva plantilla",
      message: "Indique el nombre de la nueva plantilla.",
      inputLabel: "Nombre de la plantilla",
      inputValue: suggested,
      acceptText: "Guardar"
    });
  }

  function catalogStorageArea() {
    const extensionApi = globalThis.browser || globalThis.chrome;
    if (extensionApi?.storage?.local) return extensionApi.storage.local;
    return null;
  }

  function normalizeCatalogEntry(entry) {
    return {
      codigo: String(entry?.codigo || "").trim(),
      descripcion: String(entry?.descripcion || "").trim(),
      categoria: String(entry?.categoria || "Sin clasificar").trim() || "Sin clasificar"
    };
  }

  async function listCatalog() {
    const storage = catalogStorageArea();
    if (storage) {
      const saved = await storage.get(CATALOG_STORAGE_KEY);
      if (Array.isArray(saved[CATALOG_STORAGE_KEY])) return saved[CATALOG_STORAGE_KEY].map(normalizeCatalogEntry);
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || "null");
        if (Array.isArray(saved)) return saved.map(normalizeCatalogEntry);
      } catch { /* Usa el codigario incluido si el respaldo local no es válido. */ }
    }
    return (SIOS.CODIGOS_ELEMENTOS || []).map(normalizeCatalogEntry);
  }

  async function saveCatalog(catalog) {
    const normalized = catalog.map(normalizeCatalogEntry);
    const storage = catalogStorageArea();
    if (storage) {
      await storage.set({ [CATALOG_STORAGE_KEY]: normalized });
    } else {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  async function initPanel(root) {
    let selectedAuthorization = null;
    let templates = await SIOS.plantillasStorage.list();
    const screen = SIOS.detectarPantalla();

    const isDetailScreen = () => SIOS.detectarPantalla?.()?.type === "detalle";

    // Siempre oculto al cargar: solo queda el botón lateral.
    closePanel(root);
    setStepEnabled(root, 2, false);
    setStepEnabled(root, 3, isDetailScreen());
    renderTemplates(root, templates);
    renderDiagnostics(root);
    initPanelMovement(root);

    let elementosCatalog = await listCatalog();
    const elementosList = root.querySelector("#sios-elementos-list");
    const renderCatalogOptions = () => {
      if (!elementosList) return;
      elementosList.textContent = "";
      const frag = document.createDocumentFragment();
      for (const el of elementosCatalog) {
        const option = document.createElement("option");
        option.value = `${el.codigo} — ${el.descripcion}`;
        frag.append(option);
      }
      elementosList.append(frag);
    };
    const catalogDialog = root.querySelector("[data-catalog-dialog]");
    const catalogSearch = root.querySelector("[data-catalog-search]");
    const catalogResults = root.querySelector("[data-catalog-results]");
    const catalogCode = root.querySelector("[data-catalog-code]");
    const catalogDescription = root.querySelector("[data-catalog-description]");
    const catalogCategory = root.querySelector("[data-catalog-category]");
    const clearCatalogForm = () => {
      catalogCode.value = "";
      catalogDescription.value = "";
      catalogCategory.value = "";
    };
    const renderCatalogResults = () => {
      if (!catalogResults) return;
      const query = normalizeSearch(catalogSearch?.value || "");
      const visible = elementosCatalog.filter((item) => !query || normalizeSearch(`${item.codigo} ${item.descripcion} ${item.categoria}`).includes(query)).slice(0, 100);
      catalogResults.textContent = "";
      for (const item of visible) {
        const option = document.createElement("option");
        option.value = item.codigo;
        option.textContent = `${item.codigo} — ${item.descripcion}`;
        catalogResults.append(option);
      }
    };
    const selectCatalogEntry = (code) => {
      const item = elementosCatalog.find((entry) => entry.codigo === code);
      if (!item) return;
      catalogCode.value = item.codigo;
      catalogDescription.value = item.descripcion;
      catalogCategory.value = item.categoria;
    };
    const fillTemplateItemFromCatalog = (row, value) => {
      const code = String(value || "").match(/^\d{6}/)?.[0];
      const found = code && elementosCatalog.find((item) => item.codigo === code);
      if (!row || !found) return false;
      row.querySelector('[data-item-field="codigo"]').value = found.codigo;
      row.querySelector('[data-item-field="descripcion"]').value = found.descripcion;
      setTemplateItemCollapsed(row, row.classList.contains("is-collapsed"));
      return true;
    };
    const renderTemplateItemOptions = (row, value) => {
      const options = row?.querySelector("[data-item-search-options]");
      if (!options) return;
      const query = normalizeSearch(value || "");
      options.textContent = "";
      if (query.length < 2) {
        options.hidden = true;
        return;
      }
      const matches = elementosCatalog
        .filter((item) => normalizeSearch(`${item.codigo} ${item.descripcion}`).includes(query))
        .slice(0, 12);
      for (const item of matches) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "template-item-option";
        option.dataset.action = "template-item-select";
        option.dataset.itemCode = item.codigo;
        option.textContent = `${item.codigo} — ${item.descripcion}`;
        options.append(option);
      }
      options.hidden = matches.length === 0;
    };
    renderCatalogOptions();
    root.querySelector("[data-app-modal]")?.addEventListener("cancel", (event) => {
      event.preventDefault();
      settleAppModal(root, null);
    });

    root.addEventListener("keydown", (event) => {
      const appModal = root.querySelector("[data-app-modal]");
      if (appModal?.open && event.key === "Escape") {
        event.preventDefault();
        settleAppModal(root, null);
        return;
      }
      if (appModal?.open && event.key === "Enter" && event.target === root.querySelector("[data-app-modal-input]")) {
        event.preventDefault();
        settleAppModal(root, event.target.value);
        return;
      }
      if (event.key === "Enter" && event.target?.dataset?.itemField === "buscarElemento") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Enter") return;
      const target = event.target;
      if (!target) return;
      if (target.hasAttribute?.("data-dni")) {
        event.preventDefault();
        root.querySelector('[data-action="buscar-afiliado"]')?.click();
      } else if (target.hasAttribute?.("data-autorizacion")) {
        event.preventDefault();
        root.querySelector('[data-action="buscar-autorizacion"]')?.click();
      }
    });

    root.addEventListener("input", (event) => {
      const target = event.target;
      if (target === catalogSearch) {
        renderCatalogResults();
        return;
      }
      if (target?.dataset?.itemField === "buscarElemento") {
        renderTemplateItemOptions(target.closest(".template-item"), target.value);
        return;
      }
      if (!target?.hasAttribute?.("data-template-search")) return;
      const clear = root.querySelector('[data-action="limpiar-buscador-plantillas"]');
      if (clear) clear.hidden = !target.value;
      renderTemplates(root, currentTemplates, target.value);
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target === catalogResults) {
        selectCatalogEntry(target.value);
        return;
      }
      if (!target?.dataset) return;
      const row = target.closest?.(".template-item");
      if (!row) return;

      if (target.dataset.itemField === "buscarElemento") {
        return;
      }

      if (target.dataset.itemField === "codigo") {
        const code = target.value.trim();
        const found = /^\d{6}$/.test(code) && elementosCatalog.find((el) => el.codigo === code);
        if (found) {
          const desc = row.querySelector('[data-item-field="descripcion"]');
          desc.value = found.descripcion;
          const search = row.querySelector('[data-item-field="buscarElemento"]');
          if (search) search.value = `${found.codigo} — ${found.descripcion}`;
          setTemplateItemCollapsed(row, row.classList.contains("is-collapsed"));
        }
      }
    });

    const refreshTemplates = async () => {
      templates = await SIOS.plantillasStorage.list();
      renderTemplates(root, templates, root.querySelector("[data-template-search]")?.value || "");
    };

    const getTemplate = (id) => {
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error(`Plantilla no encontrada: ${id}`);
      return SIOS.plantillasClone(template);
    };

    const selectAuthorization = (match) => {
      selectedAuthorization = match;
      clearMatches(root);
      setStepEnabled(root, 3, true);
      setAuthResult(root, `✓ ${match.displayNumber || match.authorizationNumber} · ${match.medStatus || "Estado MED no disponible"}`, "ok");
      textStatus(root, `Autorización seleccionada: ${match.displayNumber || match.authorizationNumber}.\n${match.medStatus || "Estado MED no disponible"}\nTodavía no fue abierta. Elija el elemento para continuar.`);
    };

    const runPendingDniSearch = async () => {
      const pending = SIOS.consumirDniPendiente?.();
      if (!pending?.dni) return;

      openPanel(root);
      root.querySelector("[data-dni]").value = pending.dni;
      selectedAuthorization = null;
      setStepEnabled(root, 3, false);
      clearMatches(root);
      textStatus(root, "Buscando afiliado...");
      const result = await SIOS.ejecutarBusquedaAfiliado(pending.dni);
      textStatus(root, result.message);
      setStepEnabled(root, 2, true);
      renderDiagnostics(root);
      window.setTimeout(() => root.querySelector("[data-autorizacion]")?.focus(), 0);
    };

    const startTemplateApplication = async (template) => {
      const validation = SIOS.validarPlantilla(template);
      if (!validation.ok) throw new Error(validation.errors.join(" "));

      if (!selectedAuthorization && isDetailScreen()) {
        textStatus(root, `Aplicando plantilla: ${validation.template.nombre}...`);
        closePanel(root);
        try {
          const result = await SIOS.aplicarPlantillaEnDetalle(validation.template);
          textStatus(root, result.message);
          renderDiagnostics(root);
          openPanel(root);
          ensureConfirmationVisible(root);
          return;
        } catch (error) {
          openPanel(root);
          throw error;
        }
      }

      if (!selectedAuthorization) {
        throw new Error("Primero debe verificar y seleccionar una autorización.");
      }

      const primerLapizListado = SIOS.obtenerControlAperturaAutorizacion?.(selectedAuthorization.rowId) ||
        `vMODIFICAR_${selectedAuthorization.rowId}`;

      savePendingAction({
        type: "template",
        rowId: selectedAuthorization.rowId,
        template: validation.template,
        expectedAuthorization: {
          rowId: selectedAuthorization.rowId,
          authorizationNumber: selectedAuthorization.displayNumber || selectedAuthorization.authorizationNumber,
          primerLapizListado,
          clicksPrimerLapizListado: 1
        }
      });
      textStatus(root, `Abriendo ${selectedAuthorization.displayNumber || selectedAuthorization.authorizationNumber} para aplicar ${validation.template.nombre}...`);
      closePanel(root);
      SIOS.abrirAutorizacionExacta(selectedAuthorization.rowId);
    };

    root.addEventListener("click", async (event) => {
      const target = event.target.closest("button");
      if (!target) return;

      try {
        if (target.dataset.appModalAction === "cancel") {
          settleAppModal(root, null);
          return;
        }

        if (target.dataset.appModalAction === "accept") {
          const inputWrap = root.querySelector("[data-app-modal-input-wrap]");
          const input = root.querySelector("[data-app-modal-input]");
          settleAppModal(root, inputWrap?.hidden ? true : input?.value || "");
          return;
        }

        if (target.dataset.action === "template-item-select") {
          const row = target.closest(".template-item");
          if (!fillTemplateItemFromCatalog(row, target.dataset.itemCode)) return;
          const search = row.querySelector('[data-item-field="buscarElemento"]');
          const options = row.querySelector("[data-item-search-options]");
          if (search) search.value = "";
          if (options) {
            options.textContent = "";
            options.hidden = true;
          }
          return;
        }

        if (target.dataset.action === "abrir-panel") {
          openPanel(root);
          return;
        }

        if (target.dataset.action === "abrir-codigario") {
          clearCatalogForm();
          catalogSearch.value = "";
          renderCatalogResults();
          catalogDialog.showModal();
          return;
        }

        if (target.dataset.action === "catalog-new") {
          clearCatalogForm();
          catalogResults.selectedIndex = -1;
          return;
        }

        if (target.dataset.action === "catalog-save") {
          const entry = normalizeCatalogEntry({
            codigo: catalogCode.value,
            descripcion: catalogDescription.value,
            categoria: catalogCategory.value
          });
          if (!/^\d{6}$/.test(entry.codigo)) throw new Error("El código debe tener exactamente 6 números.");
          if (!entry.descripcion) throw new Error("La descripción es obligatoria.");
          const index = elementosCatalog.findIndex((item) => item.codigo === entry.codigo);
          if (index >= 0) elementosCatalog[index] = entry;
          else elementosCatalog.push(entry);
          elementosCatalog.sort((a, b) => a.codigo.localeCompare(b.codigo));
          elementosCatalog = await saveCatalog(elementosCatalog);
          SIOS.CODIGOS_ELEMENTOS = elementosCatalog;
          renderCatalogOptions();
          renderCatalogResults();
          selectCatalogEntry(entry.codigo);
          textStatus(root, `Codigario guardado: ${entry.codigo}.`);
          return;
        }

        if (target.dataset.action === "catalog-delete") {
          const code = catalogCode.value.trim();
          const entry = elementosCatalog.find((item) => item.codigo === code);
          if (!entry) throw new Error("Seleccione un código existente para eliminar.");
          if (!await requestConfirmation(root, `¿Eliminar ${entry.codigo} — ${entry.descripcion} del codigario?`)) return;
          elementosCatalog = await saveCatalog(elementosCatalog.filter((item) => item.codigo !== code));
          SIOS.CODIGOS_ELEMENTOS = elementosCatalog;
          renderCatalogOptions();
          renderCatalogResults();
          clearCatalogForm();
          textStatus(root, `Código eliminado: ${entry.codigo}.`);
          return;
        }

        if (target.dataset.action === "catalog-close") {
          catalogDialog.close();
          return;
        }

        if (target.dataset.action === "limpiar-buscador-plantillas") {
          const search = root.querySelector("[data-template-search]");
          search.value = "";
          target.hidden = true;
          renderTemplates(root, currentTemplates, "");
          search.focus();
          return;
        }

        if (target.dataset.templateApply) {
          await startTemplateApplication(getTemplate(target.dataset.templateApply));
          return;
        }

        if (target.dataset.templateQuick) {
          fillQuickDialog(root, getTemplate(target.dataset.templateQuick));
          return;
        }

        if (target.dataset.templateEdit) {
          fillTemplateForm(root, getTemplate(target.dataset.templateEdit));
          return;
        }

        if (target.dataset.action === "plantilla-nueva") {
          fillQuickDialog(root, {
            id: "",
            nombre: "",
            categoria: "",
            activo: true,
            items: [{ codigo: "", descripcion: "", cantidad: 1, observacion: "", orden: 1 }]
          }, "create");
          return;
        }

        if (target.dataset.action === "template-item-add") {
          const items = root.querySelector("[data-template-items]");
          const current = target.closest(".template-item");
          completeTemplateItem(current);
          const nextItem = createTemplateItemEditor({ codigo: "", descripcion: "", cantidad: 1, descripcionProtesis: "-", prioridad: "ALTA", lugarEntrega: "", observacion: "", orden: items.children.length + 1 }, items.children.length);
          items.insertBefore(nextItem, current?.nextElementSibling || null);
          updateTemplateItemControls(items);
          window.setTimeout(() => nextItem.querySelector('[data-item-field="buscarElemento"]')?.focus(), 0);
          return;
        }

        if (target.dataset.action === "quick-item-add") {
          const items = root.querySelector("[data-quick-items]");
          const current = Array.from(items.querySelectorAll(":scope > .template-item"))
            .find((item) => !item.classList.contains("is-collapsed"));
          if (current) completeTemplateItem(current);
          const nextItem = createTemplateItemEditor({ codigo: "", descripcion: "", cantidad: 1, descripcionProtesis: "-", prioridad: "ALTA", lugarEntrega: "", observacion: "", orden: items.children.length + 1 }, items.children.length, true, "quick-item-add");
          items.append(nextItem);
          updateTemplateItemControls(items);
          window.setTimeout(() => nextItem.querySelector('[data-item-field="buscarElemento"]')?.focus(), 0);
          return;
        }

        if (target.dataset.action === "template-item-remove") {
          const row = target.closest(".template-item");
          const items = row?.parentElement;
          if (!items || items.querySelectorAll(":scope > .template-item").length <= 1) return;
          const description = row.querySelector('[data-item-field="descripcion"]')?.value.trim();
          const code = row.querySelector('[data-item-field="codigo"]')?.value.trim();
          const itemName = [code, description].filter(Boolean).join(" — ") || "este ítem";
          if (!await requestConfirmation(root, `¿Eliminar ${itemName} de la plantilla?`)) return;
          row.remove();
          updateTemplateItemControls(items);
          return;
        }

        if (target.dataset.action === "template-item-expand") {
          const row = target.closest(".template-item");
          if (row) setTemplateItemCollapsed(row, !row.classList.contains("is-collapsed"));
          return;
        }

        if (target.dataset.action === "template-cancel") {
          root.querySelector("[data-template-form]").hidden = true;
          return;
        }

        if (target.dataset.action === "template-save") {
          const saved = await SIOS.plantillasStorage.save(collectTemplateFromForm(root));
          await autoDownloadTemplateBackup("guardar");
          await refreshTemplates();
          fillTemplateForm(root, saved);
          textStatus(root, "Plantilla guardada.");
          return;
        }

        if (target.dataset.action === "template-duplicate") {
          const duplicate = collectTemplateFromForm(root, { newId: true, active: true });
          const suggested = `${duplicate.nombre || "Plantilla"} (variante)`;
          const newName = await requestTemplateName(root, suggested);
          if (!newName) return;
          duplicate.nombre = newName.trim();
          duplicate.id = `${SIOS.crearIdPlantilla(duplicate.nombre)}-${Date.now().toString(36)}`;
          const saved = await SIOS.plantillasStorage.save(duplicate);
          await autoDownloadTemplateBackup("duplicar");
          await refreshTemplates();
          fillTemplateForm(root, saved);
          textStatus(root, `Guardada como nueva plantilla: ${saved.nombre}.`);
          return;
        }

        if (target.dataset.action === "template-toggle") {
          const current = collectTemplateFromForm(root);
          current.activo = !current.activo;
          const saved = await SIOS.plantillasStorage.save(current);
          await autoDownloadTemplateBackup(saved.activo ? "activar" : "desactivar");
          await refreshTemplates();
          fillTemplateForm(root, saved);
          textStatus(root, saved.activo ? "Plantilla activada." : "Plantilla desactivada.");
          return;
        }

        if (target.dataset.action === "template-delete") {
          const id = root.querySelector("[data-template-id]").value.trim();
          if (!id) {
            root.querySelector("[data-template-form]").hidden = true;
            return;
          }
          if (!await requestConfirmation(root, "¿Eliminar esta plantilla?")) return;
          await SIOS.plantillasStorage.delete(id);
          await autoDownloadTemplateBackup("eliminar");
          await refreshTemplates();
          root.querySelector("[data-template-form]").hidden = true;
          textStatus(root, "Plantilla eliminada.");
          return;
        }

        if (target.dataset.action === "quick-cancel") {
          root.querySelector("[data-quick-dialog]").close();
          return;
        }

        if (target.dataset.action === "quick-apply") {
          const template = collectQuickTemplate(root);
          root.querySelector("[data-quick-dialog]").close();
          await startTemplateApplication(template);
          return;
        }

        if (target.dataset.action === "quick-save-changes") {
          const template = collectQuickTemplate(root);
          const saved = await SIOS.plantillasStorage.save(template);
          await autoDownloadTemplateBackup("guardar");
          await refreshTemplates();
          root.querySelector("[data-quick-dialog]").close();
          textStatus(root, `Cambios guardados: ${saved.nombre}.`);
          return;
        }

        if (target.dataset.action === "quick-save-new") {
          const template = collectQuickTemplate(root);
          const creating = root.querySelector("[data-quick-dialog]").dataset.mode === "create";
          const suggested = creating ? "Nueva plantilla" : `${template.nombre} (variante)`;
          const newName = await requestTemplateName(root, suggested);
          if (!newName) return;
          template.nombre = newName.trim();
          template.id = `${SIOS.crearIdPlantilla(template.nombre)}-${Date.now().toString(36)}`;
          const saved = await SIOS.plantillasStorage.save(template);
          await autoDownloadTemplateBackup("guardar");
          await refreshTemplates();
          root.querySelector("[data-quick-dialog]").close();
          textStatus(root, `Nueva plantilla guardada: ${saved.nombre}.`);
          return;
        }

        if (target.dataset.action === "quick-delete") {
          const dialog = root.querySelector("[data-quick-dialog]");
          const id = root.querySelector("[data-quick-template-id]").value.trim();
          const template = currentTemplates.find((item) => item.id === id);
          if (!template) throw new Error("No se encontró la plantilla que desea eliminar.");
          if (!await requestConfirmation(root, `¿Eliminar la plantilla "${template.nombre}"? Esta acción no se puede deshacer.`)) return;
          await SIOS.plantillasStorage.delete(id);
          await autoDownloadTemplateBackup("eliminar");
          await refreshTemplates();
          dialog.close();
          textStatus(root, `Plantilla eliminada: ${template.nombre}.`);
          return;
        }

        if (target.dataset.action === "plantillas-exportar") {
          downloadJson("asistente-sios-plantillas.json", await SIOS.plantillasStorage.export());
          textStatus(root, "Plantillas exportadas.");
          return;
        }

        if (target.dataset.action === "plantillas-exportar-fechado") {
          const templates = await SIOS.plantillasStorage.export();
          downloadJson(`asistente-sios-plantillas-${formatBackupTimestamp()}.json`, templates);
          textStatus(root, "Backup JSON descargado.");
          return;
        }

        if (target.dataset.action === "plantillas-importar") {
          root.querySelector("[data-import-file]").click();
          return;
        }

        if (target.dataset.action === "plantillas-restaurar-backup") {
          const backups = await SIOS.plantillasStorage.listBackups?.();
          const latest = backups?.find((entry) => Array.isArray(entry?.templates) && entry.templates.length);
          if (!latest) {
            throw new Error("No hay respaldos internos disponibles para restaurar.");
          }
          const label = latest.at ? new Date(latest.at).toLocaleString("es-AR") : "sin fecha";
          if (!await requestConfirmation(root, `¿Restaurar el ultimo respaldo interno (${label})? Reemplazará las plantillas actuales.`)) return;
          const result = await SIOS.plantillasStorage.restoreLatestBackup();
          await autoDownloadTemplateBackup("restaurar");
          await refreshTemplates();
          textStatus(root, `Respaldo restaurado. Plantillas recuperadas: ${result.restored.length}.`);
          return;
        }

        if (target.dataset.action === "cerrar-panel") {
          closePanel(root);
          return;
        }

        if (target.dataset.action === "diagnostico") {
          renderDiagnostics(root);
          textStatus(root, "Diagnóstico actualizado.");
          return;
        }

        if (target.dataset.action === "copiar-diagnostico") {
          await copyDiagnostics(root);
          textStatus(root, "Diagnóstico copiado.");
          return;
        }

        if (target.dataset.action === "buscar-afiliado") {
          selectedAuthorization = null;
          setStepEnabled(root, 3, false);
          clearMatches(root);
          textStatus(root, "Buscando afiliado...");
          const dni = root.querySelector("[data-dni]").value.trim();
          if (SIOS.detectarPantalla?.()?.type !== "busqueda") {
            textStatus(root, "Abriendo Autorizaciones...");
          }
          const result = await SIOS.buscarAfiliado(dni);
          textStatus(root, result.message);
          if (!result.navigating) {
            setStepEnabled(root, 2, true);
            renderDiagnostics(root);
            window.setTimeout(() => root.querySelector("[data-autorizacion]")?.focus(), 0);
          }
          return;
        }

        if (target.dataset.action === "confirmar-imprimir") {
          textStatus(root, "Confirmando autorización en SIOS...");
          savePendingAction({ type: "confirm-print" });
          try {
            const result = await SIOS.confirmarAutorizacionEImprimir();
            textStatus(root, result.message);
          } finally {
            // Si SIOS recarga la página, este código no corre y la impresión se retoma al recargar.
            clearPendingAction();
          }
          return;
        }

        if (target.dataset.action === "buscar-autorizacion") {
          selectedAuthorization = null;
          setStepEnabled(root, 3, false);
          clearMatches(root);
          setAuthResult(root, "Verificando...", "");
          textStatus(root, "Verificando coincidencia exacta...");
          const suffix = root.querySelector("[data-autorizacion]").value.trim();
          const result = SIOS.buscarAutorizacionPorUltimosTres(suffix);
          textStatus(root, result.message);

          if (result.status === "selected") {
            selectAuthorization(result.selected);
          } else if (result.status === "multiple") {
            setAuthResult(root, `Hay ${result.matches.length} coincidencias; elija una:`, "");
            renderMatches(root, result.matches, selectAuthorization);
          } else {
            setAuthResult(root, result.message, "error");
          }
          return;
        }

      } catch (error) {
        console.error("[Asistente SIOS Compra]", error);
        rememberError(error);
        renderDiagnostics(root);
        textStatus(root, `Error: ${error.message}`);
      }
    });

    root.querySelector("[data-import-file]").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const imported = await SIOS.plantillasStorage.import(parsed);
        await autoDownloadTemplateBackup("importar");
        await refreshTemplates();
        textStatus(root, `Plantillas importadas: ${imported.length}.`);
      } catch (error) {
        console.error("[Asistente SIOS Compra]", error);
        rememberError(error);
        renderDiagnostics(root);
        textStatus(root, `Error: ${error.message}`);
      }
    });

    window.addEventListener("pagehide", removeSiosDock, { once: true });

    // Solo se abre automáticamente cuando la navegación fue iniciada explícitamente
    // por el usuario al aplicar una plantilla en el paso 3.
    if (screen.type === "detalle") {
      setStepEnabled(root, 4, true);
      const pending = peekPendingAction();
      if (pending?.type === "template" && pending.template) {
        // El panel queda minimizado para no tapar SIOS mientras se aplica la plantilla.
        closePanel(root);
        textStatus(root, `Esperando autorización abierta para aplicar ${pending.template.nombre}...`);
        waitForPendingDetail(pending)
          .then((ready) => {
            if (!ready) {
              throw new Error("No se pudo verificar que la autorización seleccionada esté abierta.");
            }
            textStatus(root, `Aplicando plantilla: ${pending.template.nombre}...`);
            return SIOS.aplicarPlantillaEnDetalle(pending.template, pending.expectedAuthorization);
          })
          .then((result) => {
            clearPendingAction();
            textStatus(root, result.message);
            renderDiagnostics(root);
            openPanel(root);
            ensureConfirmationVisible(root);
          })
          .catch((error) => {
            clearPendingAction();
            console.error("[Asistente SIOS Compra]", error);
            rememberError(error);
            renderDiagnostics(root);
            textStatus(root, `Error: ${error.message}`);
          });
      } else if (pending?.type === "confirm-print") {
        // El Confirmar de SIOS recargó la página; se retoma la impresión sola.
        textStatus(root, "Confirmación aplicada. Abriendo impresión...");
        SIOS.imprimirAutorizacion()
          .then((result) => {
            clearPendingAction();
            textStatus(root, result.message);
          })
          .catch((error) => {
            clearPendingAction();
            console.error("[Asistente SIOS Compra]", error);
            rememberError(error);
            openPanel(root);
            renderDiagnostics(root);
            textStatus(root, `Error: ${error.message}`);
          });
      }
    } else {
      setStepEnabled(root, 4, false);
    }

    if (screen.type === "busqueda" && SIOS.tieneDniPendiente?.()) {
      runPendingDniSearch().catch((error) => {
        console.error("[Asistente SIOS Compra]", error);
        rememberError(error);
        openPanel(root);
        renderDiagnostics(root);
        textStatus(root, `Error: ${error.message}`);
      });
    }
  }

  SIOS.inicializarPanel = initPanel;
})();
