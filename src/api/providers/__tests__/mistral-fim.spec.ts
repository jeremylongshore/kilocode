// kilocode_change - new file
// npx vitest run src/api/providers/__tests__/mistral-fim.spec.ts

// Mock vscode first to avoid import errors
vitest.mock("vscode", () => ({}))

// Mock the Mistral SDK
const mockFimStream = vitest.fn()
vitest.mock("@mistralai/mistralai", () => ({
	Mistral: vitest.fn().mockImplementation((config: any) => ({
		fim: { stream: mockFimStream },
		chat: { stream: vitest.fn(), complete: vitest.fn() },
		_config: config,
	})),
}))

// Mock TelemetryService for error handling tests
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vitest.fn(),
		},
	},
}))

// Mock delay
vitest.mock("delay", () => ({ default: vitest.fn(() => Promise.resolve()) }))

import { Mistral } from "@mistralai/mistralai"
import { MistralHandler } from "../mistral"
import { ApiHandlerOptions } from "../../../shared/api"

describe("MistralHandler FIM support", () => {
	const mockOptions: ApiHandlerOptions = {
		mistralApiKey: "test-api-key",
		apiModelId: "codestral-latest",
	}

	beforeEach(() => vitest.clearAllMocks())

	describe("fimSupport", () => {
		it("returns FimHandler for codestral models", () => {
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "codestral-latest",
			})

			const fimHandler = handler.fimSupport()
			expect(fimHandler).toBeDefined()
			expect(typeof fimHandler?.streamFim).toBe("function")
			expect(typeof fimHandler?.getModel).toBe("function")
			expect(typeof fimHandler?.getTotalCost).toBe("function")
		})

		it("returns FimHandler for codestral-2405", () => {
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "codestral-2405",
			})

			expect(handler.fimSupport()).toBeDefined()
		})

		it("returns undefined for non-codestral models", () => {
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "mistral-large-latest",
			})

			expect(handler.fimSupport()).toBeUndefined()
		})

		it("returns FimHandler when no model is specified (defaults to codestral-latest)", () => {
			const handler = new MistralHandler({
				mistralApiKey: "test-api-key",
			})

			// Default model is codestral-latest, which supports FIM
			expect(handler.fimSupport()).toBeDefined()
		})
	})

	describe("streamFim via fimSupport()", () => {
		it("yields chunks correctly", async () => {
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "codestral-latest",
			})

			// Mock the SDK's fim.stream to return an async iterable of events
			mockFimStream.mockResolvedValue(
				(async function* () {
					yield { data: { choices: [{ delta: { content: "chunk1" } }] } }
					yield { data: { choices: [{ delta: { content: "chunk2" } }] } }
					yield { data: { choices: [{ delta: { content: "chunk3" } }] } }
				})(),
			)

			const chunks: string[] = []
			const fimHandler = handler.fimSupport()
			expect(fimHandler).toBeDefined()

			for await (const chunk of fimHandler!.streamFim("prefix", "suffix")) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual(["chunk1", "chunk2", "chunk3"])
			expect(mockFimStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "codestral-latest",
					prompt: "prefix",
					suffix: "suffix",
					stream: true,
				}),
			)
		})

		it("handles errors correctly", async () => {
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "codestral-latest",
			})

			// Mock the SDK throwing an error (SDK handles HTTP errors internally)
			mockFimStream.mockRejectedValue(new Error("FIM request failed"))

			const fimHandler = handler.fimSupport()
			expect(fimHandler).toBeDefined()
			const generator = fimHandler!.streamFim("prefix", "suffix")
			await expect(generator.next()).rejects.toThrow("Mistral FIM completion error: FIM request failed")
		})

		it("uses correct endpoint for codestral models", async () => {
			// Create handler with codestral model — should use codestral.mistral.ai
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "codestral-latest",
			})

			// Verify the Mistral client was constructed with the codestral URL
			expect(Mistral).toHaveBeenCalledWith(
				expect.objectContaining({
					serverURL: "https://codestral.mistral.ai",
					apiKey: "test-api-key",
				}),
			)
		})

		it("uses custom codestral URL when provided", async () => {
			const handler = new MistralHandler({
				...mockOptions,
				apiModelId: "codestral-latest",
				mistralCodestralUrl: "https://custom.codestral.url",
			})

			// Verify the Mistral client was constructed with the custom URL
			expect(Mistral).toHaveBeenCalledWith(
				expect.objectContaining({
					serverURL: "https://custom.codestral.url",
					apiKey: "test-api-key",
				}),
			)
		})
	})
})
