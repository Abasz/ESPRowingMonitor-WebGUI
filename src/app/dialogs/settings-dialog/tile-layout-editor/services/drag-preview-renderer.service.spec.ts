import { TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DragPreviewRenderer } from "./drag-preview-renderer.service";

describe("DragPreviewRenderer", (): void => {
    let service: DragPreviewRenderer;

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [DragPreviewRenderer],
        });

        service = TestBed.inject(DragPreviewRenderer);
    });

    const createSourceElement = (width: number, height: number): HTMLElement => {
        const sourceEl = document.createElement("div");
        vi.spyOn(sourceEl, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            width,
            height,
            right: width,
            bottom: height,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
        });

        return sourceEl;
    };

    const createPreviewWithDimensions = (
        width: number,
        height: number,
    ): { container: HTMLElement; preview: HTMLElement } => {
        const sourceEl = createSourceElement(width, height);
        const container = document.createElement("div");
        service.create(sourceEl, width / 2, height / 2, "4px", container);

        const preview = container.children[0] as HTMLElement;
        Object.defineProperty(preview, "offsetWidth", { value: width, configurable: true });
        Object.defineProperty(preview, "offsetHeight", { value: height, configurable: true });

        return { container, preview };
    };

    const mockPreviewAnimate = (
        preview: HTMLElement,
        mode: "auto-resolve" | "manual" = "auto-resolve",
    ): {
        animateSpy: ReturnType<typeof vi.spyOn>;
        triggerFinish: () => Promise<void>;
    } => {
        let resolveFinished!: (value: Animation) => void;
        const finished = new Promise<Animation>(
            (resolve: (value: Animation | PromiseLike<Animation>) => void): void => {
                resolveFinished = resolve;
            },
        );
        const mockAnimation = { finished } as unknown as Animation;
        const animateSpy = vi.spyOn(preview, "animate").mockReturnValue(mockAnimation);

        if (mode === "auto-resolve") {
            resolveFinished(mockAnimation);
        }

        const triggerFinish = async (): Promise<void> => {
            resolveFinished(mockAnimation);
            await finished;
            // flush the .then() microtask
            await Promise.resolve();
        };

        return { animateSpy, triggerFinish };
    };

    describe("as part of component creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });
    });

    describe("create method", (): void => {
        it("should append a preview to the container", (): void => {
            const sourceEl = createSourceElement(100, 50);
            const container = document.createElement("div");

            service.create(sourceEl, 60, 45, "4px", container);

            expect(container.children).toHaveLength(1);
        });

        it("should position the preview centered on the pointer", (): void => {
            const sourceEl = createSourceElement(100, 50);
            const container = document.createElement("div");

            service.create(sourceEl, 200, 150, "4px", container);

            const preview = container.children[0] as HTMLElement;
            expect(preview.style.left).toBe("150px");
            expect(preview.style.top).toBe("125px");
        });

        it("should set preview style properties", (): void => {
            const sourceEl = createSourceElement(100, 50);
            const container = document.createElement("div");

            service.create(sourceEl, 50, 25, "8px", container);

            const preview = container.children[0] as HTMLElement;
            expect(preview.style.position).toBe("fixed");
            expect(preview.style.pointerEvents).toBe("none");
            expect(preview.style.opacity).toBe("0.9");
        });

        it("should do nothing when sourceEl is null", (): void => {
            const container = document.createElement("div");

            service.create(null, 100, 100, "4px", container);

            expect(container.children).toHaveLength(0);
        });
    });

    describe("move method", (): void => {
        it("should update the preview position", (): void => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);

            service.move(300, 200);

            expect(preview.style.left).toBe("250px");
            expect(preview.style.top).toBe("175px");
        });

        it("should do nothing when no preview exists", (): void => {
            expect((): void => service.move(100, 100)).not.toThrow();
        });
    });

    describe("destroy method", (): void => {
        it("should remove the preview from DOM", (): void => {
            const sourceEl = createSourceElement(100, 50);
            const container = document.createElement("div");
            document.body.appendChild(container);
            service.create(sourceEl, 50, 25, "4px", container);

            service.destroy();

            expect(container.children).toHaveLength(0);
            document.body.removeChild(container);
        });

        it("should do nothing when no preview exists", (): void => {
            expect((): void => service.destroy()).not.toThrow();
        });

        it("should allow creating a new preview after destroy", (): void => {
            const sourceEl = createSourceElement(100, 50);
            const container = document.createElement("div");

            service.create(sourceEl, 50, 25, "4px", container);
            service.destroy();
            service.create(sourceEl, 150, 125, "4px", container);

            expect(container.children).toHaveLength(1);
        });
    });

    describe("animateToPosition method", (): void => {
        it("should resolve immediately when no preview exists", async (): Promise<void> => {
            await expect(
                service.animateToPosition(100, 100, undefined, undefined, undefined),
            ).resolves.toBeUndefined();
        });

        it("should call animate with M3 emphasized-decelerate easing and medium1 duration", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, undefined, undefined, undefined);

            const [, options]: [unknown, KeyframeAnimationOptions] = animateSpy.mock.calls[0] as [
                Array<Keyframe>,
                KeyframeAnimationOptions,
            ];
            expect(options.easing).toBe("cubic-bezier(0.05, 0.7, 0.1, 1.0)");
            expect(options.duration).toBe(250);
            expect(options.fill).toBe("forwards");
        });

        it("should animate position centered on target using target dimensions", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, 120, 60, undefined);

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].left).toBe("140px"); // 200 - 120/2
            expect(keyframes[1].top).toBe("70px"); // 100 - 60/2
        });

        it("should animate position centered on target using current size when no target dimensions given", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, undefined, undefined, undefined);

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].left).toBe("150px"); // 200 - 100/2
            expect(keyframes[1].top).toBe("75px"); // 100 - 50/2
        });

        it("should include target width and height in end keyframe when target dimensions are provided", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, 120, 60, undefined);

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].width).toBe("120px");
            expect(keyframes[1].height).toBe("60px");
        });

        it("should use current dimensions in end keyframe when target dimensions are undefined", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, undefined, undefined, undefined);

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].width).toBe("100px");
            expect(keyframes[1].height).toBe("50px");
        });

        it("should animate transform from scale(1.05) to scale(1)", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, undefined, undefined, undefined);

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[0].transform).toBe("scale(1.05)");
            expect(keyframes[1].transform).toBe("scale(1)");
        });

        it("should include grid style keyframes when targetStyle is grid", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, 120, 60, "grid");

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].backgroundColor).toContain("--dnd-tile-bg");
            expect(keyframes[1].color).toContain("--dnd-tile-color");
            expect(keyframes[1].borderRadius).toBe("6px");
            expect(keyframes[1].boxSizing).toBe("border-box");
        });

        it("should include palette style keyframes when targetStyle is palette", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, 120, 60, "palette");

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].backgroundColor).toContain("--dnd-palette-tile-bg");
            expect(keyframes[1].color).toContain("--dnd-palette-tile-color");
            expect(keyframes[1].borderRadius).toBe("16px");
        });

        it("should not include style morph keyframes when targetStyle is undefined", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { animateSpy }: { animateSpy: ReturnType<typeof vi.spyOn> } = mockPreviewAnimate(preview);

            await service.animateToPosition(200, 100, 120, 60, undefined);

            const [keyframes]: [Array<Keyframe>] = animateSpy.mock.calls[0] as [Array<Keyframe>];
            expect(keyframes[1].backgroundColor).toBeUndefined();
            expect(keyframes[1].color).toBeUndefined();
        });

        it("should resolve when animation finishes", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            const { triggerFinish }: { triggerFinish: () => Promise<void> } = mockPreviewAnimate(
                preview,
                "manual",
            );

            const promise = service.animateToPosition(200, 100, undefined, undefined, undefined);

            await triggerFinish();

            await expect(promise).resolves.toBeUndefined();
        });

        it("should resolve without throwing when animation is cancelled", async (): Promise<void> => {
            const { preview }: { preview: HTMLElement } = createPreviewWithDimensions(100, 50);
            let rejectFinished!: (reason?: unknown) => void;
            const finished = new Promise<Animation>(
                (_unused: unknown, reject: (reason?: unknown) => void): void => {
                    rejectFinished = reject;
                },
            );
            vi.spyOn(preview, "animate").mockReturnValue({
                finished,
            } as unknown as Animation);

            const promise = service.animateToPosition(200, 100, undefined, undefined, undefined);

            rejectFinished(new DOMException("AbortError"));

            await expect(promise).resolves.toBeUndefined();
        });
    });
});
