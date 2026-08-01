(function () {
  "use strict";

  const BUSQUEDA_IDS = [
    "vAUCANROAFI_NUMERO_AFILIADO",
    "vREQCOMPRA",
    "vNFLGVISTA",
    "vMODALIDAD"
  ];

  const DETALLE_IDS = [
    "span_CTLANUMINT_NUMERO_INTERNO",
    "Grid1ContainerTbl",
    "vEDITNONOCODIGO",
    "vEDITCANPRE",
    "vCONFIRMAR"
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function hasAll(ids) {
    return ids.every((id) => Boolean(byId(id)));
  }

  function getScreen() {
    const formAction = document.forms.MAINFORM?.getAttribute("action") || "";
    const title = byId("TITLETEXT")?.textContent?.trim() || document.title || "";

    if (hasAll(BUSQUEDA_IDS) || /auauditcabe_ww/i.test(formAction)) {
      return {
        type: "busqueda",
        label: "Busqueda de autorizaciones",
        title,
        formAction
      };
    }

    if (hasAll(DETALLE_IDS) || /auautorizacion/i.test(formAction)) {
      return {
        type: "detalle",
        label: "Detalle de autorizacion",
        title,
        formAction
      };
    }

    return {
      type: "desconocida",
      label: "Pantalla no reconocida",
      title,
      formAction
    };
  }

  function describeControl(id) {
    const el = byId(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
    if (!el) {
      return { id, found: false };
    }

    const item = {
      id,
      found: true,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      name: el.getAttribute("name") || "",
      visible: Boolean(el.offsetParent) && getComputedStyle(el).display !== "none"
    };

    if (el.tagName === "SELECT") {
      item.options = Array.from(el.options).map((option) => ({
        value: option.value,
        text: option.textContent.trim()
      }));
    }

    return item;
  }

  function getDiagnostics() {
    const watched = [
      "vAUCANROAFI_NUMERO_AFILIADO",
      "vREQCOMPRA",
      "vNFLGVISTA",
      "vMODALIDAD",
      "SEARCHBUTTON",
      "GridContainerDataV",
      "vMODIFICAR_0001",
      "vVISUALIZAR_0001",
      "BTNCONFIRMAR",
      "vBIMPRIMIR",
      "Grid1ContainerTbl",
      "vEDITAR_0001",
      "span_vNONOCODIGO_0001",
      "span_vNOMEDESBRE_0001",
      "span_vAUDACANPRE_CANTIDAD_PRESTACION_0001",
      "vEDITNONOCODIGO",
      "vEDITCANPRE",
      "vEDITAUDATIPLEN",
      "vEDITAUDADISDER",
      "vEDITAUDADISIZQ",
      "vEDITAUDAREQPRI",
      "vAGREGAR",
      "vCONFIRMAR"
    ];

    return {
      screen: getScreen(),
      authorizationLookup: window.AsistenteSIOS?.obtenerDiagnosticoAutorizacion?.() || null,
      controls: watched.map(describeControl)
    };
  }

  window.AsistenteSIOS = window.AsistenteSIOS || {};
  window.AsistenteSIOS.detectarPantalla = getScreen;
  window.AsistenteSIOS.obtenerDiagnostico = getDiagnostics;
})();
