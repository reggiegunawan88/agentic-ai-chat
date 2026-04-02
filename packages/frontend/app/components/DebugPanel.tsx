import { useEffect, useRef, useState } from "react";
import type { DebugEntry } from "~/types";

type EventStyleConfig = {
	icon: string;
	color: string;
	label: string;
};

const EVENT_STYLES: Record<DebugEntry["type"], EventStyleConfig> = {
	thinking: {
		icon: "\u22EF", // midline horizontal ellipsis ⋯
		color: "#888888",
		label: "Thinking",
	},
	tool_call: {
		icon: "\u2692", // hammer and pick ⚒
		color: "#d4a017",
		label: "Tool Call",
	},
	tool_result: {
		icon: "\u2713", // check mark ✓
		color: "#4ade80",
		label: "Tool Result",
	},
	response: {
		icon: "\u203A\u203A", // double chevron ›› (response/output indicator)
		color: "#60a5fa",
		label: "Response",
	},
	error: {
		icon: "\u2715", // multiplication x ✕
		color: "#ef4444",
		label: "Error",
	},
};

function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `${hh}:${mm}:${ss}`;
}

type EventDetailProps = {
	entry: DebugEntry;
};

function EventDetail({ entry }: EventDetailProps) {
	const style = EVENT_STYLES[entry.type];

	const header = (
		<div className="flex items-baseline gap-2 min-w-0">
			<span
				className="font-mono text-xs shrink-0"
				style={{ color: style.color }}
				aria-hidden="true"
			>
				{style.icon}
			</span>
			<span
				className="text-[11px] font-medium shrink-0"
				style={{ color: style.color }}
			>
				{style.label}
			</span>
			<span
				className="text-[10px] ml-auto shrink-0 tabular-nums"
				style={{ color: "#555" }}
			>
				{formatTime(entry.timestamp)}
			</span>
		</div>
	);

	if (entry.type === "thinking") {
		return (
			<div>
				{header}
				<p className="text-[11px] mt-1" style={{ color: "#666" }}>
					Iteration {entry.iteration}
				</p>
			</div>
		);
	}

	if (entry.type === "tool_call") {
		return (
			<div>
				{header}
				<p
					className="text-[11px] mt-1 font-mono truncate"
					style={{ color: "#aaa" }}
				>
					{entry.tool}
				</p>
				<pre
					className="text-[10px] mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded px-2 py-1.5"
					style={{
						color: "#999",
						backgroundColor: "#161616",
						maxHeight: "120px",
						overflowY: "auto",
					}}
				>
					{JSON.stringify(entry.args, null, 2)}
				</pre>
			</div>
		);
	}

	if (entry.type === "tool_result") {
		return (
			<div>
				{header}
				<p
					className="text-[11px] mt-1 font-mono truncate"
					style={{ color: "#aaa" }}
				>
					{entry.tool}
				</p>
				<p
					className="text-[11px] mt-1 overflow-hidden"
					style={{
						color: "#999",
						maxHeight: "80px",
						display: "-webkit-box",
						WebkitLineClamp: 4,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
					}}
				>
					{entry.result}
				</p>
			</div>
		);
	}

	if (entry.type === "response") {
		return (
			<div>
				{header}
				<p
					className="text-[11px] mt-1 overflow-hidden"
					style={{
						color: "#999",
						display: "-webkit-box",
						WebkitLineClamp: 4,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
					}}
				>
					{entry.content}
				</p>
			</div>
		);
	}

	if (entry.type === "error") {
		return (
			<div>
				{header}
				<p
					className="text-[11px] mt-1 break-words"
					style={{ color: "#ef4444" }}
				>
					{entry.message}
				</p>
			</div>
		);
	}

	return null;
}

type DebugPanelProps = {
	events: DebugEntry[];
};

export function DebugPanel({ events }: DebugPanelProps) {
	const [isOpen, setIsOpen] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);

	const eventCount = events.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: eventCount is a derived primitive that triggers scroll; scrollRef.current is intentionally excluded
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [eventCount]);

	const toggleButton = (
		<button
			type="button"
			onClick={() => setIsOpen((prev) => !prev)}
			className="flex items-center justify-center w-full py-2 transition-colors hover:bg-[#2a2a2a]"
			style={{ color: "#555" }}
			aria-label={isOpen ? "Collapse debug panel" : "Expand debug panel"}
			title={isOpen ? "Collapse debug panel" : "Expand debug panel"}
		>
			{isOpen ? (
				<span className="text-xs font-mono select-none">{"\u203A"}</span>
			) : (
				<span className="text-xs font-mono select-none">{"\u2039"}</span>
			)}
		</button>
	);

	if (!isOpen) {
		return (
			<div
				className="flex flex-col items-center shrink-0"
				style={{
					width: "40px",
					borderLeft: "1px solid #2a2a2a",
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
					DEBUG
				</div>
			</div>
		);
	}

	return (
		<div
			className="flex flex-col shrink-0"
			style={{
				width: "384px",
				borderLeft: "1px solid #2a2a2a",
				backgroundColor: "#1f1f1f",
			}}
		>
			{/* Panel header */}
			<div
				className="flex items-center justify-between px-3 py-2 shrink-0"
				style={{ borderBottom: "1px solid #2a2a2a" }}
			>
				<span
					className="text-[11px] font-medium tracking-widest uppercase select-none"
					style={{ color: "#555" }}
				>
					Debug
				</span>
				{toggleButton}
			</div>

			{/* Events list */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto px-2 py-2"
				style={{ minHeight: 0 }}
			>
				{events.length === 0 ? (
					<p
						className="text-[11px] text-center mt-8 select-none"
						style={{ color: "#444" }}
					>
						Agent events will appear here...
					</p>
				) : (
					<ul className="space-y-2">
						{events.map((entry) => (
							<li
								key={`${entry.timestamp}-${entry.type}`}
								className="rounded px-2 py-1.5"
								style={{
									backgroundColor: "#191919",
									borderLeft: `2px solid ${EVENT_STYLES[entry.type].color}33`,
								}}
							>
								<EventDetail entry={entry} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
