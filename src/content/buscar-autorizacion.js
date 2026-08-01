(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};
  let lastLookupDiagnostic = null;
  let lastListDiagnostic = {
    actionControlCount: 0,
    rowCountBeforeDedup: 0,
    resultCountBeforeDedup: 0,
    resultCountAfterDedup: 0,
    duplicatedControls: [],
    duplicateRowsByAuthorization: []
  };

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value || "";
    return textarea.value;
  }

  function normalizeAuthorization(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function extractAuthorization(text) {
    const raw = String(text || "");
    const formatted = raw.match(/\b\d{4,6}-\d{8,}\b/);
    if (formatted) return formatted[0];

    const longNumber = raw.match(/\b\d{12,}\b/);
    return longNumber ? longNumber[0] : "";
  }

  function getCellText(cell) {
    return normalizeSpaces(cell?.textContent || "");
  }

  function isHidden(el) {
    if (!el) return true;
    const style = window.getComputedStyle?.(el);
    return style?.display === "none" || style?.visibility === "hidden" ||
      el.hidden || el.getAttribute("aria-hidden") === "true";
  }

  function getGridHeaders() {
    const table = document.getElementById("GridContainerTbl");
    const headers = Array.from(table?.querySelectorAll("thead th") || []);
    return headers.map((header, position) => ({
      position,
      columnIndex: Number(header.getAttribute("colindex")),
      text: normalizeSpaces(header.textContent),
      hidden: isHidden(header)
    }));
  }

  function findMedHeader(headers) {
    const candidates = headers.filter((header) => header.text === "MED");
    return candidates.find((header) => !header.hidden) || candidates[0] || null;
  }

  function readMedStateFromRow(tr, headers) {
    const medHeader = findMedHeader(headers);
    if (!medHeader || !tr) {
      return {
        medColumnIndex: medHeader?.columnIndex ?? null,
        medText: "",
        medStatus: "Estado MED no disponible"
      };
    }

    const cell = tr.querySelector(`td[colindex="${CSS.escape(String(medHeader.columnIndex))}"]`) ||
      Array.from(tr.cells || [])[medHeader.position];
    const medText = getCellText(cell);

    return {
      medColumnIndex: medHeader.columnIndex,
      medText,
      medStatus: medText ? `Estado MED: ${medText}` : "Estado MED no disponible"
    };
  }

  function createEmptyMedState(headers) {
    const medHeader = findMedHeader(headers);
    return {
      medColumnIndex: medHeader?.columnIndex ?? null,
      medText: "",
      medStatus: "Estado MED no disponible"
    };
  }

  function parseGridDataRows() {
    const hidden = document.querySelector("input[name='GridContainerDataV']");
    if (!hidden?.value) return [];
    const headers = getGridHeaders();
    const medState = createEmptyMedState(headers);

    try {
      const rows = JSON.parse(decodeHtml(hidden.value));
      return rows.map((row, index) => {
        const values = Array.isArray(row) ? row.map((item) => String(item ?? "")) : [];
        const displayNumber = values.map(extractAuthorization).find(Boolean) || "";
        return {
          rowIndex: index + 1,
          rowId: String(index + 1).padStart(4, "0"),
          displayNumber,
          authorizationNumber: normalizeAuthorization(displayNumber),
          date: values.find((value) => /\b\d{2}\/\d{2}\/\d{2,4}\b/.test(value)) || "",
          medColumnIndex: medState.medColumnIndex,
          medText: medState.medText,
          medStatus: medState.medStatus,
          headerTexts: headers.map((header) => header.text)
        };
      }).filter((row) => row.authorizationNumber);
    } catch (error) {
      console.warn("[Asistente SIOS Compra] No se pudo interpretar GridContainerDataV", error);
      return [];
    }
  }

  function parseVisibleControlsRows() {
    const headers = getGridHeaders();
    const controls = Array.from(document.querySelectorAll(
      "input[id^='vMODIFICAR_'], input[id^='vVISUALIZAR_'], input[id^='vDETALLES_']"
    ));
    const rowsById = new Map();
    const controlsByRowId = new Map();

    for (const button of controls) {
      const match = button.id.match(/_(\d{4})$/);
      if (!match) continue;

      const rowId = match[1];
      const rowControls = controlsByRowId.get(rowId) || [];
      rowControls.push(button.id);
      controlsByRowId.set(rowId, rowControls);
      if (!rowsById.has(rowId)) {
        rowsById.set(rowId, button.closest("tr"));
      }
    }

    const rows = Array.from(rowsById.entries()).map(([rowId, tr]) => {
      const cells = tr ? Array.from(tr.cells || []) : [];
      const cellTexts = cells.map(getCellText);
      const rowText = cellTexts.join(" | ");
      const displayNumber = extractAuthorization(rowText);
      const date = cellTexts.find((value) => /\b\d{2}\/\d{2}\/\d{2,4}\b/.test(value)) || "";
      const medState = readMedStateFromRow(tr, headers);

      return {
        rowIndex: Number(rowId),
        rowId,
        displayNumber,
        authorizationNumber: normalizeAuthorization(displayNumber),
        date,
        medColumnIndex: medState.medColumnIndex,
        medText: medState.medText,
        medStatus: medState.medStatus,
        headerTexts: headers.map((header) => header.text)
      };
    }).filter((row) => row?.authorizationNumber);

    rows.actionControlCount = controls.length;
    rows.duplicatedControls = Array.from(controlsByRowId.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([rowId, controlIds]) => ({ rowId, controlIds }));

    return rows;
  }

  function dedupeRows(rows) {
    const byRowId = new Map();
    const duplicatedControls = [];

    for (const row of rows) {
      if (!byRowId.has(row.rowId)) {
        byRowId.set(row.rowId, row);
      } else {
        duplicatedControls.push({
          rowId: row.rowId,
          authorizationNumber: row.displayNumber || row.authorizationNumber
        });
      }
    }

    const byAuthorization = new Map();
    for (const row of byRowId.values()) {
      const key = row.displayNumber || row.authorizationNumber;
      const group = byAuthorization.get(key) || [];
      group.push(row);
      byAuthorization.set(key, group);
    }

    const duplicateRowsByAuthorization = Array.from(byAuthorization.entries())
      .filter(([, group]) => group.length > 1)
      .map(([authorizationNumber, group]) => ({
        authorizationNumber,
        rowIds: group.map((row) => row.rowId)
      }));

    const result = [];
    for (const group of byAuthorization.values()) {
      result.push(...group);
    }

    lastListDiagnostic = {
      actionControlCount: rows.actionControlCount || rows.length,
      rowCountBeforeDedup: rows.length,
      resultCountBeforeDedup: rows.actionControlCount || rows.length,
      resultCountAfterDedup: result.length,
      duplicatedControls: rows.duplicatedControls || duplicatedControls,
      duplicateRowsByAuthorization
    };

    return result;
  }

  function listarAutorizaciones() {
    const visible = parseVisibleControlsRows();
    if (visible.length > 0) return dedupeRows(visible);
    return dedupeRows(parseGridDataRows());
  }

  function getOpenButton(rowId) {
    return document.getElementById(`vMODIFICAR_${rowId}`) ||
      document.getElementById(`vVISUALIZAR_${rowId}`) ||
      document.getElementById(`vDETALLES_${rowId}`);
  }

  function abrirAutorizacionExacta(rowId) {
    const row = listarAutorizaciones().find((item) => item.rowId === rowId);
    if (!row) throw new Error("La autorización seleccionada ya no está disponible.");

    const button = getOpenButton(row.rowId);
    if (!button) throw new Error(`No se encontró el botón para abrir la fila ${row.rowId}.`);

    button.click();
    return { status: "opened", message: "Autorización abierta.", row };
  }

  function obtenerControlAperturaAutorizacion(rowId) {
    return getOpenButton(rowId)?.id || "";
  }

  function buscarAutorizacionPorUltimosTres(suffix) {
    if (!/^\d{3}$/.test(suffix)) {
      throw new Error("Ingrese exactamente los últimos 3 dígitos.");
    }

    const rows = listarAutorizaciones();
    const matches = rows.filter((row) => row.authorizationNumber.endsWith(suffix));
    const duplicateMatchedAuthorizations = matches.reduce((items, row) => {
      const same = rows.filter((item) =>
        item.authorizationNumber === row.authorizationNumber && item.rowId !== row.rowId
      );
      const key = row.displayNumber || row.authorizationNumber;
      if (same.length > 0 && !items.some((item) => item.authorizationNumber === key)) {
        items.push({
          authorizationNumber: key,
          rowIds: [row.rowId, ...same.map((item) => item.rowId)]
        });
      }
      return items;
    }, []);

    lastLookupDiagnostic = {
      suffix,
      authorizationNumber: matches.length === 1 ? matches[0].displayNumber || matches[0].authorizationNumber : "",
      medColumnIndex: matches.length === 1 ? matches[0].medColumnIndex : null,
      medText: matches.length === 1 ? matches[0].medText : "",
      headerTexts: rows[0]?.headerTexts || getGridHeaders().map((header) => header.text),
      actionControlCount: lastListDiagnostic.actionControlCount,
      rowCountBeforeDedup: lastListDiagnostic.rowCountBeforeDedup,
      resultCountBeforeDedup: lastListDiagnostic.resultCountBeforeDedup,
      resultCountAfterDedup: lastListDiagnostic.resultCountAfterDedup,
      duplicatedControls: lastListDiagnostic.duplicatedControls,
      duplicateRowsByAuthorization: lastListDiagnostic.duplicateRowsByAuthorization,
      duplicateMatchedAuthorizations
    };

    if (matches.length === 0) {
      return {
        status: "none",
        message: "No hay autorizaciones visibles con esos últimos 3 dígitos.",
        matches: []
      };
    }

    if (matches.length > 1) {
      return {
        status: "multiple",
        message: "Hay más de una coincidencia. Seleccione la autorización correcta; todavía no se abrirá.",
        matches
      };
    }

    const row = matches[0];
    return {
      status: "selected",
      message: `Autorización encontrada: ${row.displayNumber || row.authorizationNumber}.\n${row.medStatus}\nSeleccione el elemento para abrirla y trabajar en ella.`,
      matches,
      selected: row
    };
  }

  SIOS.listarAutorizaciones = listarAutorizaciones;
  SIOS.buscarAutorizacionPorUltimosTres = buscarAutorizacionPorUltimosTres;
  SIOS.abrirAutorizacionExacta = abrirAutorizacionExacta;
  SIOS.obtenerControlAperturaAutorizacion = obtenerControlAperturaAutorizacion;
  SIOS.obtenerDiagnosticoAutorizacion = () => lastLookupDiagnostic || {
    authorizationNumber: "",
    medColumnIndex: null,
    medText: "",
    headerTexts: getGridHeaders().map((header) => header.text),
    actionControlCount: lastListDiagnostic.actionControlCount,
    rowCountBeforeDedup: lastListDiagnostic.rowCountBeforeDedup,
    resultCountBeforeDedup: lastListDiagnostic.resultCountBeforeDedup,
    resultCountAfterDedup: lastListDiagnostic.resultCountAfterDedup,
    duplicatedControls: lastListDiagnostic.duplicatedControls,
    duplicateRowsByAuthorization: lastListDiagnostic.duplicateRowsByAuthorization
  };
})();
