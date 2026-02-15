import React from "react"
import { View, StyleSheet, Dimensions } from "react-native"
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
	withRepeat,
	interpolate,
} from "react-native-reanimated"
import { config } from "../config"
import { useTheme } from "../hooks/useTheme"

const { width, height } = Dimensions.get("window")

const Shape = ({ animation }) => {
	const duration = 15000 + Math.random() * 10000
	const progress = useSharedValue(0)

	React.useEffect(() => {
		progress.value = withRepeat(withTiming(1, { duration }), -1, true)
	}, [])

	const animatedStyle = useAnimatedStyle(() => {
		const translateX = interpolate(progress.value, [0, 1], [Math.random() * width, Math.random() * width])
		const translateY = interpolate(progress.value, [0, 1], [Math.random() * height, Math.random() * height])
		const scale = interpolate(progress.value, [0, 0.5, 1], [0.5, 1.5, 0.5])
		const opacity = interpolate(progress.value, [0, 0.5, 1], [0.1, 0.3, 0.1])

		return {
			transform: [{ translateX }, { translateY }, { scale }],
			opacity,
		}
	})

	const shapeStyle = {
		position: "absolute",
		width: animation.size,
		height: animation.size,
		borderRadius: animation.shape === "circle" ? animation.size / 2 : 0,
		backgroundColor: animation.color,
	}

	return <Animated.View style={[shapeStyle, animatedStyle]} />
}

const BubblesBackground = () => {
	const { theme } = useTheme()
	const animation = config(theme).animation.bubbles

	if (!animation) {
		return null
	}

	return (
		<View style={styles.container}>
			{Array.from({ length: animation.count }).map((_, i) => (
				<Shape key={i} animation={animation} />
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "transparent",
		zIndex: -1,
	},
})

export default BubblesBackground
