import { Injectable, Renderer2, RendererFactory2 } from "@angular/core";

/**
 * Manages the visual drag preview element that follows the pointer during drag operations.
 * Uses Renderer2 for DOM manipulation and Web Animations API for smooth transitions.
 */

/** Material Design emphasized-decelerate easing for expressive motion.
 * @see https://m3.material.io/styles/motion/easing-and-duration/tokens-specs */
const M3_EMPHASIZED_DECELERATE = "cubic-bezier(0.05, 0.7, 0.1, 1.0)";
/** Medium1 duration for medium-area transitions. */
const RETURN_ANIMATION_DURATION_MS = 250;
/** Z-index for the floating drag preview. */
const DRAG_PREVIEW_Z_INDEX = "1000";

@Injectable()
export class DragPreviewRenderer {
    private readonly renderer: Renderer2;
    private dragPreview: HTMLElement | undefined;

    constructor(rendererFactory: RendererFactory2) {
        this.renderer = rendererFactory.createRenderer(null, null);
    }

    create(
        sourceEl: HTMLElement | null,
        clientX: number,
        clientY: number,
        borderRadius: string,
        container: HTMLElement,
    ): void {
        if (!sourceEl?.getBoundingClientRect) {
            return;
        }

        const rect = sourceEl.getBoundingClientRect();
        const preview = this.createStyledPreview(sourceEl, rect.width, rect.height, borderRadius);
        this.renderer.setStyle(preview, "position", "fixed");
        this.renderer.setStyle(preview, "pointerEvents", "none");
        this.renderer.setStyle(preview, "opacity", "0.9");
        this.renderer.setStyle(preview, "left", `${clientX - rect.width / 2}px`);
        this.renderer.setStyle(preview, "top", `${clientY - rect.height / 2}px`);

        this.renderer.appendChild(container, preview);
        this.dragPreview = preview;
    }

    move(clientX: number, clientY: number): void {
        if (!this.dragPreview) {
            return;
        }

        const width = this.dragPreview.offsetWidth;
        const height = this.dragPreview.offsetHeight;
        this.renderer.setStyle(this.dragPreview, "left", `${clientX - width / 2}px`);
        this.renderer.setStyle(this.dragPreview, "top", `${clientY - height / 2}px`);
    }

    async animateToPosition(
        targetX: number,
        targetY: number,
        targetWidth: number | undefined,
        targetHeight: number | undefined,
        targetStyle: "grid" | "palette" | undefined,
    ): Promise<void> {
        if (!this.dragPreview) {
            return;
        }

        const currentWidth = this.dragPreview.offsetWidth;
        const currentHeight = this.dragPreview.offsetHeight;
        const finalWidth = targetWidth ?? currentWidth;
        const finalHeight = targetHeight ?? currentHeight;

        // material Design emphasized-decelerate easing for expressive motion
        const easing = M3_EMPHASIZED_DECELERATE;
        const duration = RETURN_ANIMATION_DURATION_MS;

        const fromKeyframe: Keyframe = {
            left: this.dragPreview.style.left,
            top: this.dragPreview.style.top,
            transform: this.dragPreview.style.transform || "scale(1.05)",
            width: `${currentWidth}px`,
            height: `${currentHeight}px`,
        };

        const toKeyframe: Keyframe = {
            left: `${targetX - finalWidth / 2}px`,
            top: `${targetY - finalHeight / 2}px`,
            transform: "scale(1)",
            width: `${finalWidth}px`,
            height: `${finalHeight}px`,
        };

        this.buildStyleMorphKeyframes(targetStyle, fromKeyframe, toKeyframe);

        const animation = this.dragPreview.animate([fromKeyframe, toKeyframe], {
            duration,
            easing,
            fill: "forwards",
        });

        try {
            await animation.finished;
        } catch (error: unknown) {
            // animation was cancelled (e.g., element removed before completion)
            console.warn(
                "Drag preview animation interrupted:",
                error instanceof Error ? error.message : error,
            );
        }
    }

    destroy(): void {
        if (this.dragPreview?.parentNode) {
            this.renderer.removeChild(this.dragPreview.parentNode, this.dragPreview);
        }
        this.dragPreview = undefined;
    }

    private buildStyleMorphKeyframes(
        targetStyle: "grid" | "palette" | undefined,
        fromKeyframe: Keyframe,
        toKeyframe: Keyframe,
    ): void {
        if (!targetStyle || !this.dragPreview) {
            return;
        }

        fromKeyframe.backgroundColor = this.dragPreview.style.backgroundColor || "";
        fromKeyframe.color = this.dragPreview.style.color || "";
        fromKeyframe.borderRadius = this.dragPreview.style.borderRadius;

        if (targetStyle === "grid") {
            // apply grid tile colors via design tokens
            toKeyframe.backgroundColor = "var(--dnd-tile-bg)";
            toKeyframe.color = "var(--dnd-tile-color)";
            toKeyframe.borderRadius = "6px";
            toKeyframe.boxSizing = "border-box";
        } else if (targetStyle === "palette") {
            // apply palette tile colors via design tokens
            toKeyframe.backgroundColor = "var(--dnd-palette-tile-bg)";
            toKeyframe.color = "var(--dnd-palette-tile-color)";
            toKeyframe.borderRadius = "16px";
        }
    }

    private createStyledPreview(
        sourceEl: HTMLElement,
        width: number,
        height: number,
        borderRadius: string,
    ): HTMLElement {
        const preview = sourceEl.cloneNode(true) as HTMLElement;
        this.renderer.setStyle(preview, "width", `${width}px`);
        this.renderer.setStyle(preview, "height", `${height}px`);
        this.renderer.setStyle(preview, "boxSizing", "border-box");
        this.renderer.setStyle(preview, "boxShadow", "0 8px 24px var(--dnd-tile-shadow)");
        this.renderer.setStyle(preview, "transform", "scale(1.05)");
        this.renderer.setStyle(preview, "borderRadius", borderRadius);
        this.renderer.setStyle(preview, "overflow", "hidden");
        this.renderer.setStyle(preview, "zIndex", DRAG_PREVIEW_Z_INDEX);

        // ensure proper flexbox centering is maintained
        this.renderer.setStyle(preview, "display", "flex");
        this.renderer.setStyle(preview, "alignItems", "center");
        this.renderer.setStyle(preview, "justifyContent", "center");

        // remove resize controls from preview - they should never be visible during drag
        const resizeControls = preview.querySelector(".resize-controls");
        if (resizeControls) {
            this.renderer.removeChild(preview, resizeControls);
        }

        return preview;
    }
}
