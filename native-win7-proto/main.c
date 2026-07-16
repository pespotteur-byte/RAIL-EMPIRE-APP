/*
 * Rail Empire — native Win7 32-bit prototype
 * Goal: simulate 100 000 trains at 30 FPS on Windows 7 / 3 GB RAM.
 *
 * Build (cross-compile from Linux):
 *   i686-w64-mingw32-gcc -O3 -march=i686 -mfpmath=sse -msse2 \
 *     -o re-native.exe main.c -lgdi32 -luser32 -lkernel32
 *
 * Run on Windows 7:
 *   re-native.exe [trains_count]
 */

#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define WIDTH 1024
#define HEIGHT 768
#define MAX_TRAINS 200000
#define ROUTE_POINTS 4096
#define TARGET_FPS 30
#define WORKER_THREADS 4

typedef struct {
    double x, y;
} Vec2;

typedef struct {
    float t;          /* 0..1 position along route */
    float speed;      /* pixels per frame */
    float target;     /* target speed */
    float dir;        /* +1 / -1 */
    uint32_t color;
} Train;

typedef struct {
    Train *trains;
    int start;
    int count;
    float dt;
    HANDLE hEventStart;
    HANDLE hEventDone;
    volatile LONG running;
} WorkerArg;

static Vec2 route[ROUTE_POINTS];
static Train trains[MAX_TRAINS];
static int trainCount = 100000;
static volatile LONG gFrame = 0;
static HANDLE workerEventsStart[WORKER_THREADS];
static HANDLE workerEventsDone[WORKER_THREADS];
static WorkerArg wargs[WORKER_THREADS];
static HANDLE workerHandles[WORKER_THREADS];

static __inline uint32_t rgb(uint8_t r, uint8_t g, uint8_t b) {
    return (r << 16) | (g << 8) | b;
}

static void buildRoute(void) {
    for (int i = 0; i < ROUTE_POINTS; i++) {
        double a = (double)i / ROUTE_POINTS * 8.0 * M_PI;
        route[i].x = WIDTH/2 + (WIDTH*0.42) * cos(a) + 120 * cos(a*3.0);
        route[i].y = HEIGHT/2 + (HEIGHT*0.38) * sin(a) + 90 * sin(a*5.0);
    }
}

static Vec2 routePos(float t) {
    t = (float)fmod(t, 1.0);
    if (t < 0) t += 1.0f;
    float idx = t * (ROUTE_POINTS - 1);
    int i = (int)idx;
    int j = i + 1;
    if (j >= ROUTE_POINTS) j = ROUTE_POINTS - 1;
    float frac = idx - (float)i;
    Vec2 p;
    p.x = route[i].x * (1.0 - frac) + route[j].x * frac;
    p.y = route[i].y * (1.0 - frac) + route[j].y * frac;
    return p;
}

static DWORD WINAPI workerThread(LPVOID arg) {
    WorkerArg *w = (WorkerArg*)arg;
    while (1) {
        WaitForSingleObject(w->hEventStart, INFINITE);
        if (w->count == 0) break;

        Train *T = w->trains + w->start;
        for (int i = 0; i < w->count; i++) {
            float s = T[i].speed;
            float diff = T[i].target - s;
            if (diff > 0.05f) s += 0.02f;
            else if (diff < -0.05f) s -= 0.02f;
            if (s > T[i].target) s = T[i].target;
            if (s < 0) s = 0;
            T[i].speed = s;
            T[i].t += s * T[i].dir * 0.00005f;
            if (T[i].t > 1.0f) { T[i].t = 1.0f; T[i].dir = -1.0f; T[i].target *= 0.7f; }
            if (T[i].t < 0.0f) { T[i].t = 0.0f; T[i].dir = 1.0f; T[i].target = 3.0f + (float)(rand() & 7); }
        }

        SetEvent(w->hEventDone);
    }
    return 0;
}

static void startUpdate(float dt) {
    int chunk = (trainCount + WORKER_THREADS - 1) / WORKER_THREADS;
    for (int i = 0; i < WORKER_THREADS; i++) {
        wargs[i].start = i * chunk;
        int end = (i + 1) * chunk;
        wargs[i].count = end > trainCount ? trainCount - i * chunk : chunk;
        wargs[i].dt = dt;
        ResetEvent(wargs[i].hEventDone);
    }
    for (int i = 0; i < WORKER_THREADS; i++) SetEvent(wargs[i].hEventStart);
    WaitForMultipleObjects(WORKER_THREADS, workerEventsDone, TRUE, INFINITE);
}

static void stopWorkers(void) {
    for (int i = 0; i < WORKER_THREADS; i++) wargs[i].count = 0;
    for (int i = 0; i < WORKER_THREADS; i++) SetEvent(wargs[i].hEventStart);
    WaitForMultipleObjects(WORKER_THREADS, workerHandles, TRUE, INFINITE);
    for (int i = 0; i < WORKER_THREADS; i++) CloseHandle(workerHandles[i]);
}

static void initTrains(void) {
    srand(12345);
    for (int i = 0; i < trainCount; i++) {
        trains[i].t = (float)i / trainCount;
        trains[i].speed = 1.0f + (float)(rand() % 40) / 10.0f;
        trains[i].target = trains[i].speed;
        trains[i].dir = (rand() & 1) ? 1.0f : -1.0f;
        uint8_t r = 80 + (rand() % 120);
        uint8_t g = 120 + (rand() % 135);
        uint8_t b = 200 + (rand() % 55);
        trains[i].color = rgb(r, g, b);
    }
}

static void plotPixel(uint32_t *buf, int x, int y, uint32_t c) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    buf[y * WIDTH + x] = c;
}

static void drawRoute(uint32_t *buf) {
    for (int i = 0; i < ROUTE_POINTS - 1; i++) {
        int x0 = (int)route[i].x;
        int y0 = (int)route[i].y;
        int x1 = (int)route[i+1].x;
        int y1 = (int)route[i+1].y;
        int dx = abs(x1 - x0), dy = abs(y1 - y0);
        int sx = x0 < x1 ? 1 : -1;
        int sy = y0 < y1 ? 1 : -1;
        int err = dx - dy;
        while (1) {
            plotPixel(buf, x0, y0, rgb(40, 60, 100));
            if (x0 == x1 && y0 == y1) break;
            int e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }
}

static void drawTrains(uint32_t *buf) {
    for (int i = 0; i < trainCount; i++) {
        Vec2 p = routePos(trains[i].t);
        int x = (int)p.x;
        int y = (int)p.y;
        uint32_t c = trains[i].color;
        plotPixel(buf, x, y, c);
        plotPixel(buf, x+1, y, c);
        plotPixel(buf, x, y+1, c);
        plotPixel(buf, x+1, y+1, c);
    }
}

static void printMemoryStatus(void) {
    MEMORYSTATUSEX ms;
    ms.dwLength = sizeof(ms);
    if (GlobalMemoryStatusEx(&ms)) {
        printf("Memory: %llu MB free / %llu MB total (%.1f%% used)\n",
               ms.ullAvailPhys / (1024*1024),
               ms.ullTotalPhys / (1024*1024),
               100.0 * (ms.ullTotalPhys - ms.ullAvailPhys) / ms.ullTotalPhys);
    }
}

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM w, LPARAM l) {
    switch (msg) {
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProc(hwnd, msg, w, l);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrev, LPSTR lpCmdLine, int nCmdShow) {
    if (lpCmdLine && *lpCmdLine) trainCount = atoi(lpCmdLine);
    if (trainCount < 100) trainCount = 100;
    if (trainCount > MAX_TRAINS) trainCount = MAX_TRAINS;

    buildRoute();
    initTrains();
    printMemoryStatus();

    for (int i = 0; i < WORKER_THREADS; i++) {
        wargs[i].trains = trains;
        wargs[i].hEventStart = CreateEvent(NULL, FALSE, FALSE, NULL);
        wargs[i].hEventDone = CreateEvent(NULL, FALSE, FALSE, NULL);
        workerEventsStart[i] = wargs[i].hEventStart;
        workerEventsDone[i] = wargs[i].hEventDone;
        workerHandles[i] = CreateThread(NULL, 0, workerThread, &wargs[i], 0, NULL);
    }

    WNDCLASS wc = {0};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "RENativeProto";
    RegisterClass(&wc);

    HWND hwnd = CreateWindow("RENativeProto", "Rail Empire Native Prototype (Win7 32-bit)",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        CW_USEDEFAULT, CW_USEDEFAULT, WIDTH, HEIGHT,
        NULL, NULL, hInstance, NULL);

    HDC hdc = GetDC(hwnd);
    HDC memDC = CreateCompatibleDC(hdc);

    BITMAPINFO bmi;
    memset(&bmi, 0, sizeof(bmi));
    bmi.bmiHeader.biSize = sizeof(bmi.bmiHeader);
    bmi.bmiHeader.biWidth = WIDTH;
    bmi.bmiHeader.biHeight = -HEIGHT;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    void *bits;
    HBITMAP bmp = CreateDIBSection(memDC, &bmi, DIB_RGB_COLORS, &bits, NULL, 0);
    SelectObject(memDC, bmp);
    ReleaseDC(hwnd, hdc);

    ShowWindow(hwnd, nCmdShow);
    UpdateWindow(hwnd);

    uint32_t *buf = (uint32_t*)bits;
    char title[128];

    LARGE_INTEGER freq, last, now;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&last);
    int frames = 0;

    MSG msg;
    int running = 1;
    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) { running = 0; break; }
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
        if (!running) break;

        startUpdate(1.0f / TARGET_FPS);

        memset(buf, 0, WIDTH * HEIGHT * 4);
        drawRoute(buf);
        drawTrains(buf);

        HDC wdc = GetDC(hwnd);
        BitBlt(wdc, 0, 0, WIDTH, HEIGHT, memDC, 0, 0, SRCCOPY);
        ReleaseDC(hwnd, wdc);

        frames++;
        QueryPerformanceCounter(&now);
        double dt = (double)(now.QuadPart - last.QuadPart) / freq.QuadPart;
        if (dt >= 1.0) {
            double fps = frames / dt;
            snprintf(title, sizeof(title), "Rail Empire Native Prototype — %d trains — %.1f FPS", trainCount, fps);
            SetWindowText(hwnd, title);
            frames = 0;
            last = now;
        }
        InterlockedIncrement(&gFrame);
    }

    stopWorkers();
    for (int i = 0; i < WORKER_THREADS; i++) {
        CloseHandle(wargs[i].hEventStart);
        CloseHandle(wargs[i].hEventDone);
    }

    DeleteObject(bmp);
    DeleteDC(memDC);
    return 0;
}
