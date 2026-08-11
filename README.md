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
| Girar el dial | Sube o baja el volumen, 2% por click |
| Apretar el dial | Alterna el mute |
| Apretar el botón | Alterna el mute |

### Mute Toggle

Para botones. Alterna el mute del destino elegido, y el icono refleja el estado
real: si mutás desde la interfaz de Wave Link, el botón se actualiza solo.

## Configuración

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
scripts/gen-icons.mjs               Genera los iconos (npm run icons)
```

Construido sobre el template `SDNodeJsSDKV2` del
[SDK oficial de StreamDock](https://github.com/MiraboxSpace/StreamDock-Plugin-SDK).
