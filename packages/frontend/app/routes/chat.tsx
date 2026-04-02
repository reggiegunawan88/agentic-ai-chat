import { useLocation } from "react-router";
import type { Route } from "./+types/chat";
import { ChatPanel } from "~/components/ChatPanel";
import { DebugPanel } from "~/components/DebugPanel";
import { MessageInput } from "~/components/MessageInput";
import { useChat } from "~/hooks/useChat";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Chat - Agentic AI" },
		{ name: "description", content: "Agentic AI chat conversation" },
	];
}

export default function Chat() {
	const location = useLocation();
	const initialMessage = (location.state as { initialMessage?: string })
		?.initialMessage;

	const { messages, debugEvents, isThinking, sendMessage } =
		useChat(initialMessage);

	return (
		<div className="flex h-full">
			<div className="flex-1 flex flex-col min-w-0">
				<ChatPanel messages={messages} isThinking={isThinking} />
				<div className="max-w-3xl mx-auto w-full px-4 pb-4">
					<MessageInput onSend={sendMessage} disabled={isThinking} />
				</div>
			</div>
			<DebugPanel events={debugEvents} />
		</div>
	);
}
