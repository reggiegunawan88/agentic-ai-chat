import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "~/types";

const thinkingLabels = [
	"Thinking...",
	"Pondering...",
	"Reasoning...",
	"Combobulating...",
	"Processing...",
	"Analyzing...",
	"Cogitating...",
	"Ruminating...",
];

type ChatPanelProps = {
	messages: ChatMessage[];
	isThinking: boolean;
};

export function ChatPanel({ messages, isThinking }: ChatPanelProps) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const [labelIndex, setLabelIndex] = useState(0);
	const [elapsed, setElapsed] = useState(0);

	// Cycle through thinking labels every 2 seconds while the agent is thinking
	useEffect(() => {
		if (!isThinking) {
			setLabelIndex(0);
			setElapsed(0);
			return;
		}
		const labelInterval = setInterval(() => {
			setLabelIndex((i) => (i + 1) % thinkingLabels.length);
		}, 2000);
		const timerInterval = setInterval(() => {
			setElapsed((s) => s + 1);
		}, 1000);
		return () => {
			clearInterval(labelInterval);
			clearInterval(timerInterval);
		};
	}, [isThinking]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isThinking]);

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
				{messages.map((message) =>
					message.role === "user" ? (
						<div key={message.id} className="flex justify-end">
							<div className="bg-[#292929] border border-[#3a3a3a] rounded-2xl px-4 py-3 max-w-[70%] text-[#e8e4df] leading-relaxed whitespace-pre-wrap">
								{message.content}
							</div>
						</div>
					) : (
						<div key={message.id} className="flex justify-start">
							<div className="flex items-start gap-3 max-w-[70%]">
								<div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center">
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#888"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
										<circle cx="9" cy="14" r="1" fill="#888" stroke="none" />
										<circle cx="15" cy="14" r="1" fill="#888" stroke="none" />
									</svg>
								</div>
								<div className="text-[#e8e4df] leading-relaxed whitespace-pre-wrap pt-1">
									{message.content}
								</div>
							</div>
						</div>
					),
				)}

				{isThinking && (
					<div className="flex justify-start">
						<div className="flex items-center gap-3">
							<div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="#888"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
									<circle cx="9" cy="14" r="1" fill="#888" stroke="none" />
									<circle cx="15" cy="14" r="1" fill="#888" stroke="none" />
								</svg>
							</div>
							<span className="text-[#888] text-sm italic animate-pulse pt-1">
								{thinkingLabels[labelIndex]}
							</span>
							<span className="text-[#555] text-xs pt-1">({elapsed}s)</span>
						</div>
					</div>
				)}

				<div ref={bottomRef} />
			</div>
		</div>
	);
}
