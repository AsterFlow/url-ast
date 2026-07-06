//! Faithful Rust port of `src/controllers/Analyze.ts`. Operates on the node tree
//! produced by [`crate::ast::AstParser`] and reproduces the exact extraction,
//! type-casting, decoding and error semantics of the TypeScript analyzer so the
//! existing test-suite validates parity.
//!
//! Returned JS container shapes (Map vs Record vs array, and thrown error text)
//! are assembled by the thin TypeScript bridge from the compact binary results
//! encoded here.

use std::cell::OnceCell;

use crate::controllers::ast::AstParser;
use crate::controllers::error::ErrorLog;
use crate::controllers::node::Node;
use crate::types::node::{
	content_type_from_annotation, parse_enum_variants_from_annotation, type_annotation_after_dot,
	ContentTypes, GeneralDelimiters, InternalExpression, Operators, OriginExpression,
	ParameterDelimiters,
};
use crate::utils::decode::decode_uri_component_utf8;

const SLASH: u16 = GeneralDelimiters::Slash as u16;
const HASH: u16 = GeneralDelimiters::Hash as u16;
const COMMA: u16 = 44;
const QUERY: u16 = ParameterDelimiters::Query as u16;
const AMPERSAND: u16 = ParameterDelimiters::Ampersand as u16;
const EQUALS: u16 = Operators::Default as u16;
const DOT: u16 = Operators::TypeAnnotation as u16;
const NOT: u16 = Operators::Not as u16;
const LBRACKET: u16 = 91;

const VARIABLE: u8 = InternalExpression::Variable as u8;
const PARAMETER: u8 = InternalExpression::Parameter as u8;
const TYPE: u8 = InternalExpression::Type as u8;
const DEFAULT: u8 = InternalExpression::InternalDefault as u8;
const PATH: u8 = InternalExpression::Path as u8;
const DYNAMIC: u8 = InternalExpression::Dynamic as u8;
const DYN_CATCH_ALL: u8 = InternalExpression::DynamicCatchAll as u8;
const DYN_OPT_CATCH_ALL: u8 = InternalExpression::DynamicOptionalCatchAll as u8;
const WILDCARD: u8 = InternalExpression::Wildcard as u8;
const NONE_T: u8 = InternalExpression::None as u8;
const STRING_T: u8 = ContentTypes::String as u8;
const ENUM_T: u8 = ContentTypes::Enum as u8;

/// A casted runtime value (`string | number | boolean | string[]`).
pub enum Value {
	Str(String),
	Num(f64),
	Bool(bool),
	List(Vec<String>),
}

/// A grouped path segment: the path nodes belonging to one `/`-delimited piece.
struct PathSegment {
	nodes: Vec<Node>,
	start: usize,
	end: usize,
}

/// Origin components, located by the cheap up-front pass `scan_origin` (scheme →
/// host → port), as byte ranges into the input. The pass stops at the end of the
/// authority, so the origin getters never touch the path/query/fragment.
#[derive(Default)]
struct Origin {
	protocol: Option<(usize, usize)>,
	host: Option<(usize, usize)>,
	port: Option<(usize, usize)>,
	/// Byte index where the path begins (after the authority), or `None` when a
	/// schemeless ambiguous authority forces the AST.
	path_start: Option<usize>,
	/// Schemeless + ambiguous authority: host / port / pathname need the AST.
	needs_ast: bool,
}

/// Byte index of the first `?` (query start) and the first `#` (fragment start).
/// Found by one forward pass, computed lazily on first access then cached — so a
/// `getProtocol` never scans for them and a `getFragment` scans for them once.
#[derive(Default)]
struct Delims {
	qpos: Option<usize>,
	hpos: Option<usize>,
}

/// Lazily-built full AST (the heavy Node tree + its UTF-16 units). Only
/// materialized when a structural query (params, query-with-types, instance mode,
/// or a non-trivial pathname / fragment) actually needs the node tree.
struct AstData {
	units: Vec<u16>,
	nodes: Vec<Node>,
}

pub struct Analyzer<'a> {
	input: &'a str,
	origin: OnceCell<Origin>,
	delims: OnceCell<Delims>,
	ast: OnceCell<AstData>,
}

/// Up-front origin pass: scheme → host → port. Cheap (stops at the authority end);
/// reuses the lexer's grammar table and scheme detector so disambiguation matches
/// the AST exactly.
fn scan_origin(input: &str) -> Origin {
	let b = input.as_bytes();
	let n = b.len();
	let mut origin = Origin::default();

	origin.path_start = match scheme_colon(b) {
		Some(p) => {
			origin.protocol = Some((0, p));
			let hstart = p + 3;
			let mut i = hstart;
			// Hostname: every grammar token terminates except '.', which is literal.
			while i < n {
				let c = b[i];
				if c != b'.' && is_grammar_b(c) {
					break;
				}
				i += 1;
			}
			if i > hstart {
				origin.host = Some((hstart, i));
			} else {
				origin.needs_ast = true;
			}
			if i < n && b[i] == b':' {
				let ps = i + 1;
				let mut j = ps;
				// Port: every grammar token terminates ('.' included).
				while j < n && !is_grammar_b(b[j]) {
					j += 1;
				}
				if j > ps {
					origin.port = Some((ps, j));
				} else {
					origin.needs_ast = true;
				}
				i = j;
			}
			Some(i)
		}
		None => {
			if b.first() == Some(&b'/') || n == 0 {
				Some(0) // path-only
			} else {
				origin.needs_ast = true; // schemeless authority -> AST resolves it
				None
			}
		}
	};

	origin
}

/// One forward pass for the first `?` (before any `#`) and the first `#`. Stops at
/// `#` — everything after it is the fragment.
fn scan_delims(input: &str) -> Delims {
	let b = input.as_bytes();
	let mut delims = Delims::default();
	for (i, &c) in b.iter().enumerate() {
		match c {
			b'#' => {
				delims.hpos = Some(i);
				break;
			}
			b'?' if delims.qpos.is_none() => delims.qpos = Some(i),
			_ => {}
		}
	}
	delims
}

impl<'a> Analyzer<'a> {
	pub fn new(input: &'a str) -> Self {
		// Nothing is scanned up front: each component (origin, query/fragment
		// delimiters, full AST) is located on first access and cached, so a call that
		// reads one field never pays for the others.
		Analyzer { input, origin: OnceCell::new(), delims: OnceCell::new(), ast: OnceCell::new() }
	}

	/// Resolves (once) and caches the origin components.
	fn origin(&self) -> &Origin {
		self.origin.get_or_init(|| scan_origin(self.input))
	}

	/// Resolves (once) and caches the query/fragment delimiter positions.
	fn delims(&self) -> &Delims {
		self.delims.get_or_init(|| scan_delims(self.input))
	}

	/// Builds (once) and returns the full AST + UTF-16 units, on demand.
	fn ast(&self) -> &AstData {
		self.ast.get_or_init(|| {
			let parsed = AstParser::parse(self.input);
			AstData { units: parsed.units, nodes: parsed.nodes }
		})
	}

	#[inline]
	fn nodes(&self) -> &[Node] {
		&self.ast().nodes
	}

	/// Slice a byte range from the original input (UTF-8) — used by the cached
	/// part-based getters.
	#[inline]
	fn raw(&self, range: (usize, usize)) -> String {
		self.input[range.0..range.1].to_string()
	}

	fn slice(&self, start: usize, end: usize) -> String {
		let units = &self.ast().units;
		let s = start.min(units.len());
		let e = end.min(units.len());
		if s >= e {
			return String::new();
		}
		String::from_utf16_lossy(&units[s..e])
	}

	fn content(&self, node: &Node) -> String {
		self.slice(node.start as usize, node.end as usize)
	}

	fn char_at(&self, index: usize) -> i32 {
		self.ast().units.get(index).map(|c| *c as i32).unwrap_or(-1)
	}

	// --- node navigation ---

	/// Pre-order reference walk of the whole tree. Node ids are assigned in
	/// pre-order (parent before its subtree, siblings left-to-right), so this is
	/// the same visitation order the old id-indexed `flat_nodes` produced — but
	/// without cloning every node.
	fn walk_flat<'b>(nodes: &'b [Node], out: &mut Vec<&'b Node>) {
		for node in nodes {
			out.push(node);
			if !node.children.is_empty() {
				Self::walk_flat(&node.children, out);
			}
		}
	}

	fn origin_node(&self, expression: OriginExpression) -> Option<&Node> {
		self.nodes().iter().find(|n| n.expression == expression as u8)
	}

	fn query_node(&self) -> Option<&Node> {
		self.nodes().iter().find(|n| n.expression == QUERY as u8)
	}

	fn fragment_node(&self) -> Option<&Node> {
		self.nodes().iter().find(|n| n.expression == HASH as u8)
	}

	fn get_path_nodes(&self) -> Vec<Node> {
		let mut path_nodes = Vec::new();
		for node in self.nodes() {
			if node.expression == QUERY as u8 || node.expression == HASH as u8 {
				break;
			}
			if node.expression == OriginExpression::Protocol as u8
				|| node.expression == OriginExpression::Hostname as u8
				|| node.expression == OriginExpression::Port as u8
			{
				continue;
			}
			if node.expression == PATH
				|| node.expression == DYNAMIC
				|| node.expression == DYN_CATCH_ALL
				|| node.expression == DYN_OPT_CATCH_ALL
				|| node.expression == WILDCARD
			{
				path_nodes.push(node.clone());
			}
		}
		path_nodes
	}

	fn get_path_segments(&self) -> Vec<PathSegment> {
		let current = self.get_path_nodes();
		if current.is_empty() {
			return Vec::new();
		}

		let mut segments = Vec::new();
		let mut seg_nodes: Vec<Node> = vec![current[0].clone()];

		for i in 1..current.len() {
			let prev = &current[i - 1];
			let node = &current[i];
			let gap = self.slice(prev.end as usize, node.start as usize);
			let has_slash = gap.encode_utf16().any(|c| c == SLASH);

			if has_slash {
				let start = seg_nodes[0].start as usize;
				let end = seg_nodes[seg_nodes.len() - 1].end as usize;
				segments.push(PathSegment { nodes: std::mem::take(&mut seg_nodes), start, end });
				seg_nodes = vec![node.clone()];
			} else {
				seg_nodes.push(node.clone());
			}
		}

		if !seg_nodes.is_empty() {
			let start = seg_nodes[0].start as usize;
			let end = seg_nodes[seg_nodes.len() - 1].end as usize;
			segments.push(PathSegment { nodes: seg_nodes, start, end });
		}

		segments
	}

	fn segment_content(&self, seg: &PathSegment) -> String {
		self.slice(seg.start, seg.end)
	}

	fn find_dynamic_in_segment<'b>(&self, seg: &'b PathSegment) -> Option<&'b Node> {
		seg.nodes
			.iter()
			.find(|n| n.expression == DYNAMIC || n.expression == DYN_CATCH_ALL || n.expression == DYN_OPT_CATCH_ALL)
	}

	fn get_node_name(&self, node: &Node) -> String {
		if !node.value.is_empty() {
			return node.value.clone();
		}
		let content = self.content(node);
		let units: Vec<u16> = content.encode_utf16().collect();
		let mut start = 0usize;
		if units.first() == Some(&NOT) {
			start = 1;
		}
		for (i, u) in units.iter().enumerate().skip(start) {
			if *u == DOT || *u == EQUALS {
				return String::from_utf16_lossy(&units[start..i]);
			}
		}
		String::from_utf16_lossy(&units[start..])
	}

	// --- origin getters (served from the single-pass `parts`) ---

	pub fn get_protocol(&self) -> Option<String> {
		// A Protocol node exists iff there is a clean `scheme://`, which is exactly
		// what `scan_url` records — no AST fallback needed.
		self.origin().protocol.map(|r| self.raw(r))
	}

	pub fn get_hostname(&self) -> Option<String> {
		if self.origin().needs_ast {
			return self.origin_node(OriginExpression::Hostname).map(|n| self.content(n));
		}
		self.origin().host.map(|r| self.raw(r))
	}

	pub fn get_port(&self) -> Option<String> {
		if self.origin().needs_ast {
			return self.origin_node(OriginExpression::Port).map(|n| self.content(n));
		}
		self.origin().port.map(|r| self.raw(r))
	}

	// --- pathname ---

	pub fn get_pathname(&self) -> String {
		// Plain (non-template) paths are sliced straight from the cached range; only
		// dynamic/template paths or a schemeless authority need the AST.
		if !self.origin().needs_ast {
			match self.origin().path_start {
				Some(ps) => {
					// Path ends at the first '?' (else first '#', else end).
					let d = self.delims();
					let end = d.qpos.or(d.hpos).unwrap_or(self.input.len()).max(ps);
					if let Some(plain) = self.simple_path(ps, end) {
						return plain;
					}
				}
				None => return "/".to_string(),
			}
		}
		self.pathname_from_ast()
	}

	/// Returns a plain path sliced from the cached range, or `None` when the path
	/// contains template syntax / `//` and must go through the AST. A plain path is
	/// `/`-separated with only `.` literals and non-grammar chars.
	fn simple_path(&self, s: usize, e: usize) -> Option<String> {
		let seg = &self.input[s..e];
		let sb = seg.as_bytes();
		if sb.first() != Some(&b'/') {
			return if sb.is_empty() { Some("/".to_string()) } else { None };
		}
		let mut k = 0;
		while k < sb.len() {
			let c = sb[k];
			if c != b'/' && c != b'.' && is_grammar_b(c) {
				return None;
			}
			if c == b'/' && k + 1 < sb.len() && sb[k + 1] == b'/' {
				return None;
			}
			k += 1;
		}
		Some(seg.to_string())
	}

	fn pathname_from_ast(&self) -> String {
		let segments = self.get_path_segments();
		if segments.is_empty() {
			return "/".to_string();
		}

		let mut parts: Vec<String> = Vec::new();
		for seg in &segments {
			if let Some(dynamic) = self.find_dynamic_in_segment(seg) {
				let is_bracket = (dynamic.start as usize) < self.ast().units.len()
					&& self.char_at(dynamic.start as usize) == LBRACKET as i32;
				if is_bracket {
					parts.push(self.slice(dynamic.start as usize, dynamic.end as usize));
				} else if let Some(var_node) = dynamic.children.iter().find(|n| n.expression == VARIABLE) {
					let prefix_code = self.char_at(dynamic.start as usize);
					let prefix = if prefix_code >= 0 {
						String::from_utf16_lossy(&[prefix_code as u16])
					} else {
						String::new()
					};
					parts.push(format!("{}{}", prefix, self.get_node_name(var_node)));
				} else {
					parts.push(self.slice(seg.start, seg.end));
				}
			} else {
				parts.push(self.slice(seg.start, seg.end));
			}
		}

		format!("/{}", parts.join("/"))
	}

	// --- params (template: names only) ---

	pub fn get_params_template(&self) -> (Vec<String>, Vec<ErrorLog>) {
		let mut params: Vec<String> = Vec::new();
		let mut errors: Vec<ErrorLog> = Vec::new();

		let mut flat: Vec<&Node> = Vec::new();
		Self::walk_flat(self.nodes(), &mut flat);

		for node in flat {
			if node.expression != VARIABLE {
				continue;
			}
			let name = self.get_node_name(node);
			match decode_uri_component_utf8(&name) {
				None => errors.push(ErrorLog {
					code: "E_DECODE_URI",
					message: "Failed to decode URI component for a variable.".into(),
					start: node.start,
					end: node.end,
				}),
				Some(variable) => {
					if params.iter().any(|p| *p == variable) {
						errors.push(ErrorLog {
							code: "E_DUPLICATE_PARAM",
							message: format!("Duplicate parameter name found: \"{}\".", variable),
							start: node.start,
							end: node.end,
						});
					}
					if !params.iter().any(|p| *p == variable) {
						params.push(variable);
					}
				}
			}
		}

		(params, errors)
	}

	// --- fragment (no base) ---

	fn read_fragment_body(&self, hash_node: &Node) -> Option<String> {
		if hash_node.children.is_empty() {
			return None;
		}
		let start = hash_node.children[0].start as usize;
		let end = hash_node.children[hash_node.children.len() - 1].end as usize;
		decode_uri_component_utf8(&self.slice(start, end))
	}

	pub fn get_fragment(&self) -> Option<String> {
		// Fragment payload is everything after the first '#'. A payload with no grammar
		// token is decoded directly; otherwise the AST may split it into children, so
		// defer to the exact node-based reader.
		let s = self.delims().hpos? + 1;
		let e = self.input.len();
		if s >= e {
			return None;
		}
		let payload = &self.input[s..e];
		if payload.as_bytes().iter().any(|&c| is_grammar_b(c)) {
			let hash_node = self.fragment_node()?;
			if hash_node.children.is_empty() {
				return None;
			}
			return self.read_fragment_body(hash_node);
		}
		decode_uri_component_utf8(payload)
	}

	// --- query pair extraction ---

	fn extract_query_pairs(&self) -> Vec<QueryPair> {
		let mut pairs = Vec::new();
		let query_node = match self.query_node() {
			Some(n) if !n.children.is_empty() => n,
			_ => return pairs,
		};

		let body = &query_node.children;
		let mut i = 0usize;
		while i < body.len() {
			let node = &body[i];
			if node.expression == PARAMETER {
				let key = self.get_node_name(node);
				let key_start = node.start;
				let mut val_end = node.end;

				let mut j = i + 1;
				if j < body.len() && (body[j].expression == TYPE || body[j].expression == DEFAULT) {
					let val_start = body[j].start;
					while j < body.len() && body[j].expression != PARAMETER {
						val_end = body[j].end;
						j += 1;
					}
					let val = self.slice(val_start as usize, val_end as usize);
					pairs.push(QueryPair { key, val, key_start, val_end });
				} else {
					pairs.push(QueryPair { key, val: String::new(), key_start, val_end });
				}
				i = j;
			} else {
				i += 1;
			}
		}
		pairs
	}

	/// Template-mode query extraction straight from the cached query range. Template
	/// values are raw strings (no casting), so a clean query string is just split on
	/// `&` then the first `=`. Returns `None` to defer to the AST whenever the section
	/// holds a char with non-trivial semantics: `%` (percent-decode + `E_DECODE_URI`),
	/// `;` (alternate separator), nested `?`, or `[` (enum bracket syntax / its error).
	fn simple_query(&self) -> Option<(Vec<(String, Value)>, Vec<ErrorLog>)> {
		let d = self.delims();
		let q = match d.qpos {
			Some(q) => q,
			None => return Some((Vec::new(), Vec::new())),
		};
		// Query spans from just after '?' to the fragment '#' (else end of input).
		let section = &self.input[q + 1..d.hpos.unwrap_or(self.input.len())];
		if section.bytes().any(|c| c == b'%' || c == b';' || c == b'?' || c == b'[') {
			return None;
		}
		let mut map: Vec<(String, Value)> = Vec::new();
		for seg in section.split('&') {
			if seg.is_empty() {
				continue;
			}
			match seg.as_bytes().iter().position(|&c| c == b'=') {
				Some(0) => return None, // empty key: AST emits no param — defer
				Some(eq) => append_param(&mut map, seg[..eq].to_string(), seg[eq + 1..].to_string()),
				None => append_param(&mut map, seg.to_string(), String::new()),
			}
		}
		Some((map, Vec::new()))
	}

	pub fn get_search_params_template(&self) -> (Vec<(String, Value)>, Vec<ErrorLog>) {
		if let Some(fast) = self.simple_query() {
			return fast;
		}

		let mut map: Vec<(String, Value)> = Vec::new();
		let mut errors: Vec<ErrorLog> = Vec::new();
		let pairs = self.extract_query_pairs();

		for pair in pairs {
			let decoded_key = match decode_uri_component_utf8(&pair.key) {
				Some(k) => k,
				None => {
					errors.push(ErrorLog {
						code: "E_DECODE_URI",
						message: "Failed to decode URI component for a search parameter.".into(),
						start: pair.key_start,
						end: pair.val_end,
					});
					continue;
				}
			};
			let decoded_val = match decode_uri_component_utf8(&pair.val) {
				Some(v) => v,
				None => {
					errors.push(ErrorLog {
						code: "E_DECODE_URI",
						message: "Failed to decode URI component for a search parameter value.".into(),
						start: pair.key_start,
						end: pair.val_end,
					});
					continue;
				}
			};
			append_param(&mut map, decoded_key, decoded_val);
		}

		(map, errors)
	}
}

struct QueryPair {
	key: String,
	val: String,
	key_start: u32,
	val_end: u32,
}

/// A template query-parameter definition: its name, cast target type, optional
/// enum variants, and an optional `=default` literal applied when the instance
/// omits the key.
struct QueryDef {
	key: String,
	type_code: u8,
	enum_variants: Option<Vec<String>>,
	default: Option<String>,
}

/// `appendParam`: string on first set, `string[]` when a key repeats.
fn append_param(map: &mut Vec<(String, Value)>, key: String, content: String) {
	if let Some(entry) = map.iter_mut().find(|(k, _)| *k == key) {
		match &mut entry.1 {
			Value::Str(prev) => {
				let prev = std::mem::take(prev);
				entry.1 = Value::List(vec![prev, content]);
			}
			Value::List(list) => list.push(content),
			_ => entry.1 = Value::Str(content),
		}
	} else {
		map.push((key, Value::Str(content)));
	}
}

// === casting (port of Analyze.castValue) ===

/// `splitByChar`: split keeping a trailing empty segment, UTF-16 aware on ASCII delims.
fn split_by_char(input: &str, delimiter: u16) -> Vec<String> {
	let units: Vec<u16> = input.encode_utf16().collect();
	let mut result = Vec::new();
	let mut start = 0usize;
	for (i, u) in units.iter().enumerate() {
		if *u == delimiter {
			result.push(String::from_utf16_lossy(&units[start..i]));
			start = i + 1;
		}
	}
	result.push(String::from_utf16_lossy(&units[start..]));
	result
}

fn to_lower(input: &str) -> String {
	input
		.chars()
		.map(|c| if c.is_ascii_uppercase() { c.to_ascii_lowercase() } else { c })
		.collect()
}

/// Casts `raw` according to `type`, returning the value or an `ErrorLog` for the
/// caller to throw (matching `castValue` which throws on failure).
fn cast_value(
	raw: &str,
	type_code: u8,
	start: u32,
	end: u32,
	enum_variants: &Option<Vec<String>>,
) -> Result<Value, ErrorLog> {
	if type_code == ContentTypes::Boolean as u8 {
		let lower = to_lower(raw);
		if lower == "true" || lower == "1" {
			return Ok(Value::Bool(true));
		}
		if lower == "false" || lower == "0" {
			return Ok(Value::Bool(false));
		}
		return Err(ErrorLog {
			code: "E_CAST_BOOLEAN",
			message: format!(
				"Invalid boolean value: \"{}\". Expected 'true', 'false', '1', or '0'.",
				raw
			),
			start,
			end,
		});
	}

	if type_code == ContentTypes::Number as u8 {
		let trimmed = raw.trim();
		let parsed = if raw.is_empty() { None } else { trimmed.parse::<f64>().ok() };
		match parsed {
			Some(n) if !n.is_nan() => return Ok(Value::Num(n)),
			_ => {
				return Err(ErrorLog {
					code: "E_CAST_NUMBER",
					message: format!("Invalid numeric value: \"{}\".", raw),
					start,
					end,
				});
			}
		}
	}

	if type_code == ContentTypes::Array as u8 {
		return Ok(Value::List(split_by_char(raw, COMMA)));
	}

	if type_code == ENUM_T {
		let variants = match enum_variants {
			None => return Ok(Value::List(split_by_char(raw, COMMA))),
			Some(v) => v,
		};

		let parts: Vec<String> = split_by_char(raw, COMMA).iter().map(|s| s.trim().to_string()).collect();

		if variants.is_empty() {
			if parts.iter().any(|p| !p.is_empty()) {
				return Err(ErrorLog {
					code: "E_CAST_ENUM",
					message: "No values are allowed for this enum (declaration is enum[]).".into(),
					start,
					end,
				});
			}
			return Ok(Value::List(Vec::new()));
		}

		let quoted = variants.iter().map(|v| format!("\"{}\"", v)).collect::<Vec<_>>().join(", ");
		for p in &parts {
			if p.is_empty() {
				return Err(ErrorLog {
					code: "E_CAST_ENUM",
					message: format!("Empty segment is not allowed. Allowed: {}.", quoted),
					start,
					end,
				});
			}
			if !variants.iter().any(|v| v == p) {
				return Err(ErrorLog {
					code: "E_CAST_ENUM",
					message: format!("Value \"{}\" is not allowed. Allowed: {}.", p, quoted),
					start,
					end,
				});
			}
		}

		return Ok(Value::List(parts));
	}

	// None / String / default
	Ok(Value::Str(raw.to_string()))
}

// === instance-mode analysis (base template + concrete input) ===

impl<'a> Analyzer<'a> {
	fn resolve_type(&self, var_node: &Node, parent_node: &Node) -> u8 {
		if var_node.node_type != NONE_T && var_node.node_type != STRING_T {
			return var_node.node_type;
		}
		if parent_node.node_type != NONE_T && parent_node.node_type != STRING_T {
			return parent_node.node_type;
		}
		for sibling in &parent_node.children {
			if sibling.expression == TYPE {
				let content = if !sibling.value.is_empty() { sibling.value.clone() } else { self.content(sibling) };
				if let Some(mapped) = content_type_from_annotation(&content) {
					return mapped;
				}
			}
		}
		STRING_T
	}

	fn enum_variants_from_template_node(&self, node: &Node) -> Option<Vec<String>> {
		let after = type_annotation_after_dot(&self.content(node))?;
		parse_enum_variants_from_annotation(&after)
	}

	fn resolve_type_info(&self, var_node: &Node, parent_node: &Node) -> (u8, Option<Vec<String>>) {
		let type_code = self.resolve_type(var_node, parent_node);
		if type_code != ENUM_T {
			return (type_code, None);
		}
		(type_code, self.enum_variants_from_template_node(var_node))
	}

	fn build_query_definitions(&self) -> Vec<QueryDef> {
		let mut map: Vec<QueryDef> = Vec::new();
		let query_node = match self.query_node() {
			Some(n) if !n.children.is_empty() => n,
			_ => return map,
		};

		for (idx, node) in query_node.children.iter().enumerate() {
			if node.expression != PARAMETER {
				continue;
			}
			let param_name = self.get_node_name(node);
			let mut type_code = STRING_T;

			if node.node_type != NONE_T && node.node_type != STRING_T {
				type_code = node.node_type;
			} else if let Some(type_node) =
				query_node.children.iter().enumerate().find(|(j, n)| *j > idx && n.expression == TYPE).map(|(_, n)| n)
			{
				let type_content = if !type_node.value.is_empty() { type_node.value.clone() } else { self.content(type_node) };
				if let Some(mapped) = content_type_from_annotation(&type_content) {
					type_code = mapped;
				}
			}

			let mut enum_variants: Option<Vec<String>> = None;
			if type_code == ENUM_T {
				enum_variants = self.enum_variants_from_template_node(node);
				if enum_variants.is_none() {
					if let Some(type_node) = query_node
						.children
						.iter()
						.enumerate()
						.find(|(j, n)| *j > idx && n.expression == TYPE)
						.map(|(_, n)| n)
					{
						let type_content =
							if !type_node.value.is_empty() { type_node.value.clone() } else { self.content(type_node) };
						enum_variants = parse_enum_variants_from_annotation(&type_content);
					}
				}
			}

			// Capture a `=default` literal declared for this param (a separate
			// `InternalDefault` node that sits between this PARAMETER and the next).
			let mut default_value: Option<String> = None;
			for sibling in query_node.children.iter().skip(idx + 1) {
				if sibling.expression == PARAMETER {
					break;
				}
				if sibling.expression == DEFAULT {
					default_value = Some(self.default_literal(sibling));
					break;
				}
			}

			map.push(QueryDef { key: param_name, type_code, enum_variants, default: default_value });
		}

		map
	}

	/// Reads a `=default` literal from an `InternalDefault` node, tolerating a
	/// leading `=` in case the node span includes the operator.
	fn default_literal(&self, node: &Node) -> String {
		let raw = if !node.value.is_empty() { node.value.clone() } else { self.content(node) };
		raw.strip_prefix('=').map(|s| s.to_string()).unwrap_or(raw)
	}

	/// Finds a `=default` literal declared inside a dynamic path segment
	/// (e.g. `:id.number=42`), searching the segment's node subtree.
	fn default_in_subtree(&self, nodes: &[Node]) -> Option<String> {
		for node in nodes {
			if node.expression == DEFAULT {
				return Some(self.default_literal(node));
			}
			if let Some(found) = self.default_in_subtree(&node.children) {
				return Some(found);
			}
		}
		None
	}

	/// Raw query-string pair extraction over a concrete instance input.
	fn extract_query_pairs_raw(input: &str) -> Vec<QueryPair> {
		let units: Vec<u16> = input.encode_utf16().collect();
		let mut pairs = Vec::new();

		let q_pos = match units.iter().position(|c| *c == QUERY) {
			Some(p) => p,
			None => return pairs,
		};
		let hash_pos = units[q_pos + 1..]
			.iter()
			.position(|c| *c == HASH)
			.map(|p| p + q_pos + 1)
			.unwrap_or(units.len());

		let query_offset = q_pos + 1;
		let query_section = String::from_utf16_lossy(&units[query_offset..hash_pos]);
		let segments = split_by_char(&query_section, AMPERSAND);

		let mut offset = 0usize;
		for seg in &segments {
			let abs_start = query_offset + offset;
			let seg_units: Vec<u16> = seg.encode_utf16().collect();

			let eq_idx = seg_units.iter().position(|c| *c == EQUALS);
			match eq_idx {
				Some(i) => {
					let key = String::from_utf16_lossy(&seg_units[..i]);
					let val = String::from_utf16_lossy(&seg_units[i + 1..]);
					let decoded_key = decode_uri_component_utf8(&key).unwrap_or(key);
					let decoded_val = decode_uri_component_utf8(&val).unwrap_or(val);
					pairs.push(QueryPair {
						key: decoded_key,
						val: decoded_val,
						key_start: abs_start as u32,
						val_end: (abs_start + seg_units.len()) as u32,
					});
				}
				None => {
					let decoded_key = decode_uri_component_utf8(seg).unwrap_or_else(|| seg.clone());
					pairs.push(QueryPair {
						key: decoded_key,
						val: String::new(),
						key_start: abs_start as u32,
						val_end: (abs_start + seg_units.len()) as u32,
					});
				}
			}

			offset += seg_units.len() + 1;
		}

		pairs
	}
}

// === shared lexer primitives (used by `scan_url` and the cast/query helpers) ===

/// ASCII grammar tokens — mirror of `GRAMMAR_TOKENS + ASTERISK` in `ast.rs`.
/// (`? & ; : [ ] / # , * . = ~`). All < 128, so byte scanning is unambiguous:
/// UTF-8 continuation bytes (>= 0x80) never collide with an ASCII delimiter.
const fn build_grammar_lut() -> [bool; 128] {
	let mut lut = [false; 128];
	let toks = [63u8, 38, 59, 58, 91, 93, 47, 35, 44, 42, 46, 61, 126];
	let mut i = 0;
	while i < toks.len() {
		lut[toks[i] as usize] = true;
		i += 1;
	}
	lut
}
static GRAMMAR_LUT: [bool; 128] = build_grammar_lut();

#[inline]
fn is_grammar_b(c: u8) -> bool {
	c < 128 && GRAMMAR_LUT[c as usize]
}

/// Byte index of the `:` in a clean leading `scheme://`, or `None`.
/// Matches the AST: a Protocol node is created only when the first grammar token
/// in the input is a `:` immediately followed by `//`, after a non-empty run.
#[inline]
fn scheme_colon(b: &[u8]) -> Option<usize> {
	let mut i = 0;
	while i < b.len() {
		let c = b[i];
		if is_grammar_b(c) {
			if c == b':' && i > 0 && i + 2 < b.len() && b[i + 1] == b'/' && b[i + 2] == b'/' {
				return Some(i);
			}
			return None;
		}
		i += 1;
	}
	None
}


/// Result of an instance-mode extraction that may throw.
pub enum InstanceResult {
	Ok(Vec<(String, Value)>),
	Throw(ErrorLog),
}

impl<'a> Analyzer<'a> {
	pub fn get_params_instance(base: &Analyzer<'_>, inst: &Analyzer<'_>) -> InstanceResult {
		let mut params: Vec<(String, Value)> = Vec::new();
		let base_segs = base.get_path_segments();
		let inst_segs = inst.get_path_segments();

		let mut inst_idx = 0usize;
		for base_idx in 0..base_segs.len() {
			let base_seg = &base_segs[base_idx];
			let dynamic = base.find_dynamic_in_segment(base_seg);

			if let Some(dynamic) = dynamic {
				let is_catch_all =
					dynamic.expression == DYN_CATCH_ALL || dynamic.expression == DYN_OPT_CATCH_ALL;
				let var_node = match dynamic.children.iter().find(|n| n.expression == VARIABLE) {
					Some(v) => v,
					None => {
						inst_idx += 1;
						continue;
					}
				};
				let key = base.get_node_name(var_node);
				let (type_code, enum_variants) = base.resolve_type_info(var_node, dynamic);

				if is_catch_all {
					let static_after = base_segs[base_idx + 1..]
						.iter()
						.filter(|s| base.find_dynamic_in_segment(s).is_none())
						.count();
					let end_slice =
						if static_after > 0 { inst_segs.len().saturating_sub(static_after) } else { inst_segs.len() };
					let catch_all_segs = &inst_segs[inst_idx.min(end_slice)..end_slice.max(inst_idx)];
					let list: Vec<String> = catch_all_segs
						.iter()
						.map(|seg| {
							let raw = inst.segment_content(seg);
							decode_uri_component_utf8(&raw).unwrap_or(raw)
						})
						.collect();
					inst_idx += catch_all_segs.len();
					params.push((key, Value::List(list)));
				} else if let Some(inst_seg) = inst_segs.get(inst_idx) {
					let raw_content = inst.segment_content(inst_seg);
					let raw = decode_uri_component_utf8(&raw_content).unwrap_or(raw_content);
					match cast_value(&raw, type_code, inst_seg.start as u32, inst_seg.end as u32, &enum_variants) {
						Ok(value) => params.push((key, value)),
						Err(error) => return InstanceResult::Throw(error),
					}
					inst_idx += 1;
				} else {
					// Instance omitted this dynamic segment: fall back to a
					// `=default` literal (e.g. `:id.number=42`) when declared.
					if let Some(default_raw) = base.default_in_subtree(&dynamic.children) {
						match cast_value(&default_raw, type_code, 0, 0, &enum_variants) {
							Ok(value) => params.push((key, value)),
							Err(error) => return InstanceResult::Throw(error),
						}
					}
					inst_idx += 1;
				}
			} else {
				inst_idx += 1;
			}
		}

		InstanceResult::Ok(params)
	}

	pub fn get_search_params_instance(base: &Analyzer<'_>, inst_input: &str) -> InstanceResult {
		let mut params: Vec<(String, Value)> = Vec::new();
		let definitions = base.build_query_definitions();
		let instance_pairs = Analyzer::extract_query_pairs_raw(inst_input);

		for pair in instance_pairs {
			let def = match definitions.iter().find(|d| d.key == pair.key) {
				Some(d) => d,
				None => continue,
			};
			match cast_value(&pair.val, def.type_code, pair.key_start, pair.val_end, &def.enum_variants) {
				Ok(value) => params.push((pair.key.clone(), value)),
				Err(error) => return InstanceResult::Throw(error),
			}
		}

		// Apply `=default` literals for keys the instance omitted entirely.
		for def in &definitions {
			let default_raw = match &def.default {
				Some(d) => d,
				None => continue,
			};
			if params.iter().any(|(k, _)| *k == def.key) {
				continue;
			}
			match cast_value(default_raw, def.type_code, 0, 0, &def.enum_variants) {
				Ok(value) => params.push((def.key.clone(), value)),
				Err(error) => return InstanceResult::Throw(error),
			}
		}

		InstanceResult::Ok(params)
	}

	pub fn get_static_props(base: &Analyzer<'_>, inst: &Analyzer<'_>) -> Vec<(String, Value)> {
		let mut props: Vec<(String, Value)> = Vec::new();
		let base_segs = base.get_path_segments();
		let inst_segs = inst.get_path_segments();

		let mut inst_idx = 0usize;
		for base_idx in 0..base_segs.len() {
			let base_seg = &base_segs[base_idx];
			let dynamic = base.find_dynamic_in_segment(base_seg);

			if let Some(dynamic) = dynamic {
				let is_catch_all =
					dynamic.expression == DYN_CATCH_ALL || dynamic.expression == DYN_OPT_CATCH_ALL;
				let var_node = match dynamic.children.iter().find(|n| n.expression == VARIABLE) {
					Some(v) => v,
					None => {
						inst_idx += 1;
						continue;
					}
				};
				let var_name = base.get_node_name(var_node);

				if is_catch_all {
					let static_after = base_segs[base_idx + 1..]
						.iter()
						.filter(|s| base.find_dynamic_in_segment(s).is_none())
						.count();
					let end_slice =
						if static_after > 0 { inst_segs.len().saturating_sub(static_after) } else { inst_segs.len() };
					let catch_all_segs = &inst_segs[inst_idx.min(end_slice)..end_slice.max(inst_idx)];
					let list: Vec<String> = catch_all_segs
						.iter()
						.map(|seg| {
							let raw = inst.segment_content(seg);
							decode_uri_component_utf8(&raw).unwrap_or(raw)
						})
						.collect();
					inst_idx += catch_all_segs.len();
					props.push((var_name, Value::List(list)));
				} else {
					let inst_seg = match inst_segs.get(inst_idx) {
						Some(s) => s,
						None => return Vec::new(),
					};
					let raw_content = inst.segment_content(inst_seg);
					let value = decode_uri_component_utf8(&raw_content).unwrap_or(raw_content);
					props.push((var_name, Value::Str(value)));
					inst_idx += 1;
				}
			} else {
				let inst_seg = match inst_segs.get(inst_idx) {
					Some(s) => s,
					None => return Vec::new(),
				};
				let base_raw_content = base.segment_content(base_seg);
				let base_raw = decode_uri_component_utf8(&base_raw_content).unwrap_or(base_raw_content);
				let inst_raw_content = inst.segment_content(inst_seg);
				let inst_raw = decode_uri_component_utf8(&inst_raw_content).unwrap_or(inst_raw_content);
				if base_raw != inst_raw {
					return Vec::new();
				}
				inst_idx += 1;
			}
		}

		if inst_idx != inst_segs.len() {
			return Vec::new();
		}
		props
	}

	pub fn get_fragment_instance(base: &Analyzer<'_>, inst: &Analyzer<'_>) -> Vec<(String, String)> {
		let mut output = Vec::new();
		let base_hash = base.fragment_node();
		let inst_hash = inst.fragment_node();

		if let (Some(base_hash), Some(inst_hash)) = (base_hash, inst_hash) {
			if !inst_hash.children.is_empty() && !base_hash.children.is_empty() {
				let key = base.read_fragment_body(base_hash);
				let val = inst.read_fragment_body(inst_hash);
				if let (Some(key), Some(val)) = (key, val) {
					if !key.is_empty() && !val.is_empty() {
						output.push((key, val));
					}
				}
			}
		}
		output
	}
}
