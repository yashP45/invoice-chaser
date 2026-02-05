import next from "@next/eslint-plugin-next";

export default [
  {
    ignores: [".next/**", "node_modules/**"]
  },
  {
    plugins: {
      "@next/next": next
    },
    rules: {
      ...next.configs["core-web-vitals"].rules
    }
  }
];
