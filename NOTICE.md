# Notices and attribution

## canivibecodeit — primary data source

Files under `data/upstream/` are verbatim copies of `data/apps/*.json` from [canivibecodeit](https://github.com/canivibecodeit/canivibecodeit) by Rob Hallam & contributors, published at [canivibecodeit.com](https://canivibecodeit.com), and licensed under the MIT license reproduced below.

Files under `data/overlays/` are derivative works: educational lessons generated and edited by the Sage.Education team from the upstream entries. All overlay content, site code, and pipeline code in this repository are our own transformative work, licensed AGPL-3.0 (see [LICENSE](LICENSE)). The exception is any overlay whose slug also appears in `data/first-party/`, described in the next section.

None of the upstream project's web application code is included in this repository. Every lesson page built from an upstream entry credits canivibecodeit and links to it; additional cited resources appear per lesson under "Sources & further reading".

## First-party lessons

Files under `data/first-party/` describe projects Sage.Education builds and runs. They are original works, contain no upstream material, and are licensed AGPL-3.0 with the rest of this repository. An overlay whose slug appears there is not derived from canivibecodeit, and its lesson page says so.

`make validate` rejects any overlay that has neither an upstream entry nor a first-party entry, so the exemption is always explicit and always reviewable. It also rejects a slug that appears in both places, because `make sync` replaces the upstream mirror wholesale and could otherwise shadow one of our entries silently.

### Upstream MIT license

```text
MIT License

Copyright (c) 2026 Rob Hallam

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
