(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `plantilla-${Date.now()}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeItem(item, index) {
    return {
      codigo: normalizeSpaces(item.codigo),
      descripcion: normalizeSpaces(item.descripcion),
      descripcionBusquedaModal: normalizeSpaces(item.descripcionBusquedaModal),
      especialidadModal: normalizeSpaces(item.especialidadModal),
      cantidad: Number(item.cantidad),
      observacion: normalizeSpaces(item.observacion),
      descripcionProtesis: normalizeSpaces(item.descripcionProtesis),
      prioridad: normalizeSpaces(item.prioridad),
      lugarEntrega: normalizeSpaces(item.lugarEntrega),
      codigoSeleccionModal: normalizeSpaces(item.codigoSeleccionModal),
      descripcionSeleccionModal: normalizeSpaces(item.descripcionSeleccionModal),
      orden: Number.isInteger(Number(item.orden)) ? Number(item.orden) : index + 1,
      camposAdicionales: Array.isArray(item.camposAdicionales) ? item.camposAdicionales : []
    };
  }

  function normalizeTemplate(template) {
    const nombre = normalizeSpaces(template.nombre);
    const id = normalizeSpaces(template.id) || slugify(nombre);
    return {
      id,
      nombre,
      categoria: normalizeSpaces(template.categoria),
      items: Array.isArray(template.items) ? template.items.map(normalizeItem) : [],
      observacionGeneral: normalizeSpaces(template.observacionGeneral),
      descripcionProtesis: normalizeSpaces(template.descripcionProtesis),
      prioridad: normalizeSpaces(template.prioridad),
      lugarEntrega: normalizeSpaces(template.lugarEntrega),
      lateralidad: template.lateralidad ? normalizeSpaces(template.lateralidad) : null,
      camposAdicionales: Array.isArray(template.camposAdicionales) ? template.camposAdicionales : [],
      activo: template.activo !== false
    };
  }

  function validateTemplate(template) {
    const errors = [];
    const normalized = normalizeTemplate(template || {});

    if (!normalized.nombre) errors.push("El nombre es obligatorio.");
    if (!normalized.items.length) errors.push("La plantilla debe tener al menos un item.");

    normalized.items.forEach((item, index) => {
      if (!item.codigo) errors.push(`Item ${index + 1}: el codigo es obligatorio.`);
      if (!/^\d+$/.test(item.codigo)) errors.push(`Item ${index + 1}: el codigo debe contener solo numeros.`);
      if (item.codigoSeleccionModal && !/^\d+$/.test(item.codigoSeleccionModal)) {
        errors.push(`Item ${index + 1}: el codigo de seleccion del modal debe contener solo numeros.`);
      }
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        errors.push(`Item ${index + 1}: la cantidad debe ser entera mayor que cero.`);
      }
    });

    return {
      ok: errors.length === 0,
      errors,
      template: normalized
    };
  }

  function validateTemplateList(list) {
    if (!Array.isArray(list)) {
      return { ok: false, errors: ["El archivo debe contener un arreglo de plantillas."], templates: [] };
    }

    const ids = new Set();
    const templates = [];
    const errors = [];

    list.forEach((item, index) => {
      const result = validateTemplate(item);
      if (!result.ok) {
        errors.push(`Plantilla ${index + 1}: ${result.errors.join(" ")}`);
        return;
      }
      if (ids.has(result.template.id)) {
        errors.push(`Identificador duplicado en archivo: ${result.template.id}.`);
        return;
      }
      ids.add(result.template.id);
      templates.push(result.template);
    });

    return { ok: errors.length === 0, errors, templates };
  }

  SIOS.plantillasClone = clone;
  SIOS.crearIdPlantilla = slugify;
  SIOS.normalizarPlantilla = normalizeTemplate;
  SIOS.validarPlantilla = validateTemplate;
  SIOS.validarListaPlantillas = validateTemplateList;
})();
