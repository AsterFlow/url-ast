<div align="center">

# url-ast

[![npm version](https://img.shields.io/npm/v/url-ast?style=for-the-badge&colorA=302D41&colorB=f9e2af&logo=npm)](https://www.npmjs.com/package/url-ast)
![license-info](https://img.shields.io/github/license/AsterFlow/url-ast?style=for-the-badge&colorA=302D41&colorB=f9e2af&logoColor=f9e2af)
![stars-info](https://img.shields.io/github/stars/AsterFlow/url-ast?colorA=302D41&colorB=f9e2af&style=for-the-badge)

![last-commit](https://img.shields.io/github/last-commit/AsterFlow/url-ast?style=for-the-badge&colorA=302D41&colorB=b4befe)
![commit-activity](https://img.shields.io/github/commit-activity/y/AsterFlow/url-ast?style=for-the-badge&colorA=302D41&colorB=f9e2af)
![code-size](https://img.shields.io/github/languages/code-size/AsterFlow/url-ast?style=for-the-badge&colorA=302D41&colorB=90dceb)

![top-language](https://img.shields.io/github/languages/top/AsterFlow/url-ast?style=for-the-badge&colorA=302D41&colorB=90dceb)
![bundle-size](https://img.shields.io/bundlejs/size/url-ast?style=for-the-badge&colorA=302D41&colorB=3ac97b)

</div>

## 💡 About

> High-performance typed URL parser with automatic type casting and AST-based analysis.

url-ast is a specialized module for analyzing and manipulating URLs using an Abstract Syntax Tree (AST) approach. It provides deep and structured URL analysis, transforming URLs into interconnected nodes that represent each component (protocol, hostname, parameters, etc.), facilitating manipulation and validation with full TypeScript support and automatic type casting, with a footprint of <!-- BUNDLE_SIZE_START -->`23.78 KB` (Minified) / `8.39 KB` (Gzipped)<!-- BUNDLE_SIZE_END -->.

📖 **[Full Documentation](https://asterflow.github.io/url-ast)**

-----

## 🚀 Key Features

* **AST-Based Analysis**: Deep URL structure analysis through interconnected nodes for precise parsing
* **Automatic Type Casting**: Built-in support for number, boolean, string, array, and enum type conversion
* **Full TypeScript Support**: Complete type inference for parameters and values with compile-time safety
* **Pattern Matching**: Advanced support for route patterns with dynamic, optional, and catch-all parameters
* **High Performance**: Optimized parser with efficient buffer handling and minimal overhead
* **UTF-8 Decoding**: Robust support for special characters and encoded URLs
* **Visual Debugging**: Colored visualization of URL structure for easy debugging and analysis
* **Zero Dependencies**: Lightweight implementation with no external dependencies

-----

## 📦 Installation

You can install **url-ast** using your preferred package manager:

```bash
bun add url-ast
```

*(Works with `npm`, `yarn`, or `pnpm` as well)*

-----

## 🛣️ Supported Routing Patterns

| Pattern | Syntax | URL Example | Description |
| :--- | :--- | :--- | :--- |
| **Static** | `/exact/path` | `/about/contact` | Requires exact match. No variables captured. |
| **Dynamic (colon)** | `/:param` | `/users/:id` | Captures a single URL segment. |
| **Dynamic (bracket)** | `/[param]` | `/posts/[slug]` | Bracket syntax, Next.js/SvelteKit style. |
| **Dynamic with type** | `/:param.type` or `/[param.type]` | `/users/:id.number` | Captures and converts the type automatically. |
| **Optional** | `/:~param` or `/[~param]` | `/posts/:id/comments/:~commentId` | Parameter can be `undefined`. |
| **Catch-all** | `/[...slug]` | `/docs/[...path]` | Captures multiple segments as `string[]`. |
| **Optional catch-all** | `/[[...slug]]` | `/blog/[[...slug]]` | Base route remains valid without parameters. |
| **Query params** | `?param` | `?sort=desc&limit=10` | Captures query string arguments. |
| **Query with type** | `?param.type` | `?page.number&active.boolean` | Query params with type casting. |
| **Query with default** | `?param.type=value` | `?page.number=1` | Query with type and default value. |
| **Fragment (hash)** | `#section` | `#introduction` | Captures the anchor at the end of the URL. |

-----

## 🎯 Type Casting

| Type | Syntax | Description | Input → Output |
| :--- | :--- | :--- | :--- |
| **String** | `.string` (or omitted) | Default behavior. Preserves the text. | `user_123` → `'user_123'` |
| **Number** | `.number` | Converts to a numeric value. | `-42` → `-42` |
| **Boolean** | `.boolean` | Analyzes intent and converts to boolean. | `true` or `1` → `true` |
| **Array** | `.array` | Splits values by comma into a list. | `a,b,c` → `['a', 'b', 'c']` |
| **Enum** | `.enum[op1,op2]` | Restricts values to an allowed list. | `admin` → `'admin'` |
| **Generic enum** | `.enum` | Enum without variant restriction. | `anything` → `'anything'` |

-----

## 🏁 Quick Start

```typescript
import { Analyze } from 'url-ast'

const template = new Analyze('/users/:id.number')
const parsed = new Analyze('/users/42', template)

parsed.getParams()        // { id: 42 }
```

For more examples, check the [examples directory](https://github.com/AsterFlow/url-ast/tree/main/examples) or the [full documentation](https://asterflow.github.io/url-ast).

-----

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code, please open a pull request.

-----

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](https://github.com/AsterFlow/url-ast/blob/main/LICENSE) file for details.
