# Rail Empire — Native Win7 32-bit Prototype

This directory contains a minimal native Windows prototype that demonstrates the feasibility of simulating **100 000 trains at 30 FPS** on a **Windows 7 32-bit / 3 GB RAM** PC.

## What it does

* Creates up to 200 000 train entities in a flat C array (~20 bytes each, ~4 MB for 100 000 trains).
* Simulates movement along a pre-computed 4096-point route using simple physics.
* Spreads the update across 4 worker threads (pthreads/win32 threads via MinGW-w64).
* Renders the route and each train as a 2×2 pixel dot into a 1024×768 32-bit DIB section.
* Updates the window title with the live FPS count.

## Build (cross-compile on Linux)

```bash
cd native-win7-proto
make
```

This produces `re-native.exe`, a 32-bit Windows PE executable (~480 KB).

## Build requirements

* `i686-w64-mingw32-gcc` and `binutils-mingw-w64-i686`
* No external dependencies beyond the standard Win32 API and GDI32.

## Run on Windows 7

```cmd
re-native.exe 100000
```

The optional argument is the number of trains (default 100 000, max 200 000).

## Why this proves the concept

The JavaScript/Canvas version is single-threaded and object-heavy, which limits it on low-end 32-bit machines. A native build:

* uses compact structs instead of JS objects,
* splits simulation across CPU cores,
* draws directly into a raw pixel buffer,
* can be further extended with a full port of the ORM/routing/schedule logic.

This prototype only exercises the rendering/simulation core. A complete Rail Empire native client would need to port the route graph, ORM, scheduling, and economy code, but the baseline performance target is achievable.
