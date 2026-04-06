import { useState } from "react";
import { useLocation, useOutletContext, useParams } from "react-router";
import { ChatPanel } from "~/components/ChatPanel";
import { DebugPanel } from "~/components/DebugPanel";
import { MessageInput } from "~/components/MessageInput";
import { useChat } from "~/hooks/useChat";
import type { Route } from "./+types/chat";
import type { LayoutContext } from "./layout";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Chat - Agentic AI" },
		{ name: "description", content: "Agentic AI chat conversation" },
	];
}

export default function Chat() {
	const params = useParams<{ id: string }>();
	const location = useLocation();
	const { refreshChats } = useOutletContext<LayoutContext>();
	const state = location.state as {
		initialMessage?: string;
		model?: string;
	};
	const initialMessage = state?.initialMessage;
	const [model, setModel] = useState(state?.model ?? "gpt-4.1-mini");

	const { messages, debugEvents, isThinking, isStreaming, sendMessage } =
		useChat(params.id!, initialMessage, refreshChats, model);

	return (
		<>
			<div className="flex-1 flex flex-col min-w-0">
				<ChatPanel
					messages={messages}
					isThinking={isThinking}
					isStreaming={isStreaming}
				/>
				<div className="max-w-3xl mx-auto w-full px-2 sm:px-4 pb-3 sm:pb-4">
					<MessageInput
						onSend={sendMessage}
						disabled={isThinking || isStreaming}
						model={model}
						onModelChange={setModel}
					/>
				</div>
			</div>
			<DebugPanel events={debugEvents} />
		</>
	);
}
