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

url-ast is a specialized module for analyzing and manipulating URLs using an Abstract Syntax Tree (AST) approach. It provides deep and structured URL analysis, transforming URLs into interconnected nodes that represent each component (protocol, hostname, parameters, etc.), facilitating manipulation and validation with full TypeScript support and automatic type casting.

-----

## 🚀 Key Features

* **AST-Based Analysis**: Deep URL structure analysis through interconnected nodes for precise parsing
* **Automatic Type Casting**: Built-in support for number, boolean, string, and array type conversion
* **Full TypeScript Support**: Complete type inference for parameters and values with compile-time safety
* **Pattern Matching**: Advanced support for route patterns with dynamic parameters and catch-all routes
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

## 📚 Examples

For more detailed examples on how to use all the features of **url-ast**, check out our [examples directory](https://github.com/AsterFlow/url-ast/tree/main/examples).

-----

## 🏁 Getting Started

Here's a quick example to get you up and running:

```typescript
import { Analyze } from 'url-ast'

// URL template with typed parameters
const template = new Analyze('/api/users/:id=number/posts/:postId=string?sort=boolean&tags=array')

// Parse a real URL using the template
const analyzer = new Analyze('/api/users/123/posts/hello-world?sort=true&tags=tech,typescript', template)

// Get typed path parameters
console.log(analyzer.getParams())
// { id: 123, postId: 'hello-world' }

// Get typed search parameters  
console.log(analyzer.getSearchParams())
// { sort: true, tags: ['tech', 'typescript'] }

// Display visual analysis
console.log(analyzer.ast.display())
```

-----

## 🛣️ Route Patterns

url-ast supports various routing patterns for flexible URL matching:

| Type | Syntax | Example | Description |
| :--- | :--- | :--- | :--- |
| **Static** | `/path/to/page` | `/about/contact` | Matches the exact path |
| **Dynamic** | `/:param` | `/users/:id` | Matches any segment and captures value |
| **Typed Dynamic** | `/:param=type` | `/users/:id=number` | Dynamic with automatic type casting |
| **Query Parameters** | `?param=value` | `?sort=true&limit=10` | URL search parameters |
| **Typed Query** | `?param=type` | `?active=boolean&limit=number` | Query params with type casting |
| **Fragment** | `#section` | `#introduction` | Hash fragment identifier |

-----

## 🎯 Type Casting System

The parser supports automatic type casting for path and query parameters, providing type-safe parameter extraction.

### Supported Types

| Type | Syntax | Description | Example |
| :--- | :--- | :--- | :--- |
| **Number** | `:param=number` | Converts to numeric values (integers, decimals, negatives) | `123`, `-42`, `99.99` |
| **Boolean** | `:param=boolean` | Converts to boolean (`true`/`false`, `1`/`0`, case-insensitive) | `true`, `false`, `1`, `0` |
| **String** | `:param=string` or `:param` | Default type, keeps as string | `hello-world`, `user_123` |
| **Array** | `:param=array` | Converts comma-separated values to array | `red,green,blue` → `['red', 'green', 'blue']` |

-----

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code, please open a pull request.

-----

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](https://github.com/AsterFlow/url-ast/blob/main/LICENSE) file for details.
