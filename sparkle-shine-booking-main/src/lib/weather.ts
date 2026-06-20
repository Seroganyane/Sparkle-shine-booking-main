export type WeatherPrediction = {
  date: string;
  condition: string;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  isGoodForWash: boolean;
  headline: string;
  details: string;
};

const weatherCodeLabels: Record<number, string> = {
  0: "Clear skies",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

const isRainyOrSnowy = (code: number) => {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code);
};

const getHeadline = (good: boolean) =>
  good ? "Perfect day for a car wash" : "Today might not be the best wash day";

const getDetails = (condition: string, temp: number, precip: number, windSpeed: number, weatherCode: number, good: boolean) => {
  if (good) {
    return `It's ${condition.toLowerCase()} with a high of ${temp.toFixed(0)}°C and no rain expected. Great time to bring your car in.`;
  }

  if (precip >= 1 || isRainyOrSnowy(weatherCode)) {
    return `The forecast shows ${condition.toLowerCase()} and ${precip.toFixed(1)} mm of rain. We recommend waiting for clearer weather.`;
  }

  return `Today is ${condition.toLowerCase()} with ${windSpeed.toFixed(0)} km/h winds. If you'd like a fresh wash, consider booking later this afternoon.`;
};

export const fetchWeatherPrediction = async (
  latitude = -26.2041,
  longitude = 28.0473,
): Promise<WeatherPrediction> => {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,precipitation_sum,windspeed_10m_max&timezone=auto`,
  );

  if (!response.ok) {
    throw new Error("Unable to load weather data.");
  }

  const data = await response.json();
  const todayIndex = 0;

  const weatherCode = data.daily.weathercode?.[todayIndex] ?? 0;
  const temperature = data.daily.temperature_2m_max?.[todayIndex] ?? 0;
  const precipitation = data.daily.precipitation_sum?.[todayIndex] ?? 0;
  const windSpeed = data.daily.windspeed_10m_max?.[todayIndex] ?? 0;
  const condition = weatherCodeLabels[weatherCode] ?? "Mixed weather";
  const goodForWash = !isRainyOrSnowy(weatherCode) && precipitation < 1 && windSpeed < 25 && temperature <= 35;

  return {
    date: data.daily.time?.[todayIndex] ?? new Date().toISOString().split("T")[0],
    condition,
    temperature,
    precipitation,
    windSpeed,
    isGoodForWash: goodForWash,
    headline: getHeadline(goodForWash),
    details: getDetails(condition, temperature, precipitation, windSpeed, weatherCode, goodForWash),
  };
};
