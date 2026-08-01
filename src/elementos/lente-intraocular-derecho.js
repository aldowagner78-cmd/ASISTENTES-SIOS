(function () {
  "use strict";

  window.AsistenteSIOSElementos = window.AsistenteSIOSElementos || {};

  window.AsistenteSIOSElementos.lenteIntraocularDerecho = {
    id: "lente-intraocular-derecho",
    nombre: "Lente intraocular - ojo derecho",
    estado: "pendiente-configuracion",
    pendientes: [
      "Codigo medico exacto para lente intraocular derecho",
      "Confirmar si debe cargarse como practica unica o varios codigos",
      "Confirmar observaciones requeridas, si correspondieran"
    ],
    resumen: [
      "Lateralidad: DERECHO, valor detectado en vEDITAUDATIPLEN = D",
      "Cantidad: pendiente de confirmar por codigo",
      "No pulsa Confirmar ni Imprimir"
    ],
    acciones: [
      {
        tipo: "campo",
        selector: "#vEDITNONOCODIGO",
        valor: null,
        pendiente: "codigo-medico"
      },
      {
        tipo: "campo",
        selector: "#vEDITCANPRE",
        valor: "1,00",
        pendiente: "confirmar-cantidad"
      },
      {
        tipo: "select",
        selector: "#vEDITAUDATIPLEN",
        valor: "D",
        texto: "DERECHO"
      },
      {
        tipo: "click",
        selector: "#vAGREGAR",
        descripcion: "Guardar/agregar practica",
        requiereConfirmacionResumen: true
      }
    ]
  };
})();
