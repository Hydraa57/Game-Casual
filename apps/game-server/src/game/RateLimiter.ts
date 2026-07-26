import { MAX_CLICKS_PER_SECOND } from '@pixelmatrix/shared';

/**
 * Batas klik per detik per pemain (jendela geser).
 *
 * Ini mitigasi cheat yang diminta PRD: tanpa batas, satu script bisa mengirim
 * ribuan `game:click` per detik dan mengklaim setiap pixel begitu muncul.
 * Batasnya jauh di atas kemampuan jempol manusia (~8/detik), jadi pemain jujur
 * tidak akan pernah menyentuhnya.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxPerSecond: number = MAX_CLICKS_PER_SECOND,
    private readonly windowMs: number = 1000,
  ) {}

  /** True kalau klik ini boleh diproses. */
  allow(playerId: string, nowMs: number): boolean {
    const recent = (this.hits.get(playerId) ?? []).filter((at) => nowMs - at < this.windowMs);

    if (recent.length >= this.maxPerSecond) {
      this.hits.set(playerId, recent);
      return false;
    }

    recent.push(nowMs);
    this.hits.set(playerId, recent);
    return true;
  }

  forget(playerId: string): void {
    this.hits.delete(playerId);
  }

  reset(): void {
    this.hits.clear();
  }
}
