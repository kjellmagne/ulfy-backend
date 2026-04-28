import { describe, expect, it } from "vitest";
import { TemplatesService } from "../src/templates/templates.service";

describe("TemplatesService", () => {
  it("validates a supported YAML template", () => {
    const service = new TemplatesService({} as any, {} as any);
    const parsed = service.validateYamlContent(`title: Test
language: nb-NO
sections:
  - id: one
    title: One
    prompt: Do one thing.
`);
    expect(parsed.title).toBe("Test");
  });

  it("rejects YAML without sections", () => {
    const service = new TemplatesService({} as any, {} as any);
    expect(() => service.validateYamlContent("title: Test\nlanguage: nb-NO\n")).toThrow();
  });
});
