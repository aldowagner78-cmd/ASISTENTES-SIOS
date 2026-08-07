(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  const PENDING_DNI_KEY = "asistente-sios-pending-dni";
  const MAX_PENDING_AGE_MS = 2 * 60 * 1000;
  const MAX_NAVIGATION_ATTEMPTS = 2;
  const SEARCH_FILTERS_TO_RESET = {
    vVERBAJAS: false,
    vAUCATIPPRES: "",
    vAUCANUMINT_NUMERO_INTERNO: "0",
    vAUCAESTADO: "",
    vAUCAORDINT: "0",
    vAUCANOMAFI_NOMBRE_AFILIADO: "",
    vCOBERTURA: "0",
    vDELEGACION: "",
    vPROVRAZSOC: "",
    vAURCODIGO: "",
    vMDMEDCODIGOSNCHECK: "T",
    vMATEFE: "",
    vNOMEFE: "",
    vAUCAESPEFC: ""
  };

  function fail(message, details) {
    const error = new Error(message);
    error.details = details || null;
    throw error;
  }

  function getRequired(id) {
    const el = document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
    if (!el) {
      fail(`No se encontro el campo requerido: ${id}`);
    }
    return el;
  }

  function emit(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function setValue(el, value) {
    el.focus();
    el.value = value;
    emit(el, "input");
    emit(el, "change");
    el.blur();
  }

  function setSelectByValue(id, value, expectedText) {
    const select = getRequired(id);
    const option = Array.from(select.options).find((item) => item.value === value);
    if (!option) {
      fail(`No se encontro la opcion "${expectedText}" en ${id}`, {
        id,
        expectedValue: value,
        available: Array.from(select.options).map((item) => `${item.value}: ${item.textContent.trim()}`)
      });
    }
    setValue(select, value);
  }

  function setCheckboxChecked(id) {
    const checkbox = getRequired(id);
    if (checkbox.type !== "checkbox") {
      fail(`${id} no es un checkbox`);
    }
    if (!checkbox.checked) {
      checkbox.click();
    }
    checkbox.value = "S";
    emit(checkbox, "change");
  }

  function resetVisibleSearchFilters() {
    for (const [id, value] of Object.entries(SEARCH_FILTERS_TO_RESET)) {
      const control = document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
      if (!control) continue;
      if (typeof value === "boolean") {
        control.checked = value;
        control.value = value ? "S" : "N";
      } else {
        control.value = value;
      }
    }
  }

  function hasGridRows() {
    const gridData = document.querySelector("input[name='GridContainerDataV']");
    if (gridData?.value && gridData.value !== "[]") {
      return true;
    }
    return Boolean(document.querySelector("input[id^='vMODIFICAR_'], input[id^='vVISUALIZAR_']"));
  }

  function readPendingDni() {
    const raw = sessionStorage.getItem(PENDING_DNI_KEY);
    if (!raw) return null;

    try {
      const pending = JSON.parse(raw);
      if (!pending?.dni || Date.now() - Number(pending.createdAt || 0) > MAX_PENDING_AGE_MS) {
        sessionStorage.removeItem(PENDING_DNI_KEY);
        return null;
      }
      return pending;
    } catch (error) {
      sessionStorage.removeItem(PENDING_DNI_KEY);
      return null;
    }
  }

  function savePendingDni(dni, pending) {
    const navigationAttempts = Number(pending?.navigationAttempts || 0) + 1;
    if (navigationAttempts > MAX_NAVIGATION_ATTEMPTS) {
      sessionStorage.removeItem(PENDING_DNI_KEY);
      fail("No se pudo abrir Autorizaciones sin repetir la navegación.");
    }

    sessionStorage.setItem(PENDING_DNI_KEY, JSON.stringify({
      dni,
      createdAt: pending?.createdAt || Date.now(),
      navigationAttempts
    }));
  }

  function consumePendingDni() {
    const pending = readPendingDni();
    sessionStorage.removeItem(PENDING_DNI_KEY);
    return pending;
  }

  function normalizeSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getStableAuthorizationUrl() {
    const current = new URL(window.location.href);
    return new URL("auauditcabe_ww?M,0", current).href;
  }

  function findAuthorizationLink() {
    const links = Array.from(document.querySelectorAll("a[href]"));
    return links.find((link) => {
      const href = link.getAttribute("href") || "";
      const text = normalizeSpaces(link.textContent);
      return /auauditcabe_ww/i.test(href) &&
        (/autorizaci/i.test(text) || /auditor/i.test(text) || /oria autorizaci/i.test(text));
    }) || links.find((link) => /auauditcabe_ww/i.test(link.getAttribute("href") || ""));
  }

  function navigateToAuthorizations() {
    const link = findAuthorizationLink();
    if (link) {
      link.click();
      return;
    }
    window.location.assign(getStableAuthorizationUrl());
  }

  function waitForSearchControls(timeoutMs) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const screen = SIOS.detectarPantalla?.();
        const ready = screen?.type === "busqueda" &&
          document.getElementById("vAUCANROAFI_NUMERO_AFILIADO") &&
          document.getElementById("vREQCOMPRA") &&
          document.getElementById("vNFLGVISTA") &&
          document.getElementById("vMODALIDAD") &&
          (document.getElementById("SEARCHBUTTON") || document.querySelector('[name="SEARCHBUTTON"]'));

        if (ready) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }

        if (Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          reject(new Error("No se cargaron los controles de Autorizaciones dentro del tiempo esperado."));
        }
      }, 250);
    });
  }

  function waitForGrid(timeoutMs) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (hasGridRows()) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          reject(new Error("No aparecio el listado de autorizaciones dentro del tiempo esperado."));
        }
      }, 300);
    });
  }

  function normalizeAfiliado(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (/^[FM]\d{6,8}$/.test(raw)) return raw;
    if (/^0\d{7}$/.test(raw)) return raw;
    if (/^\d{6,9}$/.test(raw)) return raw.length < 8 ? raw.padStart(8, "0") : raw;
    return null;
  }

  async function executeSearch(dni) {
    await waitForSearchControls(20000);

    const numeroAfiliado = normalizeAfiliado(dni);
    if (!numeroAfiliado) {
      fail("Numero de afiliado invalido. Use solo digitos, o prefijo F/M seguido de digitos.");
    }
    resetVisibleSearchFilters();
    setValue(getRequired("vAUCANROAFI_NUMERO_AFILIADO"), numeroAfiliado);
    setSelectByValue("vNFLGVISTA", "0", "Todas");
    setSelectByValue("vMODALIDAD", "1", "Autorizacion Previa");
    setCheckboxChecked("vREQCOMPRA");

    const searchButton = getRequired("SEARCHBUTTON");
    searchButton.click();
    await waitForGrid(20000);

    return {
      ok: true,
      message: "Resultados cargados"
    };
  }

  async function buscarAfiliado(dni) {
    const normalized = String(dni || "").trim().toUpperCase();
    if (!/^[FM0]?\d{6,9}$/.test(normalized)) {
      fail("El documento debe tener 6 a 9 digitos, con prefijo opcional F, M o 0.");
    }

    const screen = SIOS.detectarPantalla?.();
    if (screen?.type !== "busqueda") {
      savePendingDni(normalized, readPendingDni());
      navigateToAuthorizations();
      return {
        ok: true,
        navigating: true,
        message: "Abriendo Autorizaciones..."
      };
    }

    return executeSearch(normalized);
  }

  SIOS.buscarAfiliado = buscarAfiliado;
  SIOS.tieneDniPendiente = () => Boolean(readPendingDni());
  SIOS.consumirDniPendiente = consumePendingDni;
  SIOS.ejecutarBusquedaAfiliado = executeSearch;
})();
