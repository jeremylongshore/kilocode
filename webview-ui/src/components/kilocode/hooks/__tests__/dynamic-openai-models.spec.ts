import { ModelInfo } from "@roo-code/types"
import { RouterModels } from "@roo/api"
import { getModelsByProvider } from "../useProviderModels"

describe("PR #5562: Dynamic OpenAI model fetching on front page", () => {
	const testModel: ModelInfo = {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.2,
		description: "Test model",
	}

	const routerModels: RouterModels = {
		openrouter: { "test-model": testModel },
		requesty: { "test-model": testModel },
		glama: { "test-model": testModel },
		unbound: { "test-model": testModel },
		litellm: { "test-model": testModel },
		kilocode: { "test-model": testModel },
		"nano-gpt": { "test-model": testModel },
		ollama: { "test-model": testModel },
		lmstudio: { "test-model": testModel },
		"io-intelligence": { "test-model": testModel },
		deepinfra: { "test-model": testModel },
		"vercel-ai-gateway": { "test-model": testModel },
		huggingface: { "test-model": testModel },
		gemini: { "test-model": testModel },
		ovhcloud: { "test-model": testModel },
		chutes: { "test-model": testModel },
		"sap-ai-core": { "test-model": testModel },
		synthetic: { "test-model": testModel },
		inception: { "test-model": testModel },
		roo: { "test-model": testModel },
	}

	const baseArgs = {
		routerModels,
		kilocodeDefaultModel: "test-model",
		options: { isChina: false },
	}

	it("returns dynamically fetched models when openAiModels is provided", () => {
		const result = getModelsByProvider({
			...baseArgs,
			provider: "openai",
			openAiModels: ["gpt-4o", "gpt-4o-mini", "o1-preview"],
		})

		expect(Object.keys(result.models)).toEqual(["gpt-4o", "gpt-4o-mini", "o1-preview"])
		expect(result.defaultModel).toBe("gpt-4o")
		// Each model should have sane defaults (128K context, supports images)
		expect(result.models["gpt-4o"].contextWindow).toBe(128_000)
		expect(result.models["gpt-4o"].supportsImages).toBe(true)
	})

	it("returns empty models when openAiModels is not provided", () => {
		const result = getModelsByProvider({
			...baseArgs,
			provider: "openai",
		})

		expect(Object.keys(result.models)).toHaveLength(0)
		expect(result.defaultModel).toBe("")
	})

	it("handles empty openAiModels array gracefully", () => {
		const result = getModelsByProvider({
			...baseArgs,
			provider: "openai",
			openAiModels: [],
		})

		// Empty array is truthy but has no models
		expect(Object.keys(result.models)).toHaveLength(0)
		expect(result.defaultModel).toBe("")
	})
})
