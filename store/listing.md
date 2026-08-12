# La ficha, campo por campo

Para el formulario de [space.key123.vip](https://space.key123.vip/). Lo que va
en cada campo, listo para copiar. Las imágenes están en
[store/README.md](README.md).

---

## Product Name

```
Wave Link Control
```

La [guía de estilo](https://sdk.key123.vip/en/guide/style-guide.html) pide no
meter "Plugin" ni "Stream Dock" en el nombre. Este cumple. Tiene que coincidir
con el campo `Name` del manifest, que dice exactamente esto.

## Product type

**Plugin.** No es un icon pack ni un fondo ni un perfil: es código que corre como
proceso y habla con otra aplicación.

## Support devices

**Todos los modelos que tengan teclas**, o sea todos.

Vale saber por qué antes de tildar casillas:

- Las **cinco acciones funcionan en una tecla**. Ningún modelo queda afuera.
- El **dial** es un extra: *Volume Knob* también se puede poner en un encoder, y
  ahí gira para subir/bajar y se presiona para mutear. Los modelos sin dial usan
  *Volume Button*, que existe justamente para eso.
- **Probado de verdad sobre un AKP05E** (`AKP05EV25`, grilla de 5×3 con 4
  encoders). El resto debería andar —no hay nada específico del modelo en el
  código— pero no está verificado.

Si el formulario obliga a elegir modelos concretos y preferís no prometer lo que
no probaste, marcá el AKP05E y agregá el resto cuando alguien confirme.

## Overview

El texto de la ficha. En inglés, que es lo que lee cualquiera que no tenga la
tienda en chino:

```
Control Elgato Wave Link 3 straight from your Stream Dock.

Turn a dial and the fader moves in Wave Link. Press it and the channel mutes.
No alt-tabbing, no hunting for the right window mid-stream.

It reaches everything Wave Link exposes: channels, inputs, outputs, whole
mixes, and a single channel's cell inside a mix — the one you actually reach
for when the game is louder than your voice.

FIVE ACTIONS

- Volume Knob — On a dial: turn to set the level, press to mute. On a key it
  shows the level and mutes. You choose how much each click moves, from 1% to
  25%.
- Volume Button — Volume from a key, when you have no dials to spare. Turn it
  up, turn it down, or jump straight to a set value.
- Mute Toggle — Mutes the target and shows the state it is really in. Mute from
  Wave Link's own window and the key updates itself.
- Audio Effect — Switches a VST/AU effect loaded on a channel on and off.
- Output Mix — Sends an output to another mix. Set an alternate mix and the key
  flips between the two.

SETUP IS TWO DROPDOWNS

Drag the action onto a dial or a key and open its settings. Pick the type, pick
the target. The list fills itself with whatever Wave Link has open right now,
and choosing saves it — there is no save button, no title field to edit, nothing
to copy and paste.

THE KEY SHOWS THE TRUTH

Every key draws the live state: the level, the mute, which mix is feeding an
output, whether an effect is on. When Wave Link is closed or the target is gone
— you unplugged that microphone — the key says so instead of pretending.

REQUIREMENTS

- Windows 10 or later
- Elgato Wave Link 3, running
- Stream Dock 3.10.188.226 or later

Free and open source (MIT). English, Spanish and Simplified Chinese.
```

Y el mismo texto en chino simplificado, por si el formulario acepta una
descripción por idioma. La tienda es china: si acepta las dos, esta es la que va
a leer la mayoría.

```
在 Stream Dock 上直接控制 Elgato Wave Link 3。

旋转旋钮，Wave Link 里的推子就跟着动；按下旋钮，通道立即静音。直播中途不用再切
窗口，也不用去找那个窗口在哪。

Wave Link 暴露的一切都能控制：通道、输入设备、输出设备、整个混音，以及混音中的
单个通道——也就是游戏声盖过人声时你真正要调的那一格。

五个动作

- 音量旋钮 —— 放在旋钮上：旋转调节音量，按下切换静音。放在按键上会显示音量并可
  静音。每一格调节多少由你决定，1% 到 25%。
- 音量按键 —— 没有空余旋钮时，用按键控制音量：调高、调低，或直接跳到指定音量。
- 静音开关 —— 切换目标的静音，并显示真实状态。在 Wave Link 窗口里静音，按键会自
  己更新。
- 音频效果 —— 开关通道上加载的 VST/AU 效果。
- 输出混音 —— 把输出设备切换到另一个混音。设定备用混音后，按键会在两者之间来回
  切换。

配置只有两个下拉框

把动作拖到旋钮或按键上，打开设置，选好类型和目标即可。列表会用 Wave Link 当前
的内容自动填充，选中就保存——没有保存按钮，不用改标题，也不用复制粘贴任何东西。

按键显示真实状态

每个按键都会画出实时状态：音量、静音、哪个混音正在喂给输出设备、效果是否开启。
Wave Link 未打开，或者目标已经消失（比如你拔掉了那只麦克风），按键会直接说明，
而不是继续显示错误的信息。

系统要求

- Windows 10 或更高版本
- 正在运行的 Elgato Wave Link 3
- Stream Dock 3.10.188.226 或更高版本

免费开源（MIT）。支持英文、西班牙文和简体中文。
```

## New information

El "qué hay de nuevo". Es la primera versión, así que va como notas de lanzamiento:

```
1.0.0 — First release

- Volume Knob, Volume Button, Mute Toggle, Audio Effect and Output Mix
- Reaches all five Wave Link target types, including a channel inside a mix
- Live state on every key: level, mute, current mix, effect on or off
- Settings that fill themselves from Wave Link and save without a button
- English, Spanish and Simplified Chinese

Known limits: the hardware effects of Elgato microphones (noise removal,
Clipguard) are not covered — those live on the device, not on the channel.
Windows only for now.
```

Decir los límites acá sale más barato que contestarlos de a uno en los
comentarios.

## Related links

```
https://github.com/raikerdev/ajazz-wave-link
```

⚠️ **Ese repositorio tiene que existir y ser público antes de mandar la ficha.**
Es el mismo que declara el campo `URL` del manifest; si el enlace queda muerto,
queda muerto en los dos lados.

Si el formulario acepta más de uno, el segundo útil es la página de issues, que
es donde conviene que aterricen los reportes:

```
https://github.com/raikerdev/ajazz-wave-link/issues
```

## Version

```
1.0.0
```

Tiene que coincidir con `Version` en el manifest. La tienda muestra este número,
y el host lo usa para decidir si hay actualización: si subís un paquete sin
tocarlo, nadie lo recibe.

## Price / VIP price

```
0
```

En los dos campos. El plugin es MIT y el código está publicado: cobrarlo sería
raro y además no habría cómo sostenerlo. Si el formulario no acepta 0, buscá la
opción "Free" o "免费" en vez de escribir el número.

## Support system

**Windows solamente**, Windows 10 o superior.

No es una decisión de producto sino lo que dice el manifest: declara únicamente
`"Platform": "windows"` y no hay `CodePathMac`. macOS quedó fuera de la v1 a
propósito.

Si el formulario tiene además un campo de versión mínima del software:

```
3.10.188.226
```

Es la versión de Stream Dock que trae el Node embebido con el que corre el
plugin. Por debajo de eso no arranca.

## Support language

**English, Español, 简体中文.**

Son los tres que tienen archivo de idioma. Cualquier otro idioma ve el inglés,
que es el texto fuente — no queda roto, queda en inglés.
