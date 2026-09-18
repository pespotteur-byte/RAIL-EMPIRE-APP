/// <reference lib="webworker" />
/** Point d'entrée Worker : transport uniquement, la logique est dans SimHost. */
import type { MainToWorker, WorkerToMain } from './protocol.ts';
import { SimHost } from './sim-host.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;

const host = new SimHost(
  (m: WorkerToMain, transfer?: ArrayBuffer[]) => {
    if (transfer) scope.postMessage(m, transfer);
    else scope.postMessage(m);
  },
  {
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: (h) => {
      clearInterval(h as ReturnType<typeof setInterval>);
    },
    now: () => performance.now(),
  },
);

scope.onmessage = (ev: MessageEvent<MainToWorker>) => {
  try {
    host.handle(ev.data);
  } catch (e) {
    scope.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) } satisfies WorkerToMain);
  }
};
