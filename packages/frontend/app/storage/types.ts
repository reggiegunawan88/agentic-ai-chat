import type { ChatMessage, ChatMeta } from "~/types";

export interface ChatStorage {
	listChats(): ChatMeta[];
	loadMessages(chatId: string): ChatMessage[] | null;
	saveChat(chatId: string, messages: ChatMessage[]): void;
	deleteChat(chatId: string): void;
}
