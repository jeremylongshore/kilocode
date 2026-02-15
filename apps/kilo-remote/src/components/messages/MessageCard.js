import React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "../../hooks/useTheme"
import { getMessageCardStyles } from "../../styles"

const MessageCard = ({ headerIcon, headerText, children, onHeaderPress, isError, isUserFeedback }) => {
	const { theme } = useTheme()
	const styles = getMessageCardStyles(theme)

	const Header = () => {
		if (!headerText) {
			return null
		}
		return (
			<View style={styles.header}>
				<View style={styles.icon}>{headerIcon}</View>
				<Text style={styles.headerText}>{headerText}</Text>
			</View>
		)
	}

	return (
		<LinearGradient
			colors={isError ? [theme.error, theme.error] : theme.rainbowGradient}
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 1 }}
			style={styles.gradientBorder}>
			<View style={[styles.card, isUserFeedback && { backgroundColor: theme.dim }]}>
				{headerText &&
					(onHeaderPress ? (
						<TouchableOpacity onPress={onHeaderPress} activeOpacity={0.7}>
							<Header />
						</TouchableOpacity>
					) : (
						<Header />
					))}
				<View style={[styles.body, !headerText && { marginTop: 0 }]}>{children}</View>
			</View>
		</LinearGradient>
	)
}

export default MessageCard
