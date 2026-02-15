import React from "react"
import { config } from "../config"
import BubblesBackground from "./BubblesBackground"
import MatrixBackground from "./MatrixBackground"
import { useTheme } from "../hooks/useTheme"

const AnimatedBackground = () => {
	const { theme } = useTheme()
	const animationName = config(theme).animation.name

	if (animationName === "matrix") {
		return <MatrixBackground />
	}

	// Default to bubbles
	return <BubblesBackground />
}

export default AnimatedBackground
