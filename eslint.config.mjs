import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // next already registers the jsx-a11y plugin; turn on its full recommended rule set.
  { rules: jsxA11y.flatConfigs.recommended.rules },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@radix-ui/*", "radix-ui"], message: "Base UI only: never mix Radix primitives in." },
            {
              group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"],
              message: "Free Build: no AI calls. Use an AI-HOOK provider.",
            },
          ],
          paths: [
            {
              name: "lucide-react",
              message: "Import icons from @/components/icons so strokes and data-icon stay consistent.",
            },
          ],
        },
      ],
    },
  },
  { files: ["components/icons.ts", "components/ui/**"], rules: { "no-restricted-imports": "off" } },
  // Scrollable regions must be focusable so keyboard users can scroll them (axe scrollable-region-focusable).
  { rules: { "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region"] }] } },
  // InputGroupAddon: clicking the decorative addon focuses its input (a mouse convenience);
  // keyboard users Tab straight to the input, so no key handler is needed.
  {
    files: ["components/ui/input-group.tsx"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
  // The generic Label receives htmlFor through props, which the rule can't see.
  { files: ["components/ui/label.tsx"], rules: { "jsx-a11y/label-has-associated-control": "off" } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
