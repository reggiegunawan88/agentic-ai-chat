import { useEffect, useRef, useState } from "react";

const MODELS = [
	{ id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
	{ id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
	{ id: "gpt-5-nano", label: "GPT-5 Nano" },
];

type MessageInputProps = {
	onSend: (content: string) => void;
	disabled: boolean;
	model: string;
	onModelChange: (model: string) => void;
};

export function MessageInput({
	onSend,
	disabled,
	model,
	onModelChange,
}: MessageInputProps) {
	const [value, setValue] = useState("");
	const [isModelOpen, setIsModelOpen] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const prevDisabledRef = useRef(disabled);

	const selectedModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

	useEffect(() => {
		if (prevDisabledRef.current && !disabled) {
			textareaRef.current?.focus();
		}
		prevDisabledRef.current = disabled;
	}, [disabled]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				dropdownRef.current?.contains(target) ||
				menuRef.current?.contains(target)
			) {
				return;
			}
			setIsModelOpen(false);
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, []);

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
		<div className="relative">
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

					{/* Right: model selector + send button */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							ref={dropdownRef as React.RefObject<HTMLButtonElement>}
							onClick={() => setIsModelOpen(!isModelOpen)}
							className="text-xs text-[#888] select-none flex items-center gap-1 hover:text-[#bbb] transition-colors cursor-pointer"
						>
							<span className="font-medium text-[#999]">
								{selectedModel.label}
							</span>
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
						</button>
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
			{isModelOpen && (
				<div
					ref={menuRef}
					className="absolute top-full mt-1 right-0 bg-[#2a2a2a] border border-[#444] rounded-lg shadow-lg py-1 min-w-[160px] z-10"
				>
					{MODELS.map((m) => (
						<button
							key={m.id}
							type="button"
							onClick={() => {
								console.log("[model-select] clicked:", m.id);
								onModelChange(m.id);
								setIsModelOpen(false);
							}}
							className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
								m.id === model
									? "text-[#c96442] bg-[#333]"
									: "text-[#999] hover:text-[#e8e4df] hover:bg-[#333]"
							}`}
						>
							{m.label}
						</button>
					))}
				</div>
			)}
			<p className="text-center text-[11px] text-[#555] mt-2 select-none">
				AI can make mistakes. Please double-check responses.
			</p>
		</div>
	);
}
