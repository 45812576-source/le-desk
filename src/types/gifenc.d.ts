declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        colorDepth?: number;
        dispose?: number;
        first?: boolean;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;
  export function quantize(pixels: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: Record<string, unknown>): number[][];
  export function applyPalette(pixels: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
  export function prequantize(pixels: Uint8Array | Uint8ClampedArray, opts?: Record<string, unknown>): void;

  const _default: typeof GIFEncoder;
  export default _default;
}
