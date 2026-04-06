import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { ChatSidebar } from "~/components/ChatSidebar";
import { chatStorage } from "~/storage";
import type { ChatMeta } from "~/types";

export type LayoutContext = {
	refreshChats: () => void;
};

export default function AppLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const [chats, setChats] = useState<ChatMeta[]>(() =>
		chatStorage.listChats(),
	);

	const refreshChats = () => setChats(chatStorage.listChats());

	const match = location.pathname.match(/^\/chat\/(.+)$/);
	const activeChatId = match?.[1];

	const handleSelectChat = (chatId: string) => {
		navigate(`/chat/${chatId}`);
	};

	const handleNewChat = () => {
		navigate("/");
	};

	const handleDeleteChat = (chatId: string) => {
		chatStorage.deleteChat(chatId);
		refreshChats();
		if (chatId === activeChatId) {
			navigate("/");
		}
	};

	return (
		<div className="flex h-full">
			<ChatSidebar
				chats={chats}
				activeChatId={activeChatId}
				onSelectChat={handleSelectChat}
				onNewChat={handleNewChat}
				onDeleteChat={handleDeleteChat}
			/>
			<Outlet context={{ refreshChats } satisfies LayoutContext} />
		</div>
	);
}
