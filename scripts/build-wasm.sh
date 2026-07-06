#!/usr/bin/env bash
# Build the wasm crate without wasm-pack, emitting the WASM component of the
# unified distribution into dist/wasm:
#   1. cargo build (rustup 1.93.1 toolchain) -> raw wasm
#   2. wasm-bindgen --target web -> glue + wasm_bg.wasm
#   3. (optional) wasm-opt if available
#   4. prune to the essential files (wasm.js, wasm.d.ts, wasm_bg.wasm)
#
# wasm32-unknown-unknown is architecture-independent bytecode, so a single
# artifact serves every platform (no arm64/x86_64 split required).
set -euo pipefail

export RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
TC="$RUSTUP_HOME/toolchains/1.93.1-x86_64-unknown-linux-gnu"
export PATH="$TC/bin:$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

# Prefer the pinned toolchain; fall back to whatever cargo is active (CI installs
# 1.93.1 via rustup, but the exact triple/path can differ across runners).
CARGO="$TC/bin/cargo"
if [ ! -x "$CARGO" ]; then
  CARGO="$(command -v cargo)"
  TC="$(rustc --print sysroot)"
  echo "  pinned toolchain not found, using active cargo: $CARGO (sysroot $TC)"
fi

cd "$(dirname "$0")/.."

OUT_DIR="dist/wasm"
mkdir -p "$OUT_DIR"

echo "[1/4] cargo build (wasm32)"
# Smallest binary: rebuild std with panic=immediate-abort (strips panic-formatting
# machinery). Needs the rust-src component + bootstrap to use the -Z flags on this
# pinned stable toolchain. Fall back to a plain release build if either is missing.
BUILD_STD_OK=0
if [ -d "$TC/lib/rustlib/src/rust/library/std" ]; then
  if RUSTC_BOOTSTRAP=1 RUSTFLAGS="-Zunstable-options -Cpanic=immediate-abort" \
      "$CARGO" build --release --target wasm32-unknown-unknown --lib \
      -Z build-std=std,panic_abort; then
    BUILD_STD_OK=1
    echo "  built with -Z build-std + panic=immediate-abort"
  fi
fi
if [ "$BUILD_STD_OK" -eq 0 ]; then
  echo "  build-std unavailable, plain release build (run: rustup component add rust-src)"
  "$CARGO" build --release --target wasm32-unknown-unknown --lib
fi

RAW=target/wasm32-unknown-unknown/release/wasm.wasm
echo "[2/4] wasm-bindgen -> $OUT_DIR"
# Drop the name + producers sections and skip demangling: pure size, no runtime cost.
wasm-bindgen "$RAW" --target web --out-dir "$OUT_DIR" --out-name wasm \
  --remove-name-section --remove-producers-section --no-demangle

echo "[3/4] wasm-opt (-Oz, size)"
if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Oz --converge \
    --enable-bulk-memory --enable-sign-ext \
    --enable-nontrapping-float-to-int --enable-mutable-globals \
    --strip-debug --strip-producers --vacuum \
    "$OUT_DIR/wasm_bg.wasm" -o "$OUT_DIR/wasm_bg.wasm"
  echo "  wasm-opt done"
else
  echo "  wasm-opt not found, skipping"
fi

echo "[4/4] prune to essential files"
# Keep only the runtime binary, the JS glue and its type declarations.
rm -f "$OUT_DIR/wasm_bg.wasm.d.ts" "$OUT_DIR/package.json" "$OUT_DIR/README.md" "$OUT_DIR/.gitignore"
ls -la "$OUT_DIR"
echo "OK"
