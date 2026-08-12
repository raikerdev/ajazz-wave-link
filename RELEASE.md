# Plan de publicación — v1.0.0

Para publicar **Wave Link Control** en la tienda de AJAZZ
([space.key123.vip](https://space.key123.vip/)). Estado del plugin en
[ROADMAP.md](ROADMAP.md).

## Dónde estamos

Lo que ya está listo, verificado sobre el dispositivo real:

- **Cinco acciones**: Volume Knob, Volume Button, Mute Toggle, Audio Effect y
  Output Mix.
- **Los cinco tipos de destino** de Wave Link, incluido `channelMix`.
- **Estado real en la tecla**: nivel, mute, destino, y avisos cuando no hay
  destino o Wave Link está cerrado.
- **Instalación limpia de 398KB**, 26 archivos, sin fuentes sueltas ni artefactos
  de desarrollo (verificado 2026-08-12).
- Documentación técnica y herramientas de diagnóstico versionadas.

## Bloqueantes

### 1. Los textos de la tecla — ✅ RESUELTO (2026-08-12)

`plugin/i18n.js` traduce lo que se dibuja en las teclas, con el idioma que el host
informa en su `-info`. Verificado lanzando el plugin en español, inglés y alemán
(este último cae a inglés, como corresponde).

### 2. El manifest en español — ✅ RESUELTO (2026-08-12)

Invertido: el manifest quedó en inglés —que es el texto que ve quien tenga
cualquier idioma sin archivo propio— y `es.json` aporta el español.

**Chino agregado (2026-08-12)**: `zh_CN.json`, con las cinco acciones y las 46
claves de la pantalla de configuración, más las cuatro cadenas de las teclas en
`plugin/i18n.js`. Importa para esta tienda en particular: la de AJAZZ es china y
buena parte de quien la mira lo hace en chino simplificado.

### 3. El campo `URL` y la licencia — ✅ RESUELTO (2026-08-12)

- **MIT**, en `LICENSE` en la raíz del repositorio. Viaja también dentro del
  paquete: se copia al empaquetar, así que hay un solo archivo que mantener.
- **`URL`**: `https://github.com/raikerdev/ajazz-wave-link`.

⚠️ **Ese repositorio tiene que existir y ser público antes de publicar la ficha**,
o el enlace de "más información" de la tienda queda muerto.

### 4. Script de empaquetado — ✅ RESUELTO (2026-08-12)

`npm run package` arma `dist/com.raikerdev.wave_link.sdPlugin-1.0.0.zip`:
29 archivos, 115 KB comprimidos.

Se construye desde una **lista blanca**, no desde exclusiones, así que no puede
filtrarse ni el `dev.json` que escribe `npm run dev:on` ni el `log/` que crea
log4js. Antes de comprimir verifica además que cada icono y cada pantalla que
declara el manifest exista de verdad.

## Antes de subir: repaso completo

Con `npm run dev:off` puesto, instalación limpia, y **probando en el aparato**:

**Las cinco acciones**
- [ ] Volume Knob en un dial: girar mueve el fader en Wave Link, presionar mutea.
- [ ] Volume Knob en una tecla: muestra el nivel, presionar mutea.
- [ ] Volume Button en sus tres modos: subir, bajar y fijar (probar también 0%).
- [ ] Mute Toggle: mutea, y refleja el mute hecho desde la interfaz de Wave Link.
- [ ] Audio Effect: enciende y apaga el efecto, y refleja el cambio hecho desde
      Wave Link. Probar también **borrando el efecto** desde Wave Link: la tecla
      debe decir "no existe".
- [ ] Output Mix: manda una salida a otro mix, y alterna si hay mix alternativo.

**Los cinco tipos de destino**, sobre todo `channelMix`, que es el que más se usa.

**Los casos feos**
- [ ] Wave Link cerrado al arrancar: las teclas dicen que no hay conexión.
- [ ] Abrir Wave Link con el plugin ya corriendo: se reconecta y repinta solo.
- [ ] Cerrar Wave Link con el plugin corriendo: las teclas avisan.
- [ ] Desconectar el dispositivo de audio configurado (por ejemplo, apagar unos
      auriculares Bluetooth): la tecla dice "no existe" en vez de mentir.
- [ ] Arrastrar una acción sin configurarla: dice "sin destino", no parpadea sola.

**La pantalla de configuración**
- [ ] Los desplegables se llenan solos y guardan sin botón.
- [ ] Cerrar y reabrir conserva lo elegido.
- [ ] En inglés, español y chino (`npm run pi` acepta `&lang=zh_CN`). Verificado
      en el navegador con las tres pantallas; falta verlo en el aparato con la
      aplicación puesta en chino, sobre todo el texto de las teclas.

**Instalación desde cero**
- [ ] Descomprimir el paquete en la carpeta de plugins de una máquina que **nunca**
      tuvo este plugin, y comprobar que arranca sin nada previo.

**Lo de afuera del código**
- [ ] El repositorio `github.com/raikerdev/ajazz-wave-link` existe y es público.
- [ ] `npm run package` corrido **después** de `npm run dev:off`.
- [ ] Las imágenes de `store/` regeneradas si se tocó el dibujo de alguna tecla o
      la pantalla de configuración: salen del código, así que envejecen con él.

## Cómo se publica

**Aviso honesto**: la documentación del SDK **no explica el proceso de
publicación**. Solo enlaza a [space.key123.vip](https://space.key123.vip/) como
sitio de la tienda. Lo que sigue es lo que se pudo confirmar inspeccionándola;
los pasos exactos del formulario recién se ven una vez dentro.

1. **Crear una cuenta** en [space.key123.vip](https://space.key123.vip/).
2. **Preparar el paquete**: `npm run package`. El zip que genera ya tiene la forma
   correcta — la carpeta `.sdPlugin` adentro — que es como la tienda distribuye
   los plugins de terceros (se descargan sin extensión `.zip`, pero son zips).
3. **Cargar la ficha** con los materiales de abajo.
4. Si algo no queda claro, los canales del fabricante son el foro
   [bbs.key123.vip](https://bbs.key123.vip/) y `service@key123.vip`. Vale
   preguntar directamente por los requisitos de revisión: no están publicados.

Para la ficha vas a necesitar preparar:

- **Nombre**: "Wave Link Control". La
  [guía de estilo](https://sdk.key123.vip/en/guide/style-guide.html) pide no meter
  "Plugin" ni "Stream Dock" en el nombre — cumplimos.
- **Descripción en inglés**, dejando claro que **requiere Elgato Wave Link 3** y
  que por ahora es **solo Windows**.
- **Imágenes**: ya están hechas, en [store/](store/README.md). El avatar 480×480
  lo genera `npm run icons`; las cinco imágenes 16:9 de la ficha,
  `npm run store -- --lang=all`, en inglés y en chino. Salen del renderer de
  verdad, así que muestran las teclas tal como se ven en el aparato.
- **Versión mínima del software**: 3.10.188.226, la que ya declara el manifest.

## Decisiones que conviene tomar antes, no después

**Los iconos se apartan de la guía de estilo, a propósito.** Pide 40×40 y de un
solo color sobre fondo transparente; los nuestros son de 72px y con placa —
oscura los de acción, con degradado la marca del plugin y la categoría— porque un
glifo blanco sobre transparente desaparece en el listado de acciones de la
aplicación. Si la revisión de la tienda lo objeta, el cambio es regenerar con
`npm run icons` y ajustar `scripts/gen-icons.mjs`. Vale la pena decidir de
antemano si preferís cumplir la guía desde el arranque.

⚠️ La marca del plugin **es propia**, no una versión del icono de Elgato: el
dibujo de ellos es de ellos, y una ficha de tienda no es lugar para discutir eso.
Lo que comparte es el lenguaje —un mixer, faders, el mismo verde de nivel que
usan las teclas— y eso alcanza para que se lea de qué se trata.

**El ajuste fino no funciona en el AKP05E.** El gesto está implementado pero el
dispositivo nunca reporta `pressed`, así que no se activa. No rompe nada, pero
**no hay que anunciarlo** en la ficha: en otros dispositivos con dial podría
funcionar, en el tuyo no.

**La proporción del panel del dial nunca se midió.** Se dibuja en 200×100 porque
los paneles del plugin oficial de Elgato dan ~2:1. Si el AKP05E fuera distinto, la
imagen se ve estirada. Antes de publicar conviene cerrar esto con
`npm run dev:calibrate`.

## Después de publicar

- **Versionado**: `Version` en el manifest es lo que ve la tienda. Subirla en cada
  entrega y anotar los cambios en algún lado —un `CHANGELOG.md` alcanza.
- **Los que van a escribir** son gente con hardware distinto al tuyo: micrófonos
  Elgato con efectos, otros modelos de Stream Dock. Vale la pena tener a mano
  `npm run probe -- --raw`, que es lo que hace falta pedirles para diagnosticar
  sin acceso a su máquina.
- **Lo que quedó afuera de la v1**: los efectos de **hardware** de los micrófonos
  Elgato (los VST/AU sí están), el fundido del modo "fijar", y macOS.
