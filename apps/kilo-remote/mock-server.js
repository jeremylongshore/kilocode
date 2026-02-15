const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const crypto = require("crypto")

const app = express()
app.use(cors())
app.use(bodyParser.json())

const sampleTasks = [
	{
		id: "0108125e-f9e2-4a3f-bc21-001",
		number: 42,
		ts: 1728230400000,
		task: "added a mobile bridge button to the kilo code interface",
		tokensIn: 350,
		tokensOut: 120,
		tokensTotal: 470,
		workspace: "/Users/sainath/PycharmProjects/kilocode/kilocode",
		mode: "architect",
		totalCost: 0.0025,
		rootTaskId: null,
	},
	{
		id: "0108125e-f9e2-4a3f-bc21-004",
		number: 43,
		ts: 1728230500000,
		task: "another task for the same workspace",
		tokensIn: 350,
		tokensOut: 120,
		tokensTotal: 470,
		workspace: "/Users/sainath/PycharmProjects/kilocode/kilocode",
		mode: "architect",
		totalCost: 0.0025,
		rootTaskId: null,
	},
	{
		id: "4c11a6b2-8c9e-11ee-89fa-002",
		number: 7,
		ts: 1728320400000,
		task: "Create an expo project for kilo mobile bridge",
		tokensIn: 210,
		tokensOut: 95,
		tokensTotal: 305,
		workspace: "/Users/sainath/WebstormProjects/kilo-mobile",
		mode: "architect",
		totalCost: 0.0015,
		rootTaskId: null,
	},
	{
		id: "fd4a7d1f-213d-4b5a-9f33-003",
		number: 15,
		ts: 1728406800000,
		task: "Hello, Kilo!",
		tokensIn: 12,
		tokensOut: 20,
		tokensTotal: 32,
		workspace: "/Users/sainath/AdhocProjects/ai-studio-organiser",
		mode: "ask",
		totalCost: 0.00005,
		rootTaskId: null,
	},
]

const sampleMessages = [
	{
		ts: 1761000005000,
		type: "say",
		say: "text",
		text: "Okay, I understand the task. The timestamp needs to be dynamic. ",
		partial: true,
	},
	{
		ts: 1761000005000,
		type: "say",
		say: "text",
		text: "Okay, I understand the task. The timestamp needs to be dynamic. I will start by examining the relevant component file to understand how the timestamp is currently rendered.",
		partial: true,
	},
	{
		ts: 1761000005000,
		type: "say",
		say: "text",
		text: "Okay, I understand the task. The timestamp needs to be dynamic. I will start by examining the relevant component file to understand how the timestamp is currently rendered.\n\nBased on the project structure, the relevant file is likely `src/components/Dashboard.js`.",
		partial: false,
	},
	{
		ts: 1760076851698,
		type: "ask",
		ask: "tool",
		text: '{"tool":"updateTodoList","todos":[{"id":"1b23703c42cccd0e3606742b6df32c59","content":"1.  Set up a new Expo project named `mobile-app-clean` in the `apps/` directory.","status":"completed"},{"id":"dbd3d1b1e3a32db7645f906415954b79","content":"2.  Configure Tailwind CSS for the Expo project using `nativewind`.","status":"in_progress"},{"id":"3e9610669365b70c095ba60d0b7fa8fb","content":"3.  Analyze `webview-ui`\'s `tailwind.config.js` and replicate the theme (colors, fonts, etc.) in the Expo app.","status":"pending"},{"id":"284c6f8d94c4d887d47f81f6c70ae73f","content":"4.  Create placeholder components for `ChatView` and `HistoryView` in the Expo app.","status":"pending"},{"id":"3e9825f177c1b2956e5227796371a66f","content":"5.  Run the Expo app to ensure the basic setup is working.","status":"pending"},{"id":"fc93d8eb87d1dce6791e0df2f61cdafa","content":"6.  Implement the `ChatView` UI, including the message list and text input area.","status":"pending"},{"id":"c961679f80ecd6a4921455c2c7c07355","content":"7.  Adapt the message rendering logic from `webview-ui` to the Expo app, focusing on streaming messages.","status":"pending"},{"id":"08712f67663edcec6c33012b76d32738","content":"8.  Implement the `send` and `cancel` button functionality.","status":"pending"},{"id":"15eca7dc807b3c0047cede968c101dfe","content":"9.  Implement the mode switching functionality.","status":"pending"},{"id":"228be4222ff200542672c65178b93329","content":"10. Implement the `HistoryView` UI, focusing on rendering a list of mock tasks.","status":"pending"},{"id":"793425d46d1cf130a503769be84d9625","content":"11. Identify and install necessary icon libraries (e.g., `react-native-vector-icons`) and replace web-specific icons.","status":"pending"},{"id":"69719cba42582dd1b230f93e1e8cc963","content":"12. Connect the `HistoryView` to the `ChatView` to allow switching between the two.","status":"pending"},{"id":"aa7402f4a749ba9094cbd09c7ccea5fd","content":"13. Test the app at each stage to ensure it runs without crashing.","status":"pending"}]}',
		partial: false,
		isProtected: false,
	},
	{
		ts: 1760355622329,
		type: "ask",
		ask: "tool",
		text: '{"tool":"newFileCreated","path":"apps/kilo-remote/src/components/messages/ReadFileMessage.js","content":"import React from \'react\';\\nimport { View, Text, TouchableOpacity } from \'react-native\';\\nimport Icon from \'react-native-vector-icons/FontAwesome\';\\n\\nconst ReadFileMessage = ({ item }) => {\\n  const file = JSON.parse(item.text);\\n  return (\\n    <View className=\\"p-2 my-1 mx-2 rounded-lg bg-gray-200 self-start\\">\\n      <View className=\\"flex-row items-center\\">\\n        <Icon name=\\"file-text-o\\" size={20} color=\\"black\\" />\\n        <Text className=\\"font-bold ml-2\\">Kilo wants to read this file:</Text>\\n      </View>\\n      <Text>{file.path}</Text>\\n      <View className=\\"flex-row mt-2\\">\\n        <TouchableOpacity className=\\"bg-blue-500 rounded-lg p-2 mr-2\\">\\n          <Text className=\\"text-white\\">Approve</Text>\\n        </TouchableOpacity>\\n        <TouchableOpacity className=\\"bg-red-500 rounded-lg p-2\\">\\n          <Text className=\\"text-white\\">Reject</Text>\\n        </TouchableOpacity>\\n      </View>\\n    </View>\\n  );\\n};\\n\\nexport default ReadFileMessage;","isOutsideWorkspace":false,"isProtected":false}',
		partial: false,
		isProtected: false,
	},
	{
		ts: 1760355664372,
		type: "ask",
		ask: "tool",
		text: "{\"tool\":\"appliedDiff\",\"path\":\"apps/kilo-remote/src/components/ChatRow.js\",\"diff\":\"<<<<<<< SEARCH\\n:start_line:9\\n-------\\nimport KiloQuestionMessage from './messages/KiloQuestionMessage';\\nimport TodoListMessage from './messages/TodoListMessage';\\n=======\\nimport KiloQuestionMessage from './messages/KiloQuestionMessage';\\nimport TodoListMessage from './messages/TodoListMessage';\\nimport ReadFileMessage from './messages/ReadFileMessage';\\n>>>>>>> REPLACE\\n<<<<<<< SEARCH\\n:start_line:62\\n-------\\n            const tool = JSON.parse(item.text);\\n            if (tool.tool === 'updateTodoList') {\\n              console.log('Rendering TodoListMessage');\\n              return <TodoListMessage item={item} />;\\n            }\\n            return <ApiRequestMessage item={item} />;\\n          default:\\n=======\\n            const tool = JSON.parse(item.text);\\n            if (tool.tool === 'updateTodoList') {\\n              console.log('Rendering TodoListMessage');\\n              return <TodoListMessage item={item} />;\\n            }\\n            if (tool.tool === 'readFile') {\\n              console.log('Rendering ReadFileMessage');\\n              return <ReadFileMessage item={item} />;\\n            }\\n            return <ApiRequestMessage item={item} />;\\n          default:\\n>>>>>>> REPLACE\",\"isProtected\":false}",
		isProtected: false,
	},
	{
		ts: 1761000008000,
		type: "ask",
		ask: "tool",
		text: '{"tool":"readFile","path":"src/components/Dashboard.js","reason":"To analyze the current timestamp implementation."}',
	},
	{
		ts: 1761000012000,
		type: "say",
		say: "text",
		text: "I've reviewed the code. The component is rendering a static timestamp generated at load time. To fix this, I need to use state and a `setInterval` hook to update it continuously. I will also need a library to format the time nicely. I see `date-fns` is not in the `package.json`, so I should probably ask before adding it.",
		partial: false,
	},
	{
		ts: 1760348141554,
		type: "say",
		say: "api_req_started",
		text: '{"request":"[apply_diff for \'apps/kilo-remote/server.js\'] Result:\\n\\n<file_write_result>\\n<path>apps/kilo-remote/server.js</path>\\n<operation>modified</operation>\\n<notice>\\n<i>You do not need to re-read the file, as you have seen all changes</i>\\n<i>Proceed with the task using these changes as the new baseline.</i>\\n</notice>\\n</file_write_result>\\n\\n<notice>Making multiple related changes in a single apply_diff is more efficient. If other changes are needed in this file, please include them as additional SEARCH/REPLACE blocks.</notice>\\n\\n<environment_details>\\n# VSCode Visible Files\\napps/kilo-remote/server.js\\n\\n# VSCode Open Tabs\\napps/kilo-remote/tailwind.config.js,apps/kilo-remote/src/components/HistoryView.js,apps/kilo-remote/App.js,apps/kilo-remote/src/components/messages/CodeBlock.js,apps/kilo-remote/src/services/api.js,apps/kilo-remote/src/components/ChatView.js,apps/kilo-remote/src/components/messages/TextMessage.js,apps/kilo-remote/src/components/messages/KiloSaidMessage.js,apps/kilo-remote/src/components/ChatRow.js,apps/kilo-remote/server.js,apps/kilo-remote/node_modules/react-native-event-source/eventsource.js,apps/kilo-remote/src/components/ChatInput.js\\n\\n# Current Time\\nCurrent time in ISO 8601 UTC format: 2025-10-13T09:35:41.666Z\\nUser time zone: Asia/Calcutta, UTC+5:30\\n\\n# Current Cost\\n$0.00\\n\\n# Current Mode\\n<slug>code</slug>\\n<name>Code</name>\\n<model>gemini-2.5-pro</model>\\n====\\n\\nREMINDERS\\n\\nBelow is your current list of reminders for this task. Keep them updated as you progress.\\n\\n| # | Content | Status |\\n|---|---------|--------|\\n| 1 | 1.  **Project Setup:** Create a tab-based navigation system with \\"Chat\\" and \\"History\\" tabs. | Completed |\\n| 2 | 2.  **Project Setup:** Create and render placeholder components for `ChatView` and `HistoryView` in their respective tabs. | Completed |\\n| 3 | 3.  **Checkpoint 1:** Run the app to verify the tab navigation and placeholder components. | Completed |\\n| 4 | 4.  **ChatView:** Implement the message list using a `FlatList` and a `ChatRow` component. | Completed |\\n| 5 | 5.  **ChatView:** Implement the text input area with a mode selector, \\"Send\\" icon, and a \\"Cancel\\" button that appears during streaming. | Completed |\\n| 6 | 6.  **ChatView:** Update the mock server to emit the sample JSON and handle the `partial` flag for streaming messages. | Completed |\\n| 7 | 7.  **Checkpoint 2:** Run the app to test the message list, text input, and message streaming. | Completed |\\n| 8 | 8.  **ChatView:** Implement Markdown rendering using `react-native-markdown-display`. | Completed |\\n| 9 | 9.  **ChatView:** Implement code block highlighting using `react-native-syntax-highlighter`. | Completed |\\n| 10 | 10. **Checkpoint 3:** Run the app to test Markdown and code block rendering. | Completed |\\n| 11 | 11. **ChatView:** Implement \\"Kilo said\\" messages. | Completed |\\n| 12 | 12. **Checkpoint 4:** Run the app to test \\"Kilo said\\" messages. | Completed |\\n| 13 | 13. **Streaming:** Create a new service to handle the streaming. | Completed |\\n| 14 | 14. **Streaming:** Update `ChatView.js` to use the new service. | Completed |\\n| 15 | 15. **Checkpoint 5:** Run the app to test the new streaming implementation. | Completed |\\n| 16 | 16. **BugFix:** Fix the cancel button not converting to send icon. | Completed |\\n| 17 | 17. **BugFix:** Fix the markdown theme for single backticks. | Completed |\\n| 18 | 18. **Checkpoint 6:** Run the app to test the bug fixes. | In Progress |\\n| 19 | 19. **ChatView:** Implement \\"Checkpoint\\" messages. | Pending |\\n| 20 | 20. **Checkpoint 7:** Run the app to test \\"Checkpoint\\" messages. | Pending |\\n| 21 | 21. **ChatView:** Implement \\"API Request\\" messages. | Pending |\\n| 22 | 22. **Checkpoint 8:** Run the app to test \\"API Request\\" messages. | Pending |\\n| 23 | 23. **ChatView:** Implement \\"Kilo has a question\\" messages. | Pending |\\n| 24 | 24. **Checkpoint 9:** Run the app to test \\"Kilo has a question\\" messages. | Pending |\\n| 25 | 25. **ChatView:** Implement \\"TODO List\\" messages. | Pending |\\n| 26 | 26. **Checkpoint 10:** Run the app to test \\"TODO List\\" messages. | Pending |\\n| 27 | 27. **ChatView:** Implement \\"Kilo wants to read this file\\" messages. | Pending |\\n| 28 | 28. **Checkpoint 11:** Run the app to test \\"Kilo wants to read this file\\" messages. | Pending |\\n| 29 | 29. **ChatView:** Implement follow-up suggestions. | Pending |\\n| 30 | 30. **Checkpoint 12:** Run the app to test follow-up suggestions. | Pending |\\n| 31 | 31. **ChatView:** Implement tool and command messages. | Pending |\\n| 32 | 32. **Checkpoint 13:** Run the app to test tool and command messages. | Pending |\\n| 33 | 33. **HistoryView:** Implement the task list using a `FlatList` and a `TaskItem` component. | Pending |\\n| 34 | 34. **Checkpoint 14:** Run the app to test the history list. | Pending |\\n| 35 | 35. **HistoryView:** Implement search and sort functionality. | Pending |\\n| 36 | 36. **Checkpoint 15:** Run the app to test search and sort functionality. | Pending |\\n| 37 | 37. **HistoryView:** Implement delete and batch delete functionality. | Pending |\\n| 38 | 38. **Checkpoint 16:** Run the app to test delete and batch delete functionality. | Pending |\\n| 39 | 39. **HistoryView:** Implement favorites functionality. | Pending |\\n| 40 | 40. **Checkpoint 17:** Run the app to test favorites functionality. | Pending |\\n| 41 | 41. **Integration:** Connect the `HistoryView` to the `ChatView`. | Pending |\\n| 42 | 42. **Checkpoint 18:** Run the app to test the full `ChatView` and `HistoryView` integration. | Pending |\\n| 43 | 43. **Final Touches:** Replace mock data with real data. | Pending |\\n| 44 | 44. **Final Touches:** Add icons and polish the UI. | Pending |\\n\\n\\nIMPORTANT: When task status changes, remember to call the `update_todo_list` tool to update your progress.\\n\\n</environment_details>","apiProtocol":"openai","tokensIn":269573,"tokensOut":124,"cacheWrites":0,"cacheReads":0,"cost":0,"usageMissing":false}',
	},
	{
		ts: 1761000015000,
		type: "ask",
		ask: "followup",
		text: '{"question":"To format the time nicely, I recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?recommend using the `date-fns` library. Is it okay to install it?","suggest":[{"answer":"Yes, go ahead and install `date-fns`."},{"answer":"No, use the native `Date` object without external libraries."}]}',
	},
	{
		ts: 1761000020000,
		type: "ask",
		ask: "command",
		text: "npm install date-fns",
		partial: false,
	},
	{
		ts: 1761000025000,
		type: "say",
		say: "command_output",
		text: "added 1 package, and audited 531 packages in 5s\n\n78 packages are looking for funding\n  run `npm fund` for details",
	},
	{
		ts: 1761000028000,
		type: "say",
		say: "error",
		text: "Failed to apply diff: The file `src/components/Dashboard.js` has been modified since it was last read. Please review the changes before I proceed.",
	},
	{
		ts: 1761000032000,
		type: "ask",
		ask: "tool",
		text: '{"tool":"appliedDiff","path":"src/components/Dashboard.js","diff":"- const timestamp = new Date().toISOString();\\n+ import { format } from \'date-fns\';\\n+ const [time, setTime] = useState(new Date());\\n+ useEffect(() => {\\n+   const timer = setInterval(() => setTime(new Date()), 1000);\\n+   return () => clearInterval(timer);\\n+ }, []);\\n- <span>{timestamp}</span>\\n+ <span>{format(time, \'yyyy-MM-dd HH:mm:ss\')}</span>"}',
	},
	{
		ts: 1761000035000,
		type: "say",
		say: "checkpoint_saved",
		text: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
	},
	{
		ts: 1761000040000,
		type: "say",
		say: "completion_result",
		text: "### Task Complete!\n\nI have successfully updated the dashboard component.\n\n- **Bug Fix:** The static timestamp has been replaced with a dynamic one that updates every second.\n- **Enhancement:** Installed and used the `date-fns` library to format the time as `yyyy-MM-dd HH:mm:ss`.\n\nThe dashboard should now display a live, ticking clock.",
		partial: false,
	},
	{
		ts: 1761000042000,
		type: "say",
		say: "text",
		text: "This is a Kilo said message.",
	},
	{
		ts: 1760453594184,
		type: "ask",
		ask: "tool",
		text: '{"tool":"switchMode","mode":"code","reason":"I have a clear plan and need to start implementing the code changes."}',
		isProtected: false,
	},
	// {
	//     "ts": 1760453606540,
	//     "type": "ask",
	//     "ask": "tool",
	//     "text": "{\"tool\":\"listFilesTopLevel\",\"path\":\"apps/kilo-remote/src/styles\",\"isOutsideWorkspace\":false,\"content\":\"ambient.js\n animations.js\nmessages.js\nmodes.js\ntext-treatments.js\ntheme.js\ntransitions.js\ntypography.js\"}",
	//     "isProtected": false
	// },
	{
		ts: 1761017879437,
		type: "ask",
		ask: "completion_result",
		text: ""
	},
	{
		ts: 1761025633515,
		type: "ask",
		ask: "resume_completed_task"
	},
	{
		ts: 1761025907958,
		type: "say",
		say: "user_feedback",
		text: "secondary text is kinda very greyish. And I am using secondary for all the main text on the screen.\nIf it matches with primaryText, may be change it to somethign different but. Make secondary text brighter",
		images: []
	}
]

app.get("/health", (req, res) => {
	console.log("GET /health")
	res.json({ status: "ok", workspacePath: "/Users/sainath/AdhocProjects/ai-studio-organiser" })
})

app.get("/modes", (req, res) => {
	console.log("GET /modes")
	res.json([
		{ slug: "architect", name: "Architect" },
		{ slug: "code", name: "Code" },
		{ slug: "debug", name: "Debug" },
		{ slug: "test", name: "Test" },
		{ slug: "translate", name: "Translate" },
	])
})

app.post("/modes", (req, res) => {
	console.log("POST /modes", req.body)
	res.json({ status: "ok" })
})

app.get("/tasks", (req, res) => {
	console.log("GET /tasks")
	res.json(sampleTasks)
})

app.get("/tasks/:taskId", (req, res) => {
	const { taskId } = req.params
	console.log(`GET /tasks/${taskId}`)
	const task = sampleTasks.find((t) => t.id === taskId)
	if (task) {
		res.json(sampleMessages)
	} else {
		res.status(404).json({ error: "Task not found" })
	}
})

const handleStreamRequest = (req, res, message, taskId) => {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		"Access-Control-Allow-Origin": "*",
	})

	if (taskId) {
		// Send taskId event first for new tasks
		res.write(`id: ${Date.now()}\n`)
		res.write(`event: taskId\n`)
		res.write(`data: ${JSON.stringify({ taskId })}\n\n`)
	}

	// Stream sample messages
	const sendEvent = (index) => {
		if (index < sampleMessages.length) {
			const message = sampleMessages[index]
			if (message) {
				res.write(`data: ${JSON.stringify(message)}\n\n`)
			}
			setTimeout(() => sendEvent(index + 1), 250)
		} else {
			// Send end-of-stream for web clients
			res.write('data: {"type": "stream_end"}\n\n')
			res.end()
		}
	}

	sendEvent(0)

	req.on("close", () => {
		// Stop sending events if the client disconnects
	})
}

app.post("/new-task", (req, res) => {
	const taskId = crypto.randomUUID()
	const { message } = req.body
	console.log(`POST /new-task, message: "${message}". Responding with taskId: ${taskId}`)
	handleStreamRequest(req, res, message, taskId)
})

app.post("/send-followup", (req, res) => {
	const { taskId, message } = req.body
	console.log(`POST /send-followup for task ${taskId}: "${message}"`)
	handleStreamRequest(req, res, message, null)
})

app.get("/current-mode/:taskId", (req, res) => {
	const { taskId } = req.params
	console.log(`GET /current-mode/${taskId}`)
	const task = sampleTasks.find((t) => t.id === taskId)
	if (task) {
		res.json({ mode: task.mode })
	} else {
		// Default to architect if task not found, or handle as an error
		res.status(404).json({ error: "Task not found" })
	}
})

app.post("/cancel-task", (req, res) => {
	const { taskId } = req.body
	console.log(`POST /cancel-task for task ${taskId}`)
	res.json({ status: "ok" })
})

const PORT = 3000
app.listen(PORT, "0.0.0.0", () => {
	console.log(`Mock server running at http://0.0.0.0:${PORT}/`)
})
