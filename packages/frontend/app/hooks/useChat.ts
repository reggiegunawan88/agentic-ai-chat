import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, ChatMessage, DebugEntry } from "~/types";

export function useChat(initialMessage?: string) {
	const wsRef = useRef<WebSocket | null>(null);
	const initialSent = useRef(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [debugEvents, setDebugEvents] = useState<DebugEntry[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isThinking, setIsThinking] = useState(false);

	const handleEvent = useCallback((data: AgentEvent) => {
		const entry: DebugEntry = { ...data, timestamp: Date.now() } as DebugEntry;
		setDebugEvents((prev) => [...prev, entry]);

		switch (data.type) {
			case "thinking":
				setIsThinking(true);
				break;
			case "response":
				setIsThinking(false);
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: data.content,
					},
				]);
				break;
			case "error":
				setIsThinking(false);
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: `Error: ${data.message}`,
					},
				]);
				break;
		}
	}, []);

	const sendViaWs = useCallback((content: string) => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "message", content }));
	}, []);

	const sendMessage = useCallback(
		(content: string) => {
			setMessages((prev) => [
				...prev,
				{ id: crypto.randomUUID(), role: "user", content },
			]);
			setIsThinking(true);
			sendViaWs(content);
		},
		[sendViaWs],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: We only want this to run once on mount; handleEvent and sendViaWs are stable refs
	useEffect(() => {
		const wsUrl = import.meta.env.DEV
			? "ws://localhost:5000/ws"
			: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.addEventListener("open", () => {
			setIsConnected(true);
			// Send initial message once connected
			if (initialMessage && !initialSent.current) {
				initialSent.current = true;
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "user",
						content: initialMessage,
					},
				]);
				setIsThinking(true);
				ws.send(JSON.stringify({ type: "message", content: initialMessage }));
			}
		});

		ws.addEventListener("close", () => {
			setIsConnected(false);
			setIsThinking(false);
		});

		ws.addEventListener("message", (event) => {
			const data = JSON.parse(event.data) as AgentEvent;
			handleEvent(data);
		});

		return () => {
			ws.close();
		};
	}, []);

	return { messages, debugEvents, isConnected, isThinking, sendMessage };
}
