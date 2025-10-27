# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# 🕰️ Focusnook — A Cozy Timer Desktop App

Focusnook is a cross-platform **desktop productivity app** built with **Tauri v2**, **React + Vite**, and **Rust**.  
Its initial prototype is a **single reliable timer** designed with accessibility and neurodivergent-friendly design principles:

- predictable UI
- gentle visual feedback
- minimal cognitive overhead
- accurate background timing (Rust backend)

This repository serves both as a **real user-facing tool** and as a **solid foundation** to build more advanced “Focus OS”–style features in the future.

---

## 🧭 Project Overview

| Layer         | Tech Stack                      | Purpose                                                                |
| ------------- | ------------------------------- | ---------------------------------------------------------------------- |
| UI            | React (Vite), Tailwind CSS      | Timer visualization, configuration, and user interaction               |
| Backend       | Tauri v2 (Rust)                 | Timing logic, event emission, native window & resource management      |
| Communication | Tauri invoke + event APIs       | Frontend invokes commands, backend emits `timer:tick` and `timer:done` |
| Build Targets | macOS (primary), Windows, Linux | Packaged desktop app                                                   |

---

## 🏗️ Project Structure

focusnook/
├── public/ # static assets (e.g. chime.mp3)
├── src/ # React frontend (Vite + TS)
│ ├── App.tsx # Timer UI + state handling
│ ├── main.tsx # React entry point
│ └── index.css # TailwindCSS entry
├── src-tauri/ # Tauri Rust backend
│ ├── Cargo.toml # Rust dependencies
│ ├── src/
│ │ ├── lib.rs # Tauri app entry, command definitions
│ │ └── timer.rs # Timer state machine and event emission
│ └── tauri.conf.json # Tauri config (no extra plugins)
├── tailwind.config.js
├── package.json
└── README.md

---

## 🧠 Design Principles

- **Low cognitive load:** minimal color shifts, no flashing or aggressive animations
- **Predictable interaction:** single timer, clear states (running / paused / complete)
- **Gentle cues:** soft audio notification, no popups or vibrations

---

## 🚀 Getting Started

### Prerequisites

- **Rust** (`cargo --version`) — install via [rustup](https://rustup.rs/)
- **Node.js** (≥18)
- macOS (primary dev platform, cross-platform supported)

### Install & Run (Dev)

```bash
git clone https://github.com/YOURUSERNAME/focusnook.git
cd focusnook
npm install
npm run tauri dev
```
