import type { AllDelimiters, InternalExpression, OriginExpression, ContentTypes, ParameterDelimiters } from './node'
import type { Node } from '../controllers/Node'

export type DisplayRow = {
  idx: string
  symbol: string
  expr: string
  type: string
  optional: string
  start: string
  end: string
}

export type ASTOptionalOptions = {
  nodes?: Node[]
}

export type SourceLocation = {
  line: number
  column: number
}

export type NodeLocation = {
  start: SourceLocation
  end: SourceLocation
}

export interface BaseNode<NodeType extends OriginExpression | InternalExpression | AllDelimiters> {
  type: NodeType
  value: string
  loc: NodeLocation
  optional: boolean
}

export interface ProtocolNode extends BaseNode<OriginExpression.Protocol> {}
export interface SeparatorNode extends BaseNode<OriginExpression.Separator> {}
export interface HostNode extends BaseNode<OriginExpression.Hostname> {}
export interface PortNode extends BaseNode<OriginExpression.Port> {}

export interface PathExpressionNode extends BaseNode<InternalExpression.Path> {
  body: PathSegmentNode[]
}
export interface PathSegmentNode extends BaseNode<InternalExpression.Path> {}

export interface QueryExpressionNode extends BaseNode<ParameterDelimiters.Query> {
  body: QueryParameterNode[]
}
export interface QueryParameterNode extends BaseNode<InternalExpression.Parameter> {
  parameterType: ContentTypes
}

export interface CatchAllSegmentNode extends BaseNode<InternalExpression.Dynamic> {}

export type ASTNode =
  | ProtocolNode
  | SeparatorNode
  | HostNode
  | PortNode
  | PathExpressionNode
  | PathSegmentNode
  | QueryExpressionNode
  | QueryParameterNode
  | CatchAllSegmentNode

// ─── AST JSON Output Structure ──────────────────────────────────────

export type NodeJSON = {
  id: number
  kind: number | string
  value: string
  type?: number | string
  optional?: boolean
  body?: NodeJSON[]
  loc: NodeLocation
}

export type ASTOriginJSON = {
  type: 'OriginExpression'
  value: string
  loc: NodeLocation
  protocol?: NodeJSON
  hostname?: NodeJSON
  port?: NodeJSON
}

export type ASTPathJSON = {
  type: 'PathExpression'
  value: string
  loc: NodeLocation
  body: NodeJSON[]
}

export type ASTQueryJSON = {
  type: 'QueryExpression'
  value: string
  loc: NodeLocation
  body: NodeJSON[]
}

export type ASTFragmentJSON = {
  type: 'FragmentExpression'
  value: string
  loc: NodeLocation
  body: NodeJSON[]
}

export type ASTJSON = {
  type: 'URLDeclaration'
  input: string
  origin?: ASTOriginJSON
  path?: ASTPathJSON
  query?: ASTQueryJSON
  fragment?: ASTFragmentJSON
}
