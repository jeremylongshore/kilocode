import * as http from "http"
import * as vscode from "vscode"
import { ClineProvider } from "../core/webview/ClineProvider"
import { Task } from "../core/task/Task"
import { RooCodeEventName, ClineMessage } from "@roo-code/types"
import { getModeBySlug } from "../shared/modes"

const HOST = "0.0.0.0"

import { Socket } from "net"

export let server: http.Server | null = null
let outputChannel: vscode.OutputChannel
const sockets = new Set<Socket>()

export function getBridgeStatus(): "running" | "stopped" | "error" {
	if (server) {
		return "running"
	}
	return "stopped"
}

function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel("Kilo Code Mobile Bridge")
	}
	return outputChannel
}

export function startMobileBridge(port: number) {
	if (server) {
		const msg = `Kilo Code Mobile Bridge is already running on port ${port}.`
		getOutputChannel().appendLine(msg)
		vscode.window.showInformationMessage(msg)
		return
	}

	const channel = getOutputChannel()
	channel.show()
	channel.appendLine(`Starting Kilo Code Mobile Bridge on port ${port}...`)

	server = http.createServer(async (req, res) => {
		channel.appendLine(`[MobileBridge] Request received: ${req.method} ${req.url}`)
		res.setHeader("Access-Control-Allow-Origin", "*")
		res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID, Cache-Control, x-requested-with")

		if (req.method === "OPTIONS") {
			channel.appendLine("[MobileBridge] Responding to OPTIONS preflight request.")
			res.writeHead(204)
			res.end()
			return
		}

		if (req.method === "POST" && req.url === "/new-task") {
			channel.appendLine("[MobileBridge] Handling /new-task request.")
			let body = ""
			req.on("data", (chunk) => {
				body += chunk.toString()
			})
			req.on("end", async () => {
				try {
					const { message } = JSON.parse(body)
					channel.appendLine(`[MobileBridge] /new-task: Parsed message: ${message.substring(0, 100)}...`)
					const provider = await ClineProvider.getInstance()
					if (!provider) {
						channel.appendLine("[MobileBridge] /new-task: Error - ClineProvider not found.")
						res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Kilo Code is not running" }))
						return
					}

					channel.appendLine("[MobileBridge] /new-task: Setting up SSE stream.")
					res.writeHead(200, {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Access-Control-Allow-Origin": "*",
						Connection: "keep-alive",
						"Transfer-Encoding": "chunked",
					})

					const taskPromise = new Promise<Task>((resolve) => {
						provider.once(RooCodeEventName.TaskCreated, (task) => {
							channel.appendLine(`[MobileBridge] /new-task: Task created with ID: ${task.taskId}`)
							resolve(task as Task)
						})
					})

					await vscode.commands.executeCommand("kilo-code.newTask", { prompt: message })

					const task = await taskPromise

					channel.appendLine(`[MobileBridge] /new-task: Sending taskId ${task.taskId} to client.`)
					res.write(`id: ${Date.now()}\n`)
					res.write(`event: taskId\n`)
					res.write(`data: ${JSON.stringify({ taskId: task.taskId })}\n\n`)

					channel.appendLine(
						`[MobileBridge] /new-task: Sending ${task.clineMessages.length} historical messages.`,
					)
					task.clineMessages.forEach((msg) => {
						res.write(`id: ${msg.ts}\n`)
						res.write(`data: ${JSON.stringify(msg)}\n\n`)
					})

					const listener = (e: { message: ClineMessage }) => {
						if (!res.writableEnded) {
							channel.appendLine(`[MobileBridge] /new-task: Streaming message type ${e.message.type}`)
							res.write(`id: ${e.message.ts}\n`)
							res.write(`data: ${JSON.stringify(e.message)}\n\n`)
						}
					}

					task.on(RooCodeEventName.Message, listener)

					const heartbeat = setInterval(() => {
						if (!res.writableEnded) res.write(":heartbeat\n\n")
					}, 10000)

					const sendStreamEnd = () => {
						if (!res.writableEnded) {
							channel.appendLine(
								`[MobileBridge] /new-task: Sending stream_end for taskId: ${task.taskId}`,
							)
							res.write(`id: ${Date.now()}\n`)
							res.write(`data: ${JSON.stringify({ type: "stream_end" })}\n\n`)
							res.end()
						}
					}

					const cleanup = () => {
						clearInterval(heartbeat)
						task.off(RooCodeEventName.Message, listener)
						task.off(RooCodeEventName.TaskCompleted, onCompleted)
						task.off(RooCodeEventName.TaskAborted, onAborted)
						task.off(RooCodeEventName.TaskInteractive, onInteractive)
					}

					const onCompleted = () => {
						channel.appendLine(`[MobileBridge] Event: TaskCompleted for ${task.taskId}`)
						cleanup()
						setTimeout(() => sendStreamEnd(), 100)
					}

					const onAborted = () => {
						channel.appendLine(`[MobileBridge] Event: TaskAborted for ${task.taskId}`)
						cleanup()
						sendStreamEnd()
					}

					const onInteractive = () => {
						channel.appendLine(`[MobileBridge] Event: TaskInteractive for ${task.taskId}`)
						cleanup()
						sendStreamEnd()
					}

					task.once(RooCodeEventName.TaskCompleted, onCompleted)
					task.once(RooCodeEventName.TaskAborted, onAborted)
					task.once(RooCodeEventName.TaskInteractive, onInteractive)

					req.on("close", () => {
						channel.appendLine(`[MobileBridge] /new-task: Client disconnected for taskId: ${task.taskId}`)
						cleanup()
						sendStreamEnd()
					})
				} catch (error) {
					channel.appendLine(`[MobileBridge] Error in /new-task: ${error.message}`)
					if (!res.writableEnded) {
						res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: error.message }))
					}
				}
			})
		} else if (req.method === "POST" && req.url === "/send-followup") {
			channel.appendLine("[MobileBridge] Handling /send-followup request.")
			let body = ""
			req.on("data", (chunk) => {
				body += chunk.toString()
			})
			req.on("end", async () => {
				try {
					const { taskId, message } = JSON.parse(body)
					channel.appendLine(`[MobileBridge] /send-followup: Parsed taskId: ${taskId}`)
					const provider = await ClineProvider.getInstance()
					if (!provider) {
						channel.appendLine("[MobileBridge] /send-followup: Error - ClineProvider not found.")
						res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Kilo Code is not running" }))
						return
					}

					const task = provider.getTaskById(taskId)
					if (!task) {
						channel.appendLine(`[MobileBridge] /send-followup: Error - Task not found for ID: ${taskId}`)
						res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Task not found" }))
						return
					}

					channel.appendLine(
						`[MobileBridge] /send-followup: Found task, setting up SSE stream for taskId: ${taskId}`,
					)
					res.writeHead(200, {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Access-Control-Allow-Origin": "*",
						Connection: "keep-alive",
						"Transfer-Encoding": "chunked",
					})

					const listener = (e: { message: ClineMessage }) => {
						if (!res.writableEnded) {
							channel.appendLine(
								`[MobileBridge] /send-followup: Streaming message type ${e.message.type} for taskId: ${taskId}`,
							)
							res.write(`id: ${e.message.ts}\n`)
							res.write(`data: ${JSON.stringify(e.message)}\n\n`)
						}
					}

					task.on(RooCodeEventName.Message, listener)

					const heartbeat = setInterval(() => {
						if (!res.writableEnded) {
							res.write(":heartbeat\n\n")
						} else {
							clearInterval(heartbeat)
						}
					}, 10000)

					const sendStreamEnd = () => {
						if (!res.writableEnded) {
							channel.appendLine(
								`[MobileBridge] /send-followup: Sending stream_end for taskId: ${taskId}`,
							)
							res.write(`id: ${Date.now()}\n`)
							res.write(`data: ${JSON.stringify({ type: "stream_end" })}\n\n`)
							res.end()
						}
					}

					const cleanup = () => {
						clearInterval(heartbeat)
						task.off(RooCodeEventName.Message, listener)
						task.off(RooCodeEventName.TaskCompleted, onCompleted)
						task.off(RooCodeEventName.TaskAborted, onAborted)
						task.off(RooCodeEventName.TaskInteractive, onInteractive)
					}

					const onCompleted = () => {
						channel.appendLine(`[MobileBridge] Event: TaskCompleted for followup ${task.taskId}`)
						cleanup()
						setTimeout(() => sendStreamEnd(), 100)
					}

					const onAborted = () => {
						channel.appendLine(`[MobileBridge] Event: TaskAborted for followup ${task.taskId}`)
						cleanup()
						sendStreamEnd()
					}

					const onInteractive = () => {
						channel.appendLine(`[MobileBridge] Event: TaskInteractive for followup ${task.taskId}`)
						cleanup()
						sendStreamEnd()
					}

					task.once(RooCodeEventName.TaskCompleted, onCompleted)
					task.once(RooCodeEventName.TaskAborted, onAborted)
					task.once(RooCodeEventName.TaskInteractive, onInteractive)

					req.on("close", () => {
						channel.appendLine(`[MobileBridge] /send-followup: Client disconnected for taskId: ${taskId}`)
						cleanup()
						sendStreamEnd()
					})

					channel.appendLine(
						`[MobileBridge] /send-followup: Sending message to task: ${message.substring(0, 100)}...`,
					)
					task.handleWebviewAskResponse("messageResponse", message)
				} catch (error) {
					channel.appendLine(`[MobileBridge] Error in /send-followup: ${error.message}`)
					if (!res.writableEnded) {
						res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: error.message }))
					}
				}
			})
		} else if (req.method === "POST" && req.url === "/cancel-task") {
			channel.appendLine("[MobileBridge] Handling /cancel-task request.")
			let body = ""
			req.on("data", (chunk) => {
				body += chunk.toString()
			})
			req.on("end", async () => {
				try {
					const { taskId } = JSON.parse(body)
					channel.appendLine(`[MobileBridge] /cancel-task: Parsed taskId: ${taskId}`)
					const provider = await ClineProvider.getInstance()
					if (!provider) {
						res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Kilo Code is not running" }))
						return
					}
					const task = provider.getTaskById(taskId)
					if (!task) {
						res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Task not found" }))
						return
					}

					await task.abortTask(true)
					channel.appendLine(`[MobileBridge] /cancel-task: Task aborted for taskId: ${taskId}`)
					res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ status: "ok" }))
				} catch (error) {
					channel.appendLine(`[MobileBridge] Error in /cancel-task: ${error.message}`)
					res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: error.message }))
				}
			})
		} else if (req.method === "GET" && req.url === "/tasks") {
			channel.appendLine("[MobileBridge] Handling GET /tasks request.")
			try {
				const provider = await ClineProvider.getInstance()
				if (!provider) {
					res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: "Kilo Code is not running" }))
					return
				}
				const history = provider.getTaskHistory()
				res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify(history))
			} catch (error) {
				res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ error: error.message }))
			}
		} else if (req.method === "GET" && req.url?.startsWith("/tasks/")) {
			const taskId = req.url.split("/")[2]
			channel.appendLine(`[MobileBridge] Handling GET /tasks/${taskId} request.`)
			if (!taskId) {
				res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ error: "Task ID is required" }))
				return
			}
			try {
				const provider = await ClineProvider.getInstance()
				if (!provider) {
					res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: "Kilo Code is not running" }))
					return
				}
				const task = await provider.getTaskWithId(taskId)
				res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify(task.uiMessages))
			} catch (error) {
				res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ error: "Task not found" }))
			}
		} else if (req.method === "GET" && req.url === "/modes") {
			channel.appendLine("[MobileBridge] Handling GET /modes request.")
			try {
				const provider = await ClineProvider.getInstance()
				if (!provider) {
					res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: "Kilo Code is not running" }))
					return
				}
				const modes = await provider.getModes()
				res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify(modes))
			} catch (error) {
				res.writeHead(500, { "Content-Type": "application/json", "Access-control-Allow-Origin": "*" })
				res.end(JSON.stringify({ error: error.message }))
			}
		} else if (req.method === "POST" && req.url === "/modes") {
			channel.appendLine("[MobileBridge] Handling POST /modes request.")
			let body = ""
			req.on("data", (chunk) => {
				body += chunk.toString()
			})
			req.on("end", async () => {
				try {
					const { mode } = JSON.parse(body)
					const provider = await ClineProvider.getInstance()
					if (!provider) {
						res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Kilo Code is not running" }))
						return
					}
					const customModes = await provider.customModesManager.getCustomModes()
					const modeToSet = getModeBySlug(mode, customModes)
					if (!modeToSet) {
						res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
						res.end(JSON.stringify({ error: "Mode not found" }))
						return
					}
					await provider.handleModeSwitch(modeToSet.slug as any)
					res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ status: "ok" }))
				} catch (error) {
					res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: error.message }))
				}
			})
		} else if (req.method === "GET" && req.url === "/health") {
			channel.appendLine("[MobileBridge] Handling GET /health request.")
			const workspaceFolders = vscode.workspace.workspaceFolders
			const workspacePath = workspaceFolders ? workspaceFolders[0].uri.fsPath : "No workspace open"
			res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
			res.end(JSON.stringify({ status: "ok", workspacePath }))
		} else if (req.method === "POST" && req.url?.startsWith("/tasks/") && req.url.endsWith("/condense")) {
			const taskId = req.url.split("/")[2]
			channel.appendLine(`[MobileBridge] Handling POST /tasks/${taskId}/condense request.`)
			if (!taskId) {
				res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ error: "Task ID is required" }))
				return
			}
			try {
				const provider = await ClineProvider.getInstance()
				if (!provider) {
					res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: "Kilo Code is not running" }))
					return
				}
				const task = provider.getTaskById(taskId)
				if (!task) {
					res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
					res.end(JSON.stringify({ error: "Task not found or not active" }))
					return
				}
				await task.condenseContext()
				res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ status: "ok" }))
			} catch (error) {
				res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
				res.end(JSON.stringify({ error: error.message }))
			}
		} else {
			channel.appendLine(`[MobileBridge] 404 Not Found for request: ${req.method} ${req.url}`)
			res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
			res.end(JSON.stringify({ error: "Not Found" }))
		}
	})

	server.on("connection", (socket) => {
		sockets.add(socket)
		socket.on("close", () => {
			sockets.delete(socket)
		})
	})

	server.on("error", (err) => {
		const msg = `Kilo Code Mobile Bridge error: ${err.message}`
		getOutputChannel().appendLine(msg)
		vscode.window.showErrorMessage(msg)
		server = null
	})

	server.listen(port, HOST, () => {
		const msg = `Kilo Code Mobile Bridge listening on http://${HOST}:${port}`
		vscode.window.showInformationMessage(msg)
		channel.appendLine(msg)
	})
}

export function stopMobileBridge() {
	if (server) {
		for (const socket of sockets) {
			socket.destroy()
		}
		sockets.clear()
		server.close(() => {
			const msg = "Kilo Code Mobile Bridge stopped."
			vscode.window.showInformationMessage(msg)
			getOutputChannel().appendLine(msg)
			server = null
		})
	} else {
		const msg = "Kilo Code Mobile Bridge is not running."
		getOutputChannel().appendLine(msg)
		vscode.window.showInformationMessage(msg)
	}
}
