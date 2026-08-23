import { describe, it, expect } from "vitest";
import { ReadonlySourceReader, type ExtractorContext } from "@roguelike-games-ib/extractor-sdk";

describe("EXT-004: extractor SDK exposes no execute/write API", () => {
  it("ReadonlySourceReader has no exec/spawn/writeFile/install methods", () => {
    const reader = new ReadonlySourceReader("/tmp");
    const proto = Object.getPrototypeOf(reader);
    const methods = Object.getOwnPropertyNames(proto);

    const forbidden = ["exec", "spawn", "writeFile", "install", "fork", "connect", "request"];
    for (const method of forbidden) {
      expect(methods).not.toContain(method);
    }
  });

  it("ReadonlySourceReader has only safe read methods", () => {
    const reader = new ReadonlySourceReader("/tmp");
    const proto = Object.getPrototypeOf(reader);
    const methods = Object.getOwnPropertyNames(proto).filter((m) => m !== "constructor");

    const allowed = ["resolveSafe", "exists", "readBytes", "readText", "stat", "walk", "parseJson", "parseYaml", "getRoot", "getSupplementalRoots", "matchSupplemental", "resolveInRoot"];
    for (const method of methods) {
      expect(allowed).toContain(method);
    }
  });

  it("ExtractorContext has no write methods on source", () => {
    const ctx: ExtractorContext = {
      source: new ReadonlySourceReader("/tmp"),
      binding: {} as never,
      schemas: {} as never,
      evidence: {} as never,
      ids: {} as never,
      output: {} as never,
    };

    const sourceProto = Object.getPrototypeOf(ctx.source);
    const sourceMethods = Object.getOwnPropertyNames(sourceProto).filter((m) => m !== "constructor");
    for (const method of sourceMethods) {
      expect(method).not.toMatch(/write|exec|spawn|install|delete|remove|mkdir|rmdir|unlink/i);
    }
  });
});
