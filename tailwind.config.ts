import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    // lg(1024px)는 아래 plugins의 커스텀 variant로 정의 — html.force-mobile 클래스로 PC↔모바일 화면 전환을 지원하기 위함
    screens: {
      sm: "640px",
      md: "768px",
      xl: "1280px",
      "2xl": "1536px",
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontFamily: {
      sans: ['Pretendard', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        // 포스트 최초 진입 시 하트 버튼 존재감 모션 (1회만): 1.5배 확대 + 좌우 3회 흔들림
        "heart-in": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "22%": { transform: "scale(1.5)", opacity: "1" },
          "36%": { transform: "scale(1.45) rotate(-10deg)" },
          "50%": { transform: "scale(1.45) rotate(10deg)" },
          "64%": { transform: "scale(1.4) rotate(-10deg)" },
          "78%": { transform: "scale(1.3) rotate(10deg)" },
          "90%": { transform: "scale(1.1) rotate(-4deg)" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        // 좋아요 시 중앙 빨간 하트 팝 → 우측 하단 하트 버튼으로 날아가 흡수 (인스타그램 스타일).
        // --fly-x/--fly-y는 트리거 시점에 JS가 하트 버튼 위치를 재서 넣어줌
        "heart-pop": {
          "0%": { transform: "translate(0, 0) scale(0)", opacity: "0" },
          "14%": { transform: "translate(0, 0) scale(1.15)", opacity: "1" },
          "24%": { transform: "translate(0, 0) scale(0.95)", opacity: "1" },
          "34%, 55%": { transform: "translate(0, 0) scale(1)", opacity: "1" },
          "90%": { transform: "translate(var(--fly-x, 0px), var(--fly-y, 0px)) scale(0.25)", opacity: "1" },
          "100%": { transform: "translate(var(--fly-x, 0px), var(--fly-y, 0px)) scale(0.2)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "heart-in": "heart-in 0.8s ease-out",
        "heart-pop": "heart-pop 1s cubic-bezier(0.5, 0, 0.4, 1) forwards",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // PC↔모바일 화면 전환 기능: html에 force-mobile 클래스가 있으면 모든 lg: 스타일을 비활성화하여
    // 넓은 화면에서도 모바일 레이아웃으로 표시한다 (기본 동작은 기존과 동일: 1024px 이상 = PC 레이아웃)
    plugin(({ addVariant }) => {
      addVariant("lg", "@media (min-width: 1024px) { html:not(.force-mobile) & }");
    }),
  ],
} satisfies Config;
