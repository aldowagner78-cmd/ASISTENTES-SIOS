(async function () {
  "use strict";

  if (window.__ASISTENTE_SIOS_INICIADO__) {
    return;
  }
  window.__ASISTENTE_SIOS_INICIADO__ = true;

  const SIOS = window.AsistenteSIOS;
  const extensionApi = globalThis.browser || globalThis.chrome;
  const host = document.createElement("div");
  host.id = "asistente-sios-host";
  const shadow = host.attachShadow({ mode: "open" });

  const [html, css] = await Promise.all([
    fetch(extensionApi.runtime.getURL("src/ui/panel.html")).then((response) => response.text()),
    fetch(extensionApi.runtime.getURL("src/ui/panel.css")).then((response) => response.text())
  ]);

  const style = document.createElement("style");
  style.textContent = css;
  const panelDocument = new DOMParser().parseFromString(html, "text/html");
  const panelFragment = document.createDocumentFragment();
  while (panelDocument.body.firstChild) {
    panelFragment.append(panelDocument.body.firstChild);
  }
  shadow.append(style, panelFragment);
  document.documentElement.append(host);

  await SIOS.inicializarPanel(shadow, host);
})();
