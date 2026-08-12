# Wave Link Control

Plugin para **Stream Dock de AJAZZ** que controla el volumen y el mute de
**Elgato Wave Link 3** desde los diales físicos y los botones del dispositivo.

Un dial por canal: girás y el fader se mueve en Wave Link; lo apretás y se
mutea. Funciona con todo lo que Wave Link expone — canales, la celda de un canal
dentro de un mix, entradas, salidas y mixes completos.

## Requisitos

- Windows 10 o superior
- Stream Dock AJAZZ **3.10.188.226** o superior (trae el runtime de Node que el
  plugin necesita)
- Elgato Wave Link 3
- Node.js 20+ solo para compilarlo

## Instalación

```bash
npm run deps
```

```bash
npm run install-plugin
```

El segundo comando compila el plugin, lo copia a la carpeta de plugins de Stream
Dock y **reinicia la aplicación Stream Dock AJAZZ** (solo lee la carpeta de
plugins al arrancar). Si tenías instalada la versión anterior
(`com.ricardoaom.wavelink`), la desinstala.

## Acciones

### Volume Knob

Se puede poner en un dial o en un botón.

| Gesto | Efecto |
|---|---|
| Girar el dial | Sube o baja el volumen |
| Girar el dial **apretándolo** | Ajuste fino: un cuarto de paso por click |
| Apretar el dial | Alterna el mute |
| Apretar el botón | Alterna el mute |

En su configuración podés elegir **cuánto sube o baja por click** (entre 1% y
25%; por defecto 2%). Para ajustar un mix con precisión bajalo a 1%; para
recorrer todo el rango rápido, subilo a 10%.

### Volume Button

Para botones, cuando no te quedan diales libres. En su configuración elegís qué
hace al presionar:

| Modo | Efecto |
|---|---|
| **Subir el volumen** | Sube un paso (5% por defecto) |
| **Bajar el volumen** | Baja un paso |
| **Fijar en un valor** | Salta al volumen que le pongas, de 0% a 100% |

La tecla muestra el volumen actual y, abajo, qué va a hacer: `+ 5%`, `− 5%` o
`→ 30%`.

### Mute Toggle

Para botones. Alterna el mute del destino elegido. La tecla muestra el altavoz —
blanco cuando suena, rojo y tachado cuando está muteado — más el nivel actual, y
refleja el estado real: si mutás desde la interfaz de Wave Link, el botón se
actualiza solo.

### Audio Effect

Para botones. Enciende y apaga un efecto VST/AU que tengas cargado en un canal de
Wave Link — por ejemplo, un cambiador de voz en el micrófono.

Elegís el **canal** y el **efecto**. La tecla muestra cuál es y se pone en verde
cuando está encendido.

Los efectos hay que agregarlos primero desde Wave Link; el plugin solo los
enciende y apaga. Los efectos de **hardware** de los micrófonos Elgato
(supresión de ruido, Clipguard) no entran acá: son del dispositivo, no del canal.

### Output Mix

Para botones. Cambia a qué mix escucha una salida: por ejemplo, mandar los
auriculares del *Personal Mix* al *Stream - Music* para escuchar lo que sale al
stream, sin abrir Wave Link.

En su configuración elegís la **salida**, el **mix** al que mandarla y,
opcionalmente, un **mix alternativo**. Si dejás el alternativo vacío, el botón
siempre manda la salida al mix elegido. Si lo completás, alterna entre los dos.

La tecla muestra el mix que está alimentando la salida en este momento —en verde
cuando coincide con el que configuraste— y abajo, a cuál va a ir si la presionás.

## Configuración

*Output Mix* tiene su propia pantalla, descrita arriba. *Volume Knob* y
*Mute Toggle* comparten esta:

Arrastrá la acción a un dial o botón y abrí su configuración. Hay dos listas
desplegables:

1. **Tipo** — qué clase de cosa querés controlar.
2. **Destino** — cuál en concreto. La lista se llena sola con lo que Wave Link
   tenga en ese momento.

Se guarda solo al elegir; no hay botón de guardar.

### Tipos disponibles

| Tipo | Qué controla |
|---|---|
| **Canal (master)** | El volumen general de un canal, como el fader de arriba de todo en Wave Link |
| **Canal dentro de un Mix** | La celda de un canal en un mix concreto — por ejemplo *Game → Personal Mix* — que es lo que se ve en la grilla de Wave Link |
| **Entrada** | Un dispositivo de entrada, como un micrófono |
| **Salida** | Un dispositivo de salida, como los auriculares |
| **Mix (master)** | El volumen de un mix completo |

Si el destino aparece vacío, es que Wave Link no está abierto: abrilo y volvé a
abrir la configuración.

## Si algo no anda

**La tecla parpadea al usarla.** No hay destino configurado, Wave Link está
cerrado, o el destino ya no existe (por ejemplo, desconectaste ese micrófono).
Abrí la configuración y elegí el destino de nuevo.

**Las listas están vacías.** Wave Link no está corriendo, o arrancó después del
plugin. Abrí Wave Link, después cerrá y volvé a abrir la configuración.

**Nada responde.** Revisá el log:

```bash
type "%appdata%\HotSpot\StreamDock\plugins\com.raikerdev.wave_link.sdPlugin\log\2026.8.10.log"
```

Tiene que decir `wavelink: connected on port <número>`.

## Desarrollo

Documentación técnica en [dev_doc.md](dev_doc.md) — empieza con un glosario de
todos los términos del SDK. Ideas para versiones futuras en
[ROADMAP.md](ROADMAP.md).

```
com.raikerdev.wave_link.sdPlugin/   El plugin
  plugin/                           Proceso Node que habla con Wave Link
  propertyInspector/                Pantalla de configuración
  static/                           Iconos
scripts/                            Herramientas de desarrollo
```

Casi todo se puede probar con el Stream Dock cerrado:

```bash
npm run probe
```

| Comando | Qué hace |
|---|---|
| `npm run probe` | Muestra lo que Wave Link está informando: canales, mixes, entradas y salidas |
| `npm run pi` | Abre la pantalla de configuración en el navegador, con datos reales |
| `npm run faces` | Muestra cómo quedan todas las teclas, sin necesitar el aparato |
| `npm run dev:on` | Editás el dibujo de las teclas y se actualiza en el aparato al guardar |
| `npm run dev:off` | Apaga lo anterior |
| `npm run icons` | Regenera los iconos |

Construido sobre el template `SDNodeJsSDKV2` del
[SDK oficial de StreamDock](https://github.com/MiraboxSpace/StreamDock-Plugin-SDK).
