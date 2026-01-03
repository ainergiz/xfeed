# xfeed

[![CI](https://github.com/ainergiz/xfeed/actions/workflows/ci.yml/badge.svg)](https://github.com/ainergiz/xfeed/actions/workflows/ci.yml)

Terminal-based X.com client with vim-style navigation so you never need to leave your terminal while your agent is on work. Stay dopaminated, stay in the loop :) Built with [OpenTUI](https://github.com/sst/opentui) and [Bun](https://bun.sh).

> **Early Development:** This project is in early development. Expect bugs and breaking changes. 

## Install

Requires [Bun](https://bun.sh):

```bash
bun install -g xfeed
```

> **Note:** `npm install` won't work - xfeed requires the Bun runtime.

## Requirements

- macOS or Linux
- [Bun](https://bun.sh) >= 1.0
- A terminal with true color support ([Ghostty](https://ghostty.org), [iTerm2](https://iterm2.com), [Kitty](https://sw.kovidgoyal.net/kitty), [Warp](https://warp.dev))
- X/Twitter cookies in a supported browser (Safari, Chrome, Arc, Brave, Firefox)

## Usage

```bash
xfeed
```

On first run, you'll be prompted to select a browser to read cookies from or enter cookies manually.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Disclaimer

This project is **not affiliated with, endorsed by, or connected to X Corp (formerly Twitter)** in any way. It uses undocumented APIs which may break at any time. **Use at your own risk.** The authors are not responsible for any consequences of using this software, including but not limited to account restrictions.

## Acknowledgments

- [bird](https://github.com/steipete/bird) by Peter Steinberger - X API client implementation
- [OpenTUI](https://github.com/sst/opentui) - Terminal UI framework
- [sweet-cookie](https://github.com/steipete/sweet-cookie) - Browser cookie extraction

## License

[MIT](LICENSE)
