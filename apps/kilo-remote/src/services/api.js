import { getServerUrl } from "../config"
import EventSource from "react-native-event-source"

export const stream = (url, body, onMessage, onError, onComplete, onTaskId) => {
	console.log("[API] Calling stream function for URL:", url)

	const eventSource = new EventSource(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	})

	console.log("[API] EventSource object created.")

	const handleStreamEnd = () => {
		console.log("[API] SSE stream finished.")
		if (onComplete) onComplete()
		eventSource.close()
	}

	const handleMessage = (event) => {
		console.log("[API] Received message event:", event.data.substring(0, 100))
		try {
			const message = JSON.parse(event.data)
			if (message.type === "stream_end") {
				handleStreamEnd()
			} else {
				onMessage(message)
			}
		} catch (e) {
			console.log("[API] Message is not JSON, treating as plain text.")
			onMessage({
				type: "say",
				say: "text",
				text: event.data,
				ts: Date.now(),
			})
		}
	}

	const handleTaskId = (event) => {
		console.log("[API] Received taskId event:", event.data)
		const taskId = JSON.parse(event.data).taskId
		if (onTaskId) {
			onTaskId(taskId)
		}
	}

	const handleError = (error) => {
		console.error("[API] SSE error event:", error)
		if (error.type === "error" && onError) {
			onError(error)
		}
		// This will also trigger the close event
		eventSource.close()
	}

	const handleOpen = () => {
		console.log("[API] SSE connection opened.")
	}

	const handleClose = () => {
		console.log("[API] SSE connection closed.")
		// Ensure final cleanup happens
		if (onComplete) onComplete()
	}

	eventSource.addEventListener("open", handleOpen)
	eventSource.addEventListener("message", handleMessage)
	eventSource.addEventListener("taskId", handleTaskId)
	eventSource.addEventListener("error", handleError)
	// The 'close' event is specific to some EventSource implementations, let's add it for visibility
	eventSource.addEventListener("close", handleClose)

	// Return a cleanup function
	return () => {
		console.log("[API] Cleanup function called. Closing EventSource.")
		if (eventSource) {
			// For react-native-event-source, closing the connection is the correct
			// and sufficient way to clean up all listeners.
			eventSource.close()
		}
	}
}

export const startNewTask = (message, onMessage, onError, onComplete, onTaskId) => {
	const url = `${getServerUrl()}/new-task`
	const body = { message }
	return stream(url, body, onMessage, onError, onComplete, onTaskId)
}

export const sendFollowup = (taskId, message, onMessage, onError, onComplete) => {
	if (!taskId) {
		console.error("No task ID available to send a followup.")
		return
	}
	const url = `${getServerUrl()}/send-followup`
	const body = { taskId, message }
	return stream(url, body, onMessage, onError, onComplete)
}

export const cancelTask = async (taskId) => {
	// The stream is now cancelled via the cleanup function returned by `stream`.
	// This function is now only responsible for notifying the server.
	if (!taskId) return

	try {
		await fetch(`${getServerUrl()}/cancel-task`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ taskId }),
		})
		console.log(`Server notified of task cancellation for taskId: ${taskId}`)
	} catch (error) {
		console.error("Error notifying server of task cancellation:", error)
	}
}

export const getTasks = async () => {
	try {
		const response = await fetch(`${getServerUrl()}/tasks`)
		return await response.json()
	} catch (error) {
		console.error("Error fetching tasks:", error)
		return []
	}
}

export const getTaskHistory = async (id) => {
	try {
		const response = await fetch(`${getServerUrl()}/tasks/${id}`)
		return await response.json()
	} catch (error) {
		console.error("Error fetching task history:", error)
		return null
	}
}

export const getModes = async () => {
	try {
		const response = await fetch(`${getServerUrl()}/modes`)
		return await response.json()
	} catch (error) {
		console.error("Error fetching modes:", error)
		return []
	}
}

export const getCurrentMode = async (id) => {
	if (!id) return null
	try {
		const response = await fetch(`${getServerUrl()}/current-mode/${id}`)
		return await response.json()
	} catch (error) {
		console.error("Error fetching current mode:", error)
		return null
	}
}

export const setMode = async (mode) => {
	try {
		await fetch(`${getServerUrl()}/modes`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ mode }),
		})
	} catch (error) {
		console.error("Error setting mode:", error)
	}
}

export const checkHealth = async () => {
	try {
		const response = await fetch(`${getServerUrl()}/health`)
		return await response.json()
	} catch (error) {
		console.error("Error checking health:", error)
		return { status: "error", workspacePath: "" }
	}
}
