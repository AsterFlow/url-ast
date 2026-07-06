//! Token enums, byte constants and type-annotation helpers.
//! Mirror of `src/types/node.ts`.

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum ParameterDelimiters {
	Query = 63,     // ?
	Ampersand = 38, // &
	Semicolon = 59, // ;
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum DynamicVariableDelimiters {
	Colon = 58,        // :
	LeftBracket = 91,  // [
	RightBracket = 93, // ]
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum GeneralDelimiters {
	Slash = 47, // /
	Hash = 35,  // #
	Comma = 44, // ,
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum Operators {
	TypeAnnotation = 46, // .
	Default = 61,        // =
	Not = 126,           // ~
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum CatchAllExpression {
	Asterisk = 42, // *
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum OriginExpression {
	Protocol = 246,
	Hostname = 245,
	Port = 244,
	Separator = 243,
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum InternalExpression {
	None = 0,
	Dynamic = 200,
	DynamicCatchAll = 201,
	DynamicOptionalCatchAll = 202,
	InternalDefault = 203,
	Wildcard = 250,
	Path = 251,
	Variable = 252,
	Fragment = 253,
	Parameter = 254,
	Type = 255,
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[repr(u8)]
pub enum ContentTypes {
	Array = 239,
	Enum = 240,
	Boolean = 247,
	String = 248,
	Number = 249,
}

// Byte constants for the grammar tokens used across the parser/analyzer.
pub const SLASH: u8 = GeneralDelimiters::Slash as u8;
pub const HASH: u8 = GeneralDelimiters::Hash as u8;
pub const COMMA: u8 = GeneralDelimiters::Comma as u8;
pub const QUERY: u8 = ParameterDelimiters::Query as u8;
pub const AMPERSAND: u8 = ParameterDelimiters::Ampersand as u8;
pub const SEMICOLON: u8 = ParameterDelimiters::Semicolon as u8;
pub const COLON: u8 = DynamicVariableDelimiters::Colon as u8;
pub const LBRACKET: u8 = DynamicVariableDelimiters::LeftBracket as u8;
pub const RBRACKET: u8 = DynamicVariableDelimiters::RightBracket as u8;
pub const ASTERISK: u8 = CatchAllExpression::Asterisk as u8;
pub const DOT: u8 = Operators::TypeAnnotation as u8;
pub const EQUALS: u8 = Operators::Default as u8;
pub const TILDE: u8 = Operators::Not as u8;
pub const NONE: u8 = InternalExpression::None as u8;

// === type-annotation helpers (port of src/types/node.ts) ===

/// `CONTENT_TYPE_MAP`: maps an annotation keyword to its `ContentTypes` code.
pub fn content_type_map(key: &str) -> Option<u8> {
	match key {
		"number" => Some(ContentTypes::Number as u8),
		"boolean" => Some(ContentTypes::Boolean as u8),
		"string" => Some(ContentTypes::String as u8),
		"array" => Some(ContentTypes::Array as u8),
		"enum" | "enums" => Some(ContentTypes::Enum as u8),
		_ => None,
	}
}

/// Base name before `[` for annotations like `enum[Admin,User]`.
pub fn base_type_key_from_annotation(src: &str) -> &str {
	match src.find('[') {
		Some(i) => &src[..i],
		None => src,
	}
}

pub fn content_type_from_annotation(src: &str) -> Option<u8> {
	content_type_map(base_type_key_from_annotation(src))
}

/// Slice after the first `.` (UTF-16 aware) in a `name.annotation` fragment.
pub fn type_annotation_after_dot(content: &str) -> Option<String> {
	let units: Vec<u16> = content.encode_utf16().collect();
	for (i, u) in units.iter().enumerate() {
		if *u == DOT as u16 {
			return Some(String::from_utf16_lossy(&units[i + 1..]));
		}
	}
	None
}

/// Parses enum members from `enum[a,b]` / `enums[a,b]`. `None` if no bracket
/// list; `Some(vec![])` for `enum[]`.
pub fn parse_enum_variants_from_annotation(type_src: &str) -> Option<Vec<String>> {
	let t = type_src.trim();
	let units: Vec<u16> = t.encode_utf16().collect();
	let bi = units.iter().position(|c| *c == LBRACKET as u16)?;
	let base = String::from_utf16_lossy(&units[..bi]);
	if base != "enum" && base != "enums" {
		return None;
	}
	let mut depth = 1i32;
	let mut j = bi + 1;
	while j < units.len() && depth > 0 {
		let c = units[j];
		if c == LBRACKET as u16 {
			depth += 1;
		} else if c == RBRACKET as u16 {
			depth -= 1;
		}
		j += 1;
	}
	if depth != 0 {
		return None;
	}
	let inner = String::from_utf16_lossy(&units[bi + 1..j - 1]);
	if inner.trim().is_empty() {
		return Some(Vec::new());
	}
	Some(inner.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
}
