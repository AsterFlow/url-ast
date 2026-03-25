import { expect, describe, it } from 'bun:test'
import {
  ContentTypes,
  baseTypeKeyFromAnnotation,
  contentTypeFromAnnotation,
  typeAnnotationAfterDot,
  parseEnumVariantsFromAnnotation,
} from '../src/types/node'

describe('types/node: annotation helpers', () => {
  it('should return the key before [ for baseTypeKeyFromAnnotation', () => {
    expect(baseTypeKeyFromAnnotation('enum[Admin,User]')).toBe('enum')
    expect(baseTypeKeyFromAnnotation('number')).toBe('number')
  })

  it('should map annotation strings via contentTypeFromAnnotation', () => {
    expect(contentTypeFromAnnotation('enum[X]')).toBe(ContentTypes.Enum)
    expect(contentTypeFromAnnotation('enums[A,B]')).toBe(ContentTypes.Enum)
    expect(contentTypeFromAnnotation('number')).toBe(ContentTypes.Number)
    expect(contentTypeFromAnnotation('unknown')).toBeUndefined()
  })

  it('should return text after the first dot for typeAnnotationAfterDot', () => {
    expect(typeAnnotationAfterDot('name.number')).toBe('number')
    expect(typeAnnotationAfterDot('nope')).toBeUndefined()
  })

  it('should parse enum variant lists in parseEnumVariantsFromAnnotation', () => {
    expect(parseEnumVariantsFromAnnotation('enum[]')).toEqual([])
    expect(parseEnumVariantsFromAnnotation('enums[a,b]')).toEqual(['a', 'b'])
    expect(parseEnumVariantsFromAnnotation('number[1]')).toBeUndefined()
    expect(parseEnumVariantsFromAnnotation('enum[[')).toBeUndefined()
  })
})
