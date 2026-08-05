(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  const STORAGE_KEY = "asistente-sios-plantillas";
  const BACKUP_KEY = `${STORAGE_KEY}-backup`;
  const BACKUP_LIMIT = 10;

  function storageArea() {
    const extensionApi = globalThis.browser || globalThis.chrome;
    if (extensionApi?.storage?.local) return extensionApi.storage.local;
    return null;
  }

  function parseJsonSafe(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function normalizeTemplateList(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.templates)) return value.templates;
    if (Array.isArray(value?.plantillas)) return value.plantillas;
    return null;
  }

  async function readFromExtensionStorage(key) {
    const storage = storageArea();
    if (!storage) return null;
    const data = await storage.get(key);
    return data?.[key] ?? null;
  }

  function readFromLocalStorage(key) {
    return parseJsonSafe(localStorage.getItem(key));
  }

  function makeBackupEntry(templates, source = "runtime") {
    return {
      at: new Date().toISOString(),
      source,
      templates
    };
  }

  function normalizeBackupHistory(value) {
    if (Array.isArray(value)) return value.filter((entry) => Array.isArray(entry?.templates));
    return [];
  }

  async function readBackupHistory() {
    const direct = normalizeBackupHistory(await readFromExtensionStorage(BACKUP_KEY));
    if (direct.length) return direct;

    const local = normalizeBackupHistory(readFromLocalStorage(BACKUP_KEY));
    if (local.length) return local;

    return [];
  }

  async function readRaw() {
    const extensionValue = await readFromExtensionStorage(STORAGE_KEY);
    const direct = normalizeTemplateList(extensionValue);
    if (direct) return direct;

    const localValue = readFromLocalStorage(STORAGE_KEY);
    const local = normalizeTemplateList(localValue);
    if (local) return local;

    const backups = await readBackupHistory();
    if (backups.length) {
      return backups[0].templates;
    }

    return null;
  }

  async function writeRaw(templates, source = "runtime") {
    const storage = storageArea();
    if (storage) {
      await storage.set({ [STORAGE_KEY]: templates });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));

    const history = await readBackupHistory();
    const nextHistory = [makeBackupEntry(templates, source), ...history]
      .filter((entry, index, all) => index === all.findIndex((candidate) => JSON.stringify(candidate.templates) === JSON.stringify(entry.templates)))
      .slice(0, BACKUP_LIMIT);

    if (storage) {
      await storage.set({ [BACKUP_KEY]: nextHistory });
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(nextHistory));
  }

  async function listTemplates() {
    let templates = await readRaw();
    if (!Array.isArray(templates)) {
      // Un perfil nuevo empieza sin plantillas; cada usuario crea o importa las propias.
      templates = [];
      await writeRaw(templates, "bootstrap");
    } else {
      await writeRaw(templates, "refresh");
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

    if (changed) await writeRaw(normalized, "normalize");
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
    await writeRaw(templates, "save");
    return validation.template;
  }

  async function deleteTemplate(id) {
    const templates = (await listTemplates()).filter((item) => item.id !== id);
    await writeRaw(templates, "delete");
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
    await writeRaw(merged, "import");
    return validation.templates;
  }

  async function exportTemplates() {
    return listTemplates();
  }

  async function listBackups() {
    return readBackupHistory();
  }

  async function restoreLatestBackup() {
    const backups = await readBackupHistory();
    const latest = backups.find((entry) => Array.isArray(entry?.templates) && entry.templates.length);
    if (!latest) {
      throw new Error("No hay respaldos internos con plantillas para restaurar.");
    }

    const validation = SIOS.validarListaPlantillas(latest.templates);
    if (!validation.ok) {
      throw new Error(`El respaldo interno no es valido: ${validation.errors.join(" ")}`);
    }

    await writeRaw(validation.templates, "restore");
    return {
      restored: validation.templates,
      backupAt: latest.at || "",
      source: latest.source || "runtime"
    };
  }

  async function snapshotTemplates(source = "session-close") {
    const current = await readRaw();
    if (!Array.isArray(current)) return [];
    await writeRaw(current, source);
    return current;
  }

  SIOS.plantillasStorage = {
    list: listTemplates,
    save: saveTemplate,
    delete: deleteTemplate,
    import: importTemplates,
    export: exportTemplates,
    listBackups,
    restoreLatestBackup,
    snapshot: snapshotTemplates
  };
})();
