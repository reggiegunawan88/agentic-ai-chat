import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		port: 3000,
		proxy: {
			"/ws": {
				target: "ws://localhost:5000",
				ws: true,
				changeOrigin: true,
			},
		},
	},
	plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
