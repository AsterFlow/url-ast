# 📊 URL-AST Benchmark Report

> Generated: Mon, 29 Jun 2026 21:49:19 GMT

The following benchmarks compare **url-ast** against other URL / query-string parsing libraries.
Each section only includes libraries that **natively** implement the tested operation — no shims or regex fallbacks.

> Lower latency is better. Higher throughput is better.

### Parse (Simple)

Full URL parsing / constructor cost on a simple URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, qs, fast-querystring, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **fast-querystring** | **303.86** | **3,677,920** |
| native-url | 381.74 | 3,203,313 |
| url-ast (wasm) | 822.29 | 1,266,750 |
| query-string | 1431.70 | 786,584 |
| qs | 1672.56 | 694,430 |
| url-parse | 2761.67 | 426,285 |
| url-ast@3.0.1 (ts) | 2684.05 | 398,327 |


### Parse (Complex)

Full URL parsing / constructor cost on a complex URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, qs, fast-querystring, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **fast-querystring** | **324.15** | **3,327,271** |
| native-url | 457.95 | 2,498,715 |
| url-ast (wasm) | 1145.71 | 905,484 |
| qs | 1712.21 | 653,058 |
| query-string | 1740.21 | 624,620 |
| url-parse | 2855.04 | 400,585 |
| url-ast@3.0.1 (ts) | 4083.59 | 257,623 |


### Params (Template)

Route parameter extraction from a template URL (e.g. /users/:id.number). Participants: url-ast (wasm), url-ast@3.0.1 (ts).

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **1017.56** | **999,025** |
| url-ast@3.0.1 (ts) | 2672.03 | 387,843 |


### Query (Simple)

Query-string extraction on a simple URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, qs, fast-querystring, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **fast-querystring** | **287.65** | **3,728,420** |
| url-ast (wasm) | 343.85 | 2,952,979 |
| native-url | 915.00 | 1,335,004 |
| query-string | 1406.82 | 764,799 |
| qs | 1554.94 | 714,018 |
| url-parse | 2629.23 | 428,282 |
| url-ast@3.0.1 (ts) | 2783.34 | 371,763 |


### Query (Complex)

Query-string extraction on a complex URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, qs, fast-querystring, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **fast-querystring** | **318.85** | **3,379,535** |
| url-ast (wasm) | 391.06 | 2,616,509 |
| native-url | 1038.88 | 1,154,457 |
| qs | 1694.34 | 656,222 |
| query-string | 1716.44 | 631,117 |
| url-parse | 2833.73 | 401,719 |
| url-ast@3.0.1 (ts) | 4149.86 | 248,368 |


### Query (Bare)

Query-string extraction on a bare query string. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, qs, fast-querystring, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **fast-querystring** | **452.49** | **2,455,152** |
| url-ast (wasm) | 503.25 | 2,007,809 |
| native-url | 1495.38 | 800,574 |
| qs | 2918.57 | 390,813 |
| url-parse | 3673.78 | 317,000 |
| query-string | 3590.33 | 306,217 |
| url-ast@3.0.1 (ts) | 4033.49 | 259,983 |


### Fragment (Simple)

Fragment / hash extraction on a simple URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **268.14** | **4,104,937** |
| native-url | 393.42 | 3,221,000 |
| query-string | 406.16 | 2,703,881 |
| url-parse | 1108.46 | 994,357 |
| url-ast@3.0.1 (ts) | 1801.28 | 593,243 |


### Fragment (Complex)

Fragment / hash extraction on a complex URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse, query-string.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **319.97** | **3,335,984** |
| native-url | 487.00 | 2,410,544 |
| url-parse | 1212.40 | 938,898 |
| query-string | 1940.01 | 563,857 |
| url-ast@3.0.1 (ts) | 3890.17 | 264,522 |


### Hostname (Simple)

Hostname extraction on a simple URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **268.21** | **3,944,246** |
| native-url | 395.61 | 3,013,755 |
| url-parse | 1124.10 | 995,425 |
| url-ast@3.0.1 (ts) | 2476.61 | 418,460 |


### Hostname (Complex)

Hostname extraction on a complex URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **292.92** | **3,665,982** |
| native-url | 496.85 | 2,327,271 |
| url-parse | 1187.30 | 951,256 |
| url-ast@3.0.1 (ts) | 4015.39 | 258,985 |


### Port

Port extraction from a URL with an explicit port. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **282.19** | **3,712,849** |
| native-url | 499.18 | 2,319,246 |
| url-parse | 1169.26 | 960,497 |
| url-ast@3.0.1 (ts) | 3930.93 | 262,744 |


### Protocol (HTTP)

Protocol extraction from an HTTP URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **258.86** | **4,083,019** |
| native-url | 396.94 | 2,995,995 |
| url-parse | 1113.11 | 1,002,744 |
| url-ast@3.0.1 (ts) | 2475.58 | 418,152 |


### Protocol (HTTPS)

Protocol extraction from an HTTPS URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **285.20** | **3,705,140** |
| native-url | 486.24 | 2,378,305 |
| url-parse | 1195.79 | 941,048 |
| url-ast@3.0.1 (ts) | 3860.99 | 266,714 |


### Pathname (Simple)

Pathname extraction on a simple URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **288.69** | **3,702,061** |
| native-url | 399.62 | 2,989,973 |
| url-parse | 1169.99 | 975,248 |
| url-ast@3.0.1 (ts) | 2628.78 | 398,511 |


### Pathname (Complex)

Pathname extraction on a complex URL. Participants: url-ast (wasm), url-ast@3.0.1 (ts), native-url, url-parse.

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
| **url-ast (wasm)** | **355.39** | **2,945,850** |
| native-url | 480.81 | 2,409,898 |
| url-parse | 1184.45 | 943,791 |
| url-ast@3.0.1 (ts) | 4274.14 | 241,511 |

