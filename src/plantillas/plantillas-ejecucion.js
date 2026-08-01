(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  const CODIGO_A_CODIFICAR = "000100";
  const DESCRIPCION_A_CODIFICAR = "ELEM MEDICO A CODIFICAR";
  const STATES = {
    AUTH_SELECTED: "AUTH_SELECTED",
    OPENING_AUTH: "OPENING_AUTH",
    AUTH_DETAIL_READY: "AUTH_DETAIL_READY",
    OPENING_ITEM_EDIT: "OPENING_ITEM_EDIT",
    ITEM_EDIT_READY: "ITEM_EDIT_READY",
    ENTERING_CODE: "ENTERING_CODE",
    WAITING_AUTOCOMPLETE: "WAITING_AUTOCOMPLETE",
    SELECTING_AUTOCOMPLETE: "SELECTING_AUTOCOMPLETE",
    OPENING_PRACTICE_MODAL: "OPENING_PRACTICE_MODAL",
    PRACTICE_MODAL_READY: "PRACTICE_MODAL_READY",
    SEARCHING_MODAL: "SEARCHING_MODAL",
    SELECTING_MODAL_RESULT: "SELECTING_MODAL_RESULT",
    WAITING_USER_SELECTION: "WAITING_USER_SELECTION",
    PRACTICE_SELECTED: "PRACTICE_SELECTED",
    FILLING_QUANTITY: "FILLING_QUANTITY",
    SAVING_ITEM: "SAVING_ITEM",
    VERIFYING_ITEM: "VERIFYING_ITEM",
    COMPLETED: "COMPLETED",
    ERROR: "ERROR"
  };

  let lastTemplateDiagnostic = null;

  function normalizeSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return normalizeSpaces(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  function normalizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function cssEscape(value) {
    return CSS.escape(String(value));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el) || window.getComputedStyle?.(el);
    return !el.hidden && style?.display !== "none" && style?.visibility !== "hidden" &&
      Number(style?.opacity ?? "1") !== 0 && Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function createDiagnostic(template, expectedAuthorization) {
    const screen = SIOS.detectarPantalla?.();
    return {
      status: "running",
      state: STATES.AUTH_SELECTED,
      stateHistory: [STATES.AUTH_SELECTED],
      templateId: template?.id || "",
      templateName: template?.nombre || "",
      autorizacionSeleccionada: expectedAuthorization ? {
        rowId: expectedAuthorization.rowId || "",
        authorizationNumber: expectedAuthorization.authorizationNumber || ""
      } : null,
      pantallaActual: screen ? {
        type: screen.type,
        label: screen.label,
        title: screen.title,
        formActionPath: String(screen.formAction || "").split("?")[0]
      } : null,
      primerLapizListadoEjecutado: expectedAuthorization?.primerLapizListado || null,
      clicksPrimerLapizListado: expectedAuthorization?.clicksPrimerLapizListado || 0,
      fila000100Encontrada: null,
      descripcionFila: "",
      segundoLapizEjecutado: null,
      clicksSegundoLapiz: 0,
      formularioEditableDetectado: false,
      formularioEditableVisible: false,
      valorInicialCodigo: "",
      valorInicialDescripcion: "",
      campoCodigoDetectado: null,
      codigoEscrito: "",
      desplegableDetectado: "no",
      cantidadOpcionesDesplegable: 0,
      opcionesDesplegable: [],
      coincidenciaDesplegableSeleccionada: null,
      desplegableFallbackModal: "",
      observacionNoAplicada: "",
      clickImgSelpra: null,
      controlesSeleccionCodigo: null,
      popupExteriorDetectado: null,
      tituloPopup: "",
      iframeDetectado: null,
      iframeCargado: false,
      iframeContentDocument: null,
      camposIframe: [],
      textoBusquedaModal: "",
      especialidadSeleccionada: "",
      clicBuscarModal: null,
      modalDetectado: "no",
      cantidadOpcionesModal: 0,
      opcionesModal: [],
      opcionSeleccionada: null,
      filaCodigoSeleccionada: null,
      popupCerrado: false,
      codigoDescripcionDespuesModal: null,
      cantidadCargada: "",
      clicConfirmarPrestacion: null,
      codigoFinalVerificado: "",
      cantidadFinalVerificada: "",
      etapa: STATES.AUTH_SELECTED,
      errorExacto: "",
      stoppedBeforeConfirmPrintAuthorize: true,
      at: new Date().toISOString()
    };
  }

  function setState(diagnostic, state) {
    diagnostic.state = state;
    diagnostic.etapa = state;
    diagnostic.stateHistory.push(state);
    diagnostic.at = new Date().toISOString();
    lastTemplateDiagnostic = diagnostic;
  }

  function fail(diagnostic, state, message, details) {
    diagnostic.status = "error";
    diagnostic.state = STATES.ERROR;
    diagnostic.etapa = state;
    diagnostic.stateHistory.push(STATES.ERROR);
    diagnostic.errorExacto = message;
    if (details) diagnostic.details = details;
    diagnostic.at = new Date().toISOString();
    lastTemplateDiagnostic = diagnostic;
    throw new Error(message);
  }

  function emit(el, type) {
    const EventCtor = el?.ownerDocument?.defaultView?.Event || Event;
    el.dispatchEvent(new EventCtor(type, { bubbles: true }));
  }

  function callHandler(el, name) {
    const handler = el?.[name];
    if (typeof handler === "function") {
      const EventCtor = el?.ownerDocument?.defaultView?.Event || Event;
      try { handler.call(el, new EventCtor(name.replace(/^on/, ""), { bubbles: true })); } catch { /* GeneXus handlers may depend on native event state. */ }
    }
  }

  function setValue(el, value) {
    el.focus();
    el.value = value;
    emit(el, "keydown");
    emit(el, "keypress");
    emit(el, "input");
    emit(el, "keyup");
    emit(el, "change");
    callHandler(el, "onchange");
    el.blur();
    emit(el, "blur");
    callHandler(el, "onblur");
  }

  function formatCantidad(value, currentValue = "") {
    const amount = Number(value);
    if (String(currentValue || "").includes(",")) return `${amount},00`;
    return String(amount);
  }

  function normalizeQuantity(value) {
    const normalized = normalizeSpaces(value).replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function focusVisual(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      const doc = el.ownerDocument || document;
      const prevOutline = el.style.outline;
      const prevOffset = el.style.outlineOffset;
      el.style.outline = "3px solid #ff9800";
      el.style.outlineOffset = "2px";
      (doc.defaultView || window).setTimeout(() => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
      }, 1500);
    } catch { /* sin scroll disponible */ }
  }

  const TOAST_ID = "asistente-sios-toast";

  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
        "background:#e65100;color:#fff;font:600 14px/1.4 system-ui,sans-serif;padding:10px 18px;" +
        "border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:70vw;text-align:center;";
      document.documentElement.append(toast);
    }
    toast.textContent = message;
  }

  function hideToast() {
    document.getElementById(TOAST_ID)?.remove();
  }

  function waitFor(predicate, timeoutMs, intervalMs = 150) {
    return new Promise((resolve) => {
      const started = Date.now();
      let timer = null;
      const observer = new MutationObserver(check);

      function finish(value) {
        if (timer) window.clearInterval(timer);
        observer.disconnect();
        resolve(value || null);
      }

      function check() {
        let value = null;
        try { value = predicate(); } catch { value = null; }
        if (value) {
          finish(value);
          return;
        }
        if (Date.now() - started > timeoutMs) finish(null);
      }

      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      timer = window.setInterval(check, intervalMs);
      check();
    });
  }

  function getErrorText() {
    return [
      document.getElementById("gxErrorViewer")?.textContent,
      document.querySelector(".ErrorViewer")?.textContent,
      document.getElementById("span_vMENSAJECOMPRA")?.textContent
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  function getDescriptionText() {
    return normalizeSpaces(document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.descripcionValidada)?.textContent);
  }

  function validateAuthorization(expected, diagnostic) {
    const expectedNumber = normalizeDigits(expected?.authorizationNumber);
    if (!expectedNumber) return;

    const detailInternal = normalizeDigits(document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.numeroInterno)?.textContent);
    if (!detailInternal) {
      fail(diagnostic, "validarAutorizacion", "No se pudo verificar el numero interno de la autorizacion abierta.");
    }

    if (!expectedNumber.endsWith(detailInternal)) {
      fail(diagnostic, "validarAutorizacion", "La autorizacion abierta no coincide con la seleccionada.", {
        expectedSuffix: expectedNumber.slice(-8),
        detailInternal
      });
    }
  }

  function validateDetailScreen(diagnostic) {
    const screen = SIOS.detectarPantalla?.();
    diagnostic.pantallaActual = screen ? {
      type: screen.type,
      label: screen.label,
      title: screen.title,
      formActionPath: String(screen.formAction || "").split("?")[0]
    } : null;

    if (screen?.type !== "detalle") {
      fail(diagnostic, "esperarDetalle", "La pantalla actual no es el detalle de autorizacion.");
    }

    const missing = SIOS.CAMPOS_PLANTILLA_SIOS.detalleRequeridos
      .filter((selector) => !document.querySelector(selector));
    if (missing.length) {
      fail(diagnostic, "esperarDetalle", "Faltan campos requeridos para modificar la plantilla.", { missing });
    }
    setState(diagnostic, STATES.AUTH_DETAIL_READY);
  }

  function getRowId(row) {
    const gxrow = row?.getAttribute("gxrow");
    if (gxrow) return gxrow;
    const idMatch = row?.id?.match(/_(\d{4})$/);
    if (idMatch) return idMatch[1];
    const control = row?.querySelector("[id$='_0001'], [id$='_0002'], [id$='_0003'], [id$='_0004'], [id$='_0005']");
    return control?.id?.match(/_(\d{4})$/)?.[1] || "";
  }

  function getCellByColIndex(row, colIndex) {
    return row?.querySelector(`td[colindex="${cssEscape(colIndex)}"]`);
  }

  function readRowText(row, rowId, prefix, fallbackColIndex) {
    const byId = rowId ? document.getElementById(`${prefix}${rowId}`) : null;
    return normalizeSpaces(byId?.textContent || getCellByColIndex(row, fallbackColIndex)?.textContent || "");
  }

  function readAllPrestacionRows() {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const rows = Array.from(document.querySelectorAll(`${fields.grillaPrestaciones} tr`)).filter((row) => getRowId(row));
    return rows.map((row) => {
      const rowId = getRowId(row);
      return {
        row,
        rowId,
        codigo: readRowText(row, rowId, fields.codigoFilaPrefijo, 8),
        descripcion: readRowText(row, rowId, fields.descripcionFilaPrefijo, 10),
        cantidad: readRowText(row, rowId, fields.cantidadFilaPrefijo, 21)
      };
    });
  }

  function findCodingRow(diagnostic) {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const table = document.querySelector(fields.grillaPrestaciones);
    if (!table) {
      fail(diagnostic, "buscarFila000100", "No se encontro la grilla de prestaciones.");
    }

    const rows = readAllPrestacionRows();
    diagnostic.cantidadFilasPrestaciones = rows.length;

    for (const current of rows) {
      if (current.codigo === CODIGO_A_CODIFICAR && normalizeText(current.descripcion) === DESCRIPCION_A_CODIFICAR) {
        const editButton = current.row.querySelector(`#${cssEscape(fields.modificarPrestacionPrefijo + current.rowId)}`) ||
          document.getElementById(`${fields.modificarPrestacionPrefijo}${current.rowId}`);
        diagnostic.fila000100Encontrada = { rowId: current.rowId, codigo: current.codigo };
        diagnostic.descripcionFila = current.descripcion;
        diagnostic.segundoLapizEjecutado = editButton ? {
          id: editButton.id,
          title: editButton.getAttribute("title") || "",
          visible: isVisible(editButton)
        } : null;
        return { ...current, editButton };
      }
    }

    fail(diagnostic, "buscarFila000100", "No se encontro una fila 000100 con descripcion ELEM MEDICO A CODIFICAR.");
  }

  function detectEditableForm() {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const code = document.querySelector(fields.codigo);
    const quantity = document.querySelector(fields.cantidad);
    const confirmar = document.querySelector(fields.guardarPrestacion);
    const agregar = document.querySelector(fields.agregar);
    const save = (confirmar && isVisible(confirmar)) ? confirmar : ((agregar && isVisible(agregar)) ? agregar : null);
    if (!code || !quantity || !save || !isVisible(code) || !isVisible(quantity)) return null;
    return { code, quantity, save, mode: save === confirmar ? "editar" : "agregar" };
  }

  async function enterPrestacionEdit(rowInfo, diagnostic) {
    setState(diagnostic, STATES.OPENING_ITEM_EDIT);
    if (!rowInfo?.editButton) {
      fail(diagnostic, "segundoModificar", "No se encontro el boton Modificar de la fila 000100.");
    }

    diagnostic.segundoLapizEjecutado = {
      id: rowInfo.editButton.id,
      title: rowInfo.editButton.getAttribute("title") || "",
      rowId: rowInfo.rowId,
      visible: isVisible(rowInfo.editButton)
    };
    diagnostic.clicksSegundoLapiz += 1;
    focusVisual(rowInfo.editButton);
    rowInfo.editButton.click();

    // Los campos ya existen en modo alta; hay que esperar el re-render GeneXus en modo edicion con 000100 cargado.
    const form = await waitFor(() => {
      if (isAjaxBusy()) return null;
      const current = detectEditableForm();
      if (!current || current.mode !== "editar") return null;
      if (normalizeSpaces(current.code.value) !== CODIGO_A_CODIFICAR) return null;
      return current;
    }, 30000);
    if (!form) {
      fail(diagnostic, "esperarFormularioEditable", "No aparecio el formulario editable de la prestacion 000100 (modo edicion).");
    }

    diagnostic.formularioEditableDetectado = true;
    diagnostic.formularioEditableVisible = true;
    diagnostic.valorInicialCodigo = normalizeSpaces(form.code.value);
    diagnostic.valorInicialDescripcion = getDescriptionText();
    diagnostic.campoCodigoDetectado = {
      selector: SIOS.CAMPOS_PLANTILLA_SIOS.codigo,
      id: form.code.id,
      visible: isVisible(form.code)
    };
    setState(diagnostic, STATES.ITEM_EDIT_READY);
    return form;
  }

  function getCodeSelectionControls() {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const promptButton = document.querySelector(fields.selectorPractica);
    const select = document.querySelector(fields.comboPractica);
    return {
      imgSelpra: promptButton ? { id: promptButton.id, visible: isVisible(promptButton) } : null,
      editPracomp: select ? {
        id: select.id,
        visible: isVisible(select),
        options: Array.from(select.options || []).map((option, index) => ({
          index,
          value: normalizeSpaces(option.value),
          text: normalizeSpaces(option.textContent)
        }))
      } : null
    };
  }

  function sanitizeOptionText(value) {
    return normalizeSpaces(value).slice(0, 180);
  }

  function codeMatches(optionCode, expectedCode) {
    return normalizeDigits(optionCode) === normalizeDigits(expectedCode);
  }

  function expectedCodeFor(item) {
    return item.codigoSeleccionModal || item.codigo;
  }

  function catalogDescriptionFor(code) {
    const match = (SIOS.CODIGOS_ELEMENTOS || []).find((el) => el.codigo === code);
    return match?.descripcion || "";
  }

  function expectedDescriptionFor(item) {
    return item.descripcionSeleccionModal || item.descripcion || catalogDescriptionFor(expectedCodeFor(item)) || "";
  }

  function descriptionEquals(actual, expected) {
    if (!expected) return true;
    return normalizeText(actual) === normalizeText(expected);
  }

  function descriptionLooselyMatches(actual, expected) {
    if (!expected) return true;
    const a = normalizeText(actual);
    const b = normalizeText(expected);
    if (!a || !b) return false;
    // El modal trunca descripciones largas; se admite coincidencia por prefijo.
    return a === b || a.startsWith(b) || b.startsWith(a);
  }

  function findPracticePopup() {
    // GeneXus numera los popups gxp0, gxp1, ...; se toma el ultimo visible.
    const popups = Array.from(document.querySelectorAll("div[id^='gxp'][id$='_b']")).filter(isVisible);
    const popup = popups[popups.length - 1];
    if (!popup) return null;
    const prefix = popup.id.slice(0, -2);
    const title = normalizeSpaces(document.getElementById(`${prefix}_gxtitle`)?.textContent);
    const iframe = document.getElementById(`${prefix}_ifrm`) || popup.querySelector("iframe");
    return { popup, title, iframe };
  }

  function clickLikeUser(el) {
    const win = el.ownerDocument?.defaultView || window;
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      try {
        const Ctor = type.startsWith("pointer") ? (win.PointerEvent || win.MouseEvent) : win.MouseEvent;
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: win }));
      } catch { /* eventos opcionales */ }
    }
    el.click();
  }

  function isAjaxBusy(doc = document) {
    const notification = doc.getElementById("gx_ajax_notification");
    const indicator = doc.getElementById("gx_ajax_indicator");
    return isVisible(notification) || isVisible(indicator);
  }

  function getIframeDocument(iframe) {
    try {
      return iframe?.contentDocument || iframe?.contentWindow?.document || null;
    } catch (error) {
      return { accessError: error.message };
    }
  }

  async function waitForPracticePopup(diagnostic) {
    const popupInfo = await waitFor(() => {
      const current = findPracticePopup();
      if (!current) return null;
      if (current.title && !/Seleccionar/i.test(current.title)) return null;
      if (!current.iframe) return null;
      return current;
    }, 25000);

    if (!popupInfo) {
      fail(diagnostic, "esperarPopupPractica", "No aparecio el popup de seleccion de practica/traduccion con iframe gxp0_ifrm.");
    }

    diagnostic.popupExteriorDetectado = {
      id: popupInfo.popup.id,
      visible: isVisible(popupInfo.popup)
    };
    diagnostic.tituloPopup = popupInfo.title;
    diagnostic.iframeDetectado = {
      id: popupInfo.iframe.id,
      srcPath: (() => {
        try { return new URL(popupInfo.iframe.src).pathname; } catch { return popupInfo.iframe.getAttribute("src") || ""; }
      })()
    };

    const iframeReady = await waitFor(() => {
      const doc = getIframeDocument(popupInfo.iframe);
      if (doc?.accessError) return { accessError: doc.accessError };
      if (!doc?.documentElement || !doc.body) return null;
      if (doc.readyState && !["interactive", "complete"].includes(doc.readyState)) return null;
      return { doc };
    }, 25000);

    if (iframeReady?.accessError) {
      diagnostic.iframeContentDocument = { ok: false, error: iframeReady.accessError };
      fail(diagnostic, "accederIframePractica", "No se pudo acceder al contentDocument del iframe de practicas.", { error: iframeReady.accessError });
    }
    if (!iframeReady?.doc) {
      fail(diagnostic, "esperarIframePractica", "El iframe de practicas no termino de cargar.");
    }

    diagnostic.iframeCargado = true;
    diagnostic.iframeContentDocument = { ok: true };
    setState(diagnostic, STATES.PRACTICE_MODAL_READY);
    return { ...popupInfo, doc: iframeReady.doc };
  }

  function chooseSelectOptionByText(select, expectedText) {
    if (!select || !expectedText) return "";
    const expected = normalizeText(expectedText);
    const option = Array.from(select.options || []).find((current) =>
      normalizeText(current.textContent) === expected || normalizeText(current.textContent).includes(expected)
    );
    if (!option) return "";
    select.value = option.value;
    emit(select, "input");
    emit(select, "change");
    callHandler(select, "onchange");
    return normalizeSpaces(option.textContent);
  }

  function headerIndex(headers, patterns) {
    return headers.findIndex((header) => patterns.some((pattern) => normalizeText(header).includes(normalizeText(pattern))));
  }

  function readPracticeRows(doc) {
    const tables = Array.from(doc.querySelectorAll("table")).filter((table) => isVisible(table) && table.querySelector("tr"));
    const candidates = [];

    for (const table of tables) {
      const headerCells = Array.from(table.querySelectorAll("thead th, tr:first-child th, tr:first-child td"));
      const headers = headerCells.map((cell) => normalizeSpaces(cell.textContent));
      const codeIndex = headerIndex(headers, ["Codigo", "Código", "Practica", "Práctica"]);
      const descIndex = headerIndex(headers, ["Descripcion", "Descripción"]);
      if (codeIndex < 0 && descIndex < 0) continue;

      const rows = Array.from(table.querySelectorAll("tbody tr, tr")).filter((row) => row.cells?.length && row !== headerCells[0]?.parentElement);
      rows.forEach((row, index) => {
        const cells = Array.from(row.cells || []);
        const rowText = normalizeSpaces(row.textContent);
        const codeText = normalizeSpaces(cells[codeIndex]?.textContent || rowText.match(/\b\d{4,8}\b/)?.[0] || "");
        const descText = normalizeSpaces(cells[descIndex]?.textContent || rowText.replace(codeText, ""));
        // Se selecciona haciendo clic en el link del codigo de la fila.
        const clickable = cells[codeIndex]?.querySelector("a, input[type='image'], button") ||
          row.querySelector("a[href], button, input[type='button'], input[type='submit'], input[type='image']") || row;
        if (codeText || descText) {
          candidates.push({
            index,
            codigo: normalizeDigits(codeText),
            descripcion: descText,
            text: rowText,
            row,
            clickable,
            columnIndexes: { codigo: codeIndex, descripcion: descIndex }
          });
        }
      });
    }

    return candidates.filter((row) => row.codigo || row.descripcion);
  }

  async function selectPracticeFromIframe(item, diagnostic, doc) {
    setState(diagnostic, STATES.SELECTING_MODAL_RESULT);
    const rows = readPracticeRows(doc);
    diagnostic.cantidadOpcionesModal = rows.length;
    diagnostic.opcionesModal = rows.slice(0, 80).map((row) => ({
      index: row.index,
      codigo: row.codigo,
      descripcion: sanitizeOptionText(row.descripcion || row.text)
    }));

    if (!rows.length) {
      fail(diagnostic, "leerResultadosModal", "La busqueda del selector de practicas no devolvio filas identificables.");
    }

    const expectedCode = expectedCodeFor(item);
    const expectedDescription = expectedDescriptionFor(item);
    const byCode = rows.filter((row) => codeMatches(row.codigo, expectedCode));
    if (!byCode.length) {
      return { manual: true, reason: `No aparecio el codigo ${expectedCode} en las opciones visibles.` };
    }

    let matches = byCode;
    if (matches.length > 1 && expectedDescription) {
      const exact = matches.filter((row) => descriptionEquals(row.descripcion || row.text, expectedDescription));
      matches = exact.length ? exact : matches.filter((row) => descriptionLooselyMatches(row.descripcion || row.text, expectedDescription));
    }
    if (matches.length !== 1) {
      return {
        manual: true,
        reason: matches.length > 1
          ? `Hay varias opciones del codigo ${expectedCode} y ninguna descripcion coincide de forma unica.`
          : `Ninguna descripcion coincide con \"${expectedDescription}\".`
      };
    }

    const selected = matches[0];
    diagnostic.filaCodigoSeleccionada = {
      index: selected.index,
      codigo: selected.codigo,
      descripcion: sanitizeOptionText(selected.descripcion || selected.text),
      columnIndexes: selected.columnIndexes
    };
    diagnostic.opcionSeleccionada = {
      index: selected.index,
      codigo: selected.codigo,
      descripcion: selected.descripcion || selected.text
    };
    focusVisual(selected.clickable);
    clickLikeUser(selected.clickable);
    return { clicked: true };
  }

  function practicePopupClosed() {
    const current = findPracticePopup();
    return !current || !isVisible(current.popup);
  }

  async function waitForManualSelection(item, diagnostic, reason) {
    setState(diagnostic, STATES.WAITING_USER_SELECTION);
    diagnostic.seleccionManual = true;
    diagnostic.motivoSeleccionManual = reason;
    const expectedDescription = expectedDescriptionFor(item);
    showToast(`Asistente SIOS: elija manualmente la opcion correcta del codigo ${item.codigo}` +
      (expectedDescription ? ` (${expectedDescription})` : "") + ". La carga continuara sola.");
    try {
      const closed = await waitFor(() => practicePopupClosed() || null, 180000, 400);
      if (!closed) {
        fail(diagnostic, "seleccionManual", "Se agoto el tiempo esperando la seleccion manual en el modal.");
      }
    } finally {
      hideToast();
    }
  }

  async function resolvePracticeModal(item, diagnostic) {
    const popup = await waitForPracticePopup(diagnostic);
    diagnostic.modalDetectado = "si";

    await waitFor(() => !isAjaxBusy(popup.doc), 25000);

    const rowsReady = await waitFor(() => readPracticeRows(popup.doc).length > 0, 20000);
    if (!rowsReady) {
      fail(diagnostic, "leerOpcionesModal", "El modal de traducciones no mostro opciones para el codigo ingresado.");
    }
    const selection = await selectPracticeFromIframe(item, diagnostic, popup.doc);

    if (selection.manual) {
      await waitForManualSelection(item, diagnostic, selection.reason);
    } else {
      const closed = await waitFor(() => practicePopupClosed() || null, 20000);
      if (!closed) {
        // El clic automatico no cerro el modal; el usuario decide.
        await waitForManualSelection(item, diagnostic, "El clic automatico no cerro el modal.");
      }
    }
    diagnostic.popupCerrado = true;
    setState(diagnostic, STATES.PRACTICE_SELECTED);
  }

  async function waitForSelectedPractice(item, diagnostic, options = {}) {
    const expectedCode = item.codigo;
    const initialDescription = diagnostic.descripcionBaseItem || diagnostic.valorInicialDescripcion || DESCRIPCION_A_CODIFICAR;
    const expectedDescription = expectedDescriptionFor(item);
    const validated = await waitFor(() => {
      const currentForm = detectEditableForm();
      const code = normalizeSpaces(currentForm?.code?.value);
      const description = getDescriptionText();
      const errorText = getErrorText();
      if (errorText && !/requiere compra/i.test(errorText)) return { errorText };
      if (isAjaxBusy()) return null;
      if (code !== expectedCode) return null;
      if (!description) return null;
      if (normalizeText(description) === DESCRIPCION_A_CODIFICAR) return null;
      if (normalizeText(description) === normalizeText(initialDescription)) return null;
      return { code, description };
    }, 20000);

    if (validated?.errorText) {
      if (options.allowFallback) return null;
      fail(diagnostic, "validarCodigo", `SIOS informo un error al validar ${item.codigo}.`, { errorText: validated.errorText });
    }
    if (!validated?.description) {
      if (options.allowFallback) return null;
      fail(diagnostic, "validarCodigo", `No se pudo verificar descripcion validada para el codigo ${item.codigo}.`);
    }
    if (expectedDescription && !descriptionEquals(validated.description, expectedDescription) && !diagnostic.seleccionManual) {
      if (options.allowFallback) return null;
      fail(diagnostic, "validarCodigo", "La descripcion validada no coincide con la descripcion esperada de la plantilla.", {
        expectedDescription,
        actualDescription: validated.description
      });
    }

    diagnostic.codigoDescripcionDespuesModal = {
      codigo: validated.code,
      descripcion: validated.description
    };
    setState(diagnostic, STATES.PRACTICE_SELECTED);
    return validated;
  }

  async function enterCodeAndWaitValidation(item, diagnostic) {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const form = detectEditableForm();
    if (!form) {
      fail(diagnostic, "formularioEditable", "El formulario editable no esta disponible.");
    }

    setState(diagnostic, STATES.ENTERING_CODE);
    diagnostic.descripcionBaseItem = getDescriptionText() || DESCRIPCION_A_CODIFICAR;
    focusVisual(form.code);
    setValue(form.code, item.codigo);
    diagnostic.codigoEscrito = item.codigo;
    diagnostic.controlesSeleccionCodigo = getCodeSelectionControls();

    const initialDescription = normalizeText(diagnostic.descripcionBaseItem);
    const detectOutcome = () => {
      const errorText = getErrorText();
      if (errorText && !/requiere compra/i.test(errorText)) return { errorText };
      const popup = findPracticePopup();
      if (popup?.iframe) return { popup: true };
      if (isAjaxBusy()) return null;
      const description = normalizeText(getDescriptionText());
      if (description && description !== DESCRIPCION_A_CODIFICAR && description !== initialDescription) {
        return { validated: true };
      }
      return null;
    };

    // El blur puede disparar solo el modal; si no, se pulsa el icono junto a la descripcion (IMGPRACTICA).
    setState(diagnostic, STATES.WAITING_AUTOCOMPLETE);
    let outcome = await waitFor(detectOutcome, 3000, 100);

    if (!outcome) {
      const validateButton = document.querySelector(fields.validarPractica);
      if (!validateButton || !isVisible(validateButton)) {
        fail(diagnostic, "validarPractica", "No se encontro visible el icono IMGPRACTICA junto a la descripcion de la practica.");
      }
      setState(diagnostic, STATES.OPENING_PRACTICE_MODAL);
      diagnostic.clickValidarPractica = { id: validateButton.id, clicks: 1 };
      focusVisual(validateButton);
      validateButton.click();
      outcome = await waitFor(detectOutcome, 25000);
    }

    if (outcome?.errorText) {
      fail(diagnostic, "validarCodigo", `SIOS informo un error al validar ${item.codigo}.`, { errorText: outcome.errorText });
    }
    if (!outcome) {
      fail(diagnostic, "validarCodigo", `SIOS no abrio las opciones del codigo ${item.codigo} ni valido la practica.`);
    }

    if (outcome.popup) {
      diagnostic.desplegableDetectado = "modal-traduccion";
      await resolvePracticeModal(item, diagnostic);
      await waitForSelectedPractice(item, diagnostic);
      return;
    }

    diagnostic.desplegableDetectado = "validacion-directa";
    await waitForSelectedPractice(item, diagnostic);
  }

  function fillPurchaseFieldsIfRequired(item, template, diagnostic) {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const message = document.querySelector(fields.mensajeCompra);
    const protesis = document.querySelector(fields.descripcionProtesisCompra);
    const requiresPurchase = (message && isVisible(message) && /requiere compra/i.test(message.textContent || "")) ||
      (protesis && isVisible(protesis));
    if (!requiresPurchase) return;

    const protesisConfigurada = item.descripcionProtesis || template.descripcionProtesis || "";
    if (protesis && isVisible(protesis)) {
      if (protesisConfigurada) {
        focusVisual(protesis);
        setValue(protesis, protesisConfigurada);
      } else if (!normalizeSpaces(protesis.value)) {
        focusVisual(protesis);
        setValue(protesis, "-");
      }
    }

    const prioridadConfigurada = item.prioridad || template.prioridad || "";
    const prioridadSelect = document.querySelector(fields.prioridadCompra);
    let prioridadAplicada = "";
    if (prioridadConfigurada) {
      if (!prioridadSelect || !isVisible(prioridadSelect)) {
        fail(diagnostic, "camposCompra", "La plantilla define prioridad pero el selector de prioridad no esta visible.");
      }
      prioridadAplicada = chooseSelectOptionByText(prioridadSelect, prioridadConfigurada);
      if (!prioridadAplicada) {
        fail(diagnostic, "camposCompra", `No se encontro la prioridad \"${prioridadConfigurada}\" en el selector.`, {
          opciones: Array.from(prioridadSelect.options || []).map((option) => normalizeSpaces(option.textContent))
        });
      }
    }

    const lugarConfigurado = item.lugarEntrega || template.lugarEntrega || "";
    const lugar = document.querySelector(fields.lugarEntregaCompra);
    if (lugarConfigurado) {
      if (!lugar || !isVisible(lugar)) {
        fail(diagnostic, "camposCompra", "La plantilla define lugar de entrega pero el campo no esta visible.");
      }
      setValue(lugar, lugarConfigurado);
    }

    diagnostic.camposCompraCompletados = {
      requiereCompra: true,
      descripcionProtesis: protesis ? normalizeSpaces(protesis.value) : "",
      prioridad: prioridadAplicada || (prioridadSelect ? normalizeSpaces(prioridadSelect.selectedOptions?.[0]?.textContent) : ""),
      lugarEntrega: lugar ? normalizeSpaces(lugar.value) : ""
    };
  }

  async function savePrestacion(item, template, diagnostic) {
    const fields = SIOS.CAMPOS_PLANTILLA_SIOS;
    const form = detectEditableForm();
    if (!form) fail(diagnostic, "guardarPrestacion", "El formulario editable no esta disponible para guardar.");

    setState(diagnostic, STATES.FILLING_QUANTITY);
    const cantidad = formatCantidad(item.cantidad, form.quantity.value);
    focusVisual(form.quantity);
    setValue(form.quantity, cantidad);
    diagnostic.cantidadCargada = cantidad;
    if (normalizeQuantity(form.quantity.value) !== Number(item.cantidad)) {
      fail(diagnostic, "completarCantidad", "La cantidad cargada no coincide antes de guardar la prestacion.", {
        expectedQuantity: item.cantidad,
        actualQuantity: form.quantity.value
      });
    }

    const observation = [template.observacionGeneral, item.observacion].filter(Boolean).join(" ");
    if (observation) {
      if (!diagnostic.opcionSeleccionada) {
        diagnostic.observacionNoAplicada = "observacion no aplicada por selector no confirmado";
        fail(diagnostic, "completarObservacion", "La plantilla tiene observacion, pero el selector de practica no fue confirmado.");
      }
      const obsField = document.querySelector(fields.observacion);
      if (!obsField) fail(diagnostic, "completarObservacion", "La plantilla tiene observacion pero no se encontro el campo de observacion.");
      setValue(obsField, observation);
    }

    const laterality = document.querySelector(fields.lateralidad);
    if (laterality && template.lateralidad) setValue(laterality, template.lateralidad);

    setState(diagnostic, STATES.SAVING_ITEM);
    const clickSave = (currentForm) => {
      diagnostic.clicConfirmarPrestacion = {
        id: currentForm.save.id,
        title: currentForm.save.getAttribute("title") || "",
        clicks: (diagnostic.clicConfirmarPrestacion?.clicks || 0) + 1
      };
      focusVisual(currentForm.save);
      currentForm.save.click();
    };
    const waitForSaveCompletion = () => waitFor(() => {
      const errorText = getErrorText();
      if (errorText && !/requiere compra/i.test(errorText)) return { errorText };
      if (isAjaxBusy()) return null;
      if (!detectEditableForm()) return { formClosed: true };
      if (readAllPrestacionRows().some((row) => row.codigo === item.codigo)) return { rowSaved: true };
      return null;
    }, 12000);

    let completion;
    if (form.mode === "agregar") {
      // Para los ítems posteriores, SIOS recién muestra los campos de Compra después
      // del primer +. No se completa ni confirma por segunda vez hasta que aparezcan.
      clickSave(form);
      const purchaseStep = await waitFor(() => {
        const errorText = getErrorText();
        if (errorText && !/requiere compra/i.test(errorText)) return { errorText };
        if (isAjaxBusy()) return null;
        const message = document.querySelector(fields.mensajeCompra);
        const protesis = document.querySelector(fields.descripcionProtesisCompra);
        if ((message && isVisible(message) && /requiere compra/i.test(message.textContent || "")) ||
          (protesis && isVisible(protesis))) return { purchaseRequired: true };
        if (!detectEditableForm()) return { formClosed: true };
        if (readAllPrestacionRows().some((row) => row.codigo === item.codigo)) return { rowSaved: true };
        return null;
      }, 12000);

      if (purchaseStep?.errorText) {
        fail(diagnostic, "guardarPrestacion", `SIOS informo un error al guardar ${item.codigo}.`, { errorText: purchaseStep.errorText });
      }
      if (purchaseStep?.purchaseRequired) {
        const purchaseForm = detectEditableForm();
        if (!purchaseForm || purchaseForm.mode !== "agregar") {
          fail(diagnostic, "camposCompra", "SIOS solicito completar los campos de Compra, pero el formulario de alta ya no esta disponible.");
        }
        fillPurchaseFieldsIfRequired(item, template, diagnostic);
        clickSave(purchaseForm);
        completion = await waitForSaveCompletion();
      } else {
        completion = purchaseStep;
      }
    } else {
      // El primer ítem se carga desde la fila 000100 en modo edición y conserva
      // su secuencia actual de completar los campos antes de confirmar.
      fillPurchaseFieldsIfRequired(item, template, diagnostic);
      clickSave(form);
      completion = await waitForSaveCompletion();
    }

    diagnostic.formularioEditableVisible = Boolean(detectEditableForm());
    if (completion?.errorText) {
      fail(diagnostic, "guardarPrestacion", `SIOS informo un error al guardar ${item.codigo}.`, { errorText: completion.errorText });
    }
    if (!completion?.formClosed && !completion?.rowSaved) {
      fail(diagnostic, "guardarPrestacion", "No se pudo verificar que la prestacion haya quedado guardada en la grilla.");
    }
  }

  async function verifySavedItem(item, diagnostic) {
    setState(diagnostic, STATES.VERIFYING_ITEM);
    const expectedQuantity = Number(item.cantidad);
    const expectedDescription = expectedDescriptionFor(item);
    const row = await waitFor(() => readAllPrestacionRows().find((current) => current.codigo === item.codigo), 20000);
    if (!row) {
      fail(diagnostic, "verificarResultado", `No se verifico que la fila haya cambiado al codigo ${item.codigo}.`, {
        filas: readAllPrestacionRows().map((current) => ({
          rowId: current.rowId,
          codigo: current.codigo,
          descripcion: current.descripcion,
          cantidad: current.cantidad
        }))
      });
    }

    diagnostic.codigoFinalVerificado = row.codigo;
    diagnostic.cantidadFinalVerificada = row.cantidad;

    if (normalizeQuantity(row.cantidad) !== expectedQuantity) {
      fail(diagnostic, "verificarResultado", `La cantidad verificada para ${item.codigo} no coincide.`, {
        expectedQuantity,
        actualQuantity: row.cantidad
      });
    }
    if (expectedDescription && !descriptionEquals(row.descripcion, expectedDescription)) {
      fail(diagnostic, "verificarResultado", `La descripcion verificada para ${item.codigo} no coincide.`, {
        expectedDescription,
        actualDescription: row.descripcion
      });
    }

    return {
      codigo: row.codigo,
      cantidad: row.cantidad,
      descripcion: row.descripcion || item.descripcion
    };
  }

  async function getFormForItem(index, diagnostic) {
    if (index === 0) {
      // La grilla GeneXus puede seguir cargando filas despues de mostrar el detalle.
      await waitFor(() => {
        if (isAjaxBusy()) return null;
        return readAllPrestacionRows().some((row) => row.codigo === CODIGO_A_CODIFICAR) || null;
      }, 20000);
      const rowInfo = findCodingRow(diagnostic);
      return enterPrestacionEdit(rowInfo, diagnostic);
    }

    const form = await waitFor(() => {
      if (isAjaxBusy()) return null;
      return detectEditableForm();
    }, 20000);

    if (!form) {
      fail(diagnostic, "itemsMultiples", "Plantilla con varios items: no hay un formulario editable disponible para cargar el siguiente item y no esta confirmado otro mecanismo de alta de lineas.");
    }

    diagnostic.formularioEditableDetectado = true;
    diagnostic.formularioEditableVisible = true;
    setState(diagnostic, STATES.ITEM_EDIT_READY);
    return form;
  }

  async function applyItem(item, template, index, diagnostic) {
    if (!/^\d+$/.test(item.codigo)) fail(diagnostic, "validarItem", `Codigo invalido: ${item.codigo}`);
    if (!Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
      fail(diagnostic, "validarItem", `Cantidad invalida para ${item.codigo}`);
    }

    await getFormForItem(index, diagnostic);
    await enterCodeAndWaitValidation(item, diagnostic);
    await savePrestacion(item, template, diagnostic);
    return verifySavedItem(item, diagnostic);
  }

  async function applyTemplate(template, expectedAuthorization) {
    const validation = SIOS.validarPlantilla(template);
    if (!validation.ok) {
      const diagnostic = createDiagnostic(template, expectedAuthorization);
      fail(diagnostic, "validarPlantilla", validation.errors.join(" "));
    }

    const normalized = validation.template;
    const diagnostic = createDiagnostic(normalized, expectedAuthorization);
    setState(diagnostic, STATES.OPENING_AUTH);
    lastTemplateDiagnostic = diagnostic;

    validateDetailScreen(diagnostic);
    validateAuthorization(expectedAuthorization, diagnostic);

    const items = normalized.items.slice().sort((a, b) => a.orden - b.orden);
    const applied = [];

    for (let index = 0; index < items.length; index += 1) {
      applied.push(await applyItem(items[index], normalized, index, diagnostic));
    }

    diagnostic.status = "ok";
    diagnostic.appliedCount = applied.length;
    diagnostic.applied = applied;
    setState(diagnostic, STATES.COMPLETED);

    return {
      ok: true,
      message: `Plantilla aplicada: ${normalized.nombre}. Items modificados: ${applied.length}. Revise SIOS antes de confirmar o imprimir.`,
      applied
    };
  }

  SIOS.aplicarPlantillaEnDetalle = applyTemplate;

  async function waitAndClickPrint() {
    const printImg = await waitFor(() => {
      const img = document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.imprimir);
      return img && isVisible(img) ? img : null;
    }, 30000);

    if (!printImg) {
      const errorText = getErrorText();
      throw new Error(errorText ? `SIOS no habilito la impresion: ${errorText}` : "SIOS no habilito el icono de impresion.");
    }

    focusVisual(printImg);
    const anchor = printImg.closest("a") || printImg;
    clickLikeUser(anchor);
    return {
      ok: true,
      message: "Autorizacion confirmada. La impresion se abrio en una pestaña nueva. Si el navegador la bloqueo, haga clic en la impresora resaltada."
    };
  }

  async function confirmarAutorizacionEImprimir() {
    const screen = SIOS.detectarPantalla?.();
    if (screen?.type !== "detalle") {
      throw new Error("Debe estar abierta la solicitud de autorizacion para confirmar.");
    }

    // Si la impresora ya esta visible, la autorizacion ya fue confirmada.
    const printReady = document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.imprimir);
    if (printReady && isVisible(printReady)) {
      return waitAndClickPrint();
    }

    const confirmBtn = document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.confirmar);
    if (!confirmBtn || !isVisible(confirmBtn)) {
      throw new Error("No se encontro visible el boton Confirmar de SIOS.");
    }

    focusVisual(confirmBtn);
    clickLikeUser(confirmBtn);

    await wait(600);
    await waitFor(() => (!isAjaxBusy() ? true : null), 30000);

    const errorText = getErrorText();
    if (errorText && !/requiere compra/i.test(errorText)) {
      throw new Error(`SIOS informo al confirmar: ${errorText}`);
    }

    return waitAndClickPrint();
  }

  SIOS.confirmarAutorizacionEImprimir = confirmarAutorizacionEImprimir;
  SIOS.imprimirAutorizacion = waitAndClickPrint;
  SIOS.detallePlantillaDisponible = (expectedAuthorization) => {
    const screen = SIOS.detectarPantalla?.();
    if (screen?.type !== "detalle") return false;
    if (!document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.grillaPrestaciones)) return false;

    const expectedNumber = normalizeDigits(expectedAuthorization?.authorizationNumber);
    if (!expectedNumber) return true;
    const detailInternal = normalizeDigits(document.querySelector(SIOS.CAMPOS_PLANTILLA_SIOS.numeroInterno)?.textContent);
    return Boolean(detailInternal && expectedNumber.endsWith(detailInternal));
  };
  SIOS.obtenerDiagnosticoPlantilla = () => lastTemplateDiagnostic;
})();
