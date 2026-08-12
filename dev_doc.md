# Wave Link Control — documentación técnica

Documentación a nivel de código del plugin `com.raikerdev.wave_link.sdPlugin`.
Para el uso del plugin ver [README.es.md](README.es.md). Para ideas de versiones
futuras, [ROADMAP.md](ROADMAP.md).

Si es la primera vez que tocás esto, arrancá por el [glosario](#glosario).

## Glosario

Vocabulario del SDK de StreamDock y de Wave Link, en castellano llano. No están
los términos generales de programación, solo los que significan algo particular
acá.

### El aparato y la aplicación

**Stream Dock** — el aparato físico (en este caso un AJAZZ AKP05E) y también la
aplicación de escritorio que lo maneja. Cuando la documentación dice *el host*,
se refiere a la aplicación: es la que arranca los plugins, les manda los eventos
de las teclas y les dibuja la pantalla de configuración.

**Tecla / key** — cada uno de los botones cuadrados con pantallita. El AKP05E
tiene 10.

**Dial / encoder** — cada una de las perillas que giran **y** se pueden apretar.
El AKP05E tiene 4. Girar y apretar son eventos distintos.

**Tick / detente** — un "click" del dial. Al girar, el host no te dice el ángulo,
te dice cuántos ticks se movió y para qué lado (`+3` = tres clicks a la derecha).
Si girás rápido te llegan varios ticks en un solo evento.

**Canvas / lienzo** — la grilla de teclas que ves en la aplicación, donde
arrastrás las acciones. Su tamaño depende del dispositivo (acá 5 columnas × 3
filas).

**Escena / perfil** — un juego guardado de qué acción está en cada tecla. Podés
tener varias y cambiar entre ellas.

**Lista de plugins** — la barra lateral de la aplicación con todos los plugins
instalados y sus acciones.

### Las piezas de un plugin

**Plugin** — un paquete que agrega funciones nuevas a la aplicación. Es
literalmente una carpeta con un nombre que termina en `.sdPlugin`, copiada dentro
de la carpeta de plugins de Stream Dock.

**`.sdPlugin`** — el sufijo obligatorio de esa carpeta. `com.raikerdev.wave_link.sdPlugin`
es "el plugin", y lo de adelante es su identificador único.

**`manifest.json`** — la ficha del plugin. Declara cómo se llama, qué acciones
trae, qué iconos usa, qué programa ejecutar y qué versión mínima de la aplicación
necesita. Si algo no está acá, para la aplicación no existe.

**Acción** — cada cosa que el usuario puede arrastrar a una tecla o a un dial.
Este plugin trae dos: *Volume Knob* y *Mute Toggle*. Ojo con la ambigüedad: en el
código, "acción" es tanto el tipo (la plantilla) como el objeto `Actions` que la
implementa.

**Categoría** — el grupo bajo el que aparecen tus acciones en la lista lateral.
Acá es "Wave Link". Si no ponés ninguna, caen en "Custom".

**UUID de la acción** — el identificador de cada acción, en formato de dominio al
revés: `com.raikerdev.wave_link.volumeknob`. **Importante en este SDK**: el
framework reparte los eventos usando el **último pedacito** del UUID
(`volumeknob`), así que ese pedacito tiene que ser igual al nombre de la
propiedad en el código (`plugin.volumeknob`).

**Instancia** — una copia concreta de una acción puesta en una tecla concreta. Si
ponés *Mute Toggle* en tres teclas, hay una acción y tres instancias, cada una
con su propia configuración.

**`context`** — el código que identifica a una instancia. Es el "a quién" de todo:
cuando querés cambiarle el icono a una tecla, le mandás su `context`. Te llega en
cada evento; no lo inventás vos.

**Controller** — qué clase de control acepta una acción. Dos valores:
`"Keypad"` (teclas) y `"Knob"` (diales). Se declara en el manifest y define dónde
te deja soltarla el usuario. Ojo: en el SDK original de Elgato esto se llama
`"Encoder"`; acá es `"Knob"`.

**Estado / state** — las "caras" que puede mostrar una acción. *Mute Toggle*
tiene dos (con sonido y muteado), y el código elige cuál se ve con `setState`.
Se declaran en el manifest como una lista, y se numeran desde 0.

**`DisableAutomaticStates`** — puesto en `true`, le dice a la aplicación "no
cambies el estado vos sola cuando aprieten la tecla, yo lo manejo". Sin esto, la
aplicación alterna las caras por su cuenta y se desincroniza de la realidad.

**Título** — el texto que el usuario puede escribirle encima a una tecla. Lo
maneja la aplicación; el plugin puede pisarlo con `setTitle`, pero acá no lo
hacemos a propósito, para dejárselo libre al usuario.

### La pantalla de configuración

**Property Inspector (PI)** — la pantalla de configuración que aparece cuando
seleccionás una tecla. Es una página web común (HTML + CSS + JavaScript) que la
aplicación abre en un navegador embebido. En este plugin es la de los dos
desplegables Tipo y Destino.

**Chrome del host** — la parte de arriba de ese panel (el icono, el campo
"Título", el nombre de la acción, el tacho de basura) **no es tuya**: la dibuja la
aplicación igual para todos los plugins. Vos solo controlás lo que va debajo.

**`sdpi`** — abreviatura de *Stream Deck Property Inspector*. Aparece como
prefijo en clases de CSS (`sdpi-wrapper`) y en un archivo `sdpi.css` que traen
otros templates del SDK. Este plugin usa Bootstrap en lugar de `sdpi.css`, pero
mantiene la clase `sdpi-wrapper` como contenedor por convención.

**Settings** — la configuración guardada de **una instancia**. Acá es
`{targetType, targetId, targetName}`. La guarda la aplicación, sobrevive a
reinicios y viene incluida en casi todos los eventos.

**Global Settings** — configuración de **todo el plugin**, compartida por todas
las instancias (por ejemplo, una clave de API). Este plugin no usa ninguna.

### Cómo se hablan las partes

**Evento** — cada mensaje que se mandan la aplicación y el plugin. Van en JSON por
un WebSocket. Se dividen en *recibidos* (la aplicación te avisa algo) y *enviados*
(vos le pedís algo).

**`registerEvent` / registro** — el saludo inicial. La aplicación arranca tu
proceso pasándole un puerto y un código; vos te conectás y mandás ese código para
identificarte. Hasta que no lo hacés, no existís para la aplicación.

**`willAppear` / `willDisappear`** — "esta instancia se volvió visible / dejó de
verse". Pasa al abrir la aplicación, al cambiar de escena o al arrastrar la
acción. Es el momento de pintar el estado inicial correcto.

**`keyDown` / `keyUp`** — apretaron y soltaron una tecla. Se suele actuar en
`keyUp` para que se pueda cancelar arrastrando el dedo.

**`dialRotate` / `dialDown` / `dialUp`** — giraron el dial, lo apretaron, lo
soltaron. `dialRotate` trae los ticks.

**`didReceiveSettings`** — "la configuración de esta instancia cambió". Llega,
por ejemplo, cuando el usuario elige otra cosa en la pantalla de configuración.

**`sendToPlugin`** — mensaje de la pantalla de configuración **hacia** el proceso
del plugin. El contenido lo inventás vos; acá mandamos `{type: 'getTargets'}`.

**`sendToPropertyInspector`** — el camino de vuelta, del plugin hacia la pantalla
de configuración. Acá contestamos con la lista de destinos.

**`propertyInspectorDidAppear` / `DidDisappear`** — "el usuario abrió / cerró la
pantalla de configuración". Sirve para saber si hay alguien escuchando.

**`setState`, `setTitle`, `setImage`** — pintarle a una tecla la cara, el texto o
una imagen propia (podés mandar un SVG o un PNG en base64).

**`showAlert` / `showOk`** — hacerle parpadear a la tecla una cruz o un tilde.
Es la forma estándar de decir "falló" o "listo" sin abrir ninguna ventana.

### Cosas del build

**`SDKVersion`** — la versión del formato de plugin que declarás en el manifest.
Acá `1`, probado y funcionando.

**`CodePathWin`** — qué archivo ejecuta la aplicación al arrancar tu plugin, en
Windows. Acá apunta a `plugin/index.js`.

**`Nodejs: {Version: "20"}`** — le dice a la aplicación "corré ese archivo con el
Node que traés incorporado". Es lo que nos ahorra tener que compilar un `.exe`.

**Bundle / `ncc`** — juntar tu código y todas sus dependencias en un solo archivo
`.js`. Lo hace la herramienta `ncc`. Sin esto habría que copiar `node_modules`
entero dentro del plugin.

**CDP (Chrome DevTools Protocol)** — el mismo mecanismo con el que las DevTools
de Chrome inspeccionan una página. La aplicación Stream Dock lo deja abierto, así
que se puede espiar la pantalla de configuración en vivo (ver
[Diagnóstico](#diagnóstico)).

### Vocabulario de Wave Link

**Canal** — cada fila de la mezcladora de Wave Link: *Game*, *Music*, *Voice
chat*, el micrófono. Tiene un volumen general.

**Mix** — una mezcla completa con su propia salida. Wave Link separa lo que
escuchás vos (*Personal Mix*) de lo que sale al stream.

**Canal dentro de un mix** — la celda donde se cruzan los dos: cuánto de *Game*
va al *Personal Mix*. Es lo que ves como grilla en Wave Link, y en este plugin es
el tipo `channelMix`.

**Entrada / salida (input / output)** — dispositivos de audio físicos: un
micrófono, unos auriculares. Cuelgan de un *device* padre, y por eso para
cambiarles el volumen hay que mandar el id del padre además del propio.

**Nivel / level** — el volumen, siempre de 0 a 1 (no 0 a 100).

**JSON-RPC** — el idioma en que habla Wave Link: le mandás `{"method": "setChannel",
"params": {...}, "id": 7}` y te contesta con el mismo `id`. Además te manda
avisos sin que preguntes cuando algo cambia.

**`ws-info.json`** — el archivito donde Wave Link anota en qué puerto está
escuchando. Cambia cada vez que arranca, así que hay que leerlo, no adivinarlo.

## Panorama

El plugin es un **proceso Node externo** que hace de puente entre dos WebSockets:

```
┌──────────────────────┐   ws (protocolo StreamDock)   ┌─────────────────┐
│ Stream Dock AJAZZ    │ ◄───────────────────────────► │ plugin/index.js │
│ (host, node20.exe)   │                               │                 │
└──────────┬───────────┘                               └────────┬────────┘
           │ abre el webview                                    │ ws (JSON-RPC 2.0)
           ▼                                                    ▼
┌────────────────────────────────┐                    ┌──────────────────┐
│ propertyInspector/target/      │                    │ Elgato Wave Link │
│ index.html + index.js          │                    │ puerto dinámico  │
└────────────────────────────────┘                    └──────────────────┘
```

El host trae su propio Node (`node20.exe`), así que el manifest declara
`"Nodejs": {"Version": "20"}` y `CodePathWin: plugin/index.js`: **no se compila
ningún ejecutable**, se publica un bundle de ~168KB.

## Estructura

```
com.raikerdev.wave_link.sdPlugin/
  manifest.json                    Dos acciones, iconos, versión mínima del host
  en.json / es.json / zh_CN.json   Nombres y tooltips localizados
  plugin/
    index.js                       Entry point: acciones y su cableado
    package.json                   Deps del proceso + script de build
    autofile.js                    Instalador (post-build)
    utils/plugin.js                Framework oficial del SDK — NO EDITAR
    wavelink/client.js             Cliente JSON-RPC de Wave Link
    wavelink/types.js              Tipos de target y separadores
    render/keyFace.js              Dibuja la cara de la tecla como SVG
    i18n.js                        Traduce el texto que va en las teclas
    dev/devMode.js                 Recarga en vivo del renderer (ver más abajo)
  propertyInspector/
    target/index.html              PI de Volume Knob y Mute Toggle
    target/index.js                Lógica de esa PI
    outputmix/index.html           PI de Output Mix
    outputmix/index.js             Lógica de esa PI
    utils/action.js                Framework oficial de la PI — NO EDITAR
    utils/common.js                Helpers oficiales ($, $emit, debounce) — NO EDITAR
    utils/bootstrap.min.css        Bootstrap 5.1.3 vendorizado por el SDK
  static/                          Iconos PNG (generados, ver scripts/gen-icons.mjs)
scripts/gen-icons.mjs              Rasterizador de iconos sin dependencias
scripts/gen-store-images.mjs       Imagenes de la ficha de la tienda
scripts/dev-mode.mjs               Enciende/apaga la recarga en vivo
scripts/wavelink-probe.mjs         Inspecciona Wave Link sin pasar por Stream Dock
scripts/pi-harness.mjs             Simula al host para trabajar la PI en un navegador
scripts/face-preview.mjs           Renderiza todas las caras con datos reales
store/                             Material de la ficha (generado, ver store/README.md)
```

Los archivos marcados **NO EDITAR** vienen tal cual del template oficial
`SDNodeJsSDKV2`. Mantenerlos intactos hace trivial actualizarlos cuando Mirabox
publique una versión nueva.

Del template se descartaron `axios.js` y `bootstrap-icons.css` con sus fuentes
(~290KB): esta PI no los referencia. Si alguna vez hacen falta, se copian desde
el repo del SDK.

## El framework del host (`plugin/utils/plugin.js`)

Exporta `Plugins`, `Actions`, `EventEmitter` y `log` (log4js).

### `Plugins`

Singleton. Abre el WebSocket al host y se registra usando los argumentos
posicionales con los que el host lanza el proceso:

| argv | contenido |
|---|---|
| `argv[3]` | puerto del host |
| `argv[5]` | pluginUUID |
| `argv[7]` | registerEvent |
| `argv[9]` | JSON de `info` (idioma, dispositivos, versión del host) |

**Despacho de eventos** — esta línea define toda la convención de nombres:

```js
const action = data.action?.split('.').pop();
this[action]?.[data.event]?.(data);   // evento de una acción concreta
this[data.event]?.(data);             // evento a nivel de plugin
```

Es decir: **el último segmento del UUID de la acción tiene que coincidir con el
nombre de la propiedad** en el objeto `plugin`. `com.raikerdev.wave_link.volumeknob`
→ `plugin.volumeknob`. Renombrar uno sin el otro rompe la acción en silencio.

Métodos usados por este plugin: `setState`, `showAlert`, `sendToPropertyInspector`.

### `Actions`

Se instancia con un objeto que se copia encima con `Object.assign`, así que
cualquier clave se vuelve un handler. Dos familias:

- **Envueltos por la clase base** (`willAppear`, `didReceiveSettings`,
  `willDisappear`): la base mantiene `this.data[context]` con los settings de esa
  instancia y después llama al hook con guion bajo (`_willAppear`, …).
- **Directos** (`keyUp`, `dialRotate`, `dialUp`, `sendToPlugin`,
  `propertyInspectorDidDisappear`): se llaman con el nombre del evento tal cual.

`propertyInspectorDidAppear` es un caso especial: la base lo usa para guardar
`Actions.currentAction` / `Actions.currentContext`, que es lo que después usa
`sendToPropertyInspector` para saber a qué PI contestarle.

## `plugin/index.js`

### Estado

- `wavelink` — instancia única de `WaveLinkClient`.
- `piContext` — contexto de la PI abierta, o `null`. Se setea en
  `_propertyInspectorDidAppear` y se limpia en `propertyInspectorDidDisappear`.
- Los settings de cada instancia viven en `plugin.<accion>.data[context]`,
  administrados por la clase base.

### Funciones

| función | qué hace |
|---|---|
| `resolveTarget(action, event)` | Saca `{targetType, targetId}` de los settings del evento (o del cache si el evento no los trae) y devuelve el target vivo de Wave Link. |
| `toggleMute(action, event)` | Invierte el mute del target resuelto; `showAlert` si no hay target o si el RPC falla. |
| `paintVolumeKnob(context, settings)` | Dibuja la cara de **un** Volume Knob con `setImage`. |
| `paintMuteToggle(context, settings)` | Dibuja la cara de **un** Mute Toggle, y le fija el `state`. |
| `resolveOutputMix(settings)` | Qué mix alimenta la salida hoy y a cuál iría si presionás. |
| `paintOutputMix(context, settings)` | Dibuja la cara de **un** Output Mix. |
| `repaintAll()` | Redibuja todo lo que esté visible, de las dos acciones. |
| `requestRepaint()` | Lo mismo, con un tope de frecuencia. |
| `pushTargets()` | Manda a la PI abierta `{type:'targets', connected, targets, settings}`. |

`resolveTarget` prefiere `payload.settings` del evento por sobre el cache: el
host manda los settings frescos en cada evento, y son más confiables que la copia
cacheada si la PI acaba de guardar.

### Cableado

```js
wavelink.on('ready',        () => { requestRepaint(); if (piContext) pushTargets(); });
wavelink.on('changed',      requestRepaint);
wavelink.on('disconnected', requestRepaint);
```

`ready` también repuebla la PI porque una PI abierta **antes** de que Wave Link
estuviera arriba recibió una lista vacía.

`changed` dispara con cada notificación de Wave Link, incluidos los cambios de
nivel mientras se gira el dial. Por eso no llama a `pushTargets` — mandarle la
lista entera a la PI en cada tick le resetearía los dropdowns al usuario.

### Acciones

**`plugin.volumeknob`** (`Controllers: ["Keypad","Knob"]`)

- `dialRotate` — llama a `wavelink.nudgeLevel(...)` con
  `payload.ticks * stepFraction(settings)`. El paso sale de `stepPercent` en los
  settings (2% si no hay nada), acotado a 1..25. `payload.ticks` viene con signo y
  puede ser mayor que 1 en giros rápidos. El acumulado, el clamp del nivel y el
  agrupado de escrituras los maneja el cliente (ver
  [giro rápido](#giro-rápido-niveles-optimistas)).
- `dialUp` / `keyUp` — alternan mute. `keyUp` existe porque la acción también se
  puede poner en un botón, donde no hay dial que girar.

**Ajuste fino**: `dialRotate` trae `pressed`, así que girar con el dial apretado
mueve `FINE_STEP_RATIO` (un cuarto) de un detente normal.

Eso choca con el mute, y por eso existe el `Map` `dialHold`: `dialDown` marca el
contexto, una rotación con `pressed` lo marca como girado, y `dialUp` **no mutea**
si hubo giro. Sin eso, cada ajuste fino terminaría muteando al soltar.

Si el host no reportara `pressed`, el gesto simplemente no se activa y el mute al
soltar sigue funcionando: degrada solo. Para confirmarlo, la primera rotación de
cada arranque vuelca su payload al log (`first dialRotate payload: …`) — una línea
por ejecución, no una traza.

**`plugin.volumebutton`** (`Controllers: ["Keypad"]`)

Volumen sin dial. El modo lo elige el usuario en la configuración:

| `mode` | `keyUp` hace |
|---|---|
| `up` / `down` | `nudgeLevel` con ±`stepFraction(settings)`, o sea que hereda el acumulado y el agrupado del giro rápido |
| `set` | `setLevel` directo a `levelFraction(settings)` — es un salto a un valor absoluto, no hay nada que acumular |

`levelFraction()` **no puede usar `||`** para su valor por defecto: 0% es un
volumen legítimo y `0 || 50` daría 50.

**`plugin.mutetoggle`** (`Controllers: ["Keypad"]`, 2 estados)

- `keyUp` — alterna mute. **No** pinta de forma optimista: Wave Link devuelve la
  notificación y `requestRepaint` redibuja. Una sola fuente de verdad.
- `_willAppear` / `_didReceiveSettings` — pintan la cara correcta al aparecer el
  botón o al cambiar el destino.

El manifest usa `DisableAutomaticStates: true` para que el host no avance el
estado por su cuenta al presionar.

**`plugin.outputmix`** (`Controllers: ["Keypad"]`)

Cambia a qué mix escucha una salida — el *Mix Output Device* del plugin oficial.
Sus settings son otros: `{outputId, outputName, mixId, mixName, altMixId, altMixName}`.

- `keyUp` — manda la salida al mix que devuelva `resolveOutputMix()`.
- La regla de alternancia está en esa función: **si la salida ya está en el mix
  principal, va al alternativo; si no, va al principal**. Sin alternativo
  configurado es un simple "mandala ahí". Con alternativo, la primera pulsación
  la lleva al principal y a partir de ahí hace ping-pong entre los dos.

Verificado contra la instancia real: tres pulsaciones seguidas dan A → B → A.

## `plugin/wavelink/client.js`

`WaveLinkClient extends EventEmitter`. Emite `ready`, `changed`, `disconnected`.

### Descubrimiento de puerto y conexión

`discoverPort()` lee
`%LOCALAPPDATA%\Packages\Elgato.WaveLink_g54w8ztgkx496\LocalState\ws-info.json`
(`{"port": N}`). **El puerto es dinámico** y cambia entre arranques de Wave Link.
Si el archivo no está, se prueba el rango legacy 1884-1893 (documentado por la
comunidad, nunca necesario en esta máquina). Si nada responde, reintenta cada 3s.

El handshake exige `Origin: streamdeck://`; sin ese header Wave Link rechaza.

### RPC

`call(method, params)` implementa JSON-RPC 2.0 con `id` incremental, un `Map` de
promesas pendientes y timeout de 5s. `loadSnapshot()` pide en paralelo
`getChannels`, `getInputDevices`, `getOutputDevices`, `getMixes`.

Antes de eso, `checkVersion()` llama a `getApplicationInfo` y deja en el log con
quién estamos hablando:

```
wavelink: Elgato Wave Link 3.2.10.4073, interfaceRevision 2
```

Si `interfaceRevision` no es el 2 contra el que se desarrolló, lo anota como
error. No bloquea nada —una revisión nueva podría ser compatible— pero deja una
línea clara para no perder tiempo si algún día el protocolo cambia.

### El índice de destinos

`getTarget()` corre **una vez por tecla visible en cada notificación**, y aplanar
las cuatro colecciones cada vez era trabajo tirado. Ahora `baseTargets()` arma la
lista y un `Map` por `tipo + id`, y los guarda hasta que el cache se mueva;
`invalidateTargets()` los tira en cada mutación de `onMessage` y en
`loadSnapshot()`.

Medido: 0,33 µs por búsqueda.

El nivel optimista **no** entra en lo cacheado: se aplica al leer, sobre la
entrada del índice. Si entrara, un giro tendría que invalidar la lista entera en
cada detente y no quedaría nada del ahorro.

### Giro rápido: niveles optimistas

Leer el nivel del cache en cada detente **no sobrevive a un giro rápido**: las
confirmaciones de Wave Link llegan más lento que los ticks, así que varias vueltas
seguidas calculan sobre el mismo valor viejo y el fader se arrastra o se traba.

`nudgeLevel(targetType, targetId, delta)` lo resuelve con dos ideas:

1. **Cada tick suma sobre el último valor que decidimos nosotros**, no sobre el
   último que confirmó Wave Link. Ese valor vive en el `Map` `optimistic`.
2. **Las escrituras se agrupan**: la primera programa un envío para dentro de
   `LEVEL_FLUSH_MS` (40ms) y los ticks siguientes solo actualizan el valor. Quince
   detentes seguidos producen **una** llamada RPC, no quince.

`getTargets()` aplica el valor optimista antes de devolver, así que la tecla
muestra el nivel nuevo de inmediato en vez de esperar el ida y vuelta.

La entrada optimista se descarta cuando pasa cualquiera de estas dos cosas:

- Wave Link informa un nivel a menos de `LEVEL_EPSILON` del que pedimos — llegó.
- Pasaron `LEVEL_SETTLE_MS` (1,5s) sin que llegue y no hay envío pendiente. Esto
  es lo que hace que una escritura rechazada o perdida **se autocorrija** en vez
  de dejar la pantalla congelada en un valor que no existe.

La clave del `Map` es `` `${targetType} ${targetId}` ``, con un espacio: un
`channelMix` ya lleva `::` adentro del id y usar eso como separador chocaría.

`onMessage` distingue respuesta (tiene `id` pendiente) de notificación. Las
notificaciones parchean el cache y emiten `changed`:

| notificación | efecto |
|---|---|
| `channelsChanged` / `inputDevicesChanged` / `outputDevicesChanged` / `mixesChanged` | reemplazan la colección entera |
| `channelChanged` / `mixChanged` | merge parcial sobre el elemento por `id` |
| `inputDeviceChanged` / `outputDeviceChanged` | merge por `id` **dentro** del array `inputs`/`outputs` (`mergeById`) |

**Las notificaciones de dispositivo son parciales, y eso importa.** Verificado
contra la instancia real: al cambiar el nivel de una salida, Wave Link responde

```json
{"id":"dev","name":"...","deviceType":"thirdParty",
 "outputs":[{"id":"out","name":"...","level":0.69}]}
```

o sea **solo la salida que se movió, y solo los campos que se movieron** — sin
`isMuted` ni `mixId`, y sin las otras salidas del mismo dispositivo. Reemplazar el
array con eso borraba las dos cosas: el Mute Toggle apuntado a una salida
mostraba mal el estado, y la acción Output Mix se quedaba sin `mixId` después de
cualquier cambio de volumen. De ahí `mergeById()`.

`channelChanged` **no** es así: manda su array `mixes` completo. La asimetría es
real, no un descuido de esta implementación.

### Efectos

Un canal trae los efectos VST/AU que tenga cargados:

```json
"effects": [{ "id": "18aeca3e-…", "name": "Pip-Boy Voice FX", "isEnabled": false }]
```

Se escriben con **`setChannel`**, igual que los mixes de un canal:

```js
setChannel({ id: canalId, effects: [{ id: efectoId, isEnabled: true }] })
```

`setPluginInfo` existe en el protocolo, pero **no hace falta** para esto.

`getEffects()` los aplana como se aplanan los destinos, a
`{ channelId, channelName, effectId, effectName, isEnabled }`. Van **fuera** de
`getTargets()` porque un efecto no tiene nivel, solo encendido o apagado.

**Los efectos de hardware no están acá.** Los del micrófono Elgato (supresión de
ruido, EQ, Clipguard) viven en el dispositivo, no en el canal, y no aparecen en
`channel.effects`.

### El resto del protocolo, sin usar

El servidor **no tiene introspección** (`rpc.discover`, `getMethods` y
`system.listMethods` no existen), pero Wave Link es una app .NET y sus ensamblados
guardan los literales. Extrayendo cadenas de `Elgato.WaveLink.dll` y
`Elgato.WaveLink.AppLogic.dll`, y probando después cuáles responden algo distinto
de `-32601`, aparecieron estos:

| existe pero no usamos | probablemente |
|---|---|
| `setPluginInfo` | Algo de la gestión de plugins; los efectos **no** lo necesitan |
| `setSubscription` | Suscribirse a notificaciones que no llegan por defecto |

Y estas notificaciones, que tampoco escuchamos: `effectUpdate`,
`levelMeterChanged`, `focusedAppChanged`, `windowModeChanged`, `inputUpdate`,
`mixUpdate`, `outputUpdate`.

`levelMeterChanged` es la más interesante para el futuro: sería el vúmetro en
vivo sobre la tecla. Probablemente haya que pedirla con `setSubscription`, porque
no llega sola.

**La técnica queda documentada porque sirve para cualquier duda futura del
protocolo**: extraer cadenas de los ensamblados, filtrar por forma
(`^(get|set)[A-Z]…`, `…Changed`), y confirmar contra el servidor con una llamada
de parámetros vacíos. Un `-32601` descarta; cualquier otro error confirma.

### Los 5 tipos de target

`getTargets()` aplana cuatro colecciones sin relación entre sí en una sola lista
de `{targetType, targetId, targetName, level, isMuted}`:

| `targetType` | origen | cómo se escribe |
|---|---|---|
| `channel` | `channels[]` | `setChannel({id, level\|isMuted})` |
| `channelMix` | `channels[].mixes[]` | `setChannel({id: canal, mixes:[{id: mix, …}]})` |
| `input` | `inputDevices[].inputs[]` | `setInputDevice({id: device, inputs:[{id, gain:{value}\|isMuted}]})` |
| `output` | `outputDevices[].outputs[]` | `setOutputDevice({outputDevice:{id: device, outputs:[{id, level\|isMuted}]}})` |
| `mix` | `mixes[]` | `setMix({id, level\|isMuted})` |

Además del nivel y el mute, un `output` tiene un **`mixId`**: de qué mix se
alimenta. Se lee con `getOutputMix()` y se escribe con `setOutputMix()`, que es
lo que usa la acción Output Mix.

**Para desasignar una salida hay que mandar `mixId: ''`.** Comprobado contra la
instancia real: `null` se ignora y omitir la clave también, así que la cadena
vacía es la única forma. Una salida sin mix es un estado legítimo de Wave Link,
no un error.

Detalles que cuesta redescubrir:

- **`channelMix`** es la celda canal×mix de la grilla de Wave Link. Su `targetId`
  es compuesto: `"<channelId>::<mixId>"` (`CHANNEL_MIX_SEPARATOR`). El nombre
  visible usa `" -> "` **ASCII** a propósito — una flecha unicode se rompía al
  renderizar.
- **`input` y `output` se escriben a través del device padre**, no directo. De ahí
  `findInputDevice` / `findOutputDevice`, que buscan qué device contiene ese id.
- **`setInputDevice` es plano y `setOutputDevice` va anidado** bajo la clave
  `outputDevice`. Es una asimetría real de la API de Wave Link, no un error.
- El nivel de un input está en `gain.value`; el de todo lo demás, en `level`.
- Para micrófonos simples `device.id === input.id`.

### El rango de la ganancia

`gain` no viene solo con `value`: trae también `min`, `max` y una `lookUpTable`.
**El resto del plugin habla en 0..1**, así que las entradas se convierten en los
dos sentidos:

```js
normalizeGain(gain)              // rango del dispositivo -> 0..1, al leer
denormalizeGain(gain, fraccion)  // 0..1 -> rango del dispositivo, al escribir
```

Si faltan los bordes, o si `max <= min`, se asume 0..1.

En esta máquina todas las entradas reportan `0..1`, así que la conversión es la
identidad y no se puede comprobar contra hardware real — se validó con un caso
sintético en rango dB (`-60..12`: leer `-24` da 50%, escribir 75% manda `-6`).
Se hizo igual porque el hardware Wave de Elgato podría reportar otro rango y el
dial quedaría descalibrado sin que nada avise.

**`lookUpTable` viene vacía en todo lo visto hasta ahora.** Si alguna vez llega
con contenido, lo más probable es que el mapeo sea una curva y no la recta que se
asume acá; `loadSnapshot()` lo anota en el log en vez de fallar callado. Lo mismo
si un dispositivo reporta un rango distinto de 0..1.

## `plugin/render/keyFace.js`

Dibuja la cara de una tecla *Volume Knob* como SVG, que se manda con `setImage`
en un data URI. El template oficial del SDK usa la misma técnica en su acción de
ejemplo, así que está confirmado que el host la acepta.

Exporta tres funciones:

| función | qué devuelve |
|---|---|
| `volumeFace(target, iconPng, surface)` | La cara del Volume Knob, en dial o en tecla |
| `muteFace(target, iconPng)` | La cara del Mute Toggle, siempre cuadrada |
| `volumeButtonFace(target, iconPng, operacion)` | La del Volume Button: el nivel y qué hará al presionar |
| `outputMixFace(estado)` | La del Output Mix: la salida, su mix actual y a cuál irá |
| `outputMixFace(estado)` | La cara del Output Mix, siempre cuadrada |
| `unconfiguredFace(mensaje, surface)` | La cara de "acá no hay nada que mostrar" |
| `calibrationFace(surface)` | Patrón de prueba para medir la proporción real del panel |
| `toDataUri(svg)` | El SVG listo para `setImage` |

### Dos superficies, dos formas

`surface` vale `'key'` o `'dial'`, y **no es un detalle estético**: la tecla es
cuadrada, pero la franja arriba de un dial es aproximadamente el doble de ancha
que de alta. El host **estira la imagen para llenar la superficie**, sin respetar
la proporción, así que mandar la misma imagen cuadrada a un dial la deforma.

| superficie | lienzo | layout |
|---|---|---|
| `key` | 144×144 (2× de 72px) | icono, etiqueta, porcentaje y barra apilados |
| `dial` | 200×100 (2:1) | tarjeta con encabezado (icono + nombre + alcance) y, debajo, dial rotatorio a la izquierda y lectura a la derecha |

En los dos casos, si no hay icono el resto se corre para ocupar ese espacio.

### La cara del dial

Está modelada sobre las caras que dibuja el plugin oficial de Wave Link, porque
resuelve bien un problema que teníamos: en un `channelMix` hay **dos** datos que
importan (qué canal y en qué mix) y antes solo entraba uno.

```
┌──────────────────────────────┐
│ [♪] Music              All   │  ← encabezado
│                              │
│      ╭─╮               50    │  ← dial rotatorio + lectura
│     ╵ ╲ ╵               %    │
└──────────────────────────────┘
```

- **`primaryLabel()`** — qué es: el nombre, y en un `channelMix` **el canal**.
- **`scopeLabel()`** — hasta dónde llega: `All` para un canal (su fader mueve
  todos los mixes), el nombre del mix para un `channelMix`, y `Mix` / `In` / `Out`
  para el resto. Es la misma ranura donde el oficial pone `All` o el número de mix.
- El nombre se recorta con lo que le dejan el icono y el alcance, calculado con un
  ancho de texto aproximado (`approxWidth`); no hay métricas de fuente acá.

**El dial rotatorio** (`gauge()`) barre de −115° a +115° medidos desde las doce,
así que 0% apunta abajo a la izquierda, 50% justo hacia arriba y 100% abajo a la
derecha. Lo componen las marcas, la pista, el relleno verde y la aguja. No lleva
cuerpo de perilla: la aguja sola, larga, sobre el fondo de la tarjeta se lee
mejor a este tamaño.

Los valores de la paleta y de la geometría están todos como constantes arriba del
archivo (`CARD`, `LEVEL`, `TICK`, `GAUGE_FROM`, `GAUGE_TO`, `GAUGE_TICKS`), que
es lo que se toca para reestilizar sin tener que entrar al SVG.

**Estados**, como en la referencia:

| estado | qué cambia |
|---|---|
| normal | relleno verde hasta el nivel, número grande y `%` debajo |
| muteado | la tarjeta se contornea en rojo, el número se reemplaza por un altavoz tachado y el arco queda sin relleno — la aguja sigue marcando el nivel real, para saber a dónde vuelve al desmutear |
| sin destino / sin conexión | misma tarjeta, con una perilla gris y el motivo escrito |

**De dónde sale la superficie**: solo `willAppear` informa el `controller`
(`"Knob"` o `"Keypad"`), así que `index.js` lo guarda en un `Map` por contexto
(`surfaceOf`) y lo borra en `willDisappear`.

**Por qué hay dos y no una.** No son dos diseños alternativos entre los que se
elige: son **la misma acción en dos lugares distintos**. *Volume Knob* declara
`Controllers: ["Keypad", "Knob"]`, o sea que el usuario puede soltarla tanto en un
dial como en una tecla. En un dial se gira para el volumen y se presiona para
mutear; en una tecla no hay nada que girar, así que queda como un **indicador de
nivel que además mutea al presionarse** (`keyUp` llama al mismo `toggleMute`).

*Mute Toggle* tiene su **propia** cara (`muteFace`), no reusa `keyFace`. Ver
[abajo](#la-cara-del-mute-toggle).

### La cara del Mute Toggle

`muteFace()` es cuadrada como `keyFace`, pero **la jerarquía está al revés a
propósito**: un Volume Knob trata del número, un Mute Toggle trata de si el audio
está saliendo o no. Así que el altavoz se lleva el centro y el nivel baja a rol
secundario, y las dos acciones se distinguen de un vistazo en lugar de ser la
misma tecla dos veces.

| estado | qué se ve |
|---|---|
| suena | altavoz blanco con ondas verdes, barra verde y el porcentaje |
| muteado | contorno rojo, altavoz rojo tachado, barra vacía y la palabra `MUTE` |
| sin destino / sin conexión | la cara de `unconfiguredFace`, igual que el Volume Knob |

`setState` se sigue mandando aunque la imagen lo tape: es la noción de mute que
tiene el host, y es lo que queda si alguna vez la imagen no se dibuja.

### La cara del Output Mix

Sin icono, porque **los dispositivos de salida no traen imagen** en Wave Link. Lo
que tiene que leerse de un vistazo es el mix que está alimentando la salida en
este momento, así que se lleva el centro:

| zona | contenido |
|---|---|
| arriba | el nombre de la salida, en gris |
| centro | el mix actual, o `Sin mix` si no tiene ninguno asignado |
| abajo | `→ <mix>`: a dónde va a ir si presionás |

El mix del centro va **en verde cuando coincide con el mix configurado** en la
acción, y en blanco cuando no. `splitMixName()` lo parte en dos líneas por el
` - `, porque `"Stream - Music"` entero no entra: se ve `Stream` / `Music`.

### De dónde sale el icono

`client.getIcon()` devuelve `channel.image.imgData`, un PNG en base64 que Wave
Link ya trae, y se incrusta con `<image href="data:image/png;base64,…">`.

**Solo los canales tienen icono.** Los mixes traen `image.name` (el *nombre* de un
icono, como `"headphones"`, no la imagen), y los dispositivos de entrada/salida no
traen nada. Un `channelMix` hereda el icono de su canal.

El campo `isAppIcon` distingue el icono de la app asignada (canales de hardware)
del dibujo propio de Wave Link (canales de software). **No se usa para filtrar**:
los dos sirven. Filtrar por `isAppIcon` dejaba a *Game*, *Music* y *Voice chat*
sin icono.

**El `<image>` se emite con `href` y `xlink:href` a la vez.** Los renderizadores
SVG 2 leen el primero; los que siguen en SVG 1.1 —como el de Qt, que es
probablemente el que dibuja la tecla— solo entienden el segundo. Con solo `href`
el icono no aparecía en el dispositivo, aunque el texto y la barra del mismo SVG
sí. Si en el futuro vuelve a no verse, ese es el primer sospechoso, y el plan B
es dibujar un glifo vectorial según `channel.type` en vez de incrustar el PNG.

### Etiquetas

Ninguna cara muestra el `targetName` crudo, porque no entra. La cara cuadrada usa
`shortLabel()` (una sola línea: el mix en un `channelMix`, recortado a 12); la del
dial parte el nombre en `primaryLabel()` + `scopeLabel()`, descritos arriba.

En los dos casos se saca el modelo entre paréntesis de los nombres de
dispositivo: `"Micrófono (Maono PD100W Mic USB)"` queda en `"Micrófono"`.

**El paréntesis se recorta con un grupo goloso** (`/\s*\(.*\)\s*$/`). Con el
`[^)]*` que parecía más prolijo, `"Altavoces (Realtek(R) Audio)"` —que anida
paréntesis— no matcheaba y quedaba `"Altavoces (R…"`.

### Codificación

`toDataUri` aplica `encodeURIComponent` al SVG. **No es opcional**: los nombres
de canal traen acentos, y un `#` crudo cortaría la URI en el fragmento. El
ejemplo oficial del SDK no lo hace, pero su SVG solo contiene un número.

### El límite de frecuencia

Wave Link manda una notificación por cada cambio de nivel, así que un giro rápido
generaría decenas de imágenes por segundo. `requestRepaint()` en `index.js`
limita a un repintado cada 100ms: dispara en el flanco de subida —para que el
primer click se vea al instante— y agenda una pasada final, de modo que el valor
en el que quedó nunca sea el que se descartó.

## Iterar sobre el diseño de la tecla en vivo

El plugin instalado corre un `index.js` **bundleado**, así que editar los fuentes
no cambia nada hasta recompilar y reiniciar el host. Para trabajo visual eso es
un ciclo insoportable: cada retoque hay que verlo en el aparato de verdad.

`plugin/dev/devMode.js` lo arregla. Con esto:

```bash
npm run dev:on
```

el plugin deja de usar el renderer compilado y carga
`plugin/render/keyFace.js` **desde el repo**, lo vigila con `fs.watch` y lo
recarga en cada guardado. El ciclo pasa a ser: editás, guardás, mirás el
dispositivo. Sin reinstalar, sin reiniciar.

```bash
npm run dev:off
```

vuelve al renderer compilado.

### Cómo funciona

`dev-mode.mjs` escribe un `dev.json` dentro del plugin **instalado**:

```json
{ "renderer": "D:/…/plugin/render/keyFace.js", "calibrate": false }
```

Al arrancar, `devMode.start()` busca ese archivo; si no está, no hace
absolutamente nada, por eso es inofensivo dejar el código en el plugin
publicado. El `dev.json` se escribe en la carpeta instalada y no en el repo, así
que cualquier `npm run install-plugin` lo borra y deja una instalación limpia.

Dos detalles de implementación que no son evidentes:

- **El `require` va por `eval('require')`.** ncc inlinea todo `require` que pueda
  resolver estáticamente, que es justo lo contrario de lo que se busca acá: hace
  falta el archivo que está en disco *en el momento de la llamada*. Pasar por
  `eval` conserva el require de Node y el bundler no lo toca.
- **Un error de sintaxis a medio editar no rompe nada.** El `try/catch` del
  watcher se queda con la última versión buena y lo anota en el log.

### Calibrar la proporción del panel

```bash
npm run dev:calibrate
```

Cada Volume Knob pasa a mostrar un círculo dentro de un cuadrado, con el tamaño
del lienzo escrito abajo. Sirve porque **el host estira la imagen para llenar el
panel sin respetar la proporción**, y en ningún archivo del host figura cuántos
píxeles mide ese panel (se buscó: las imágenes que cachea en `profiles/` son
todas cuadradas y son iconos elegidos por el usuario, no caras renderizadas).

Con una foto del patrón se despeja midiendo el óvalo:

```
proporción del panel = (ancho/alto del óvalo en la foto) × (ancho/alto del lienzo)
```

Si el círculo sale redondo, el lienzo ya coincide con el panel. Los lienzos están
en `LAYOUTS`, arriba de todo en `keyFace.js`.

## Property Inspector

### Carga

```html
<script src="../utils/common.js"></script>   <!-- $, $emit, debounce -->
<script src="../utils/action.js"></script>   <!-- conexión, saveData, sendToPlugin -->
<script src="index.js"></script>             <!-- $local, $back, $dom, $propEvent -->
```

`action.js` declara `connectElgatoStreamDeckSocket` como *function declaration*,
así que queda global antes de que el host la llame. `index.js` agrega el alias
`window.connectMiraBoxSDSocket` porque el host ha sido observado llamando ese
otro nombre.

### Contrato con `action.js`

`index.js` tiene que definir cuatro globales que `action.js` consume:

| global | valor acá | por qué |
|---|---|---|
| `$local` | `true` | Enciende la traducción automática del markup estático. Ver [Idiomas](#idiomas): exige que **todo** nodo de texto tenga clave. |
| `$back` | `true` | Con `false`, `action.js` recién muestra `$dom.main` al llegar `didReceiveSettings`. La PI es visible desde el arranque para no depender de ese evento. |
| `$dom` | elementos estáticos | Requiere al menos `main`. |
| `$propEvent` | handlers por evento | `action.js` hace `$propEvent[data.event]?.(data.payload)`. |

### Flujo

1. El host llama a la función de conexión → `action.js` abre el WebSocket.
2. `requestTargets()` en `index.js` espera (poll de 50ms, hasta 5s) a que el
   socket esté `OPEN` y manda `sendToPlugin({type:'getTargets'})`.
3. El plugin contesta con `{targets, settings, connected}` en un mensaje.
4. `renderTargets()` puebla el dropdown Destino filtrando por el Tipo elegido y
   marca como seleccionado el `targetId` guardado.
5. Cualquier `change` llama a `save()` → `$websocket.saveData({targetType,
   targetId, targetName})` (helper oficial, `setSettings` con debounce).

**Los settings iniciales vienen del plugin, no de `didReceiveSettings`.** Un solo
round-trip trae lista y selección, sin depender de un evento del host que puede
no llegar. El handler de `didReceiveSettings` igual existe, por si llega.

Cambiar el Tipo invalida el Destino: se limpia `targetId` antes de repoblar.

### Idiomas

**Todo el texto fuente está en inglés**, y cada archivo de idioma lo mapea. Se
traduce por **tres** caminos distintos, y hay que conocer los tres:

| qué | cómo |
|---|---|
| El markup estático de las pantallas | Lo hace el SDK: con `$local = true`, `utils/action.js` baja `../../<idioma>.json` y recorre los nodos de texto reemplazándolos |
| Lo que las pantallas arman en runtime | La función `t()` de cada pantalla, porque el recorrido del SDK pasa una sola vez y solo sobre el markup |
| **El texto dibujado en las teclas** | `plugin/i18n.js`, del lado del proceso. El idioma sale de `Plugins.language`, que el host informa en su `-info` |

El manifest queda en inglés a propósito: es el texto que se usa cuando **no** hay
archivo de idioma que coincida, así que es el que ve alguien con el sistema en
alemán. El español lo aporta `es.json`.

`plugin/render/keyFace.js` **no contiene texto traducible**: quien lo llama le
pasa las cadenas ya resueltas. Así el renderer se puede recargar en caliente sin
arrastrar el módulo de idiomas.

```js
t('Controlling: {name}', { name: 'Music' })
```

**Dos trampas que ya se pagaron:**

1. **El recorrido del SDK escribe `undefined`** cuando no encuentra una clave. Por
   eso *cada* nodo de texto necesita entrada en `Localization`, y por eso no hay
   que agregar archivos de idioma con el bloque vacío: sería peor que no tenerlos.
   `t()`, en cambio, **cae al inglés** — un texto en otro idioma es mejor que uno
   roto, y además `$lang` llega de forma asíncrona, así que las primeras llamadas
   caen legítimamente.
2. **`t` no puede sombrearse.** Varios `.filter(t => …)` usaban `t` como variable
   de iteración; dentro de esos callbacks la función quedaba tapada. Las variables
   se renombraron a `item`.

Hoy se incluyen `en.json`, `es.json` y `zh_CN.json`, con 46 claves cada uno. Un
idioma sin archivo cae a inglés, verificado.

Para probarlo sin cambiar nada de la máquina: `npm run pi` acepta `&lang=`, por
ejemplo `http://127.0.0.1:8099/?action=volumeknob&lang=zh_CN`.

#### Agregar un idioma

Son tres archivos, y **el empaquetado no te deja olvidarte de ninguno**:

1. **`<idioma>.json`** en la raíz del plugin, con el nombre tal como lo escribe el
   host. Los plugins oficiales de Mirabox usan `de`, `en`, `es`, `fr`, `it`, `ja`,
   `ko`, `pl`, `pt`, `ru` y `zh_CN` — copiá esa forma, con la región en mayúsculas
   cuando la lleva. Copiá `en.json` entero y traducí los valores; el bloque
   `Localization` tiene que quedar con **exactamente** las mismas claves.
2. **`plugin/i18n.js`**: agregá la entrada a `STRINGS` con las cuatro cadenas que
   se dibujan en las teclas. La clave se escribe igual que el archivo (`zh_CN`).
   `resolve()` tolera las variantes que puede informar el host: `zh_CN`, `zh-CN`
   y `zh` pegan todas contra la misma tabla.
3. **`scripts/package.mjs`**: sumalo a `SHIPS`. Si no lo hacés, `npm run package`
   falla diciendo que el idioma existe pero no está en la lista de envío, y de
   paso compara las claves de cada archivo contra `en.json` — que es la
   verificación que atrapa el `undefined` **antes** de subir el paquete.

Los nombres de las acciones se traducen o no según el idioma. En `es.json` quedan
en inglés (*Volume Knob*, *Mute Toggle*): son legibles y coinciden con lo que dice
la ficha de la tienda. En `zh_CN.json` sí se traducen (音量旋钮, 静音开关), que es
lo que hacen los plugins chinos oficiales y lo único útil para quien no lee el
alfabeto latino.

**Sobre el chino en las teclas**: el texto de las teclas se manda como SVG y lo
rasteriza el host, no el aparato. Chromium resuelve el fallback a Microsoft
YaHei solo, así que los glifos salen. Lo que **no** se ajusta es `approxWidth()`
de `keyFace.js`, que estima 0.52 em por carácter: un carácter chino ocupa cerca
de 1 em, así que un nombre largo puede desbordar. Hoy no molesta porque las
cadenas traducidas son cortas (`未设置目标`, 5 caracteres) y los nombres largos
vienen de Wave Link, no de la traducción.

### Estilos

El SDK vendoriza **Bootstrap 5.1.3**, anterior a `data-bs-theme` (5.3). Poner
ese atributo **no hace nada** — los selects quedan blancos sobre el panel oscuro.
Todo el tema oscuro va como override en el `<style>` de `index.html`.

**Estilo de la casa.** Estos son los valores en uso; cualquier control que se
agregue después tiene que respetarlos para no desentonar:

| Rol | Valor |
|---|---|
| Fondo del panel | `#2d2d2d` |
| Fondo de un campo | `#3d3d3d` — **más claro** que el panel, no más oscuro |
| Borde | `#4a4a4a`, y `#7a7a7a` con el foco |
| Texto de los campos | `#dee2e6` |
| Etiquetas | `#ffffff`, 12px, `margin-bottom: 4px` |
| Radio de borde | `4px` |
| Tipografía y espaciado | 12px, `padding: 5px 10px` |
| Separación entre campos | `mb-1` (compacto, la pantalla es angosta) |
| Contenedor | `sdpi-wrapper` sin `p-3`; el `padding: 8px` del `body` alcanza |

Dos detalles heredados de Bootstrap que conviene no pelear:

- El chevron del desplegable es un **SVG inline como data URI**, no un archivo.
  Se le cambia el color en el propio `stroke='%23dee2e6'`.
- `box-shadow: none` en `:focus` saca el halo azul que Bootstrap pone por
  defecto; el foco se marca solo aclarando el borde.

Cuando cambies el fondo de un campo, acordate de cambiarlo **también en
`:focus`**. Si no, el campo pega un salto de color al hacerle clic.

## Cómo tocar la pantalla de configuración

Dos recetas paso a paso. Los archivos en juego son siempre estos cuatro:

| Archivo | Qué le corresponde |
|---|---|
| `propertyInspector/target/index.html` | El markup y **todos** los estilos |
| `propertyInspector/target/index.js` | Leer los controles, guardar, repoblar |
| `plugin/index.js` | Usar el valor guardado cuando el usuario aprieta algo |
| `manifest.json` | El valor por defecto del ajuste nuevo |

Nunca hace falta tocar `propertyInspector/utils/*`: son del SDK.

### Receta 1 — cambiar el aspecto

Todo el CSS vive en el bloque `<style>` al final de
`propertyInspector/target/index.html`. No hay hoja de estilos propia aparte, y es
a propósito: son treinta líneas, y separarlas en otro archivo solo agrega un
archivo más que sincronizar.

Los valores en uso están en la tabla de [Estilos](#estilos). Ejemplo, agrandar
las etiquetas y separar un poco más los campos:

```html
<style>
    /* ... lo que ya está ... */

    .form-label {
        font-size: 13px;
        font-weight: 600;
    }

    .mb-1 {
        margin-bottom: .5rem !important;   /* Bootstrap lo define con !important */
    }
</style>
```

Cuatro cosas que conviene saber antes de pelearte con esto:

1. **El Bootstrap vendorizado es 5.1.3.** Cualquier receta de internet que use
   `data-bs-theme` no va a funcionar: eso llegó en 5.3. Los colores oscuros de
   los controles son overrides propios que ya están puestos.
2. **Las utilidades de Bootstrap usan `!important`.** Para pisar `.mb-1` o `.p-3`
   necesitás `!important` también.
3. **Los estados van en pareja.** Si tocás el fondo o el borde de un control,
   revisá su regla `:focus`: es el olvido más fácil, y se nota como un salto de
   color al hacer clic.
4. **La franja de arriba no es tuya.** El icono, el campo "Título" y el nombre de
   la acción los dibuja la aplicación. Desde el plugin no se pueden cambiar.

Para ver los cambios no hace falta reinstalar nada: abrí la página con el arnés
que se describe en [Diagnóstico](#diagnóstico) y recargá.

### Receta 2 — agregar un ajuste nuevo

El recorrido usa como ejemplo el campo **"Paso por click (%)"**, que ya está
implementado: podés abrir cada archivo y comparar con lo que dice acá.

#### Paso 1 — declarar el valor por defecto en `manifest.json`

En la acción `com.raikerdev.wave_link.volumeknob`, agregá la clave a `Settings`:

```json
"Settings": {
  "targetType": "",
  "targetId": "",
  "targetName": "",
  "stepPercent": 2
}
```

Esto es lo que tendrá una instancia recién arrastrada, antes de que el usuario
abra la configuración.

#### Paso 2 — agregar el control en `index.html`

Dentro del `<div class="sdpi-wrapper">`, después del bloque de Destino:

```html
<div class="mb-1">
    <label class="form-label" for="stepInput">Paso por click (%)</label>
    <input class="form-control" type="number" id="stepInput" min="1" max="25" step="1">
</div>
```

`form-control` es la clase de Bootstrap para inputs, la hermana de `form-select`.
Viene sin tema oscuro, así que hay que dárselo con los valores de la casa (ver
[Estilos](#estilos)). Lo más cómodo es sumarla a las reglas que ya existen, para
que no se vayan separando con el tiempo:

```css
.form-select,
.form-control {
    color: #dee2e6;
    background-color: #3d3d3d;
    border-color: #4a4a4a;
    border-radius: 4px;
    font-size: 12px;
    padding: 5px 10px;
}

.form-select:focus,
.form-control:focus {
    color: #dee2e6;
    background-color: #3d3d3d;
    border-color: #7a7a7a;
    box-shadow: none;
}
```

> El `background-image` del chevron queda solo en `.form-select`: es la flechita
> del desplegable y un input no la lleva.

#### Paso 2b — esconderlo donde no aplica

**Esta pantalla la comparten tres acciones** (Volume Knob, Mute Toggle y Volume
Button), y cada campo solo tiene sentido en algunas. Todos los condicionales
llevan `hidden` en el markup y los destapa `applyActionVisibility()`, que mira
`$action` y, en el caso del Volume Button, también el modo elegido.

**Cuándo llamarla es la parte delicada.** `$action` lo deja `utils/action.js`
cuando el host conecta, así que hay que engancharse ahí — envolviendo la función
de entrada:

```js
const hostConnect = connectElgatoStreamDeckSocket;
window.connectMiraBoxSDSocket = window.connectElgatoStreamDeckSocket = function (...args) {
    const result = hostConnect.apply(this, args);
    applyActionVisibility();   // $action ya está seteado
    return result;
};
```

`action.js` asigna `$action` de forma síncrona antes de abrir el socket, así que
al volver de la llamada ya se sabe qué acción es.

**Por qué no alcanza con hacerlo al recibir la primera respuesta del plugin**: se
probó así y los campos quedaban ocultos si el plugin tardaba o no contestaba. La
disposición del formulario no debe depender de una respuesta que puede no llegar.

#### Paso 3 — cablearlo en `target/index.js`

Tres retoques chicos. Primero, registrar el elemento en `$dom`:

```js
const $local = false, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    type: $('#typeSelect'),
    target: $('#targetSelect'),
    step: $('#stepInput'),          // ← nuevo
    status: $('#status')
};
```

Segundo, incluirlo al guardar. En `save()`, sumalo al objeto que se persiste,
saneado:

```js
selected = {
    targetType,
    targetId,
    targetName: match ? match.targetName : '',
    stepPercent: Math.min(25, Math.max(1, Number($dom.step.value) || DEFAULT_STEP))
};
$websocket.saveData(selected);
```

Tercero, restaurarlo al abrir. Hay **dos** lugares que reciben settings
(`didReceiveSettings` y `sendToPropertyInspector`), así que conviene una sola
función `restore(settings)` que los dos llamen, en vez de duplicar el back-fill:

```js
function restore(settings) {
    selected = { targetType: '', targetId: '', targetName: '', stepPercent: DEFAULT_STEP, ...settings };
    $dom.type.value = selected.targetType || '';
    $dom.step.value = selected.stepPercent ?? DEFAULT_STEP;
}
```

Y engancharle el evento, junto a los otros dos listeners:

```js
$dom.step.addEventListener('change', save);
```

> Usá `change` y no `input`: `input` dispara en cada tecla y guardaría basura
> intermedia mientras el usuario todavía está escribiendo el número.

#### Paso 4 — usarlo en `plugin/index.js`

En `dialRotate`, reemplazá la constante por el valor de la instancia:

```js
const step = stepFraction(payload?.settings || this.data[context]);
wavelink.nudgeLevel(target.targetType, target.targetId, payload.ticks * step);
```

**Saneá el valor también acá**, no solo en la pantalla de configuración: los
settings los persiste el host y pueden venir de una versión anterior del plugin o
estar editados a mano.

```js
function stepFraction(settings) {
    const percent = Number(settings?.stepPercent) || DEFAULT_STEP_PERCENT;
    return Math.min(MAX_STEP_PERCENT, Math.max(MIN_STEP_PERCENT, percent)) / 100;
}
```

No hay que tocar nada más del lado del plugin: `pushTargets()` ya le manda a la
pantalla de configuración el objeto de settings **completo**, así que el campo
nuevo viaja solo.

#### Paso 5 — reinstalar

```bash
npm run install-plugin
```

#### Errores típicos

- **El campo se ve pero no guarda.** Falta el `addEventListener`, o el `id` del
  HTML no coincide con el selector de `$dom`.
- **Guarda pero se pierde al reabrir.** Falta restaurarlo en **los dos** lugares
  del paso 3. El que casi siempre se olvida es `sendToPropertyInspector`, que es
  justamente el que usa este plugin como fuente principal.
- **La pantalla queda en blanco.** `$('#loQueSea')` **tira una excepción** si el
  elemento no existe, y corta el resto del script. Revisá que el `id` esté escrito
  igual en los dos lados.
- **El plugin ignora el valor.** El proceso del plugin está bundleado: si no
  corrés `npm run install-plugin`, sigue ejecutando el código viejo. Los cambios
  de la pantalla de configuración sí se ven al reinstalar sin recompilar, porque
  esos archivos se copian tal cual.

### Documentación de referencia

La oficial del fabricante (Mirabox/HotSpot, el vendor detrás de AJAZZ):

| Página | Para qué sirve |
|---|---|
| [Overview](https://sdk.key123.vip/en/guide/overview.html) | Punto de entrada del SDK |
| [Terminology](https://sdk.key123.vip/en/guide/terminology.html) | Vocabulario oficial (corto; el [glosario](#glosario) de acá es bastante más completo) |
| [Manifest](https://sdk.key123.vip/en/guide/manifest.html) | Todos los campos del `manifest.json` |
| [Received Events](https://sdk.key123.vip/en/guide/events-received.html) | Los eventos que te manda la aplicación y qué trae cada payload |
| [Events Sent](https://sdk.key123.vip/en/guide/events-sent.html) | Lo que le podés pedir a la aplicación (`setState`, `setTitle`, `showAlert`, …) |
| [Property Inspector](https://sdk.key123.vip/en/guide/property-inspector.html) | Cómo se conecta la pantalla de configuración y cómo se comunica con el plugin |
| [Style Guide](https://sdk.key123.vip/en/guide/style-guide.html) | Criterios de diseño: tamaños de icono, cuándo usar radio vs desplegable, cómo no complicar la pantalla |
| [Internationalization](https://sdk.key123.vip/en/guide/i18n.html) | Cómo funcionan los `en.json` / `es.json` |

Y el código, que muchas veces contesta más rápido que la documentación:

- [MiraboxSpace/StreamDock-Plugin-SDK](https://github.com/MiraboxSpace/StreamDock-Plugin-SDK)
  — este plugin sale del template `SDNodeJsSDKV2`. Los otros templates
  (`SDJavaScriptSDK`, `SDVueSDK`) sirven para ver otras formas de armar la
  pantalla de configuración; ahí está el `sdpi.css` clásico si algún día se
  quiere abandonar Bootstrap.
- Los plugins ya instalados en `%appdata%\HotSpot\StreamDock\plugins\` son la
  referencia más honesta de cómo se ve un plugin real, más que las plantillas.
- La tienda `https://space.key123.vip/` permite bajar plugins de terceros (son
  archivos zip) para mirarles el markup por dentro.

Un detalle del [Style Guide](https://sdk.key123.vip/en/guide/style-guide.html)
que conviene tener a mano: recomienda **iconos de un solo color con fondo
transparente**, 40×40 para acciones, 48×48 para categorías y 128×128 para
plugins. Este plugin se aparta a propósito en dos puntos —iconos de 72px y con
placa de fondo— y el porqué está en [Iconos](#iconos).

## Build e instalación

```
npm run deps     # instala deps dentro de plugin/
npm run icons    # regenera static/*.png y store/product-avatar.png
npm run store    # regenera las imagenes de la ficha de la tienda
npm run build    # ncc bundle + autofile.js  (alias: npm run install-plugin)
npm run package  # arma el zip distribuible en dist/
```

`ncc build index.js -m -o ./build` mete `index.js`, `utils/`, `wavelink/`, `ws` y
`log4js` en un solo `build/index.js` minificado.

`autofile.js` (adaptado del oficial) hace, en orden:

1. `taskkill` de `Stream Dock AJAZZ.exe` — el host solo escanea la carpeta de
   plugins al arrancar, y mantiene los archivos instalados abiertos.
2. `taskkill` de `wavelink-plugin.exe` y borrado de
   `com.ricardoaom.wavelink.sdPlugin` — el plugin anterior, que este reemplaza.
3. Copia el `.sdPlugin` a `%appdata%\HotSpot\StreamDock\plugins\`, excluyendo lo
   que solo sirve para construir (`node_modules`, fuentes ya bundleadas, `log`).
4. Copia `plugin/build/` sobre `plugin/` en el destino: ese bundle **reemplaza**
   los fuentes excluidos en el paso anterior.
5. Relanza el host, con `cwd` explícito para que no tire sus logs en este repo.

Los scripts usan `cd <dir> && npm …` y no `npm --prefix <dir>`: con `--prefix`,
npm agrega al `package.json` del subpaquete una autodependencia espuria
`"com.raikerdev.wave-link": "file:../.."`.

### El paquete distribuible

`npm run package` arma `dist/<nombre>-<version>.zip` con la carpeta `.sdPlugin`
adentro, que es la forma en que la tienda distribuye los plugins.

**Se arma desde una lista blanca**, no desde exclusiones: manifest, archivos de
idioma, `propertyInspector/`, `static/` y el bundle. Una lista de exclusiones es
una invitación permanente a que se filtre lo próximo que se agregue — la carpeta
instalada ya junta un `dev.json` de `npm run dev:on` y un `log/` de log4js, y en
un momento arrastró también los fuentes al lado del bundle.

Antes de comprimir revisa que no se haya colado nada de eso, que cada icono y
cada pantalla que declara el manifest exista de verdad, y que los archivos de
idioma estén completos: que ninguno de los que hay en disco haya quedado fuera de
la lista blanca, y que todos tengan las mismas claves de `Localization` que
`en.json` más el nombre de cada acción. Son comprobaciones baratas y atrapan
exactamente los errores que ya ocurrieron una vez.

## Iconos

`scripts/gen-icons.mjs` los dibuja sin dependencias: un escritor de PNG
(CRC32 + chunks + `deflateSync`) y un rasterizador que evalúa funciones de
cobertura sobre el cuadrado unitario con supersampling 4×4 (de ahí el
antialiasing). Cada icono es una lista ordenada de capas `[color, dentro?, alfa]`
compuestas source-over.

Tamaños: `plugin` 128, `category` 48, iconos de acción 72, todos con su `@2x`.

Un color puede ser una **función de la posición** en vez de una terna fija; así se
hacen los degradados, y así está pintada la placa de la marca.

**La marca del plugin sale de acá también.** `mark()` devuelve las capas —tres
faders con la parte de abajo encendida en verde sobre una placa con degradado— y
el script la dibuja tres veces: 48px para la categoría, 128px para el plugin y
480px para el avatar de la tienda, que queda en `store/product-avatar.png` sin el
margen que sí necesitan los otros dos. Es la misma definición las tres veces: no
hay un archivo de arte suelto que se pueda quedar viejo.

La marca **es propia**. Toma prestado el lenguaje —un mixer, el mismo verde de
nivel que usan las teclas— pero no es una versión del icono de Elgato ni de nadie.

Hay **dos desvíos deliberados** respecto del
[Style Guide](https://sdk.key123.vip/en/guide/style-guide.html) oficial:

- Pide iconos de acción de **40×40**; acá son de 72. El archivo del icono se
  reusa como cara de la tecla (`States[].Image`), y 40px se ve pixelado ahí. Es
  lo que hacen también los ejemplos oficiales del SDK.
- Pide **un solo color sobre fondo transparente**; acá los tres iconos de acción
  llevan una placa oscura detrás. Un glifo blanco sobre transparente se ve bien
  en la tecla negra del dispositivo, pero **desaparece** en la lista de acciones
  de la aplicación. Se verificó mirando los PNG generados.

## Diagnóstico

Casi nada de esto necesita el dispositivo. Las tres herramientas de abajo se
pueden correr con el Stream Dock cerrado.

### `npm run probe` — mirar Wave Link

```bash
npm run probe                  # los destinos, agrupados por tipo
npm run probe -- --raw         # las estructuras crudas, con todos sus campos
npm run probe -- --watch       # las notificaciones, en vivo
```

Lista los 21 destinos con nivel, mute, si tienen icono y —para las salidas— a qué
mix alimentan. Es lo primero a correr cuando algo "no aparece": dice si el
problema es del plugin o de lo que Wave Link está informando.

`--raw` sirve para descubrir campos que todavía no usamos: así aparecieron
`image.imgData` y `mixId`. `--watch` imprime cada notificación tal cual llega, que
es como se descubrió que las de dispositivo son parciales.

### `npm run pi` — trabajar la pantalla de configuración

Sirve `propertyInspector/` por HTTP y levanta un WebSocket que habla el protocolo
del host, con **datos reales** de Wave Link. Imprime una URL por acción:

```
volumeknob    http://127.0.0.1:8099/?action=volumeknob
mutetoggle    http://127.0.0.1:8099/?action=mutetoggle
volumebutton  http://127.0.0.1:8099/?action=volumebutton
outputmix     http://127.0.0.1:8099/?action=outputmix
```

La página **se conecta sola** —el arnés inyecta la llamada que haría el host— y
todo lo que la pantalla guarda se imprime en la consola, así que se ve exactamente
qué persistiría. Los settings quedan en memoria por acción, o sea que guardar y
recargar se comporta como el host de verdad.

Dos cosas que hay que respetar y costaron entenderlas:

- **Tiene que ser HTTP.** Un `file://` puede degradarse a snapshot sin JS.
- **La página se sirve en su ruta real**, con una redirección desde `/`. Servirla
  en la raíz rompe sus rutas relativas: `index.js` se pide como `/index.js` y da
  404, y sin ese archivo la pantalla explota con `$local is not defined`.

### `npm run faces` — ver las caras

Renderiza todas las caras de todas las acciones con datos reales, al tamaño en que
las muestra el dispositivo, en `http://127.0.0.1:8102/`. Relee
`render/keyFace.js` en cada request, así que editar y recargar alcanza. Si el
archivo no compila, la página muestra el stack en vez de romperse.

Para verlo **en el dispositivo** en vez de en el navegador, `npm run dev:on`.

### `npm run store` — las imágenes de la ficha

```bash
npm run store                  # las cinco imagenes en ingles
npm run store -- --lang=zh     # las mismas en chino
npm run store -- --lang=all    # los dos juegos
```

Escribe `store/<idioma>/1-hero.png` … `5-setup.png` a 1920×1080, que es el 16:9
que pide el formulario de la tienda. El avatar 480×480 **no** sale de acá: es
parte de `npm run icons`, porque es la misma marca que el icono del plugin.

Lo que importa de este script es de dónde saca lo que dibuja:

- **Las teclas son las de verdad**, de `render/keyFace.js`. Cambiar el diseño de
  una tecla cambia las imágenes de la tienda; no hay una maqueta aparte.
- **La pantalla de configuración también**: lee el `index.html` real con su CSS y
  le inyecta nada más la lista de destinos, que en vivo la pone el plugin. Cada
  inyección se verifica y **el script falla** si el markup dejó de contener lo
  que esperaba, en vez de generar una imagen equivocada en silencio.
- El chino se arma con las traducciones de `zh_CN.json`, del mismo modo que lo
  haría el recorrido del SDK: nodo de texto completo contra clave completa.

Rasteriza con el Chrome o el Edge que ya está instalado, en modo headless
(`--screenshot`). No agrega ninguna dependencia; si tenés el navegador en otro
lado, `CHROME_PATH`.

Cómo se sube cada archivo está en [store/README.md](store/README.md).

### Lo demás

- **Log**: `%appdata%\HotSpot\StreamDock\plugins\com.raikerdev.wave_link.sdPlugin\log\<año>.<mes>.<día>.log`.
  log4js escribe relativo al CWD del proceso, que es la raíz del plugin instalado.
- **Probar el plugin entero sin el dispositivo**: se puede levantar un
  `WebSocketServer`, lanzar `plugin/index.js` con
  `-port <puerto> -pluginUUID x -registerEvent registerPlugin -info <json>` y
  mandarle eventos (`willAppear`, `keyUp`, `dialRotate`…) a mano. Así se
  verificaron el ajuste fino y los tres modos del Volume Button. Conviene apuntar
  a un destino inaudible, como una salida sin mix asignado.
- **PI en vivo dentro del host**: `Stream Dock AJAZZ.exe` expone Chrome DevTools
  Protocol (`127.0.0.1:23519`, puede variar). `/json/list` muestra la página de la
  PI **solo mientras el panel de configuración está abierto**; conectarse a su
  `webSocketDebuggerUrl` y escuchar `Runtime.exceptionThrown`.
