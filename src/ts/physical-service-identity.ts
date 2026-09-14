/** A rescue may share ONLY its immobilised target's occupied block during the
 * authorised approach/coupling. This is not a permission to ignore other trains.
 * The depot validates the mission, endpoint and target every time it is asked. */
export function samePhysicalMovement(a: unknown, b: unknown): boolean {
    return a === b || !!globalThis.window?.game?.depotManager?.isRescueCouplingAuthorized?.(a, b);
}
