//! Internal AST node. Mirror of `src/controllers/Node.ts` (fields + serialized
//! record size). Not exported to JS — the bridge serializes nodes into the binary
//! buffer that the TypeScript `Node` class decodes.

#[derive(Clone, Debug)]
pub struct Node {
	pub id: u8,
	pub expression: u8,
	pub node_type: u8,
	pub start: u32,
	pub end: u32,
	pub value: String,
	pub optional: bool,
	pub children: Vec<Node>,
}

impl Node {
	/// Serialized record size in bytes, matching `Node.SIZE` in `src/controllers/Node.ts`.
	pub const SIZE: usize = 10;

	#[allow(clippy::too_many_arguments)]
	pub fn new(
		id: u8,
		expression: u8,
		start: u32,
		end: u32,
		value: String,
		node_type: u8,
		optional: bool,
	) -> Self {
		Self { id, expression, node_type, start, end, value, optional, children: Vec::new() }
	}

	pub fn set_children(&mut self, target_children: Vec<Node>) {
		self.children = target_children;
	}
}
