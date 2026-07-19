import "@testing-library/jest-dom/vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => ({
    setTransform: () => undefined,
    clearRect: () => undefined,
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    beginPath: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    globalCompositeOperation: "source-over",
    fillStyle: "",
  }),
});
