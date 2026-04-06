import { useState } from "react";
import type { ChatMeta } from "~/types";

type ChatSidebarProps = {
	chats: ChatMeta[];
	activeChatId?: string;
	onSelectChat: (chatId: string) => void;
	onNewChat: () => void;
	onDeleteChat: (chatId: string) => void;
};

function ChatList({
	chats,
	activeChatId,
	onSelectChat,
	onDeleteChat,
}: Omit<ChatSidebarProps, "onNewChat">) {
	return (
		<div className="flex-1 overflow-y-auto px-2 py-2" style={{ minHeight: 0 }}>
			{chats.length === 0 ? (
				<p
					className="text-[11px] text-center mt-8 select-none"
					style={{ color: "#444" }}
				>
					No conversations yet
				</p>
			) : (
				<ul className="space-y-0.5">
					{chats.map((chat) => (
						<li key={chat.id} className="group relative">
							<button
								type="button"
								onClick={() => onSelectChat(chat.id)}
								className="w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors"
								style={{
									color: chat.id === activeChatId ? "#e8e4df" : "#999",
									backgroundColor:
										chat.id === activeChatId ? "#292929" : "transparent",
								}}
								title={chat.title}
							>
								{chat.title}
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onDeleteChat(chat.id);
								}}
								className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#3a3a3a]"
								style={{ color: "#666" }}
								aria-label={`Delete "${chat.title}"`}
							>
								<span className="text-xs">{"\u2715"}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function ChatSidebar({
	chats,
	activeChatId,
	onSelectChat,
	onNewChat,
	onDeleteChat,
}: ChatSidebarProps) {
	const [isOpen, setIsOpen] = useState(true);

	const newChatButton = (
		<button
			type="button"
			onClick={onNewChat}
			className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#2a2a2a] text-left flex items-center gap-2"
			style={{ color: "#e8e4df" }}
		>
			<svg
				width="14"
				height="14"
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
			New Chat
		</button>
	);

	const toggleButton = (
		<button
			type="button"
			onClick={() => setIsOpen((prev) => !prev)}
			className="flex items-center justify-center w-full py-2 transition-colors hover:bg-[#2a2a2a]"
			style={{ color: "#555" }}
			aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
			title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
		>
			{isOpen ? (
				<span className="text-xs font-mono select-none">{"\u2039"}</span>
			) : (
				<span className="text-xs font-mono select-none">{"\u203A"}</span>
			)}
		</button>
	);

	return (
		<>
			{/* Mobile: floating toggle + full-screen overlay */}
			<div className="md:hidden">
				<button
					type="button"
					onClick={() => setIsOpen((prev) => !prev)}
					className="fixed bottom-20 left-3 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors"
					style={{
						backgroundColor: isOpen ? "#c96442" : "#292929",
						border: "1px solid #3a3a3a",
					}}
					aria-label="Toggle chat history"
				>
					<span className="text-[10px] font-bold text-[#e8e4df] select-none">
						{isOpen ? "\u2715" : "\u2630"}
					</span>
				</button>

				{isOpen && (
					<div
						className="fixed inset-0 z-30 flex flex-col"
						style={{ backgroundColor: "#1f1f1f" }}
					>
						<div
							className="flex items-center justify-between px-3 py-3 shrink-0"
							style={{ borderBottom: "1px solid #2a2a2a" }}
						>
							<span
								className="text-[11px] font-medium tracking-widest uppercase select-none"
								style={{ color: "#555" }}
							>
								Recents
							</span>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="w-7 h-7 rounded-lg flex items-center justify-center text-[#888] hover:text-[#e8e4df] hover:bg-[#2a2a2a] transition-colors"
								aria-label="Close sidebar"
							>
								<span className="text-sm font-mono">{"\u2715"}</span>
							</button>
						</div>
						<div className="px-2 py-2 shrink-0">{newChatButton}</div>
						<ChatList
							chats={chats}
							activeChatId={activeChatId}
							onSelectChat={(id) => {
								onSelectChat(id);
								setIsOpen(false);
							}}
							onDeleteChat={onDeleteChat}
						/>
					</div>
				)}
			</div>

			{/* Desktop: side panel */}
			<div className="hidden md:flex">
				{!isOpen ? (
					<div
						className="flex flex-col items-center shrink-0"
						style={{
							width: "40px",
							borderRight: "1px solid #2a2a2a",
							backgroundColor: "#1f1f1f",
						}}
					>
						<div
							className="w-full py-2"
							style={{ borderBottom: "1px solid #2a2a2a" }}
						>
							{toggleButton}
						</div>
						<div
							className="mt-4 text-[10px] font-medium tracking-widest select-none"
							style={{
								color: "#444",
								writingMode: "vertical-rl",
								textOrientation: "mixed",
								transform: "rotate(180deg)",
							}}
						>
							CHATS
						</div>
					</div>
				) : (
					<div
						className="flex flex-col shrink-0"
						style={{
							width: "280px",
							borderRight: "1px solid #2a2a2a",
							backgroundColor: "#1f1f1f",
						}}
					>
						<div
							className="flex items-center justify-between px-3 py-2 shrink-0"
							style={{ borderBottom: "1px solid #2a2a2a" }}
						>
							<span
								className="text-[11px] font-medium tracking-widest uppercase select-none"
								style={{ color: "#555" }}
							>
								Recents
							</span>
							{toggleButton}
						</div>
						<div className="px-2 py-2 shrink-0">{newChatButton}</div>
						<ChatList
							chats={chats}
							activeChatId={activeChatId}
							onSelectChat={onSelectChat}
							onDeleteChat={onDeleteChat}
						/>
					</div>
				)}
			</div>
		</>
	);
}
