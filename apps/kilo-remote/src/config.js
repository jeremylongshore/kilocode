let serverUrl = "http://localhost:3000"
let workspacePath = ""

export const getServerUrl = () => serverUrl

export const setServerUrl = (url) => {
	serverUrl = url
}

export const getWorkspacePath = () => workspacePath

export const setWorkspacePath = (path) => {
	workspacePath = path
}

let activeWorkspace = ""

export const getActiveWorkspace = () => activeWorkspace

export const setActiveWorkspace = (workspace) => {
	activeWorkspace = workspace
}

export const config = (theme) => ({
	animation: {
		name: "matrix", // 'bubbles', 'code-flow', or 'matrix'
		bubbles: {
			shape: "circle",
			count: 5,
			size: 200,
			color: theme.bubbleColor,
		},
		"code-flow": {
			shape: "square",
			count: 10,
			size: 100,
			color: theme.codeFlowColor,
		},
		matrix: {
			fontSize: 12,
			color: theme.matrixColor,
		},
	},
})
