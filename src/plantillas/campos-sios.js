(function () {
  "use strict";

  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};

  SIOS.CAMPOS_PLANTILLA_SIOS = {
    detalleRequeridos: [
      "#Grid1ContainerTbl"
    ],
    grillaPrestaciones: "#Grid1ContainerTbl",
    filaPrestacion: "#Grid1ContainerRow_",
    codigoFilaPrefijo: "span_vNONOCODIGO_",
    descripcionFilaPrefijo: "span_vNOMEDESBRE_",
    cantidadFilaPrefijo: "span_vAUDACANPRE_CANTIDAD_PRESTACION_",
    modificarPrestacionPrefijo: "vEDITAR_",
    codigo: "#vEDITNONOCODIGO",
    cantidad: "#vEDITCANPRE",
    guardarPrestacion: "#vCONFIRMAR",
    agregar: "#vAGREGAR",
    selectorPractica: "#IMG_SELPRA",
    validarPractica: "#IMGPRACTICA",
    comboPractica: "#vEDITPRACOMP",
    descripcionValidada: "#span_vEDITNOMEDESBRE",
    observacion: "#vEDITAUDAOBS",
    lateralidad: "#vEDITAUDATIPLEN",
    mensajeCompra: "#span_vMENSAJECOMPRA",
    prioridadCompra: "#vEDITAUDAREQPRI",
    lugarEntregaCompra: "#vEDITAUDAREQLUG",
    descripcionProtesisCompra: "#vEDITAUDADEDPRO",
    fechaEntregaCompra: "#vEDITAUDAFECENT",
    reposicionUrgenciaCompra: "#vEDITAUDAREPURG",
    numeroInterno: "#span_CTLANUMINT_NUMERO_INTERNO",
    delegacion: "#span_CTLDELEGACION",
    confirmar: "[name='BTNCONFIRMAR']",
    imprimir: "#vBIMPRIMIR"
  };
})();
