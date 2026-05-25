import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#e8f1ff",
        muted: "#8fa4c4",
        panel: "#06111f",
        line: "rgba(89, 134, 190, 0.24)",
        telecom: "#0f7cff",
        huawei: "#e22b45",
        surface: "#0b1b2d",
        "surface-2": "#10243a",
        cyan: "#23d9ff"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};

export default config;
