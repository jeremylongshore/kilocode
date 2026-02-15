import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native"
import { setServerUrl, setWorkspacePath } from "../config"
import { useTheme } from "../hooks/useTheme"
import { getHomeScreenStyles } from "../styles"

const HomeScreen = ({ navigation }) => {
	const [url, setUrl] = useState(process.env.EXPO_PUBLIC_DEFAULT_WORKSPACE_URL || "")
	const { theme } = useTheme()
	const styles = getHomeScreenStyles(theme)

	const handleConnect = async () => {
		try {
			const response = await fetch(`${url}/health`)
			if (response.ok) {
				const data = await response.json()
				setServerUrl(url)
				setWorkspacePath(data.workspacePath)
				navigation.navigate("Main")
			} else {
				Alert.alert("Connection Failed", "Could not connect to the server. Please check the URL and try again.")
			}
		} catch (error) {
			console.error("Connection error:", error)
			Alert.alert(
				"Connection Error",
				"An error occurred while trying to connect. Please check the server URL and your network connection.",
			)
		}
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Welcome to Kilo canvas</Text>
			<TextInput
				style={styles.input}
				value={url}
				onChangeText={setUrl}
				placeholder="Enter server URL"
				placeholderTextColor={theme.dim}
				autoCapitalize="none"
				keyboardType="url"
			/>
			<TouchableOpacity style={styles.button} onPress={handleConnect}>
				<Text style={styles.buttonText}>Connect</Text>
			</TouchableOpacity>
		</View>
	)
}

export default HomeScreen
