# Material para la ficha de la tienda

Todo lo que hay acá se genera; no se edita a mano. Si algo no te gusta, se toca
el script y se vuelve a correr.

```bash
npm run icons
```

```bash
npm run store -- --lang=all
```

## Qué sube a cada campo

| Campo del formulario | Archivo | Formato que pide |
|---|---|---|
| **Product Avatar** | `product-avatar.png` | 480×480, `.png` |
| **Product Imgs** | `en/1-hero.png` … `en/5-setup.png` | 16:9, `.png` |

Las imágenes van numeradas por el orden en que conviene mostrarlas: la portada
primero, y la pantalla de configuración al final.

| Imagen | Qué muestra |
|---|---|
| `1-hero` | Portada: nombre, para qué sirve y una fila de teclas reales |
| `2-actions` | Las cinco acciones, cada una con su tecla |
| `3-dial` | El panel del dial en tres estados |
| `4-feedback` | Que la tecla refleja el estado real, incluidos los casos feos |
| `5-setup` | La pantalla de configuración de verdad, con datos cargados |

En `zh/` está el mismo set en chino. La tienda de AJAZZ es china; si el
formulario permite subir material por idioma, ese es el que corresponde ahí.
Si solo acepta un set, subí el de `en/`.

## De dónde sale cada cosa

- **El avatar** es la misma marca que el icono del plugin, sin el margen. Sale de
  `scripts/gen-icons.mjs`, que la dibuja a 48, 128 y 480 px desde la misma
  definición. No hay dos dibujos que mantener sincronizados.
- **Las teclas de las imágenes son las de verdad**: las dibuja
  `plugin/render/keyFace.js`, el mismo módulo que pinta el aparato. Si cambia el
  diseño de una tecla, estas imágenes cambian con él.
- **La pantalla de configuración también**: se lee el `index.html` real con su
  CSS, y solo se le inyecta la lista de destinos, que en vivo la pone el plugin.
  La versión en chino se arma con las traducciones de `zh_CN.json`.

Los nombres de canales que se ven (Music, Game, Mic, Browser, Headphones) son de
ejemplo, escritos en el script. Los niveles y estados también.

## Lo que la ficha necesita además de las imágenes

El resto de los campos del formulario —nombre, descripción, versión, precio,
idiomas— están escritos y listos para copiar en [listing.md](listing.md).

Los pasos de la publicación en sí, y lo que conviene repasar antes, están en
[RELEASE.md](../RELEASE.md).
