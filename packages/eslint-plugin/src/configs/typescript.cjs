module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "deprecation",
    "import",
    "@simplysm"
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"]
    }
  },
  rules: {
    // 기본
    "no-console": ["warn"],
    "no-warning-comments": ["warn"],
    "linebreak-style": ["error", "unix"],

    // Deprecation
    // "deprecation/deprecation": ["warn"], // 느림

    // import
    // "import/no-extraneous-dependencies": ["error"], // 느림

    // 심플리즘
    "@simplysm/ts-no-throw-not-implement-error": ["warn"],
    "@simplysm/ts-no-self-entry-import": ["error"],

    // 타입스크립트
    "@typescript-eslint/explicit-member-accessibility": ["error"],
    "@typescript-eslint/require-await": ["error"],
    "@typescript-eslint/await-thenable": ["error"],
    "@typescript-eslint/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
    "@typescript-eslint/semi": ["error"],
    "@typescript-eslint/no-shadow": ["error"],
    "@typescript-eslint/member-delimiter-style": ["error"],
    // "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: true }],
    "@typescript-eslint/no-unnecessary-type-assertion": ["error"],
    "@typescript-eslint/non-nullable-type-assertion-style": ["error"],
    "@typescript-eslint/prefer-reduce-type-parameter": ["error"],
    "@typescript-eslint/prefer-return-this-type": ["error"],
    "@typescript-eslint/no-duplicate-imports": ["error"],
    "@typescript-eslint/prefer-readonly": ["error"],
    "@typescript-eslint/typedef": ["error"],
    "@typescript-eslint/explicit-function-return-type": ["error", {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
      allowDirectConstAssertionInArrowFunctions: true,
      allowConciseArrowFunctionExpressionsStartingWithVoid: true
    }],
    "@typescript-eslint/no-unused-expressions": ["error"],
    "@typescript-eslint/no-unused-vars": ["warn", { args: "none" }],
    "@typescript-eslint/strict-boolean-expressions": ["error", {
      allowNullableBoolean: true,
      allowNullableObject: true
    }],
    "@typescript-eslint/explicit-module-boundary-types": ["error", { allowArgumentsExplicitlyTypedAsAny: true }],
    "@typescript-eslint/return-await": ["error", "always"],
    "@typescript-eslint/no-floating-promises": ["error"],
    // "@typescript-eslint/comma-dangle": ["error"]
    "@typescript-eslint/prefer-ts-expect-error": ["error"]
  }
};
