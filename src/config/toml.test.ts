import { describe, expect, it } from "bun:test";

import { parseToml } from "./toml";

describe("parseToml", () => {
  it("parses section headers", () => {
    const result = parseToml("[timeline]\n[theme]");

    expect(result).toEqual({
      timeline: {},
      theme: {},
    });
  });

  it("parses key-value pairs with double quotes", () => {
    const result = parseToml('[timeline]\ndefault_tab = "following"');

    expect(result).toEqual({
      timeline: { default_tab: "following" },
    });
  });

  it("parses key-value pairs with single quotes", () => {
    const result = parseToml("[timeline]\ndefault_tab = 'for_you'");

    expect(result).toEqual({
      timeline: { default_tab: "for_you" },
    });
  });

  it("ignores empty lines", () => {
    const result = parseToml('[timeline]\n\ndefault_tab = "test"\n\n');

    expect(result).toEqual({
      timeline: { default_tab: "test" },
    });
  });

  it("ignores comment lines", () => {
    const result = parseToml(
      '# This is a comment\n[timeline]\n# Another comment\ndefault_tab = "test"'
    );

    expect(result).toEqual({
      timeline: { default_tab: "test" },
    });
  });

  it("handles multiple sections", () => {
    const result = parseToml(
      '[timeline]\ndefault_tab = "following"\n\n[theme]\npreset = "dark"'
    );

    expect(result).toEqual({
      timeline: { default_tab: "following" },
      theme: { preset: "dark" },
    });
  });

  it("handles multiple keys in a section", () => {
    const result = parseToml(
      '[colors]\naccent = "#1DA1F2"\nbackground = "#000000"'
    );

    expect(result).toEqual({
      colors: {
        accent: "#1DA1F2",
        background: "#000000",
      },
    });
  });

  it("ignores key-value pairs before any section", () => {
    const result = parseToml('orphan_key = "value"\n[timeline]\nok = "yes"');

    expect(result).toEqual({
      timeline: { ok: "yes" },
    });
  });

  it("parses unquoted alphanumeric values", () => {
    const result = parseToml("[timeline]\ndefault_tab = following");

    expect(result).toEqual({
      timeline: { default_tab: "following" },
    });
  });

  it("parses unquoted values with underscores", () => {
    const result = parseToml("[timeline]\ndefault_tab = for_you");

    expect(result).toEqual({
      timeline: { default_tab: "for_you" },
    });
  });

  it("ignores malformed lines", () => {
    const result = parseToml(
      '[timeline]\ndefault_tab = "ok"\nthis is not valid'
    );

    expect(result).toEqual({
      timeline: { default_tab: "ok" },
    });
  });

  it("returns empty object for empty input", () => {
    expect(parseToml("")).toEqual({});
  });

  it("returns empty object for comments-only input", () => {
    expect(parseToml("# just a comment\n# another one")).toEqual({});
  });

  it("handles empty string values", () => {
    const result = parseToml('[timeline]\nempty = ""');

    expect(result).toEqual({
      timeline: { empty: "" },
    });
  });

  it("handles values with spaces", () => {
    const result = parseToml('[section]\nkey = "hello world"');

    expect(result).toEqual({
      section: { key: "hello world" },
    });
  });

  it("handles keys with underscores and numbers", () => {
    const result = parseToml('[section]\nmy_key_2 = "value"');

    expect(result).toEqual({
      section: { my_key_2: "value" },
    });
  });

  it("handles whitespace around equals sign", () => {
    const result = parseToml('[section]\nkey   =   "value"');

    expect(result).toEqual({
      section: { key: "value" },
    });
  });
});
