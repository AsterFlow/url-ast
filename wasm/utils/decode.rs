/// Decodifica componente URI com sequências `%HH`, validando UTF-8 (equivalente prático a `decodeURIComponentUTF8` em TS).
pub fn decode_uri_component_utf8(s: &str) -> Option<String> {
	if !s.as_bytes().contains(&b'%') {
		return Some(s.to_string());
	}
	let b = s.as_bytes();
	let mut out = Vec::with_capacity(s.len());
	let mut i = 0;
	while i < b.len() {
		if b[i] == b'%' {
			if i + 2 >= b.len() {
				return None;
			}
			let hi = hex_val(b[i + 1])?;
			let lo = hex_val(b[i + 2])?;
			out.push((hi << 4) | lo);
			i += 3;
		} else {
			out.push(b[i]);
			i += 1;
		}
	}
	String::from_utf8(out).ok()
}

fn hex_val(c: u8) -> Option<u8> {
	match c {
		b'0'..=b'9' => Some(c - b'0'),
		b'a'..=b'f' => Some(c - b'a' + 10),
		b'A'..=b'F' => Some(c - b'A' + 10),
		_ => None,
	}
}
