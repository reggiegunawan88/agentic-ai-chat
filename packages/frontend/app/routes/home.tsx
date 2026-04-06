import { useState } from "react";
import { useNavigate } from "react-router";
import { MessageInput } from "~/components/MessageInput";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Agentic AI Chat" },
		{ name: "description", content: "Agentic AI chatbot interface" },
	];
}

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

const suggestions = [
	{ label: "Calculator", message: "What is 25 * 4 + 10?" },
	{ label: "Web Search", message: "Search for the latest AI news" },
	{
		label: "Multi-step",
		message: "Calculate 100/4 and search for weather in Tokyo",
	},
];

export default function Home() {
	const navigate = useNavigate();
	const [model, setModel] = useState("gpt-4.1-mini");

	const handleSend = (content: string) => {
		const chatId = crypto.randomUUID();
		navigate(`/chat/${chatId}`, { state: { initialMessage: content, model } });
	};

	return (
		<div className="flex-1 flex flex-col items-center justify-center min-w-0 px-4">
			<h1 className="text-2xl sm:text-4xl font-light text-[#e8e4df]/80 mb-6 sm:mb-8">
				{getGreeting()}
			</h1>
			<div className="w-full max-w-xl">
				<MessageInput
					onSend={handleSend}
					disabled={false}
					model={model}
					onModelChange={setModel}
				/>
			</div>
			<div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-4">
				{suggestions.map((suggestion) => (
					<button
						key={suggestion.label}
						type="button"
						onClick={() => handleSend(suggestion.message)}
						className="px-3 sm:px-4 py-2 rounded-full border border-[#3a3a3a] bg-[#292929] text-sm text-[#888] hover:text-[#e8e4df] hover:border-[#555] transition-colors cursor-pointer"
					>
						{suggestion.label}
					</button>
				))}
			</div>
		</div>
	);
}
