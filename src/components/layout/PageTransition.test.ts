import { describe, expect, it } from "vitest";
import { getPageTransitionKey, getPageTransitionProps } from "./PageTransition";

describe("PageTransition", () => {
  it("keys transitions by pathname + search so distinct URLs get distinct transitions", () => {
    expect(getPageTransitionKey({ pathname: "/results/view/1", search: "?tab=a", hash: "" }))
      .toBe("/results/view/1?tab=a");
    expect(getPageTransitionKey({ pathname: "/results/view/2", search: "?tab=a", hash: "" }))
      .toBe("/results/view/2?tab=a");
    expect(getPageTransitionKey({ pathname: "/library", search: "", hash: "" }))
      .toBe("/library");
  });

  it("uses a 100ms opacity-only transition", () => {
    expect(getPageTransitionProps(false)).toEqual({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.1, ease: "easeOut" },
    });
  });

  it("disables animation when reduced motion is requested", () => {
    expect(getPageTransitionProps(true)).toEqual({
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 1 },
      transition: { duration: 0 },
    });
  });
});
