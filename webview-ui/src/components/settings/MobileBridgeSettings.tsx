import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { ToggleSwitch } from "../ui/toggle-switch"
import { vscode } from "@src/utils/vscode"

type MobileBridgeSettingsProps = {
	port: number
	setPort: (port: number) => void
	serverStatus: string
	onSave: () => void
	enabled: boolean
	setEnabled: (enabled: boolean) => void
}

export const MobileBridgeSettings = ({
	port,
	setPort,
	serverStatus,
	onSave,
	enabled,
	setEnabled,
}: MobileBridgeSettingsProps) => {
	const { t } = useAppTranslation()

	const handleSave = () => {
		if (enabled) {
			vscode.postMessage({ type: "startMobileBridge", value: port })
		} else {
			vscode.postMessage({ type: "stopMobileBridge" })
		}
		onSave()
	}

	return (
		<div className="flex flex-col gap-2 p-2 border-t border-border">
			<div className="flex items-center gap-2">
				<label htmlFor="port" className="text-sm font-medium">
					{t("settings:mobileBridge.port")}
				</label>
				<Input
					id="port"
					type="number"
					value={port}
					onChange={(e) => setPort(parseInt(e.target.value, 10))}
					className="w-24"
				/>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium">{t("settings:mobileBridge.status")}</span>
				<span className="text-sm">{serverStatus}</span>
			</div>
			<div className="flex items-center gap-2">
				<label htmlFor="enabled" className="text-sm font-medium">
					{t("settings:mobileBridge.enabled")}
				</label>
				<ToggleSwitch checked={enabled} onChange={() => setEnabled(!enabled)} />
			</div>
			<Button onClick={handleSave} className="self-start">
				{t("settings:mobileBridge.save")}
			</Button>
		</div>
	)
}
