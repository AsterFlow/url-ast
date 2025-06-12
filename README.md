<div align="center">

# url-ast

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

```bash
# Using npm
npm install url-ast

# Using bun
bun add url-ast

# Using yarn
yarn add url-ast

# Using pnpm
pnpm add url-ast
```

-----

## 🏁 Getting Started

Here's a quick example to get you up and running:

```typescript
import { Analyze } from 'url-ast'

// URL template with typed parameters
const template = new Analyze('/api/users/:id=number/posts/:postId=string?sort=boolean&tags=array')

// Parse a real URL using the template
const url = new Analyze('/api/users/123/posts/hello-world?sort=true&tags=tech,typescript', template)

// Get typed path parameters
console.log(url.getParams())
// { id: 123, postId: 'hello-world' }

// Get typed search parameters  
console.log(url.getSearchParams())
// { sort: true, tags: ['tech', 'typescript'] }

// Display visual analysis
console.log(url.display())
// Shows detailed AST structure with colored output
```

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

### Type Casting Examples

**Number Casting:**
```typescript
const template = new Analyze('/users/:id=number/price/:amount=number')
const instance = new Analyze('/users/100/price/99.99', template)

console.log(instance.getParams()) 
// { id: 100, amount: 99.99 }
console.log(typeof instance.getParams().id) // "number"
```

**Boolean Casting:**
```typescript
const template = new Analyze('/status/:active=boolean')
const instance = new Analyze('/status/true', template)

console.log(instance.getParams()) // { active: true }
// Accepts: "true", "false", "1", "0" (case insensitive)
```

**Array Casting:**
```typescript
const template = new Analyze('/tags/:items=array')
const instance = new Analyze('/tags/red,green,blue', template)

console.log(instance.getParams()) // { items: ["red", "green", "blue"] }
```

**Error Handling:**
```typescript
try {
  const template = new Analyze('/users/:id=number')
  const instance = new Analyze('/users/abc', template)
  instance.getParams() // Throws exception
} catch (error) {
  console.log('Casting error:', error.message)
  // Error [E_CAST_NUMBER] at col 7: Invalid numeric value: "abc".
}
```

-----

## 📖 API Reference

### `new Analyze<Path, TypedPath, Parser>(input, base?)`

Creates a new URL analyzer instance.

* **`input`**: `string`. The URL or template to analyze.
* **`base`**: `Analyze` (optional). Base template for typed parameter extraction.

### `.getParams()`

Extracts path parameters with automatic type casting.

* **Returns**: Object with typed parameters based on template definition.

### `.getSearchParams()`

Extracts search/query parameters with automatic type casting.

* **Returns**: `Map<string, string | number | boolean | string[]>` or typed object.

### `.getFragment()`

Retrieves the fragment identifier from the URL.

* **Returns**: `string | undefined` or typed fragment object.

### `.getPathname()`

Gets the pathname portion of the URL.

* **Returns**: `string`. The pathname (e.g., '/users/:id').

### `.getProtocol()`, `.getHostname()`, `.getPort()`

Extract origin components from the URL.

* **Returns**: `string | undefined`. The respective component.

### `.display()`

Returns a formatted table showing the AST structure with colored output.

* **Returns**: `string`. Formatted analysis table.

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

## 🔧 Advanced Usage

### Router Integration

```typescript
import { Router } from '@asterflow/router'
import { Analyze } from 'url-ast'

const router = new Router({
  path: '/users/:id=number/posts/:postId=string',
  methods: {
    get({ url }) {
      // url is an instance of Analyze
      const params = url.getParams()
      // params is typed as { id: number, postId: string }
      return response.success({ params })
    }
  }
})
```

### Static Props Extraction

```typescript
// Next.js-style dynamic routes
const template = new Analyze('/posts/[...slug]')
const instance = new Analyze('/posts/2024/01/hello-world', template)

console.log(instance.getStaticProps())
// { slug: ['2024', '01', 'hello-world'] }
```

### Structure Visualization

```typescript
const analyzer = new Analyze('/users/:id=number?active=boolean#section')

console.log(analyzer.display())
/*
Id  Symbol  Expression  Type    Start  End
1   /       Slash      -       0      1
2   users   Path       -       1      6
3   /       Slash      -       6      7
4   :       Colon      -       7      8
5   id      Variable   -       8      10
6   =       Equal      -       10     11
7   number  Value      Number  11     17
8   ?       Query      -       17     18
9   active  Parameter  -       18     24
10  =       Equal      -       24     25
11  boolean Value      Boolean 25     32
12  #       Hash       -       32     33
13  section Fragment   -       33     40
*/
```

-----

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code, please open a pull request.

-----

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](https://github.com/AsterFlow/url-ast/blob/main/LICENSE) file for details.