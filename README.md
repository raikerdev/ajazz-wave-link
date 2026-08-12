**English** · [Español](README.es.md)

# Wave Link Control

A plugin for the **AJAZZ Stream Dock** that controls the volume and mute state of
**Elgato Wave Link 3** from the device's physical dials and keys.

One dial per channel: turn it and the fader moves in Wave Link, press it and the
channel mutes. It reaches everything Wave Link exposes — channels, a single
channel's cell inside a mix, inputs, outputs and whole mixes.

## Requirements

- Windows 10 or later
- Stream Dock AJAZZ **3.10.188.226** or later (it ships the Node runtime the
  plugin runs on)
- Elgato Wave Link 3
- Node.js 20+, only to build it

## Installation

```bash
npm run deps
```

```bash
npm run install-plugin
```

The second command builds the plugin, copies it into Stream Dock's plugins folder
and **restarts the Stream Dock AJAZZ application** — it only reads that folder at
startup. If the earlier version (`com.ricardoaom.wavelink`) is installed, it is
removed.

## Actions

### Volume Knob

Goes on a dial or on a key.

| Gesture | Effect |
|---|---|
| Turn the dial | Raises or lowers the volume |
| Turn the dial **while holding it** | Fine adjustment: a quarter step per click |
| Press the dial | Toggles mute |
| Press the key | Toggles mute |

Its settings let you choose **how much each click moves the fader** (1% to 25%,
2% by default). Drop it to 1% to balance a mix precisely; raise it to 10% to
cross the whole range quickly.

### Volume Button

For keys, when you have no dials to spare. Its settings decide what pressing does:

| Mode | Effect |
|---|---|
| **Turn the volume up** | Raises it one step (5% by default) |
| **Turn the volume down** | Lowers it one step |
| **Set to a value** | Jumps to whatever volume you set, from 0% to 100% |

The key shows the current volume and, underneath, what it will do: `+ 5%`, `− 5%`
or `→ 30%`.

### Mute Toggle

For keys. Toggles mute on the chosen target. The key shows a speaker — white
while sound is going out, red and crossed out when muted — along with the current
level, and it tracks the real state: mute from Wave Link's own interface and the
key updates itself.

### Audio Effect

For keys. Turns a VST/AU effect loaded on a Wave Link channel on and off — a
voice changer on the microphone, say.

You pick the **channel** and the **effect**. The key names it and turns green
while it is on.

Effects have to be added from Wave Link first; the plugin only switches them.
The **hardware** effects of Elgato microphones (noise removal, Clipguard) are not
covered: those live on the device, not on the channel.

### Output Mix

For keys. Changes which mix an output listens to — sending your headphones from
the *Personal Mix* to *Stream - Music* to hear what goes out to the stream,
without opening Wave Link.

Its settings take the **output**, the **mix** to send it to and, optionally, an
**alternate mix**. Leave the alternate empty and the key always sends the output
to the chosen mix; fill it in and the key flips between the two.

The key shows which mix is feeding the output right now — green when it matches
the one you configured — and underneath, where pressing will send it.

## Settings

*Audio Effect* and *Output Mix* have their own panels, described above.
*Volume Knob*, *Volume Button* and *Mute Toggle* share this one:

Drag the action onto a dial or a key and open its settings. There are two
dropdowns:

1. **Type** — what kind of thing you want to control.
2. **Target** — which one. The list fills itself with whatever Wave Link has at
   that moment.

Choosing saves immediately; there is no save button.

### Available types

| Type | What it controls |
|---|---|
| **Channel (master)** | A channel's overall volume, the fader at the top in Wave Link |
| **Channel within a Mix** | One channel's cell in one mix — *Game → Personal Mix*, say — which is what the Wave Link grid shows |
| **Input** | An input device, such as a microphone |
| **Output** | An output device, such as headphones |
| **Mix (master)** | The volume of an entire mix |

If the target list is empty, Wave Link is not open: start it and reopen the
settings.

## When something is wrong

**The key reads "No target" or "No connection".** Nothing is configured, or Wave
Link is not running. The key always says what it is missing.

**The key flashes when you use it.** The target no longer exists — you unplugged
that microphone, for instance. Open the settings and pick the target again.

**The lists are empty.** Wave Link is not running, or it started after the
plugin. Start Wave Link, then close and reopen the settings.

**Nothing responds at all.** Check the log, under
`%appdata%\HotSpot\StreamDock\plugins\com.raikerdev.wave_link.sdPlugin\log\`.
It should say `wavelink: connected on port <number>`.

## Development

Technical documentation in [dev_doc.md](dev_doc.md) — it opens with a glossary of
every SDK term. Ideas for future versions in [ROADMAP.md](ROADMAP.md), and the
steps to publish in [RELEASE.md](RELEASE.md). Both are written in Spanish.

```
com.raikerdev.wave_link.sdPlugin/   The plugin
  plugin/                           Node process that talks to Wave Link
  propertyInspector/                Settings panel
  static/                           Icons
scripts/                            Development tools
```

Nearly everything can be exercised with Stream Dock closed:

```bash
npm run probe
```

| Command | What it does |
|---|---|
| `npm run probe` | Shows what Wave Link is reporting: channels, mixes, inputs and outputs |
| `npm run pi` | Opens the settings panel in a browser, against real data |
| `npm run faces` | Renders every key face, no device needed |
| `npm run dev:on` | Edit the key artwork and it redraws on the device as you save |
| `npm run dev:off` | Turns that back off |
| `npm run icons` | Regenerates the icons |
| `npm run package` | Builds the distributable zip into `dist/` |

Built on the `SDNodeJsSDKV2` template from the
[official StreamDock SDK](https://github.com/MiraboxSpace/StreamDock-Plugin-SDK).

## Licence

[MIT](LICENSE) — use it, modify it and redistribute it freely, keeping the
copyright notice.
