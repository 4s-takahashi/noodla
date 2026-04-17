/**
 * job-processor.ts — 疑似ジョブ処理エンジン
 *
 * seed ベースの決定論的ハッシュでトークンを生成し、
 * 50ms〜200ms の処理時間を模倣する。
 */

import type { PseudoJobPayload } from './ws-types';

// ── 語彙テーブル ──────────────────────────────────────────────────────────────

const VOCABULARY = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
  'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape',
  'morning', 'afternoon', 'evening', 'night', 'dawn', 'dusk', 'noon',
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'white', 'black',
  'run', 'walk', 'fly', 'swim', 'jump', 'dance', 'sing', 'play',
  'happy', 'sad', 'angry', 'peaceful', 'excited', 'calm', 'brave', 'wise',
  'mountain', 'river', 'ocean', 'forest', 'desert', 'valley', 'cloud', 'rain',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'omega',
  'north', 'south', 'east', 'west', 'up', 'down', 'left', 'right', 'center',
];

// ── Pseudo Random Number Generator (seed-based) ───────────────────────────────

class SeededRng {
  private state: number;

  constructor(seed: number) {
    // xorshift32
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state >>> 0) / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

// ── Job Processing Result ─────────────────────────────────────────────────────

export interface JobProcessingResult {
  tokens: string[];
  tokenCount: number;
  processingMs: number;
  deviceLoad: {
    cpuUsage: number;
    memoryUsage: number;
    batteryLevel: number;
  };
}

// ── processJob ────────────────────────────────────────────────────────────────

export async function processJob(payload: PseudoJobPayload): Promise<JobProcessingResult> {
  const startTime = Date.now();

  const rng = new SeededRng(payload.seed);

  // seed ベースでトークン生成
  const tokenCount = Math.max(1, Math.min(payload.maxTokens, 5));
  const tokens: string[] = [];

  for (let i = 0; i < tokenCount; i++) {
    const idx = rng.nextInt(VOCABULARY.length);
    tokens.push(VOCABULARY[idx]);
  }

  // 処理時間を模倣: 50ms〜200ms
  const targetMs = 50 + rng.nextInt(151); // 50〜200ms
  const elapsed = Date.now() - startTime;
  if (elapsed < targetMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, targetMs - elapsed));
  }

  const processingMs = Date.now() - startTime;

  // デバイス負荷の概算 (モック値)
  const deviceLoad = getDeviceLoad();

  return {
    tokens,
    tokenCount,
    processingMs,
    deviceLoad,
  };
}

// ── Device Load ───────────────────────────────────────────────────────────────

function getDeviceLoad(): { cpuUsage: number; memoryUsage: number; batteryLevel: number } {
  // 実際のシステム情報が取得できない場合はモック値を返す
  // Phase 7 以降で expo-device / expo-battery の実値を使用予定
  return {
    cpuUsage: 0.1 + Math.random() * 0.3,      // 10〜40%
    memoryUsage: 0.3 + Math.random() * 0.3,   // 30〜60%
    batteryLevel: 0.5 + Math.random() * 0.5,  // 50〜100%
  };
}
