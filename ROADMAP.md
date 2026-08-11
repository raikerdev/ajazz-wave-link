# Estado del plugin y plan de mejoras

Evaluación al **2026-08-10**, con la versión 1.0.0 ya probada y funcionando sobre
el dispositivo real. Detalles de implementación en [dev_doc.md](dev_doc.md).

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
- **Se puede diagnosticar sin el dispositivo.** El cliente de Wave Link y la
  pantalla de configuración se pueden ejercer por separado.

### Lo que es frágil

- **No hay ninguna señal de vida en la tecla.** El icono es siempre el mismo: no
  muestra el volumen, ni a qué canal apunta, ni si Wave Link está caído. El único
  aviso es el parpadeo de error al intentar usarla.
- **Giro rápido.** Cada tick calcula el nivel nuevo a partir del que tiene
  cacheado. Si las notificaciones de Wave Link llegan más lento que los ticks, el
  cálculo parte de un valor viejo y el volumen se queda corto o "se traba". Es el
  defecto más probable de que aparezca en uso real.
- **Una llamada RPC por tick.** Un giro rápido puede disparar veinte mensajes en
  un segundo. Hoy aguanta, pero no hay ningún control.
- **Los arneses de diagnóstico no existen como archivos.** [dev_doc.md](dev_doc.md)
  explica cómo probar el cliente y la pantalla de configuración por separado,
  pero hay que escribir esos scripts de cero cada vez.
- **`getTarget()` reconstruye la lista entera** (21 objetos hoy) en cada consulta,
  y se consulta una vez por tecla en cada notificación de Wave Link.
- **Solo Windows.** La ruta del `ws-info.json` es de Windows y el manifest no
  declara `CodePathMac`. Tampoco es una limitación nuestra: el SDK V2 todavía no
  tiene Node embebido en Mac.
- **Cero tests automatizados.** Todo se valida a mano.

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
| **Mix Output Device** — cambiar a qué mix alimenta una salida | ❌ |
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

#### 1. Mostrar el volumen en la tecla

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

#### 2. Arreglar el giro rápido

**Problema.** El descrito arriba: el nivel se lee de un cache que puede venir
atrasado.

**Propuesta.** Mantener un nivel optimista por destino: al girar, calcular sobre
el último valor que *mandamos* y no sobre el último que *recibimos*, y descartar
ese valor optimista cuando llega la confirmación de Wave Link o después de un
tiempo sin actividad.

**Dónde.** `plugin/wavelink/client.js`, dentro de `setLevel` y del manejo de
notificaciones, para que quede encapsulado y `index.js` no se entere.

**Combinar con.** Agrupar los ticks: acumular el desplazamiento y mandar una sola
llamada cada ~50ms en vez de una por tick. Resuelve también el punto de las
veinte llamadas por segundo.

**Esfuerzo** medio · **Riesgo** medio — es el cambio con más chance de introducir
un error sutil, así que conviene hacerlo con el arnés del punto 5 ya armado.

#### 3. Avisar cuando Wave Link no está

**Problema.** Si Wave Link está cerrado, las teclas se ven normales y solo
parpadean al apretarlas. La pantalla de configuración sí lo dice, pero hay que
abrirla.

**Propuesta.** Atenuar el icono o mostrar uno específico mientras
`wavelink.isReady()` sea falso. Ya existen los eventos `ready` y `disconnected`
del cliente; solo falta engancharlos a un repintado.

**Esfuerzo** bajo · **Riesgo** bajo.

### Prioridad media

#### 4. Paso por click configurable

Hoy son 2% fijos (`STEP_PER_TICK`). Para un mix delicado conviene 1%; para ir de
0 a 100 rápido, 5%. El paso a paso completo de cómo implementarlo está escrito
como ejemplo en [dev_doc.md](dev_doc.md#receta-2--agregar-un-ajuste-nuevo).

**Esfuerzo** bajo · **Riesgo** bajo.

#### 5. Guardar los arneses de diagnóstico como scripts del repo

Convertir en archivos permanentes las dos herramientas que ya se usaron y
funcionaron:

- `scripts/wavelink-probe.mjs` — conecta a Wave Link e imprime los destinos con
  su nivel y su mute. Sirve para ver qué ve el plugin sin abrir la aplicación.
- `scripts/pi-harness.mjs` — sirve la pantalla de configuración por HTTP y simula
  al host por WebSocket. Permite trabajar en la interfaz sin reinstalar ni tocar
  el dispositivo.

Es la mejora con mejor relación esfuerzo/beneficio: acelera todas las demás.

**Esfuerzo** bajo · **Riesgo** ninguno.

#### 6. Ajuste fino apretando el dial

El evento `dialRotate` trae un campo `pressed`. Girar con el dial apretado podría
mover de a 0.5% para ajustes finos. Es un gesto que ya existe en el hardware y
hoy se desperdicia.

**Ojo.** Hoy soltar el dial (`dialUp`) mutea. Habría que no mutear si hubo giro
mientras estaba apretado, o el gesto fino terminaría muteando siempre.

**Esfuerzo** bajo · **Riesgo** bajo.

#### 7. Acciones nuevas para botones

El plugin está pensado para diales; en botones queda pobre. Candidatas:

- **Volume Up / Volume Down** — subir o bajar un paso, para quien no tiene diales
  libres.
- **Set Volume** — saltar a un valor fijo. Un botón "música al 30%" es más rápido
  que girar.

Las tres reusan `client.setLevel` tal cual. El trabajo es manifest, un handler y
un campo más en la pantalla de configuración.

Son las mismas que el oficial llama *Set* y *Adjust*. El oficial además permite
que el *Set* haga un **fundido** hasta el valor en vez de saltar; con `setLevel`
ya disponible, eso es un bucle de unos pocos pasos.

**Esfuerzo** medio · **Riesgo** bajo.

#### 8. Acción "Cambiar el mix de una salida"

Equivale al *Mix Output Device* del oficial: mandar los auriculares del *Personal
Mix* al *Stream Mix* con un botón, para escuchar lo que sale al stream sin tocar
la aplicación.

**Es construible ya**: cada salida trae su `mixId` (verificado), y se escribe con
el mismo `setOutputDevice` que ya usamos. Solo falta una acción nueva y un
desplegable de mix en la pantalla de configuración.

**Esfuerzo** bajo · **Riesgo** bajo. Es la función del oficial que más barato nos
sale copiar.

### Prioridad baja

#### 9. Respetar el rango real de la ganancia

`input.gain` trae `min`, `max` y una `lookUpTable`. Hoy asumimos 0..1 fijo. En
esta máquina coincide, pero el hardware Wave de Elgato podría reportar otro rango
y el dial quedaría descalibrado.

**Esfuerzo** bajo · **Riesgo** bajo.

#### 10. Verificar la versión de Wave Link al conectar

`getApplicationInfo` devuelve versión y `interfaceRevision` (hoy `2`). Si algún
día Wave Link cambia el protocolo, hoy el plugin fallaría de formas raras en vez
de decir "esta versión no es compatible".

**Esfuerzo** bajo · **Riesgo** ninguno.

#### 11. Control de efectos — requiere ingeniería inversa

El oficial toggplea efectos de hardware (supresión de ruido, EQ, compresión,
Clipguard) y efectos VST/AU por canal. El objeto de canal **sí trae un array
`effects`**, así que la información está expuesta; lo que no sabemos es con qué
método se escribe, y el servidor **no tiene introspección** (`rpc.discover` y
compañía no existen).

**Cómo destrabarlo.** Espiar el tráfico del plugin oficial contra Wave Link en
una máquina con Stream Deck instalado, o cargar un VST en Wave Link y mirar qué
notificación llega cuando se lo activa desde la interfaz — eso último se puede
hacer acá mismo con el probe, sin necesidad de un Stream Deck.

**Esfuerzo** alto · **Riesgo** alto. Solo vale la pena si realmente usás efectos.

#### 12. Buscar destinos por índice

Reemplazar la reconstrucción completa de la lista en `getTarget()` por un `Map`
que se arme junto con el cache. Hoy no se nota, pero es trabajo desperdiciado en
el camino más caliente del plugin.

**Esfuerzo** bajo · **Riesgo** bajo.

#### 13. Traducir la pantalla de configuración

Los textos están escritos en español a mano y `$local` está apagado a propósito,
porque el traductor automático del SDK convierte en `undefined` cualquier texto
sin clave. Para publicar el plugin habría que completar el bloque `Localization`
de cada archivo de idioma y volver a encenderlo.

**Esfuerzo** bajo · **Riesgo** bajo, pero hay que probar idioma por idioma.

#### 14. Soporte para macOS

Bloqueado por el SDK: el host de Mac todavía no trae Node embebido. Cuando lo
tenga, hay que agregar `CodePathMac` y resolver la ruta del `ws-info.json` en
Mac. Sin una máquina Mac para probar, no tiene sentido escribirlo a ciegas.

**Bloqueado.**

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
