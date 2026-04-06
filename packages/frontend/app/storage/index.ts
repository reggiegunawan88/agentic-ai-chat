export type { ChatStorage } from "./types";
export { LocalChatStorage } from "./localStorage";
import { LocalChatStorage } from "./localStorage";

export const chatStorage = new LocalChatStorage();
