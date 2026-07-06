//! Parse/analyze diagnostic. Mirror of the data carried by `src/controllers/Error.ts`
//! (`ErrorLog`). Presentation (`toString`/colorize) lives on the TS class; here it
//! is plain data serialized across the bridge.

#[derive(Clone, Debug)]
pub struct ErrorLog {
	pub code: &'static str,
	pub message: String,
	pub start: u32,
	pub end: u32,
}
