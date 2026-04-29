import { afterEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AdminController } from "../src/admin/admin.controller";

describe("AdminController provider model lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads OpenAI-compatible models from a normalized /models endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "zeta" }, { id: "alpha" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({} as any, {} as any, {} as any);

    const result = await controller.providerModels({
      providerDomain: "document_generation",
      providerType: "openai_compatible",
      endpointUrl: "https://llm.example.internal/v1/chat/completions",
      apiKey: "lookup-key"
    });

    expect(fetchMock).toHaveBeenCalledWith("https://llm.example.internal/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer lookup-key", "X-API-Key": "lookup-key" })
    }));
    expect(result).toEqual({
      success: true,
      providerType: "openai_compatible",
      models: [{ id: "alpha", name: "alpha" }, { id: "zeta", name: "zeta" }]
    });
  });

  it("loads Ollama model names from /api/tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [{ name: "llama3.1:8b" }, { name: "mistral:latest" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({} as any, {} as any, {} as any);

    const result = await controller.providerModels({
      providerDomain: "privacy_review",
      providerType: "ollama",
      endpointUrl: "http://localhost:11434",
      apiKey: ""
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434/api/tags", expect.any(Object));
    expect(result.models).toEqual([{ id: "llama3.1:8b", name: "llama3.1:8b" }, { id: "mistral:latest", name: "mistral:latest" }]);
  });

  it("rejects providers without remote model lookup", async () => {
    const controller = new AdminController({} as any, {} as any, {} as any);

    await expect(controller.providerModels({
      providerDomain: "speech",
      providerType: "azure",
      endpointUrl: "http://192.168.222.171:5000",
      apiKey: ""
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
