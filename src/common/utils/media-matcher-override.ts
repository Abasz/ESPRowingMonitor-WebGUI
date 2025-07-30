import { MediaMatcher } from "@angular/cdk/layout";
import { Injectable } from "@angular/core";

@Injectable()
export class CustomMediaMatcher extends MediaMatcher {
    override matchMedia(query: string): MediaQueryList {
        // if Angular Material is asking about reduced‑motion, force no‑preference
        if (/\(\s*prefers-reduced-motion\b/.test(query)) {
            // we still get a real MediaQueryList (so listeners work, style rules get injected, etc.)
            return window.matchMedia("(prefers-reduced-motion: no-preference)");
        }

        // otherwise, let the base class do everything (including WebKit style‑injection)
        return super.matchMedia(query);
    }
}
