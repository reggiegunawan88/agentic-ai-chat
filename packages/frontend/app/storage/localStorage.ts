import type { ChatMessage, ChatMeta } from "~/types";
import type { ChatStorage } from "./types";

const META_KEY = "chat:meta";
const MESSAGES_PREFIX = "chat:messages:";

const isBrowser = typeof window !== "undefined";

export class LocalChatStorage implements ChatStorage {
	listChats(): ChatMeta[] {
		if (!isBrowser) return [];
		const raw = localStorage.getItem(META_KEY);
		if (!raw) return [];
		const metas = JSON.parse(raw) as ChatMeta[];
		return metas.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	loadMessages(chatId: string): ChatMessage[] | null {
		if (!isBrowser) return null;
		const raw = localStorage.getItem(MESSAGES_PREFIX + chatId);
		if (!raw) return null;
		return JSON.parse(raw) as ChatMessage[];
	}

	saveChat(chatId: string, messages: ChatMessage[]): void {
		if (!isBrowser) return;
		// Save messages
		localStorage.setItem(MESSAGES_PREFIX + chatId, JSON.stringify(messages));

		// Derive title from first user message
		const firstUserMsg = messages.find((m) => m.role === "user");
		const title = firstUserMsg
			? firstUserMsg.content.slice(0, 100)
			: "New chat";

		// Upsert meta
		const metas = this.listChats();
		const existing = metas.find((m) => m.id === chatId);
		const now = Date.now();

		if (existing) {
			existing.title = title;
			existing.updatedAt = now;
		} else {
			metas.push({
				id: chatId,
				title,
				createdAt: now,
				updatedAt: now,
			});
		}

		localStorage.setItem(META_KEY, JSON.stringify(metas));
	}

	deleteChat(chatId: string): void {
		if (!isBrowser) return;
		localStorage.removeItem(MESSAGES_PREFIX + chatId);

		const metas = this.listChats().filter((m) => m.id !== chatId);
		localStorage.setItem(META_KEY, JSON.stringify(metas));
	}
}
