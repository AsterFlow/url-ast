//! MemoryShare bridge: serialization of the parsed AST into the binary node
//! layout that the TypeScript `Node.fromBuffer` reader already understands, plus
//! the parse-time error list.
//!
//! Node record layout (10 bytes, matches `src/controllers/Node.ts` `Node.SIZE`):
//!   u8  id
//!   u8  expression
//!   u16 start      (LE)
//!   u16 end        (LE)
//!   u8  type
//!   u8  optional   (0/1)
//!   u16 childCount (LE)   followed by `childCount` child records, recursively.
//!
//! Bridge buffer layout (`parsePath`):
//!   u16 rootCount
//!   <root nodes...>
//!   u16 errorCount
//!   <errors...>   each: u16 codeLen, code utf8, u16 msgLen, msg utf8, u32 start, u32 end

use std::cell::RefCell;

use wasm_bindgen::prelude::wasm_bindgen;

use crate::controllers::analyze::{Analyzer, InstanceResult, Value};
use crate::controllers::ast::{AstParser, ParsedAst};
use crate::controllers::error::ErrorLog;
use crate::controllers::node::Node;

thread_local! {
	/// Reused scratch buffer holding the most recent serialized parse result.
	/// Kept alive across the call so a JS view over WASM linear memory stays valid
	/// until the next `parsePathView` call. Reused to avoid per-call allocation.
	static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Recursively writes a node and its descendants into `out`.
fn write_node(out: &mut Vec<u8>, node: &Node) {
	out.push(node.id);
	out.push(node.expression);
	out.extend_from_slice(&(node.start as u16).to_le_bytes());
	out.extend_from_slice(&(node.end as u16).to_le_bytes());
	out.push(node.node_type);
	out.push(u8::from(node.optional));
	out.extend_from_slice(&(node.children.len() as u16).to_le_bytes());

	for child in &node.children {
		write_node(out, child);
	}
}

/// Serializes root nodes only: `[u16 rootCount][nodes...]`.
pub fn serialize_nodes(nodes: &[Node]) -> Vec<u8> {
	let mut out = Vec::with_capacity(2 + nodes.len() * Node::SIZE);
	out.extend_from_slice(&(nodes.len() as u16).to_le_bytes());
	for node in nodes {
		write_node(&mut out, node);
	}
	out
}

/// Serializes a full parse result (nodes + errors) into `out`.
pub fn serialize_parsed_into(out: &mut Vec<u8>, parsed: &ParsedAst) {
	out.extend_from_slice(&(parsed.nodes.len() as u16).to_le_bytes());
	for node in &parsed.nodes {
		write_node(out, node);
	}

	out.extend_from_slice(&(parsed.errors.len() as u16).to_le_bytes());
	for error in &parsed.errors {
		let code = error.code.as_bytes();
		let message = error.message.as_bytes();
		out.extend_from_slice(&(code.len() as u16).to_le_bytes());
		out.extend_from_slice(code);
		out.extend_from_slice(&(message.len() as u16).to_le_bytes());
		out.extend_from_slice(message);
		out.extend_from_slice(&error.start.to_le_bytes());
		out.extend_from_slice(&error.end.to_le_bytes());
	}
}

/// Serializes a full parse result (nodes + errors) into a fresh bridge buffer.
pub fn serialize_parsed(parsed: &ParsedAst) -> Vec<u8> {
	let mut out = Vec::with_capacity(2 + parsed.nodes.len() * Node::SIZE + 2);
	serialize_parsed_into(&mut out, parsed);
	out
}

/// Parses `input` and returns the serialized nodes + parse errors.
/// This is the primary engine entry point consumed by the TypeScript bridge.
#[wasm_bindgen(js_name = parsePath)]
pub fn parse_path(input: &str) -> Vec<u8> {
	serialize_parsed(&AstParser::parse(input))
}

/// Zero-copy variant of [`parse_path`]: serializes into a reused thread-local
/// buffer in WASM linear memory and returns a `Uint8Array` **view** aliasing it
/// (no copy out of WASM). The JS side must consume the view synchronously,
/// before the next WASM call mutates the shared buffer.
///
/// # Safety
/// The returned view aliases the `RESULT` buffer. It is invalidated by the next
/// `parsePathView` call (which may reallocate) or by any WASM memory growth, so
/// callers must decode it immediately and never retain it across WASM calls.
#[wasm_bindgen(js_name = parsePathView)]
pub fn parse_path_view(input: &str) -> js_sys::Uint8Array {
	RESULT.with(|cell| {
		let mut buffer = cell.borrow_mut();
		buffer.clear();
		serialize_parsed_into(&mut buffer, &AstParser::parse(input));
		// SAFETY: see function-level docs — the view is consumed synchronously by
		// the bridge before any further WASM call, and `buffer` outlives the call.
		unsafe { js_sys::Uint8Array::view(&buffer) }
	})
}

/// Back-compat full parse export: returns the serialized node buffer.
#[wasm_bindgen(js_name = parseAndAnalyze)]
pub fn parse_and_analyze(input: String) -> Vec<u8> {
	serialize_nodes(&AstParser::parse(&input).nodes)
}

// === analyzer result encoders ===

fn put_str(out: &mut Vec<u8>, s: &str) {
	out.extend_from_slice(&(s.len() as u32).to_le_bytes());
	out.extend_from_slice(s.as_bytes());
}

fn put_value(out: &mut Vec<u8>, value: &Value) {
	match value {
		Value::Str(s) => {
			out.push(0);
			put_str(out, s);
		}
		Value::Num(n) => {
			out.push(1);
			out.extend_from_slice(&n.to_le_bytes());
		}
		Value::Bool(b) => {
			out.push(2);
			out.push(u8::from(*b));
		}
		Value::List(list) => {
			out.push(3);
			out.extend_from_slice(&(list.len() as u32).to_le_bytes());
			for item in list {
				put_str(out, item);
			}
		}
	}
}

fn put_map(out: &mut Vec<u8>, entries: &[(String, Value)]) {
	out.extend_from_slice(&(entries.len() as u32).to_le_bytes());
	for (key, value) in entries {
		put_str(out, key);
		put_value(out, value);
	}
}

fn put_error(out: &mut Vec<u8>, error: &ErrorLog) {
	let code = error.code.as_bytes();
	let message = error.message.as_bytes();
	out.extend_from_slice(&(code.len() as u16).to_le_bytes());
	out.extend_from_slice(code);
	out.extend_from_slice(&(message.len() as u16).to_le_bytes());
	out.extend_from_slice(message);
	out.extend_from_slice(&error.start.to_le_bytes());
	out.extend_from_slice(&error.end.to_le_bytes());
}

fn put_errors(out: &mut Vec<u8>, errors: &[ErrorLog]) {
	out.extend_from_slice(&(errors.len() as u32).to_le_bytes());
	for error in errors {
		put_error(out, error);
	}
}

/// Serializes an analyzer result into the reused thread-local `RESULT` buffer and
/// returns a `Uint8Array` **view** aliasing it — no copy out of WASM, no malloc/free
/// of a fresh `Vec` per call. Same shared-memory contract as [`parse_path_view`]:
/// the JS bridge decodes the view synchronously before the next WASM call.
///
/// # Safety
/// The view aliases `RESULT`; it is invalidated by the next call into this buffer
/// (or by WASM memory growth). Callers must consume it immediately.
fn shared_view<F: FnOnce(&mut Vec<u8>)>(fill: F) -> js_sys::Uint8Array {
	RESULT.with(|cell| {
		let mut out = cell.borrow_mut();
		out.clear();
		fill(&mut out);
		unsafe { js_sys::Uint8Array::view(out.as_slice()) }
	})
}

// === analyzer exports ===

#[wasm_bindgen(js_name = analyzePathname)]
pub fn analyze_pathname(input: &str) -> String {
	Analyzer::new(input).get_pathname()
}

#[wasm_bindgen(js_name = analyzeProtocol)]
pub fn analyze_protocol(input: &str) -> Option<String> {
	Analyzer::new(input).get_protocol()
}

#[wasm_bindgen(js_name = analyzeHostname)]
pub fn analyze_hostname(input: &str) -> Option<String> {
	Analyzer::new(input).get_hostname()
}

#[wasm_bindgen(js_name = analyzePort)]
pub fn analyze_port(input: &str) -> Option<String> {
	Analyzer::new(input).get_port()
}

#[wasm_bindgen(js_name = analyzeFragment)]
pub fn analyze_fragment(input: &str) -> Option<String> {
	Analyzer::new(input).get_fragment()
}

/// `[u32 nameCount][names...][u32 errCount][errors...]`
#[wasm_bindgen(js_name = analyzeParamsTemplate)]
pub fn analyze_params_template(input: &str) -> js_sys::Uint8Array {
	let (names, errors) = Analyzer::new(input).get_params_template();
	shared_view(|out| {
		out.extend_from_slice(&(names.len() as u32).to_le_bytes());
		for name in &names {
			put_str(out, name);
		}
		put_errors(out, &errors);
	})
}

/// `[map][u32 errCount][errors...]`
#[wasm_bindgen(js_name = analyzeSearchTemplate)]
pub fn analyze_search_template(input: &str) -> js_sys::Uint8Array {
	let (entries, errors) = Analyzer::new(input).get_search_params_template();
	shared_view(|out| {
		put_map(out, &entries);
		put_errors(out, &errors);
	})
}

/// `[u8 status]` then `map` (status 0) or `error` (status 1).
#[wasm_bindgen(js_name = analyzeParamsInstance)]
pub fn analyze_params_instance(base_input: &str, input: &str) -> js_sys::Uint8Array {
	let base = Analyzer::new(base_input);
	let inst = Analyzer::new(input);
	let result = Analyzer::get_params_instance(&base, &inst);
	shared_view(|out| match result {
		InstanceResult::Ok(entries) => {
			out.push(0);
			put_map(out, &entries);
		}
		InstanceResult::Throw(error) => {
			out.push(1);
			put_error(out, &error);
		}
	})
}

/// `[u8 status]` then `map` (status 0) or `error` (status 1).
#[wasm_bindgen(js_name = analyzeSearchInstance)]
pub fn analyze_search_instance(base_input: &str, input: &str) -> js_sys::Uint8Array {
	let base = Analyzer::new(base_input);
	let result = Analyzer::get_search_params_instance(&base, input);
	shared_view(|out| match result {
		InstanceResult::Ok(entries) => {
			out.push(0);
			put_map(out, &entries);
		}
		InstanceResult::Throw(error) => {
			out.push(1);
			put_error(out, &error);
		}
	})
}

/// `[map]` of `string | string[]` values.
#[wasm_bindgen(js_name = analyzeStaticProps)]
pub fn analyze_static_props(base_input: &str, input: &str) -> js_sys::Uint8Array {
	let base = Analyzer::new(base_input);
	let inst = Analyzer::new(input);
	let entries = Analyzer::get_static_props(&base, &inst);
	shared_view(|out| put_map(out, &entries))
}

/// `[u32 count][(key,val) string pairs...]`
#[wasm_bindgen(js_name = analyzeFragmentInstance)]
pub fn analyze_fragment_instance(base_input: &str, input: &str) -> js_sys::Uint8Array {
	let base = Analyzer::new(base_input);
	let inst = Analyzer::new(input);
	let entries = Analyzer::get_fragment_instance(&base, &inst);
	shared_view(|out| {
		out.extend_from_slice(&(entries.len() as u32).to_le_bytes());
		for (key, val) in &entries {
			put_str(out, key);
			put_str(out, val);
		}
	})
}
