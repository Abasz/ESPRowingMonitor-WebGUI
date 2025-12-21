// @ts-check
import globals from "globals";
import js from "@eslint/js";
import angular from "@angular-eslint/eslint-plugin";
import angularTemplate from "@angular-eslint/eslint-plugin-template";
import angularParser from "@angular-eslint/template-parser";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import unicorn from "eslint-plugin-unicorn";
import rxjs from "@smarttools/eslint-plugin-rxjs";
import rxjsAngular from "eslint-plugin-rxjs-angular-updated";
import unusedImports from "eslint-plugin-unused-imports";
import preferArrow from "eslint-plugin-prefer-arrow";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";

export default [
    // Global ignores
    {
        ignores: [
            "projects/**/*",
            "dist/**/*",
            "out-tsc/**/*",
            "node_modules/**/*",
            "*.js", // Ignore compiled JS files
        ],
    },

    // Base JavaScript config
    js.configs.recommended,

    // TypeScript files configuration
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jasmine,
                BluetoothAdvertisingEvent: true,
                BluetoothServiceUUID: true,
                BluetoothCharacteristicUUID: true,
                BluetoothDeviceEventMap: true,
            },
            parser: typescriptParser,
            parserOptions: {
                project: ["./tsconfig.json", "./tsconfig.app.json", "./tsconfig.spec.json"],
                ecmaVersion: 2022,
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": typescript,
            "@angular-eslint": angular,
            prettier: prettier,
            unicorn: unicorn,
            rxjs: rxjs,
            "rxjs-angular": rxjsAngular,
            "unused-imports": unusedImports,
            "prefer-arrow": preferArrow,
            import: importPlugin,
            jsdoc: jsdoc,
        },
        rules: {
            // Extend recommended configs
            ...typescript.configs.recommended.rules,
            ...angular.configs.recommended.rules,

            "@angular-eslint/prefer-inject": "off",

            // Angular-specific rules
            "@angular-eslint/component-class-suffix": [
                "error",
                {
                    suffixes: ["Component"],
                },
            ],
            "@angular-eslint/component-selector": [
                "error",
                {
                    type: "element",
                    prefix: ["ngx", "test", "app"],
                    style: "kebab-case",
                },
            ],
            "@angular-eslint/directive-class-suffix": [
                "error",
                {
                    suffixes: ["Directive"],
                },
            ],
            "@angular-eslint/directive-selector": [
                "error",
                {
                    type: "attribute",
                    prefix: ["ngx", "test"],
                    style: "camelCase",
                },
            ],
            "@angular-eslint/no-forward-ref": "error",
            "@angular-eslint/no-queries-metadata-property": "error",
            "@angular-eslint/prefer-output-readonly": "error",
            "@angular-eslint/use-component-view-encapsulation": "error",
            "@angular-eslint/no-pipe-impure": "error",

            // TypeScript rules
            "@typescript-eslint/no-unused-expressions": [
                "error",
                {
                    allowShortCircuit: true,
                    allowTernary: true,
                },
            ],
            "@typescript-eslint/member-ordering": [
                "error",
                {
                    default: {
                        memberTypes: [
                            "signature",
                            "public-static-field",
                            "protected-static-field",
                            "private-static-field",
                            "public-instance-field",
                            "protected-instance-field",
                            "private-instance-field",
                            "public-constructor",
                            "protected-constructor",
                            "private-constructor",
                            "public-instance-method",
                            "protected-instance-method",
                            "private-instance-method",
                        ],
                        order: "as-written",
                    },
                },
            ],
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "enumMember",
                    format: ["PascalCase"],
                    filter: {
                        regex: "_",
                        match: false,
                    },
                },
                {
                    selector: "variable",
                    types: ["boolean"],
                    format: ["PascalCase"],
                    prefix: ["is", "should", "has", "can", "did", "will"],
                },
            ],
            "@typescript-eslint/no-inferrable-types": [
                "error",
                {
                    ignoreParameters: true,
                    ignoreProperties: true,
                },
            ],
            "@typescript-eslint/array-type": [
                "error",
                {
                    default: "generic",
                },
            ],
            "@typescript-eslint/consistent-type-definitions": "error",
            "@typescript-eslint/explicit-member-accessibility": [
                "error",
                {
                    accessibility: "no-public",
                },
            ],
            "@typescript-eslint/explicit-function-return-type": [
                "error",
                {
                    allowExpressions: false,
                    allowTypedFunctionExpressions: false,
                    allowHigherOrderFunctions: false,
                    allowDirectConstAssertionInArrowFunctions: false,
                    allowConciseArrowFunctionExpressionsStartingWithVoid: true,
                },
            ],
            "@typescript-eslint/no-empty-function": "error",
            "@typescript-eslint/dot-notation": "off",
            "@typescript-eslint/no-unused-vars": "off",

            // Deprecation rules (now built into @typescript-eslint)
            "@typescript-eslint/no-deprecated": "warn",

            // No-null equivalent (using TypeScript ESLint)
            "@typescript-eslint/restrict-plus-operands": "error",
            "@typescript-eslint/no-base-to-string": "error",

            // Unused imports
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],

            // TypeScript typedef rules
            "@typescript-eslint/typedef": [
                "error",
                {
                    arrayDestructuring: true,
                    arrowParameter: true,
                    memberVariableDeclaration: true,
                    objectDestructuring: true,
                    parameter: true,
                    propertyDeclaration: true,
                    variableDeclarationIgnoreFunction: true,
                },
            ],

            // Unicorn rules
            "unicorn/filename-case": "error",
            "unicorn/no-unused-properties": "error",

            // Prefer arrow functions
            "prefer-arrow/prefer-arrow-functions": [
                "error",
                {
                    disallowPrototype: false,
                    singleReturnOnly: false,
                    classPropertiesAllowed: false,
                    allowStandaloneDeclarations: true,
                },
            ],

            // Import rules
            "import/no-unresolved": "off",
            "import/first": ["error"],
            "import/order": [
                "error",
                {
                    "newlines-between": "always",
                    alphabetize: {
                        order: "asc",
                    },
                },
            ],
            "import/no-duplicates": "error",
            "import/newline-after-import": "error",
            "import/no-unassigned-import": "error",

            // RxJS rules
            "rxjs/ban-observables": "error",
            "rxjs/ban-operators": "error",
            "rxjs/no-create": "error",
            "rxjs/no-internal": "error",
            "rxjs/no-exposed-subjects": [
                "error",
                {
                    allowProtected: true,
                },
            ],
            "rxjs/no-nested-subscribe": "error",
            "rxjs/no-subject-unsubscribe": "error",
            "rxjs/no-unsafe-takeuntil": [
                "error",
                {
                    allow: [
                        "defaultIfEmpty",
                        "endWith",
                        "every",
                        "finalize",
                        "finally",
                        "isEmpty",
                        "last",
                        "max",
                        "min",
                        "publish",
                        "publishBehavior",
                        "publishLast",
                        "publishReplay",
                        "reduce",
                        "share",
                        "shareReplay",
                        "skipLast",
                        "takeLast",
                        "throwIfEmpty",
                        "toArray",
                    ],
                },
            ],

            // RxJS Angular rules
            "rxjs-angular/prefer-takeuntil": [
                "warn",
                {
                    alias: ["takeUntilDestroyed"],
                    checkComplete: true,
                },
            ],

            // Core JavaScript/TypeScript rules
            "arrow-parens": ["error", "always"],
            "brace-style": ["error", "1tbs"],
            "capitalized-comments": [
                "error",
                "never",
                {
                    line: {
                        ignoreConsecutiveComments: true,
                        ignorePattern: "TODO",
                    },
                    block: {
                        ignorePattern: ".*",
                    },
                },
            ],
            eqeqeq: ["error", "always"],
            "comma-dangle": [
                "error",
                {
                    arrays: "only-multiline",
                    objects: "only-multiline",
                    imports: "only-multiline",
                    exports: "only-multiline",
                    functions: "only-multiline",
                },
            ],
            complexity: [
                "error",
                {
                    max: 20,
                },
            ],
            "default-case": "error",
            "prefer-arrow-callback": [
                "error",
                {
                    allowNamedFunctions: true,
                },
            ],
            "max-classes-per-file": ["error", 1],
            "max-lines": ["error", 1500],
            "no-underscore-dangle": [
                "error",
                {
                    allow: ["_getHostElement"],
                    allowAfterThis: true,
                },
            ],
            "no-duplicate-imports": "error",
            "no-empty": "error",
            "no-multiple-empty-lines": [
                "error",
                {
                    max: 1,
                },
            ],
            "no-unused-vars": "off",
            "no-template-curly-in-string": "error",
            "padding-line-between-statements": [
                "error",
                {
                    blankLine: "always",
                    prev: "*",
                    next: "return",
                },
            ],
            "sort-imports": [
                "error",
                {
                    ignoreDeclarationSort: true,
                    allowSeparatedGroups: true,
                    ignoreCase: true,
                },
            ],
            "sort-vars": "error",
            "space-in-parens": ["off", "never"],
            "spaced-comment": "error",
            yoda: "error",

            // Prettier rules (must be last)
            "prettier/prettier": [
                "error",
                {
                    endOfLine: "auto",
                },
            ],
        },
    },

    // Angular template files configuration
    {
        files: ["**/*.html"],
        languageOptions: {
            parser: angularParser,
        },
        plugins: {
            "@angular-eslint/template": angularTemplate,
        },
        rules: {
            ...angularTemplate.configs.recommended.rules,
            "@angular-eslint/template/no-autofocus": "error",
            "@angular-eslint/template/banana-in-box": "error",
        },
    },

    // Prettier config (must be last to override conflicting rules)
    prettierConfig,
];
