# Third-party notices

lyricstapper source code is licensed separately under [LICENSE](LICENSE). The
following bundled assets and runtime dependencies retain their own licenses.
`package-lock.json` is the authoritative version and integrity record.

## Bundled fonts

| Component | Copyright / source | License |
| --- | --- | --- |
| Geist Sans and Geist Mono | Copyright 2023 Vercel, in collaboration with basement.studio; [vercel/geist-font](https://github.com/vercel/geist-font) | SIL Open Font License 1.1; [local copy](public/fonts/OFL-Geist.txt) |
| Creepster | Copyright 2011 Font Diner, Inc.; distributed through [Fontsource](https://fontsource.org/fonts/creepster) | SIL Open Font License 1.1; [local copy](public/fonts/OFL-Fontsource.txt) |
| Inter | The Inter Project Authors; distributed through [Fontsource](https://fontsource.org/fonts/inter) | SIL Open Font License 1.1; [local copy](public/fonts/OFL-Fontsource.txt) |
| League Spartan | The League Spartan Project Authors; distributed through [Fontsource](https://fontsource.org/fonts/league-spartan) | SIL Open Font License 1.1; [local copy](public/fonts/OFL-Fontsource.txt) |
| Lexend | The Lexend Project Authors; distributed through [Fontsource](https://fontsource.org/fonts/lexend) | SIL Open Font License 1.1; [local copy](public/fonts/OFL-Fontsource.txt) |
| Montserrat | The Montserrat Project Authors; distributed through [Fontsource](https://fontsource.org/fonts/montserrat) | SIL Open Font License 1.1; [local copy](public/fonts/OFL-Fontsource.txt) |

The Fontsource package archives and the served local copy include the
corresponding copyright and OFL text.

For release verification, the self-hosted Geist files currently have these
SHA-256 checksums:

```text
9b6f5ff45b278c744b5f379a2c4ecbaf858a842b8eaf82ac8d21b699ca16c608  public/fonts/geist-variable.woff2
5f3d6ad60f29d6cb708414ec6887163d63bf197377ef5417d2483ff31ace6c3b  public/fonts/geist-mono-variable.woff2
```

## Demo media

| Component | Copyright / source | License |
| --- | --- | --- |
| `docs/assets/demo/a-thousand-years-demo.mp3`, `lyrics.txt` and their use in the rendered demo | “A Thousand Years” by Josh Woodward; [official song page and download](https://www.joshwoodward.com/song/AThousandYears) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Required attribution:

> Music – “A Thousand Years” by Josh Woodward. Free download:
> https://www.joshwoodward.com/

The bundled excerpt covers approximately 00:01:34.2–00:01:45.5 of the original
recording. It was trimmed, faded in and out, transcoded to MP3 and paired with
timed captions. These modifications do not suggest endorsement by the artist.
The original artist download and bundled excerpt have these SHA-256 checksums:

```text
9ee7c318b53451371f0fbafc948c0c17f2e60116035d086b2f1c39bc17bcbc43  JoshWoodward-AThousandYears.mp3 (original download)
b73113474d164bdb8d84e564a92fbdd09744eaf5f0d720f15d9759efd714a207  docs/assets/demo/a-thousand-years-demo.mp3
```

## Runtime libraries

| Component | Source | License |
| --- | --- | --- |
| Astryx core and neutral theme | [facebook/astryx](https://github.com/facebook/astryx) | MIT |
| StyleX | [facebook/stylex](https://github.com/facebook/stylex) | MIT |
| Mediabunny | [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny) | Mozilla Public License 2.0 |
| React, React DOM and React Server DOM Webpack | [facebook/react](https://github.com/facebook/react) | MIT |
| caniuse-lite browser data | [browserslist/caniuse-lite](https://github.com/browserslist/caniuse-lite) | CC BY 4.0 |

Installed npm packages carry their full license texts in their package folders.
Mediabunny is consumed as an unmodified library; modifications to its MPL-covered
files would remain subject to MPL 2.0.
