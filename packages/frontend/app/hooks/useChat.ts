import { useCallback, useEffect, useRef, useState } from "react";
import { chatStorage } from "~/storage";
import type { AgentEvent, ChatMessage, DebugEntry } from "~/types";

const FLUSH_INTERVAL_MS = 30;

export function useChat(
	chatId: string,
	initialMessage?: string,
	onSave?: () => void,
) {
	const wsRef = useRef<WebSocket | null>(null);
	const initialSent = useRef(false);
	const streamingIdRef = useRef<string | null>(null);
	const deltaQueueRef = useRef<string[]>([]);
	const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [debugEvents, setDebugEvents] = useState<DebugEntry[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isThinking, setIsThinking] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);

	// Save to localStorage when streaming finishes
	const prevStreamingRef = useRef(false);
	useEffect(() => {
		if (prevStreamingRef.current && !isStreaming && messages.length > 0) {
			chatStorage.saveChat(chatId, messages);
			onSave?.();
		}
		prevStreamingRef.current = isStreaming;
	}, [isStreaming, chatId, messages, onSave]);

	const startFlushing = useCallback(() => {
		if (flushTimerRef.current) return;
		flushTimerRef.current = setInterval(() => {
			const chunk = deltaQueueRef.current.shift();
			if (!chunk) return;

			const targetId = streamingIdRef.current;
			if (!targetId) return;

			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === targetId ? { ...msg, content: msg.content + chunk } : msg,
				),
			);
		}, FLUSH_INTERVAL_MS);
	}, []);

	const stopFlushing = useCallback(() => {
		if (flushTimerRef.current) {
			clearInterval(flushTimerRef.current);
			flushTimerRef.current = null;
		}
	}, []);

	const flushRemaining = useCallback(() => {
		const remaining = deltaQueueRef.current.join("");
		deltaQueueRef.current = [];
		if (!remaining) return;

		const targetId = streamingIdRef.current;
		if (!targetId) return;

		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === targetId
					? { ...msg, content: msg.content + remaining }
					: msg,
			),
		);
	}, []);

	const handleEvent = useCallback(
		(data: AgentEvent) => {
			switch (data.type) {
				case "thinking":
					setIsThinking(true);
					setDebugEvents((prev) => [
						...prev,
						{ ...data, timestamp: Date.now() } as DebugEntry,
					]);
					break;

				case "response_delta": {
					setIsThinking(false);

					if (!streamingIdRef.current) {
						const id = crypto.randomUUID();
						streamingIdRef.current = id;
						setIsStreaming(true);
						setMessages((prev) => [
							...prev,
							{ id, role: "assistant", content: data.delta },
						]);
						setDebugEvents((prev) => [
							...prev,
							{ ...data, timestamp: Date.now() } as DebugEntry,
						]);
						startFlushing();
					} else {
						deltaQueueRef.current.push(data.delta);
					}
					break;
				}

				case "response_end":
					stopFlushing();
					flushRemaining();
					streamingIdRef.current = null;
					setIsStreaming(false);
					setIsThinking(false);
					setDebugEvents((prev) => [
						...prev,
						{ ...data, timestamp: Date.now() } as DebugEntry,
					]);
					break;

				case "error":
					stopFlushing();
					deltaQueueRef.current = [];
					streamingIdRef.current = null;
					setIsStreaming(false);
					setIsThinking(false);
					setMessages((prev) => [
						...prev,
						{
							id: crypto.randomUUID(),
							role: "assistant",
							content: `Error: ${data.message}`,
						},
					]);
					setDebugEvents((prev) => [
						...prev,
						{ ...data, timestamp: Date.now() } as DebugEntry,
					]);
					break;

				default:
					setDebugEvents((prev) => [
						...prev,
						{ ...data, timestamp: Date.now() } as DebugEntry,
					]);
					break;
			}
		},
		[startFlushing, stopFlushing, flushRemaining],
	);

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
		// Load stored messages for resumed chats
		const stored = initialMessage ? null : chatStorage.loadMessages(chatId);
		if (stored && stored.length > 0) {
			setMessages(stored);
		}

		const wsUrl = import.meta.env.DEV
			? "ws://localhost:5000/ws"
			: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.addEventListener("open", () => {
			setIsConnected(true);

			if (stored && stored.length > 0) {
				// Resume: restore history on the backend
				ws.send(
					JSON.stringify({
						type: "restore",
						history: stored.map((m) => ({
							role: m.role,
							content: m.content,
						})),
					}),
				);
			} else if (initialMessage && !initialSent.current) {
				// New chat: send first message
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
				ws.send(
					JSON.stringify({
						type: "message",
						content: initialMessage,
					}),
				);
			}
		});

		ws.addEventListener("close", () => {
			setIsConnected(false);
			setIsThinking(false);
			setIsStreaming(false);
			stopFlushing();
			deltaQueueRef.current = [];
			streamingIdRef.current = null;
		});

		ws.addEventListener("message", (event) => {
			const data = JSON.parse(event.data) as AgentEvent;
			handleEvent(data);
		});

		return () => {
			stopFlushing();
			ws.close();
		};
	}, []);

	return {
		messages,
		debugEvents,
		isConnected,
		isThinking,
		isStreaming,
		sendMessage,
	};
}
