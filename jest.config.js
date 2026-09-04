/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^qrcode$": "<rootDir>/src/__tests__/__mocks__/qrcode.ts",
    "^whatsapp-web.js$": "<rootDir>/src/__tests__/__mocks__/whatsapp-web.js.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],
  testMatch: [
    "<rootDir>/src/__tests__/unit/**/*.test.ts",
    "<rootDir>/src/__tests__/unit/**/*.test.tsx",
    "<rootDir>/src/__tests__/integration/**/*.test.ts",
    "<rootDir>/src/__tests__/integration/**/*.test.tsx",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          esModuleInterop: true,
          moduleResolution: "node",
          target: "es2022",
          lib: ["esnext"],
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  testTimeout: 15000,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
    "!src/pages/**",
    "!src/app/**/page.tsx",
    "!src/app/**/layout.tsx",
    "!src/app/providers.tsx",
  ],
};
