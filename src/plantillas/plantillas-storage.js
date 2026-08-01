(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  const STORAGE_KEY = "asistente-sios-plantillas";

  function storageArea() {
    const extensionApi = globalThis.browser || globalThis.chrome;
    if (extensionApi?.storage?.local) return extensionApi.storage.local;
    return null;
  }

  async function readRaw() {
    const storage = storageArea();
    if (storage) {
      const data = await storage.get(STORAGE_KEY);
      return data[STORAGE_KEY] || null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async function writeRaw(templates) {
    const storage = storageArea();
    if (storage) {
      await storage.set({ [STORAGE_KEY]: templates });
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  async function listTemplates() {
    let templates = await readRaw();
    if (!Array.isArray(templates)) {
      templates = SIOS.plantillasClone(SIOS.PLANTILLAS_PREDETERMINADAS || []);
      await writeRaw(templates);
    }
    const normalized = templates.map(SIOS.normalizarPlantilla);
    let changed = false;

    for (const template of normalized) {
      if (!/^malla-15x15-x[12]$/.test(template.id)) continue;
      for (const item of template.items || []) {
        if (item.codigo === "080213" && !/NAC/i.test(item.descripcion || "")) {
          item.descripcion = "MALLA DE POLIPROPILENO DE 15 X 15 NAC";
          changed = true;
        }
        if (item.codigo === "080213" && !item.descripcionSeleccionModal) {
          item.descripcionSeleccionModal = "MALLA DE POLIPROPILENO DE 15 X 15 NAC";
          changed = true;
        }
        if (!item.descripcionBusquedaModal) {
          item.descripcionBusquedaModal = "MALLA";
          changed = true;
        }
        if (!item.especialidadModal) {
          item.especialidadModal = "ELEMENTOS MEDICOS";
          changed = true;
        }
      }
    }

    if (changed) await writeRaw(normalized);
    return normalized;
  }

  async function saveTemplate(template) {
    const validation = SIOS.validarPlantilla(template);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }

    const templates = await listTemplates();
    const index = templates.findIndex((item) => item.id === validation.template.id);
    if (index >= 0) {
      templates[index] = validation.template;
    } else {
      templates.push(validation.template);
    }
    await writeRaw(templates);
    return validation.template;
  }

  async function deleteTemplate(id) {
    const templates = (await listTemplates()).filter((item) => item.id !== id);
    await writeRaw(templates);
  }

  async function importTemplates(incoming) {
    const list = Array.isArray(incoming) ? incoming : incoming?.plantillas;
    const validation = SIOS.validarListaPlantillas(list);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }

    const existing = await listTemplates();
    const ids = new Set(existing.map((item) => item.id));
    const duplicates = validation.templates.filter((item) => ids.has(item.id)).map((item) => item.id);
    if (duplicates.length) {
      throw new Error(`Identificadores ya existentes: ${duplicates.join(", ")}.`);
    }

    const merged = existing.concat(validation.templates);
    await writeRaw(merged);
    return validation.templates;
  }

  async function exportTemplates() {
    return listTemplates();
  }

  SIOS.plantillasStorage = {
    list: listTemplates,
    save: saveTemplate,
    delete: deleteTemplate,
    import: importTemplates,
    export: exportTemplates
  };
})();
