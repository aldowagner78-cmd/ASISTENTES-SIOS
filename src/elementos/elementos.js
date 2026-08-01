(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  const catalogo = window.AsistenteSIOSElementos || {};

  function getElementos() {
    return [
      catalogo.lenteIntraocularDerecho
    ].filter(Boolean);
  }

  function findElementConfig(id) {
    const config = getElementos().find((item) => item.id === id);
    if (!config) {
      throw new Error(`Elemento no configurado: ${id}`);
    }
    return config;
  }

  function getBySelector(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      throw new Error(`No se encontro el campo de SIOS: ${selector}`);
    }
    return el;
  }

  function dispatchChange(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function prepararElemento(id) {
    const config = findElementConfig(id);
    const missing = [];

    for (const action of config.acciones || []) {
      if (action.pendiente) {
        missing.push(`${action.selector}: ${action.pendiente}`);
        continue;
      }
      if (action.selector && !document.querySelector(action.selector)) {
        missing.push(`${action.selector}: campo no encontrado`);
      }
    }

    return {
      config,
      canApply: missing.length === 0,
      missing,
      summary: config.resumen || []
    };
  }

  function aplicarElemento(id) {
    const prepared = prepararElemento(id);
    if (!prepared.canApply) {
      return {
        status: "blocked",
        message: "Elemento pendiente de configuracion. No se cargo ni guardo nada.",
        missing: prepared.missing,
        summary: prepared.summary
      };
    }

    for (const action of prepared.config.acciones) {
      const el = getBySelector(action.selector);
      if (action.tipo === "campo" || action.tipo === "select") {
        el.focus();
        el.value = action.valor;
        dispatchChange(el);
        el.blur();
      }
      if (action.tipo === "click") {
        el.click();
      }
    }

    return {
      status: "applied",
      message: "Elemento cargado y guardado. Revise SIOS antes de confirmar.",
      summary: prepared.summary
    };
  }

  SIOS.obtenerElementos = getElementos;
  SIOS.prepararElemento = prepararElemento;
  SIOS.aplicarElemento = aplicarElemento;
})();
