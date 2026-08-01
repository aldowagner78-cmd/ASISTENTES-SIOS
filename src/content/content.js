(async function () {
  "use strict";

  if (window.__ASISTENTE_SIOS_INICIADO__) {
    return;
  }
  window.__ASISTENTE_SIOS_INICIADO__ = true;

  const SIOS = window.AsistenteSIOS;
  const host = document.createElement("div");
  host.id = "asistente-sios-host";
  const shadow = host.attachShadow({ mode: "open" });

  const [html, css] = await Promise.all([
    fetch(browser.runtime.getURL("src/ui/panel.html")).then((response) => response.text()),
    fetch(browser.runtime.getURL("src/ui/panel.css")).then((response) => response.text())
  ]);

  const style = document.createElement("style");
  style.textContent = css;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  shadow.append(style, wrapper);
  document.documentElement.append(host);

  await SIOS.inicializarPanel(shadow, host);
})();
