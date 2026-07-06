//! Faithful Rust port of the TypeScript scannerless parser in
//! `src/controllers/AST.ts` (`AST.parser`). Operates on UTF-16 code units so
//! node `start`/`end` offsets are byte-for-byte identical to the JS engine
//! (JS string indexing / `slice` are UTF-16). Produces the exact same node tree
//! and parse-time error list the TS engine produces, so the existing test suite
//! validates parity.

use crate::controllers::error::ErrorLog;
use crate::controllers::node::Node;
use crate::types::node::{
	content_type_map, ContentTypes, InternalExpression, OriginExpression, ASTERISK, COLON, DOT,
	EQUALS, HASH, LBRACKET, NONE, QUERY, RBRACKET, SLASH, TILDE,
};

// Char-code constants not already exported as bytes by `types`.
const COMMA: u16 = 44; // ,
const TYPE_ANNOTATION: u16 = DOT as u16; // . (Operators.TypeAnnotation)
const AMPERSAND_CC: u16 = 38;
const SEMICOLON_CC: u16 = 59;

/// Result of a parse: root nodes + parse-time errors + the UTF-16 code units the
/// parser already materialized (so the `Analyzer` can reuse them instead of
/// re-encoding the input a second time).
pub struct ParsedAst {
	pub nodes: Vec<Node>,
	pub errors: Vec<ErrorLog>,
	pub units: Vec<u16>,
}

const GRAMMAR_TOKENS: [u16; 13] = [
	63, 38, 59, // ParameterDelimiters: ? & ;
	58, 91, 93, // DynamicVariableDelimiters: : [ ]
	47, 35, 44, // GeneralDelimiters: / # ,
	42, // CatchAllExpression: *
	46, 61, 126, // Operators: . = ~
];

/// `[bool; 128]` lookup over the ASCII grammar tokens — O(1) membership instead of
/// the per-char linear scan of `GRAMMAR_TOKENS`.
const fn build_grammar_lut() -> [bool; 128] {
	let mut lut = [false; 128];
	let mut i = 0;
	while i < GRAMMAR_TOKENS.len() {
		let t = GRAMMAR_TOKENS[i];
		if t < 128 {
			lut[t as usize] = true;
		}
		i += 1;
	}
	lut
}
static GRAMMAR_LUT: [bool; 128] = build_grammar_lut();

#[inline]
fn is_grammar_token(code: u16) -> bool {
	code < 128 && GRAMMAR_LUT[code as usize]
}

/// Default `type` applied when a `Node` is created without an explicit type,
/// matching the `Node` constructor default in `src/controllers/Node.ts`.
#[inline]
fn default_type(expression: u8) -> u8 {
	if expression == InternalExpression::Parameter as u8
		|| expression == InternalExpression::Variable as u8
	{
		ContentTypes::String as u8
	} else {
		NONE
	}
}

pub struct AstParser {
	units: Vec<u16>,
	len: usize,
	id_counter: u32,
	has_catch_all: bool,
	errors: Vec<ErrorLog>,
}

impl AstParser {
	pub fn parse(input: &str) -> ParsedAst {
		let units: Vec<u16> = input.encode_utf16().collect();
		let len = units.len();
		let mut parser = AstParser {
			units,
			len,
			id_counter: 0,
			has_catch_all: false,
			errors: Vec::new(),
		};
		let nodes = parser.parse_rec(NONE, 0, true, false);
		ParsedAst { nodes, errors: parser.errors, units: parser.units }
	}

	#[inline]
	fn id(&mut self) -> u8 {
		let id = self.id_counter as u8;
		self.id_counter += 1;
		id
	}

	/// `this.input.charCodeAt(i)` — returns -1 for out-of-range (JS `NaN`).
	#[inline]
	fn cc(&self, i: isize) -> i32 {
		if i < 0 || i as usize >= self.len {
			-1
		} else {
			self.units[i as usize] as i32
		}
	}

	/// `this.input.slice(start, end)` (UTF-16, clamped).
	fn slice(&self, start: usize, end: usize) -> String {
		let s = start.min(self.len);
		let e = end.min(self.len);
		if s >= e {
			return String::new();
		}
		String::from_utf16_lossy(&self.units[s..e])
	}

	/// Records only the fact that a catch-all/wildcard expression has appeared —
	/// the sole property the parser ever queries about seen expressions. Replaces
	/// the old per-char `Vec<u8>` membership push/scan.
	#[inline]
	fn mark(&mut self, expr: u8) {
		if expr == InternalExpression::DynamicCatchAll as u8
			|| expr == InternalExpression::DynamicOptionalCatchAll as u8
			|| expr == InternalExpression::Wildcard as u8
		{
			self.has_catch_all = true;
		}
	}

	/// Reverse token name used only in non-asserted diagnostic strings.
	fn raw_token_name(code: i32) -> String {
		match code {
			38 => "Ampersand".into(),
			58 => "Colon".into(),
			47 => "Slash".into(),
			63 => "Query".into(),
			59 => "Semicolon".into(),
			_ => String::new(),
		}
	}

	fn push_error(&mut self, code: &'static str, message: String, start: usize, end: usize) {
		self.errors.push(ErrorLog {
			code,
			message,
			start: start as u32,
			end: end as u32,
		});
	}

	fn make_node(&mut self, expression: u8, start: usize, end: usize, optional: bool) -> Node {
		let id = self.id();
		Node::new(id, expression, start as u32, end as u32, String::new(), default_type(expression), optional)
	}

	#[allow(clippy::too_many_arguments)]
	fn parse_rec(
		&mut self,
		mut state: u8,
		start_index: usize,
		is_root_level: bool,
		is_inside_dynamic: bool,
	) -> Vec<Node> {
		let mut nodes: Vec<Node> = Vec::new();

		let mut token_start = start_index;
		let mut token_end = start_index;
		let mut is_optional = state == InternalExpression::DynamicOptionalCatchAll as u8;

		let mut index = start_index;
		while index < self.len {
			let char_code = self.cc(index as isize);
			let next_char_code = self.cc(index as isize + 1);

			self.mark(state);

			let is_dot_literal_outside_var = (state == OriginExpression::Hostname as u8
				|| state == InternalExpression::Path as u8)
				&& char_code == TYPE_ANNOTATION as i32;
			let is_grammar = (is_grammar_token(char_code as u16) || char_code == ASTERISK as i32)
				&& !is_dot_literal_outside_var;

			let has_catch_all = self.has_catch_all;

			// --- syntactic validations ---
			if has_catch_all && char_code == SLASH as i32 {
				self.push_error(
					"E_INVALID_SYNTAX",
					"Unexpected route segment. No further path segments are allowed after a catch-all segment."
						.into(),
					index,
					index + 1,
				);
			}

			if state == InternalExpression::Path as u8
				&& char_code == SLASH as i32
				&& state != OriginExpression::Hostname as u8
			{
				self.push_error(
					"E_CONSECUTIVE_SLASHES",
					"Consecutive slashes are not allowed in the path.".into(),
					index,
					index + 1,
				);
			}

			// --- text content processing ---
			if !is_grammar {
				let is_delimiter_code = next_char_code <= 0
					|| (is_grammar_token(next_char_code as u16)
						&& !((state == OriginExpression::Hostname as u8
							|| state == InternalExpression::Path as u8)
							&& next_char_code == TYPE_ANNOTATION as i32));

				if (state == InternalExpression::Path as u8
					|| state == InternalExpression::Variable as u8)
					&& (next_char_code == AMPERSAND_CC as i32 || next_char_code == COLON as i32)
				{
					let nc = self.cc(index as isize + 1);
					let ch = if nc >= 0 {
						String::from_utf16_lossy(&[nc as u16])
					} else {
						String::new()
					};
					self.push_error(
						"E_INVALID_SYNTAX",
						format!(
							"Unexpected token '{}'. A path segment or variable cannot be followed by '{}'.",
							ch,
							Self::raw_token_name(next_char_code)
						),
						index + 1,
						index + 2,
					);
				}

				if is_inside_dynamic
					&& (is_grammar || is_delimiter_code)
					&& next_char_code != RBRACKET as i32
				{
					let current_character = {
						let c = self.cc(index as isize);
						if c >= 0 { String::from_utf16_lossy(&[c as u16]) } else { String::new() }
					};
					self.push_error(
						"E_INVALID_SYNTAX",
						format!(
							"Unexpected delimiter '{}' inside a dynamic segment '[{}]'.",
							current_character,
							self.slice(token_end, index + 1)
						),
						index,
						index + 1,
					);
				}

				if state == InternalExpression::Parameter as u8
					&& (next_char_code == COLON as i32
						|| next_char_code == SLASH as i32
						|| next_char_code == QUERY as i32)
				{
					let is_colon_token = next_char_code == COLON as i32;
					let nc = self.cc(index as isize + 1);
					let ch = if nc >= 0 { String::from_utf16_lossy(&[nc as u16]) } else { String::new() };
					let message = if is_colon_token {
						"A search parameter cannot be followed by a variable (':'). Use '.' to define a type or value."
							.to_string()
					} else {
						format!(
							"Unexpected token '{}'. A search parameter cannot be followed by '{}'.",
							ch,
							Self::raw_token_name(next_char_code)
						)
					};
					self.push_error("E_INVALID_SYNTAX", message, index + 1, index + 2);
				}

				if !is_delimiter_code {
					index += 1;
					continue;
				}

				// switch (state)
				if state == OriginExpression::Hostname as u8 {
					let n = self.make_node(state, token_start, index + 1, false);
					nodes.push(n);
					token_start = index + 1;

					if next_char_code == COLON as i32 {
						index += 2;
						token_start = index;
						state = OriginExpression::Port as u8;
						index += 1;
						continue;
					}
					state = NONE;
					index += 1;
					continue;
				} else if state == OriginExpression::Port as u8
					|| state == InternalExpression::Fragment as u8
					|| state == InternalExpression::Path as u8
				{
					// pushSimpleNode(index + 1)
					let n = self.make_node(state, token_start, index + 1, is_optional);
					nodes.push(n);
					token_start = index + 1;
					state = NONE;
					is_optional = false;
					index += 1;
					continue;
				} else if state == NONE {
					token_end = if token_end <= token_start { index + 1 } else { token_end };

					let has_scheme_separator = next_char_code == COLON as i32
						&& self.cc(index as isize + 2) == SLASH as i32
						&& self.cc(index as isize + 3) == SLASH as i32;

					if has_scheme_separator {
						let n = self.make_node(OriginExpression::Protocol as u8, token_start, token_end, false);
						nodes.push(n);
						index = token_end + 2;
						token_start = index + 1;
						state = OriginExpression::Hostname as u8;
						index += 1;
						continue;
					}

					if next_char_code != COLON as i32 && next_char_code != SLASH as i32 {
						let n = self.make_node(InternalExpression::Parameter as u8, token_start, token_end, false);
						nodes.push(n);
						token_start = token_end;
						index += 1;
						continue;
					}

					let n = self.make_node(OriginExpression::Hostname as u8, token_start, token_end, false);
					nodes.push(n);

					if next_char_code == COLON as i32 {
						index += 2;
						token_start = index;
						state = OriginExpression::Port as u8;
					}
					index += 1;
					continue;
				} else {
					// default branch
					token_end = index + 1;
					let mapped_content_type = if state == InternalExpression::Type as u8 {
						content_type_map(&self.slice(token_start, token_end))
					} else {
						None
					};

					if state == InternalExpression::Type as u8
						&& mapped_content_type == Some(ContentTypes::Enum as u8)
						&& next_char_code == LBRACKET as i32
					{
						let mut depth = 1i32;
						let mut j = index + 2;
						while j < self.len && depth > 0 {
							let c = self.cc(j as isize);
							if c == LBRACKET as i32 {
								depth += 1;
							} else if c == RBRACKET as i32 {
								depth -= 1;
							}
							j += 1;
						}
						if depth != 0 {
							self.push_error(
								"E_INVALID_SYNTAX",
								"Unclosed '[' in enum type annotation.".into(),
								index + 1,
								self.len,
							);
						}
						token_end = j;
					}
					if mapped_content_type.is_some() && !nodes.is_empty() {
						let mapped = mapped_content_type.unwrap();
						let last = nodes.last_mut().unwrap();
						let target = if !last.children.is_empty() {
							&mut last.children[0]
						} else {
							last
						};
						target.node_type = mapped;
						target.end = token_end as u32;
					} else {
						let n = self.make_node(state, token_start, token_end, is_optional);
						nodes.push(n);
					}

					if !is_root_level
						&& (state == InternalExpression::Parameter as u8
							|| state == InternalExpression::Type as u8
							|| state == InternalExpression::InternalDefault as u8
							|| state == InternalExpression::Variable as u8)
						&& next_char_code != AMPERSAND_CC as i32
						&& (next_char_code == HASH as i32
							|| next_char_code == SLASH as i32
							|| next_char_code == QUERY as i32)
					{
						return nodes;
					}

					token_start = token_end;
					state = NONE;
					is_optional = false;
					index = token_end - 1;
					index += 1;
					continue;
				}
			}

			// --- grammar token processing ---
			let cc = char_code;
			if cc == TILDE as i32 {
				is_optional = true;
				token_start = index + 1;
				index += 1;
				continue;
			} else if cc == COLON as i32 {
				index = self.parse_delimited_expression(
					&mut nodes,
					&mut state,
					&mut token_start,
					&mut is_optional,
					InternalExpression::Variable as u8,
					InternalExpression::Dynamic as u8,
					NONE,
					1,
					0,
					false,
				);
				index += 1;
				continue;
			} else if cc == QUERY as i32 {
				index = self.parse_delimited_expression(
					&mut nodes,
					&mut state,
					&mut token_start,
					&mut is_optional,
					InternalExpression::Parameter as u8,
					QUERY,
					NONE,
					1,
					0,
					false,
				);
				index += 1;
				continue;
			} else if cc == HASH as i32 {
				index = self.parse_delimited_expression(
					&mut nodes,
					&mut state,
					&mut token_start,
					&mut is_optional,
					InternalExpression::Fragment as u8,
					HASH,
					ContentTypes::String as u8,
					1,
					0,
					false,
				);
				index += 1;
				continue;
			} else if cc == ASTERISK as i32 {
				let n = self.make_node(InternalExpression::Wildcard as u8, index, index + 1, false);
				nodes.push(n);
				// falls through to getState
			} else if cc == LBRACKET as i32 {
				let is_double_bracket_open = self.cc(index as isize + 1) == LBRACKET as i32;
				let inner_start_index = index + if is_double_bracket_open { 2 } else { 1 };

				let mut ellipsis_dot_count = 0usize;
				let mut ellipsis_index = inner_start_index;
				while self.cc(ellipsis_index as isize) == TYPE_ANNOTATION as i32 {
					ellipsis_dot_count += 1;
					ellipsis_index += 1;
				}

				let is_catch_all_segment = ellipsis_dot_count == 3;

				if ellipsis_dot_count > 0 && ellipsis_dot_count != 3 {
					self.push_error(
						"E_INVALID_CATCH_ALL",
						"Invalid catch-all syntax. Expected \u{2018}...\u{2019} but found an incomplete sequence."
							.into(),
						index,
						ellipsis_index,
					);
				}

				let mut block_start_offset: usize = if is_double_bracket_open { 2 } else { 1 };
				let block_end_offset: usize = if is_double_bracket_open { 2 } else { 1 };

				if is_catch_all_segment {
					block_start_offset += 3;
				} else if ellipsis_dot_count > 0 {
					block_start_offset += ellipsis_dot_count;
				}

				if is_double_bracket_open {
					is_optional = true;
				}

				let dynamic_expression = if is_catch_all_segment {
					if is_double_bracket_open {
						InternalExpression::DynamicOptionalCatchAll as u8
					} else {
						InternalExpression::DynamicCatchAll as u8
					}
				} else {
					InternalExpression::Dynamic as u8
				};

				index = self.parse_delimited_expression(
					&mut nodes,
					&mut state,
					&mut token_start,
					&mut is_optional,
					InternalExpression::Variable as u8,
					dynamic_expression,
					ContentTypes::String as u8,
					block_start_offset,
					block_end_offset,
					true,
				);
				index += 1;
				continue;
			} else if cc == RBRACKET as i32 {
				let is_double_bracket_close = self.cc(index as isize + 1) == RBRACKET as i32;
				if !is_root_level {
					return nodes;
				}
				if is_double_bracket_close {
					index += 1;
				}
				// falls through to getState
			}

			// post-switch: state = getState(charCode); tokenStart = index + 1
			state = Self::get_state(char_code);
			token_start = index + 1;
			index += 1;
		}

		nodes
	}

	#[allow(clippy::too_many_arguments)]
	fn parse_delimited_expression(
		&mut self,
		nodes: &mut Vec<Node>,
		state: &mut u8,
		token_start: &mut usize,
		is_optional: &mut bool,
		expression_state: u8,
		delimiter_type: u8,
		node_type: u8,
		start_offset: usize,
		end_offset: usize,
		is_inside_dynamic: bool,
	) -> usize {
		self.mark(delimiter_type);

		let parent_id = self.id();
		let result = self.parse_rec(expression_state, *token_start + start_offset, false, is_inside_dynamic);

		let end_index = if let Some(last) = result.last() {
			last.end as usize
		} else {
			*token_start + start_offset
		};
		let has_optional = result.iter().any(|n| n.optional);

		let mut parent = Node::new(
			parent_id,
			delimiter_type,
			*token_start as u32,
			(end_index + end_offset) as u32,
			String::new(),
			node_type,
			has_optional || *is_optional,
		);
		parent.set_children(result);
		nodes.push(parent);

		*state = NONE;
		*token_start = end_index + end_offset;
		*is_optional = false;

		// returns `tokenStart - 1`
		token_start.wrapping_sub(1)
	}

	fn get_state(char_code: i32) -> u8 {
		match char_code {
			c if c == SLASH as i32 => InternalExpression::Path as u8,
			c if c == TYPE_ANNOTATION as i32 => InternalExpression::Type as u8,
			c if c == EQUALS as i32 => InternalExpression::InternalDefault as u8,
			c if c == AMPERSAND_CC as i32 || c == SEMICOLON_CC as i32 => {
				InternalExpression::Parameter as u8
			}
			c if c == ASTERISK as i32 => InternalExpression::Wildcard as u8,
			c if c == COMMA as i32 => InternalExpression::Dynamic as u8,
			_ => NONE,
		}
	}
}
