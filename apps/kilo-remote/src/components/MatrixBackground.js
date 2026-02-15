import React, { useEffect } from "react"
import { View, Text, StyleSheet, Dimensions } from "react-native"
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
	withRepeat,
	withDelay,
	interpolate,
	Extrapolate,
} from "react-native-reanimated"
import { BlurView } from "expo-blur"
import { useTheme } from "../hooks/useTheme" // hook for theme access

const { width, height } = Dimensions.get("window")
const COLUMN_COUNT = 20
const SYMBOLS = "アァカサタナハマヤャラワン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$@#%&*+-"

const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]

const MatrixColumn = ({ index, theme, styles }) => {
	const progress = useSharedValue(0)
	const speed = 4000 + Math.random() * 4000 // different speeds
	const delay = Math.random() * 4000 // staggered starts

	useEffect(() => {
		progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: speed }), -1, false))
	}, [])

	const animatedStyle = useAnimatedStyle(() => {
		const translateY = interpolate(progress.value, [0, 1], [-height, height], Extrapolate.CLAMP)
		const opacity = interpolate(progress.value, [0, 0.2, 1], [0.2, 1, 0.2])
		return {
			transform: [{ translateY }],
			opacity,
		}
	})

	const columnSymbols = Array.from({ length: 20 }, () => randomSymbol())

	return (
		<Animated.View style={[styles.column, animatedStyle, { left: (width / COLUMN_COUNT) * index }]}>
			{columnSymbols.map((sym, i) => (
				<Text
					key={i}
					style={[
						styles.symbol,
						{
							color: i === columnSymbols.length - 1 ? theme.primary : theme.secondary, // use theme greens
						},
					]}>
					{sym}
				</Text>
			))}
		</Animated.View>
	)
}

const MatrixBackground = () => {
	const { theme } = useTheme()
	const styles = getStyles(theme)

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			{/* Falling code columns */}
			{Array.from({ length: COLUMN_COUNT }).map((_, i) => (
				<MatrixColumn key={i} index={i} theme={theme} styles={styles} />
			))}

			{/* Frosted glass overlay */}
			<BlurView intensity={5} tint="light" style={StyleSheet.absoluteFill} />

			{/* Slight translucent overlay for text readability */}
			<View
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: theme.backgroundOverlay }, // matches theme.background
				]}
			/>
		</View>
	)
}

const getStyles = (theme) =>
	StyleSheet.create({
		container: {
			...StyleSheet.absoluteFillObject,
			zIndex: -1,
			flexDirection: "row",
		},
		column: {
			position: "absolute",
			top: 0,
			width: width / COLUMN_COUNT,
			alignItems: "center",
		},
		symbol: {
			fontSize: 8,
			fontWeight: "bold",
			textShadowColor: theme.primary,
			textShadowOffset: { width: 0, height: 0 },
			textShadowRadius: 6,
		},
	})

export default MatrixBackground
