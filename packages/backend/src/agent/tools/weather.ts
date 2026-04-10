import type { ChatCompletionTool } from "openai/resources/chat/completions";

const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

export const definition: ChatCompletionTool = {
	type: "function",
	function: {
		name: "weather",
		description:
			"Get the current weather for a given city. Returns temperature, humidity, wind speed, and conditions.",
		parameters: {
			type: "object",
			properties: {
				city: {
					type: "string",
					description: 'City name, e.g. "Tokyo", "New York", "London"',
				},
			},
			required: ["city"],
		},
	},
};

type GeoResult = {
	name: string;
	country: string;
	latitude: number;
	longitude: number;
};

type WeatherData = {
	current: {
		temperature_2m: number;
		relative_humidity_2m: number;
		apparent_temperature: number;
		weather_code: number;
		wind_speed_10m: number;
	};
};

const weatherCodes: Record<number, string> = {
	0: "Clear sky",
	1: "Mainly clear",
	2: "Partly cloudy",
	3: "Overcast",
	45: "Foggy",
	48: "Depositing rime fog",
	51: "Light drizzle",
	53: "Moderate drizzle",
	55: "Dense drizzle",
	61: "Slight rain",
	63: "Moderate rain",
	65: "Heavy rain",
	71: "Slight snow",
	73: "Moderate snow",
	75: "Heavy snow",
	80: "Slight rain showers",
	81: "Moderate rain showers",
	82: "Violent rain showers",
	95: "Thunderstorm",
	96: "Thunderstorm with slight hail",
	99: "Thunderstorm with heavy hail",
};

export async function handler(args: { city: string }): Promise<string> {
	try {
		// Step 1: Geocode city name to coordinates
		const geoRes = await fetch(
			`${GEOCODING_API}?name=${encodeURIComponent(args.city)}&count=1`,
		);
		if (!geoRes.ok) {
			return `Error: Geocoding API returned ${geoRes.status}`;
		}
		const geoData = (await geoRes.json()) as { results?: GeoResult[] };
		if (!geoData.results?.length) {
			return `Error: Could not find location "${args.city}"`;
		}
		const { name, country, latitude, longitude } = geoData.results[0];

		// Step 2: Fetch current weather
		const weatherRes = await fetch(
			`${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`,
		);
		if (!weatherRes.ok) {
			return `Error: Weather API returned ${weatherRes.status}`;
		}
		const weather = (await weatherRes.json()) as WeatherData;
		const c = weather.current;

		return [
			`Weather for ${name}, ${country}:`,
			`Condition: ${weatherCodes[c.weather_code] ?? `Code ${c.weather_code}`}`,
			`Temperature: ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)`,
			`Humidity: ${c.relative_humidity_2m}%`,
			`Wind: ${c.wind_speed_10m} km/h`,
		].join("\n");
	} catch (error) {
		return `Error: Weather fetch failed — ${error instanceof Error ? error.message : "unknown error"}`;
	}
}
