# Estado del plugin y plan de mejoras

Evaluación al **2026-08-12**, con 12 de 14 puntos hechos. Detalles de
implementación en [dev_doc.md](dev_doc.md); los pasos para publicar, en
[RELEASE.md](RELEASE.md).

## Dónde está parado hoy

### Lo que está sólido

- **La base es la oficial.** El plugin sale del template `SDNodeJsSDKV2`, con los
  archivos del framework sin tocar. Cuando Mirabox saque una versión nueva del
  SDK, actualizarlos es copiar y pegar.
- **Sin ejecutable propio.** El host corre el `.js` con su Node embebido: 167KB
  contra los 57MB del intento anterior. Reinstalar no puede fallar por un `.exe`
  bloqueado.
- **El direccionamiento de Wave Link está completo.** Los cinco tipos de destino
  andan, incluido `channelMix`, que es el que más cuesta descubrir.
- **La configuración no tiene pasos raros.** Dos desplegables que se llenan solos
  y guardan solos, sin botón de guardar ni trucos con el título.
- **El estado del mute tiene una sola fuente de verdad.** El icono se pinta desde
  lo que informa Wave Link, no desde lo que el plugin cree haber hecho. Mutear
  desde la interfaz de Wave Link se refleja en la tecla.
- **Se puede diagnosticar sin el dispositivo.** Cuatro herramientas en `scripts/`
  cubren Wave Link, la pantalla de configuración, las caras y la recarga en vivo.
- **Cuatro acciones, todas con estado real en la tecla**: nivel, mute, destino y
  avisos de "sin destino" o "sin conexión".

### Lo que es frágil

- **La proporción real del panel del dial sigue sin medirse.** Se dibuja en 200×100
  porque los paneles del plugin oficial dan ~2:1, pero nunca se confirmó con el
  aparato (`npm run dev:calibrate` está para eso).
- **Sin tests automatizados.** Las herramientas de `scripts/` hacen fácil verificar
  a mano, pero nada corre solo ni detecta una regresión.
- **Solo Windows**, por decisión: macOS se sacó del plan a pedido del usuario
  (2026-08-12). El SDK V2 tampoco trae Node embebido en Mac todavía.
- **El ajuste fino no se activa en el AKP05E**: el `pressed` de `dialRotate` nunca
  llega en `true`, así que el gesto queda inerte (sin romper nada).

## Comparación con el plugin oficial de Elgato

El [plugin oficial de Wave Link para Stream Deck](https://marketplace.elgato.com/product/wave-link-aa41150f-9645-4275-b064-7642ba6a17ae)
(v3.0.2.290, abril 2026) es la referencia obvia. **No corre en un AJAZZ**: necesita
la aplicación Stream Deck de Elgato. Esa es la razón de existir de este proyecto,
y también el motivo por el que la comparación es sobre funcionalidad, no sobre
cuál conviene instalar.

### Lo que trae el oficial

Nueve acciones, contra las dos de acá:

| Acción oficial | ¿La tenemos? |
|---|---|
| **Channel Level** — volumen de un canal, en todos los mixes o en uno | ✅ Es nuestro `channel` + `channelMix` |
| **Mix Level** — volumen y mute de un mix completo | ✅ Es nuestro `mix` |
| **Output Control** — volumen y mute de una salida | ✅ Es nuestro `output` |
| **Wave Control** — ganancia y mezcla de monitoreo del hardware Wave | 🟡 Nuestro `input` cubre la ganancia de entrada, y además funciona con micrófonos que no son Elgato. No cubre la mezcla de monitoreo |
| **Mix Output Device** — cambiar a qué mix alimenta una salida | ✅ Es nuestra acción `Output Mix` |
| **Main Output Device** — cambiar la salida principal | ❌ |
| **Audio Effect** — efectos del hardware Wave (supresión de ruido, EQ, compresión, Clipguard) | ❌ |
| **Channel Audio Effect** — efectos VST/AU por canal | ❌ |
| **Add to Channel** — mandar la app en primer plano a un canal | ❌ |

Y sobre todo: **el oficial dibuja el nivel en la tecla en tiempo real**, con un
fader visual, y en los diales muestra el valor mientras girás. Nosotros mostramos
siempre el mismo icono.

### Nuestras ventajas

1. **Corre en el AJAZZ.** El oficial, no. Todo lo demás es secundario.
2. **Una sola pantalla de configuración para todo.** El oficial te obliga a saber
   de antemano qué acción arrastrar según lo que quieras controlar. Acá arrastrás
   *Volume Knob* y elegís entre los 21 destinos de una lista plana.
3. **`channelMix` es de primera clase.** La celda canal×mix se elige como
   cualquier otro destino, sin una acción aparte.
4. **Funciona con hardware que no es Elgato.** Verificado: la lista de entradas
   incluye un micrófono Maono y unos auriculares Sony, ambos `deviceType:
   "thirdParty"`.
5. **Es nuestro.** Se modifica, se depura y se le agrega lo que haga falta.
6. **167KB** contra ~1MB del oficial.

### Nuestras desventajas

1. **Sin feedback visual**, que es lo que más se nota en el uso diario.
2. **Cero control de efectos**, ni de hardware ni VST/AU.
3. **No cambia enrutamientos** (salida→mix, salida principal, app→canal).
4. **Solo Windows**; el oficial anda en Mac y Windows.
5. **Sin mantenimiento ni actualizaciones automáticas.**

### Qué de eso es alcanzable (probado contra la API real)

Se inspeccionaron las respuestas crudas de Wave Link 3.2.10 para saber qué se
puede construir de verdad y qué no:

- ✅ **Los canales traen su icono en `channel.image.imgData`**, un PNG en base64
  listo para usar. Es exactamente lo que hace falta para dibujar una tecla linda.
- ✅ **Cada salida trae su `mixId`**, así que *Mix Output Device* es construible
  con el `setOutputDevice` que ya usamos.
- ✅ **`getApplicationInfo` funciona** y devuelve versión y `interfaceRevision`,
  útil para detectar una versión de Wave Link incompatible.
- 🟡 **`channel.effects` existe** (viene `[]` sin VST cargados), o sea que los
  efectos por canal están expuestos, pero no sabemos con qué método se escriben.
- ❌ **El servidor no tiene introspección**: `rpc.discover`, `getMethods` y
  `system.listMethods` devuelven "method does not exist". Los métodos de efectos,
  monitoreo y enrutamiento de apps existen (el oficial los usa) pero **hay que
  descubrir sus nombres por ingeniería inversa**, probablemente espiando el
  tráfico del plugin oficial en una máquina con Stream Deck.
- 🟡 **`gain` trae `min`, `max` y `lookUpTable`.** Hoy asumimos 0..1 a secas.

## Plan de mejoras

Ordenado por lo que más se nota en el uso diario. Ninguna es urgente: el plugin
hace lo que promete.

### Prioridad alta

#### 1. Mostrar el volumen en la tecla — ✅ HECHO (2026-08-11)

Implementado en `plugin/render/keyFace.js`. La tecla muestra el icono real del
canal, la etiqueta, el porcentaje y una barra de nivel; en mute pasa a rojo y
dice `MUTE`. Detalles en [dev_doc.md](dev_doc.md#pluginrenderkeyfacejs).

Efecto lateral: como la cara también dice `Sin destino` y `Sin conexión`, el
punto 3 queda cubierto **para el Volume Knob**; falta el Mute Toggle.

**Problema.** Girás el dial a ciegas: hay que mirar la pantalla de la
computadora para saber en cuánto quedó.

**Propuesta.** Dibujar la cara de la tecla con `setImage`, mandando un SVG como
data URI. Un arco o una barra con el porcentaje, más el nombre del destino. El
template oficial hace exactamente esto en su acción de ejemplo, así que está
probado que el host lo acepta. Es lo mismo que hace el plugin oficial de Elgato,
que muestra un fader en la tecla.

**Regalo.** Wave Link ya devuelve el icono de cada canal en
`channel.image.imgData`, un PNG en base64 (verificado). Se puede incrustar en el
SVG y mostrar el icono real de la aplicación junto al nivel, sin dibujar nada a
mano. Los mixes traen `image.name` (por ejemplo `"headphones"`), que es el nombre
de un icono, no la imagen.

**Dónde.** `plugin/index.js`: una función que arme el SVG, llamada desde
`dialRotate` y desde el listener de `changed`. No toca la pantalla de
configuración.

**Ojo.** Usar `setImage`, **no** `setTitle`: el título es del usuario y ya se
descartó una vez pisarlo. Conviene limitar la frecuencia de repintado (unos
100ms) para no saturar el WebSocket durante un giro.

**Esfuerzo** medio · **Riesgo** bajo.

#### 2. Arreglar el giro rápido — ✅ HECHO (2026-08-11)

Resuelto con `nudgeLevel()` en `plugin/wavelink/client.js`: cada tick suma sobre
el último valor que decidimos nosotros, no sobre el último que confirmó Wave
Link, y las escrituras se agrupan en una cada 40ms. El valor optimista se
descarta al converger o tras 1,5s sin confirmación, así que una escritura perdida
se autocorrige. Detalles en
[dev_doc.md](dev_doc.md#giro-rápido-niveles-optimistas).

Medido contra la instancia real: 15 detentes seguidos acumulan exacto (0.200 →
0.500, sin pasos perdidos), se ven en la tecla al instante y salen en **una** sola
llamada RPC en vez de quince.

Queda como efecto secundario que la respuesta se siente más rápida, porque la
tecla ya no espera el ida y vuelta para repintarse.

#### 3. Avisar cuando Wave Link no está — ✅ HECHO (2026-08-11)

**Problema.** Si Wave Link está cerrado, las teclas se ven normales y solo
parpadean al apretarlas. La pantalla de configuración sí lo dice, pero hay que
abrirla.

Las dos acciones muestran ahora `Sin destino` o `Sin conexión` en la cara de la
tecla, enganchadas al evento `disconnected` del cliente. El Mute Toggle además
dejó los dos PNG fijos y pasó a dibujarse con `muteFace`, que muestra el nivel
mientras suena. Ver [dev_doc.md](dev_doc.md#la-cara-del-mute-toggle).

**Esfuerzo** bajo · **Riesgo** bajo.

### Prioridad media

#### 4. Paso por click configurable — ✅ HECHO (2026-08-11)

Campo **"Paso por click (%)"** en la configuración del Volume Knob, con 2% por
defecto y acotado a 1..25. Para un mix delicado conviene 1%; para ir de 0 a 100
rápido, 10%.

El campo se esconde en el Mute Toggle, que comparte la misma pantalla y no tiene
dial que girar. El valor se sanea en los dos lados —pantalla y plugin— porque los
settings los persiste el host y podrían venir de una versión anterior.

La [receta 2 de dev_doc.md](dev_doc.md#receta-2--agregar-un-ajuste-nuevo) quedó
reescrita como recorrido de este código real, para usarla de plantilla la próxima
vez.

#### 5. Guardar los arneses de diagnóstico como scripts del repo — ✅ HECHO (2026-08-12)

Cuatro herramientas versionadas, todas usables con el Stream Dock cerrado. Ver
[dev_doc.md](dev_doc.md#diagnóstico).

| script | para qué |
|---|---|
| `npm run probe` | Los destinos de Wave Link, sus estructuras crudas (`--raw`) o sus notificaciones en vivo (`--watch`) |
| `npm run pi` | La pantalla de configuración en un navegador, con datos reales y autoconectada |
| `npm run faces` | Todas las caras de todas las acciones, releídas en cada refresh |
| `npm run dev:on` | Lo mismo pero **en el dispositivo**, recargando al guardar |

Motivo para hacerlo: se habían escrito siete scripts descartables en carpetas
temporales a lo largo del proyecto, reinventando lo mismo cada vez.

#### 6. Ajuste fino apretando el dial — ✅ HECHO (2026-08-12)

Girar con el dial apretado mueve un cuarto de paso. Soltar sin haber girado
sigue muteando; soltar después de girar, no. Detalles en
[dev_doc.md](dev_doc.md#acciones).

Probado corriendo el proceso real del plugin contra un host simulado: paso fino,
paso normal y mute salen los tres como corresponde.

**Falta confirmarlo en el aparato**: no hay documentación del AKP05E que diga si
reporta `pressed`, así que la primera rotación de cada arranque vuelca su payload
al log para poder verificarlo. Si no lo reporta, el gesto no se activa y no rompe
nada.

#### 7. Acciones nuevas para botones — ✅ HECHO (2026-08-12)

Una sola acción **Volume Button** con tres modos —subir, bajar y fijar en un
valor— en vez de tres acciones separadas: comparte la misma pantalla de
configuración y no infla el listado de la categoría. Cubre lo que el oficial
llama *Adjust* y *Set*.

Probado corriendo el proceso real contra un host simulado: +10%, −10%, fijar en
25% y fijar en 0% dan todos exacto.

**Queda pendiente el fundido** del *Set*, que el oficial sí tiene: llegar al valor
progresivamente en vez de saltar. Con `setLevel` disponible es un bucle de unos
pocos pasos, pero hay que pensar cómo convive con los niveles optimistas del giro
rápido.

#### 8. Acción "Cambiar el mix de una salida" — ✅ HECHO (2026-08-11)

Equivale al *Mix Output Device* del oficial. Acción `Output Mix`, con su propia
pantalla de configuración (salida + mix + mix alternativo opcional). Sin
alternativo manda la salida al mix elegido; con alternativo alterna entre los
dos. La tecla muestra el mix que está alimentando la salida ahora y a cuál va a
ir si la presionás.

Verificado contra la instancia real: tres pulsaciones dan A → B → A, y Wave Link
emite `outputDeviceChanged`, así que la tecla se repinta sola si cambiás el
enrutamiento desde la aplicación.

**Hallazgo**: para *desasignar* una salida hay que mandar `mixId: ''`. Ni `null`
ni omitir la clave funcionan — los dos se ignoran en silencio.

### Prioridad baja

#### 9. Respetar el rango real de la ganancia — ✅ HECHO (2026-08-12)

Las entradas se convierten en los dos sentidos entre el rango que declara el
dispositivo y el 0..1 que habla el resto del plugin. Ver
[dev_doc.md](dev_doc.md#el-rango-de-la-ganancia).

**Sin comprobar contra hardware real**: todas las entradas de esta máquina
reportan 0..1, así que la conversión es la identidad. Se validó con un caso
sintético en rango dB. Si aparece un dispositivo con otro rango, o con la
`lookUpTable` cargada, queda anotado en el log.

#### 10. Verificar la versión de Wave Link al conectar — ✅ HECHO (2026-08-12)

`checkVersion()` corre antes del snapshot y deja en el log
`wavelink: Elgato Wave Link 3.2.10.4073, interfaceRevision 2`. Si la revisión no
es la 2, lo anota como error. No bloquea: una revisión nueva podría ser
compatible, pero deja una línea clara si algún día algo se comporta raro.

#### 11. Control de efectos — ✅ HECHO (2026-08-12)

Acción **Audio Effect**: enciende y apaga un efecto VST/AU cargado en un canal. La
tecla muestra el canal, el efecto y si está encendido, con el borde en verde
cuando lo está.

**No hace falta `setPluginInfo`.** Se escribe con `setChannel` y
`effects: [{id, isEnabled}]`, el mismo patrón que los mixes de un canal. El objeto
de efecto es `{ id, name, isEnabled }`.

Probado corriendo el proceso real contra un host simulado: dos pulsaciones
encienden y apagan el efecto, y la cara de la tecla acompaña el estado.

**Ojo con la notificación.** `channelChanged` responde con **solo** `effects`
—sin `mixes`, `level` ni `isMuted`— así que el merge superficial que ya existía
los conserva. Pero el array `effects` en sí se pasa por `mergeById`, por las
dudas de que Wave Link mande solo el efecto que cambió, como hace con las
salidas. Con un solo efecto cargado no se pudo comprobar cuál de las dos cosas
hace.

<details>
<summary>Cómo se encontraron los nombres (sirve para cualquier duda futura del protocolo)</summary>

El servidor no tiene introspección, pero Wave Link es una app .NET y sus
ensamblados guardan los literales. Extrayendo cadenas de `Elgato.WaveLink.dll` y
`Elgato.WaveLink.AppLogic.dll` en `C:\Program Files\WindowsApps\Elgato.WaveLink_*\`
salieron los candidatos, y probándolos contra el servidor se confirmó cuáles
existen (`-32601` = no existe).

**Existen pero no usamos**: `setPluginInfo`, `setSubscription`.

**No existen**: `setEffect`, `getEffect`, `setChannelEffect`, `getChannelEffects`,
`setEffects`, `getDspEffects`, `setDspEffect`, `getPluginInfo`, `getPlugins`,
`getAudioPlugins`, `setParameter`, `getWaveDeviceSettings`, `setWaveDeviceSetting`,
`getMicrophoneSettings`.

**Notificaciones que existen y no escuchamos**: `effectUpdate`,
`levelMeterChanged`, `focusedAppChanged`, `windowModeChanged`, `inputUpdate`,
`mixUpdate`, `outputUpdate`.

El primer intento se frenó porque no había ningún efecto cargado en la máquina:
sin un ejemplo vivo no se podía deducir la forma del objeto ni probar nada. Con
un VST agregado, la forma quedó a la vista en `getChannels` y el resto salió
solo.
</details>

**Lo que quedó afuera**: los efectos de **hardware** del oficial (supresión de
ruido, EQ, compresión, Clipguard) son otra cosa — viven en el micrófono Elgato,
no en el canal, y no aparecen en `channel.effects`. Sin hardware Elgato en esta
máquina no hay forma de investigarlos, y `getWaveDeviceSettings` y compañía no
existen. Si algún día hace falta, el camino es el mismo: minar los ensamblados y
probar contra el servidor.

#### 12. Buscar destinos por índice — ✅ HECHO (2026-08-12)

La lista aplanada y un `Map` por `tipo + id` se arman una vez y se conservan hasta
que el cache se mueve. `getTarget()` pasó de reconstruir 21 objetos a una
búsqueda: **0,33 µs**. Ver [dev_doc.md](dev_doc.md#el-índice-de-destinos).

Lo que había que cuidar era la invalidación, no la velocidad: se verificó que un
`channelChanged` se refleja de inmediato y que el nivel optimista sigue pisando al
del cache.

#### 13. Traducir la pantalla de configuración — ✅ HECHO (2026-08-12)

El texto fuente pasó a inglés y se tradujo por dos caminos: el markup estático por
el recorrido del SDK (`$local = true`), y lo que se arma en runtime por una
función `t()` que **cae al inglés** en vez de a `undefined`. Ver
[dev_doc.md](dev_doc.md#idiomas).

`en.json` y `es.json` con 36 claves cada uno. Verificado en las dos pantallas, en
los dos idiomas y con un idioma sin archivo (`fr`), que cae a inglés limpio.

**No agregar archivos de idioma con el bloque `Localization` vacío**: el recorrido
del SDK los tomaría como válidos y dejaría la pantalla llena de `undefined`. Es
mejor no tener el archivo.

## Lo que conviene no hacer

Cosas que ya se evaluaron y se descartaron, para no volver a proponerlas:

- **Usar el campo Título como configuración.** Funcionaba, pero el usuario quiere
  el título libre para escribir lo que se le antoje.
- **Un selector de "qué control físico soy" en la configuración.** Es un paso
  extra innecesario: la pantalla de configuración ya sabe a qué instancia
  pertenece.
- **Migrar la pantalla de configuración a Vue.** El template de Vue corre dentro
  del navegador embebido del host, sin acceso al sistema de archivos, así que no
  puede descubrir el puerto de Wave Link. Y para dos desplegables no paga.
- **Volver a compilar un `.exe`.** Solo tendría sentido si el host dejara de
  traer Node, que sería un retroceso improbable.
