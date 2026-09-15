# Vibeforge

AI Ad Designer Pipeline Node for O-Kay-Est Media. Generates ad creatives across 56+ formats from a single creative brief, with AI-assisted generation, review/approval workflow, and delivery to OKLaunch.

## Pipeline Position

```
Unity Core  ──▶  Vibeforge  ──▶  OKLaunch
(job source)     (AI ad designer)  (distribution)
```

- **Unity Core** sends ad job requests (client, brief, formats)
- **Vibeforge** generates creatives, Joe reviews/approves, exports assets
- **OKLaunch** receives finished assets and runs them

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Tauri v2 (Electron migration planned) |
| Frontend | React 19 |
| Language | TypeScript ~5.6 |
| Bundler | Vite ^6.0 |
| Backend | Rust (Edition 2021) |
| AI | Claude (text + vision), image generation TBD |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) (with `cargo`)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Install & Run

```sh
npm install
npm run tauri dev
```

### Build

```sh
npm run tauri build
```

## Project Structure

```
ok-plug/
├── src/                        # React frontend
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # React entry point
│   └── styles.css              # Global styles
├── src-tauri/                  # Rust / Tauri backend
│   ├── src/
│   │   ├── lib.rs              # Tauri app setup + commands
│   │   └── main.rs             # Binary entry point
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── docs/
│   ├── vibeforge-blueprint-v2.md   # Full project blueprint
│   └── format-catalog.ts           # Ad format catalog (57 entries)
├── .opencode/
│   └── command/
│       └── integrate-format-catalog.md  # Integration command
├── CHANGELOG.md
├── PROJECT_TIMELINE.md
└── package.json
```

## Blueprint

See [`docs/vibeforge-blueprint-v2.md`](docs/vibeforge-blueprint-v2.md) for the full project blueprint including:

- Integration contracts with Unity Core and OKLaunch
- Module architecture (Job Intake, AI Creative Assistant, Template Engine, Render/Export, Review Queue, Delivery)
- 12-step build sequence with definitions of done
- Format catalog with 56+ ad specifications across 8 platforms

## Open Decisions

- Unity Core and OKLaunch actual schemas (blocks Step 11)
- AI provider(s) for text + image generation
- Video/motion formats for v1 (static-only acceptable first release)
- Brand token palette (real O-Kay-Est Media vs. Vibeforge distinct)

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview production build |
| `npm run tauri` | Run Tauri CLI commands |

## Recommended IDE

- [VS Code](https://code.visualstudio.com/) + [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

Proprietary — O-Kay-Est Media
