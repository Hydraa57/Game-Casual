import { describe, expect, it, vi } from 'vitest';
import { createShutdown, SHUTDOWN_TIMEOUT_MS } from './lifecycle';

const targets = (closeServers = () => Promise.resolve()) => ({
  stopMatches: vi.fn(),
  notifyClients: vi.fn(),
  closeServers: vi.fn(closeServers),
});

describe('penutupan server yang rapi', () => {
  it('mengabari client SEBELUM menutup server', async () => {
    // Setelah server tertutup tidak ada jalan lagi untuk mengabarkan apa pun,
    // dan pemain cuma melihat "server tidak terjangkau".
    const order: string[] = [];
    const t = {
      notifyClients: vi.fn(() => order.push('notify')),
      stopMatches: vi.fn(() => order.push('stop')),
      closeServers: vi.fn(async () => {
        order.push('close');
      }),
    };

    await createShutdown(t)();
    expect(order).toEqual(['notify', 'stop', 'close']);
  });

  it('menghentikan match sebelum menutup, supaya interval tidak menahan proses', async () => {
    const t = targets();
    await createShutdown(t)();
    expect(t.stopMatches).toHaveBeenCalledOnce();
  });

  /**
   * SIGTERM dan SIGINT bisa datang beruntun. Menjalankan urutan ini dua kali
   * berarti menutup server yang sudah tertutup, dan itu melempar tepat di
   * tengah proses keluar.
   */
  it('aman dipanggil berkali-kali', async () => {
    const t = targets();
    const shutdown = createShutdown(t);

    await Promise.all([shutdown(), shutdown(), shutdown()]);

    expect(t.notifyClients).toHaveBeenCalledOnce();
    expect(t.closeServers).toHaveBeenCalledOnce();
  });

  it('tidak menggantung selamanya kalau penutupan macet', async () => {
    // Host memberi jendela terbatas sebelum SIGKILL. Penutupan yang menunggu
    // socket yang tidak pernah tertutup akan menghabiskan seluruh jendela itu
    // lalu tetap dibunuh paksa.
    vi.useFakeTimers();
    const t = targets(() => new Promise<void>(() => {}));

    const done = createShutdown(t)();
    await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS + 100);
    await expect(done).resolves.toBeUndefined();

    vi.useRealTimers();
  });

  it('batas waktunya di bawah jendela SIGKILL host (30 dtk di Render)', () => {
    expect(SHUTDOWN_TIMEOUT_MS).toBeLessThan(30_000);
  });
});
