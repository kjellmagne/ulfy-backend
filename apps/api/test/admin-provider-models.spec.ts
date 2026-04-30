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
      models: [{ name: "nordic-docgen:latest" }, { name: "mistral:latest" }]
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
    expect(result.models).toEqual([{ id: "mistral:latest", name: "mistral:latest" }, { id: "nordic-docgen:latest", name: "nordic-docgen:latest" }]);
  });

  it("preserves APISIX route prefixes for Ollama model lookup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [{ name: "gemma4:26b" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({} as any, {} as any, {} as any);

    await controller.providerModels({
      providerDomain: "privacy_review",
      providerType: "ollama",
      endpointUrl: "https://kvasetech.com/ollama",
      apiKey: ""
    });

    expect(fetchMock).toHaveBeenCalledWith("https://kvasetech.com/ollama/api/tags", expect.any(Object));
  });

  it("loads OpenAI-compatible models through APISIX /v1/models", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "qwen3.6:27b-q4_K_M" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({} as any, {} as any, {} as any);

    await controller.providerModels({
      providerDomain: "document_generation",
      providerType: "openai_compatible",
      endpointUrl: "https://kvasetech.com/ollama",
      apiKey: "local-ollama-preview"
    });

    expect(fetchMock).toHaveBeenCalledWith("https://kvasetech.com/ollama/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer local-ollama-preview" })
    }));
  });

  it("loads AI preview provider models with saved provider credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "preview-model" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            providerType: "openai-compatible",
            endpointUrl: "https://kvasetech.com/ollama/v1/chat/completions",
            apiKey: "saved-preview-key"
          }
        })
      }
    } as any, {} as any, {} as any);

    const result = await controller.templatePreviewProviderModels({}, { user: { role: "superadmin" } });

    expect(fetchMock).toHaveBeenCalledWith("https://kvasetech.com/ollama/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer saved-preview-key" })
    }));
    expect(result).toEqual({ models: [{ id: "preview-model", name: "preview-model" }] });
  });

  it("does not reuse the saved preview key for unsaved provider changes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            providerType: "openai-compatible",
            endpointUrl: "https://kvasetech.com/ollama/v1/chat/completions",
            apiKey: "saved-preview-key"
          }
        })
      }
    } as any, {} as any, {} as any);

    await expect(controller.templatePreviewProviderModels({
      providerType: "openai",
      endpointUrl: "https://api.openai.com/v1/chat/completions"
    }, { user: { role: "superadmin" } })).rejects.toThrow(
      "Enter an API key to test unsaved preview provider changes, or save the preview provider first."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the saved preview key when provider scope changes and no replacement key is provided", async () => {
    const upsert = vi.fn().mockResolvedValue({
      value: {
        providerType: "openai",
        endpointUrl: "https://api.openai.com/v1",
        model: "gpt-5-mini",
        apiKey: null
      }
    });
    const controller = new AdminController({
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            providerType: "openai-compatible",
            endpointUrl: "https://kvasetech.com/ollama/v1/chat/completions",
            model: "preview-model",
            apiKey: "saved-preview-key"
          }
        }),
        upsert
      }
    } as any, { log: vi.fn() } as any, {} as any);

    const result = await controller.updateTemplatePreviewProviderSetting({
      providerType: "openai",
      endpointUrl: "https://api.openai.com/v1",
      model: "gpt-5-mini"
    }, { user: { sub: "admin-1", email: "admin@example.com", role: "superadmin" } });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        value: expect.objectContaining({
          providerType: "openai",
          endpointUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          apiKey: null
        })
      })
    }));
    expect(result).toEqual(expect.objectContaining({
      providerType: "openai",
      endpointUrl: "https://api.openai.com/v1",
      model: "gpt-5-mini",
      apiKeyConfigured: false
    }));
  });

  it("loads OpenAI preview provider models from the OpenAI models endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "gpt-5-mini" }, { id: "gpt-4.1-mini" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) }
    } as any, {} as any, {} as any);

    const result = await controller.templatePreviewProviderModels({
      providerType: "openai",
      endpointUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-preview"
    }, { user: { role: "superadmin" } });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer sk-preview", "X-API-Key": "sk-preview" })
    }));
    expect(result.models).toEqual([{ id: "gpt-4.1-mini", name: "gpt-4.1-mini" }, { id: "gpt-5-mini", name: "gpt-5-mini" }]);
  });

  it("requires an API key for OpenAI preview model lookup", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) }
    } as any, {} as any, {} as any);

    await expect(controller.templatePreviewProviderModels({
      providerType: "openai",
      endpointUrl: "https://api.openai.com/v1"
    }, { user: { role: "superadmin" } })).rejects.toThrow(
      "API key is required for this provider model lookup."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns preview provider runtime status without exposing secrets", async () => {
    const controller = new AdminController(
      {} as any,
      {} as any,
      {
        previewProviderStatus: vi.fn().mockResolvedValue({
          configured: true,
          providerType: "openai",
          model: "gpt-5-mini",
          endpointConfigured: true,
          apiKeyConfigured: true
        })
      } as any
    );

    await expect(controller.templatePreviewProviderRuntimeStatus()).resolves.toEqual({
      configured: true,
      providerType: "openai",
      model: "gpt-5-mini",
      endpointConfigured: true,
      apiKeyConfigured: true
    });
  });

  it("loads OpenAI provider models from the default endpoint when endpoint URL is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "gpt-5-mini" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({} as any, {} as any, {} as any);

    await controller.providerModels({
      providerDomain: "document_generation",
      providerType: "openai",
      endpointUrl: "",
      apiKey: "sk-provider"
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer sk-provider" })
    }));
  });

  it("adds /v1/models for vLLM gateway base URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "meta-llama/Meta-Llama-3.1-8B-Instruct" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AdminController({} as any, {} as any, {} as any);

    await controller.providerModels({
      providerDomain: "document_generation",
      providerType: "vllm",
      endpointUrl: "https://kvasetech.com/vllm",
      apiKey: ""
    });

    expect(fetchMock).toHaveBeenCalledWith("https://kvasetech.com/vllm/v1/models", expect.any(Object));
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
