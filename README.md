# Asistente SIOS Compra

Extensión para Firefox y Chrome destinada a asistir la carga de compras dentro de SIOS de IAPOS.

## Estado de esta entrega

- Versión: `0.11.0`.
- El panel permanece oculto por defecto y se abre desde un botón con ícono de carrito.
- El panel es redimensionable y recuerda el ancho y el scroll durante la sesión.
- Paso 1: busca DNI desde cualquier pantalla de SIOS. Si hace falta, navega a `Auditoria Medica Autorizaciones`, completa filtros y ejecuta `Buscar`.
- Paso 2: verifica autorizacion por ultimos tres digitos, deduplica filas repetidas y muestra exclusivamente el estado de la columna `MED`.
- Paso 3: aplica plantillas sobre la autorizacion seleccionada, sin abrirla durante el paso 2.
- La autorizacion se abre recien al pulsar una plantilla.
- Diagnostico permanece plegado por defecto y puede copiarse.
- No guarda DNI, nombres de afiliados, tokens, cookies ni datos medicos sensibles.
- Nunca confirma ni imprime automáticamente: esas acciones requieren la intervención explícita de la persona usuaria.

## Flujo real implementado para plantillas

Secuencia:

1. El usuario busca el afiliado y selecciona la autorizacion en el paso 2.
2. El paso 2 solo informa `Estado MED` y deja seleccionada la autorizacion; no la abre.
3. Al pulsar una plantilla, el listado abre la autorizacion con el primer lapiz `vMODIFICAR_XXXX`.
4. La accion pendiente queda en `sessionStorage` durante la navegacion GeneXus.
5. Al cargar el detalle, se verifica el numero interno de la autorizacion abierta.
6. Se localiza la fila de prestacion con codigo `000100` y descripcion normalizada `ELEM MEDICO A CODIFICAR`.
7. Se pulsa una sola vez el segundo lapiz `vEDITAR_XXXX` de esa fila.
8. Se espera el formulario editable real, no la sola presencia de la grilla.
9. Se escribe el codigo de plantilla en `#vEDITNONOCODIGO`.
10. Primero se espera un desplegable/autocompletado visible asociado al campo.
11. Si el desplegable contiene una unica coincidencia exacta por codigo y descripcion esperada, se selecciona esa opcion.
12. Si no hay desplegable accesible, no hay coincidencia exacta o la seleccion falla, recien entonces se pulsa una sola vez `#IMG_SELPRA`.
13. En la ruta alternativa se espera el popup exterior `#gxp0_b` con titulo `Seleccionar Practica por Especialidad o General`.
14. Se espera el iframe `#gxp0_ifrm` cuyo origen es `nmpromptmultiple` y se accede a su `contentDocument`.
15. Dentro del iframe se detectan dinamicamente campo `Descripcion`, selector `Especialidad`, boton `Buscar` y tabla de resultados.
16. Se completa la descripcion de busqueda configurada y la especialidad configurada.
17. Se pulsa `Buscar` dentro del iframe.
18. Se leen las filas resultantes por indice dinamico de columnas `Codigo` y `Descripcion`.
19. Se selecciona una unica coincidencia exacta por codigo y, si hay multiples filas con el mismo codigo, por descripcion.
20. Si no hay coincidencia exacta o hay varias coincidencias exactas ambiguas, la extension se detiene.
21. Despues de seleccionar, se verifica que `#vEDITNONOCODIGO` tenga el codigo esperado y que `#span_vEDITNOMEDESBRE` haya cambiado desde `ELEM MEDICO A CODIFICAR`.
22. Se completa cantidad en `#vEDITCANPRE`, respetando el formato actual del campo.
23. Se completa observacion solo si la plantilla la trae y la practica fue seleccionada correctamente.
24. Se guarda la prestacion con `#vCONFIRMAR`.
25. Se verifica en la grilla que el codigo final, descripcion y cantidad coincidan.
26. La accion pendiente se elimina al completar o al detenerse por error.

## Maquina de estados de ejecucion

La ejecucion de plantillas registra estos estados en diagnostico:

- `AUTH_SELECTED`
- `OPENING_AUTH`
- `AUTH_DETAIL_READY`
- `OPENING_ITEM_EDIT`
- `ITEM_EDIT_READY`
- `ENTERING_CODE`
- `WAITING_AUTOCOMPLETE`
- `SELECTING_AUTOCOMPLETE`
- `OPENING_PRACTICE_MODAL`
- `PRACTICE_MODAL_READY`
- `SEARCHING_MODAL`
- `SELECTING_MODAL_RESULT`
- `PRACTICE_SELECTED`
- `FILLING_QUANTITY`
- `SAVING_ITEM`
- `VERIFYING_ITEM`
- `COMPLETED`
- `ERROR`

## Plantillas

Un perfil nuevo comienza sin plantillas. Se pueden crear desde el panel o importar un respaldo JSON exportado previamente. Las plantillas se guardan en el almacenamiento local del navegador.

Cada item admite:

- `codigo`
- `descripcion`
- `descripcionBusquedaModal`
- `especialidadModal`
- `cantidad`
- `observacion`
- `codigoSeleccionModal` legado/opcional
- `descripcionSeleccionModal` opcional para desambiguar multiples filas con el mismo codigo
- `orden`

## Selectores confirmados

Busqueda:

- DNI / numero de afiliado: `#vAUCANROAFI_NUMERO_AFILIADO`
- Requiere compra: `#vREQCOMPRA`
- Ver todas: `#vNFLGVISTA`, valor `0`
- Modalidad Autorizacion Previa: `#vMODALIDAD`, valor `1`
- Buscar: `[name="SEARCHBUTTON"]`
- Datos de grilla: `[name="GridContainerDataV"]`
- Primer lapiz de listado: `#vMODIFICAR_0001`, `#vMODIFICAR_0002`, etc.

Detalle / prestaciones:

- Grilla de prestaciones: `#Grid1ContainerTbl`
- Fila pendiente: `#span_vNONOCODIGO_XXXX`, valor `000100`
- Descripcion pendiente: `#span_vNOMEDESBRE_XXXX`, valor `ELEM MEDICO A CODIFICAR`
- Segundo lapiz de prestacion: `#vEDITAR_0001`, `#vEDITAR_0002`, etc.
- Codigo editable: `#vEDITNONOCODIGO`
- Boton selector de practica: `#IMG_SELPRA`
- Combo GeneXus asociado: `#vEDITPRACOMP`
- Descripcion validada: `#span_vEDITNOMEDESBRE`
- Cantidad editable: `#vEDITCANPRE`
- Observacion: `#vEDITAUDAOBS`
- Tipo lente / lateralidad: `#vEDITAUDATIPLEN`
- Guardar prestacion: `#vCONFIRMAR`
- Agregar practica: `#vAGREGAR` existe, pero no se usa para modificar la fila `000100`.
- Confirmar final: `BTNCONFIRMAR` existe, pero la extension no lo pulsa.
- Imprimir: `#vBIMPRIMIR` existe, pero la extension no lo pulsa.

Popup de practica:

- Popup exterior: `#gxp0_b`
- Titulo: `#gxp0_gxtitle`
- Iframe: `#gxp0_ifrm`
- URL del iframe: contiene `nmpromptmultiple`
- Dentro del iframe no se usan IDs fijos inventados; los controles se detectan por label, texto visible, `id`, `name`, `title` y relacion estructural.

## Diagnostico

El diagnostico de plantillas registra:

- autorizacion seleccionada;
- primer lapiz pulsado y cantidad de clics;
- fila `000100` encontrada;
- segundo lapiz pulsado y cantidad de clics;
- formulario editable detectado;
- valor inicial del codigo;
- valor inicial de la descripcion;
- codigo escrito;
- desplegable detectado;
- cantidad de opciones del desplegable;
- opciones del desplegable;
- coincidencia seleccionada del desplegable;
- clic en `IMG_SELPRA`;
- uso del modal;
- popup exterior detectado;
- iframe detectado;
- iframe cargado;
- acceso a `contentDocument` correcto o error;
- etiquetas y campos encontrados dentro del iframe;
- texto de busqueda usado;
- especialidad seleccionada;
- clic en Buscar dentro del iframe;
- cantidad de filas obtenidas;
- codigos y descripciones encontrados, sin datos personales;
- fila seleccionada;
- cierre del popup;
- codigo y descripcion despues del modal;
- cantidad aplicada;
- clic en `vCONFIRMAR` de la prestacion;
- codigo y cantidad verificados en la grilla;
- etapa exacta del error.

## Casos revisados

- Una sola coincidencia de autorizacion: el paso 2 selecciona y no abre.
- Una plantilla creada o importada conserva sus items y valores configurados.
- El editor permite crear, editar, guardar, eliminar y agregar varios items a una plantilla.
- Modal con una coincidencia exacta: selecciona esa opcion.
- Modal con varias opciones: si varias coinciden exactamente, se detiene.
- Modal sin coincidencia: se detiene y muestra opciones seguras en diagnostico.
- Desplegable con una coincidencia exacta: se usa antes del modal.
- Desplegable sin coincidencia: pasa a la ruta alternativa del modal.
- Desplegable con varias coincidencias exactas: se detiene.
- Formulario sin descripcion validada: se detiene.
- Timeout de detalle, formulario, modal, cierre o guardado: se detiene con etapa exacta.
- Doble clic en lapices: el primer lapiz se registra desde el listado y el segundo `vEDITAR_XXXX` se pulsa solo una vez sobre la fila `000100`.
- Confirmacion general: no se usa `BTNCONFIRMAR`.
- Impresion: no se usa `#vBIMPRIMIR`.

## Instalacion temporal en Firefox

1. Abrir Firefox.
2. Ir a `about:debugging#/runtime/this-firefox`.
3. Pulsar `Cargar complemento temporal`.
4. Seleccionar `manifest.json` dentro de esta carpeta.
5. Entrar a SIOS. El boton lateral `SIOS` queda visible en el borde izquierdo.

## Verificación antes de publicar una versión

1. Probar una carga real con un item y otra con varios items.
2. Comprobar creación, edición, eliminación, exportación e importación de plantillas.
3. Probar cancelación y un error de verificación, confirmando que nunca se ejecute la confirmación o impresión automáticamente.
4. Ejecutar `powershell -ExecutionPolicy Bypass -File .\herramientas\actualizar-codigos.ps1` si se modificó `codigos-elementos.csv`.
5. Incrementar `version` en `manifest.json` antes de generar el próximo paquete para Firefox o Chrome.

## Privacidad

La extension no guarda DNI, nombres de afiliados, cookies ni tokens. Las plantillas se guardan en almacenamiento local de Firefox; los DNI y acciones pendientes de navegacion usan `sessionStorage` y se eliminan al ejecutar, completar o cancelar el flujo.

## Cambios de la version 0.7.0

- Renombre visible a `Asistente SIOS Compra`.
- Implementacion de maquina de estados para aplicar plantillas.
- Se pulsa explicitamente `#IMG_SELPRA` despues de ingresar el codigo.
- El codigo no se considera validado por `change`, `blur` ni por una descripcion previa.
- El modal/selector exige coincidencia exacta por codigo y opcionalmente descripcion.
- Si hay multiples coincidencias exactas o ninguna, se detiene con diagnostico.
- La fila `000100 / ELEM MEDICO A CODIFICAR` se edita con un solo clic en `vEDITAR_XXXX`.
- La accion pendiente sobrevive a la navegacion GeneXus y se elimina solo al completar o fallar.

## Cambios de la version 0.7.1

- El selector de practicas ahora usa el popup GeneXus real `#gxp0_b` y el iframe `#gxp0_ifrm`.
- Se accede al DOM interno del iframe `nmpromptmultiple` con `contentDocument`.
- La busqueda de malla usa `descripcionBusquedaModal: MALLA` y `especialidadModal: ELEMENTOS MEDICOS`.
- La seleccion de practica lee filas dentro del iframe, detectando dinamicamente columnas `Codigo` y `Descripcion`.
- La extension se detiene si no puede acceder al iframe, si no aparece `080213`, o si hay multiples coincidencias ambiguas.
- Diagnostico ampliado con popup, iframe, campos encontrados, filas leidas y fila seleccionada.

## Cambios de la version 0.7.2

- La ruta principal tras escribir el codigo ahora es el desplegable/autocompletado GeneXus accesible en DOM.
- `#IMG_SELPRA` y el popup con iframe quedan como ruta alternativa, no obligatoria.
- Se agregan estados `ENTERING_CODE`, `WAITING_AUTOCOMPLETE`, `SELECTING_AUTOCOMPLETE`, `OPENING_PRACTICE_MODAL`, `SEARCHING_MODAL`, `SELECTING_MODAL_RESULT` y `FILLING_QUANTITY`.
- Se elimina seleccion aproximada de descripcion: codigo, descripcion y cantidad se validan de forma normalizada y exacta.
- La cantidad respeta el formato actual del campo editable antes de guardar.
- La verificacion final controla codigo, descripcion y cantidad en la grilla.

## Cambios visuales 0.10.1

- Panel acoplado al borde izquierdo, con ancho inicial de 200 px y redimensionado horizontal.
- La página de SIOS se desplaza mientras el panel está abierto y recupera el ancho completo al cerrarlo.
- Barra lateral preparada para futuros asistentes; el acceso actual usa un icono de Compras.
- Cabecera compacta sin subtítulo.
- Búsqueda de afiliado y verificación de autorización mediante iconos con tooltips.
- Al completar el DNI con Enter, se ejecuta la búsqueda y el foco pasa a Últimos 3 dígitos cuando finaliza.
- Buscador en vivo de plantillas por nombre, código, descripción, observación o categoría, con botón para limpiar.
- Plantillas compactas en una línea, lista con desplazamiento propio e icono coherente para editar antes de aplicar.
- Pasos 1 a 4 visibles; Estado, Administración de plantillas y Diagnóstico colapsados por defecto.
- Estado resumido en el encabezado: Esperando, Listo o Error.
- No se modificó la lógica de automatización de SIOS.
