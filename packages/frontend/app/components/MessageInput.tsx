import { useRef, useState } from "react";

type MessageInputProps = {
	onSend: (content: string) => void;
	disabled: boolean;
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const resizeTextarea = () => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		resizeTextarea();
	};

	const handleSubmit = () => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue("");
		const el = textareaRef.current;
		if (el) {
			el.style.height = "auto";
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const isSendDisabled = disabled || value.trim().length === 0;

	return (
		<div>
			<div className="rounded-2xl bg-[#292929] border border-[#3a3a3a] overflow-hidden">
				<textarea
					ref={textareaRef}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder="How can I help you today?"
					disabled={disabled}
					rows={1}
					className="w-full bg-transparent border-none outline-none resize-none px-4 pt-3 pb-2 text-[#e8e4df] placeholder-[#666] text-sm leading-6 min-h-6 overflow-y-auto"
					style={{ maxHeight: "200px" }}
				/>
				<div className="flex items-center justify-between px-3 pb-2">
					{/* Left: action buttons */}
					<div className="flex items-center gap-1">
						<button
							type="button"
							className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666] hover:text-[#999] hover:bg-[#3a3a3a] transition-colors"
							aria-label="Add attachment"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</button>
					</div>

					{/* Right: model label + send button */}
					<div className="flex items-center gap-2">
						<span className="text-xs text-[#888] select-none flex items-center gap-1">
							<span className="font-medium text-[#999]">GPT4.1-mini</span>
							<svg
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#666"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</span>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isSendDisabled}
							className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
								isSendDisabled
									? "bg-[#444] cursor-not-allowed"
									: "bg-[#c96442] hover:bg-[#b5573a] cursor-pointer"
							}`}
							aria-label="Send message"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke={isSendDisabled ? "#666" : "#fff"}
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M12 19V5M5 12l7-7 7 7" />
							</svg>
						</button>
					</div>
				</div>
			</div>
			<p className="text-center text-[11px] text-[#555] mt-2 select-none">
				AI can make mistakes. Please double-check responses.
			</p>
		</div>
	);
}
