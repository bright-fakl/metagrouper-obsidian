/**
 * Boolean expression parser for filter expressions
 *
 * Supports:
 * - Operators: & (AND), | (OR), ! (NOT), ()
 * - Also accepts: AND, OR, NOT (case-insensitive)
 * - Filter labels: A-Z, a-z, or custom names
 *
 * Operator precedence:
 * 1. ! / NOT (highest)
 * 2. & / AND
 * 3. | / OR (lowest)
 * 4. () for grouping
 */

export type ExpressionNode =
  | { type: 'filter'; label: string }
  | { type: 'not'; operand: ExpressionNode }
  | { type: 'and'; left: ExpressionNode; right: ExpressionNode }
  | { type: 'or'; left: ExpressionNode; right: ExpressionNode };

export interface ParseResult {
  ast: ExpressionNode | null;
  errors: string[];
}

type TokenType = 'LABEL' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

class Tokenizer {
  private input: string;
  private position: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  nextToken(): Token {
    // Skip whitespace
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }

    if (this.position >= this.input.length) {
      return { type: 'EOF', value: '', position: this.position };
    }

    const start = this.position;
    const char = this.input[this.position];

    // Single-character tokens
    if (char === '(') {
      this.position++;
      return { type: 'LPAREN', value: '(', position: start };
    }
    if (char === ')') {
      this.position++;
      return { type: 'RPAREN', value: ')', position: start };
    }
    if (char === '&') {
      this.position++;
      return { type: 'AND', value: '&', position: start };
    }
    if (char === '|') {
      this.position++;
      return { type: 'OR', value: '|', position: start };
    }
    if (char === '!') {
      this.position++;
      return { type: 'NOT', value: '!', position: start };
    }

    // Multi-character tokens (labels or keywords)
    if (/[a-zA-Z]/.test(char)) {
      let value = '';
      while (this.position < this.input.length && /[a-zA-Z0-9_-]/.test(this.input[this.position])) {
        value += this.input[this.position];
        this.position++;
      }

      const upperValue = value.toUpperCase();
      if (upperValue === 'AND') {
        return { type: 'AND', value: 'AND', position: start };
      }
      if (upperValue === 'OR') {
        return { type: 'OR', value: 'OR', position: start };
      }
      if (upperValue === 'NOT') {
        return { type: 'NOT', value: 'NOT', position: start };
      }

      // It's a label
      return { type: 'LABEL', value, position: start };
    }

    // Unknown character
    throw new Error(`Unexpected character '${char}' at position ${this.position}`);
  }

  reset() {
    this.position = 0;
  }
}

export class ExpressionParser {
  private tokens: Token[] = [];
  private current: number = 0;
  private errors: string[] = [];

  /**
   * Parse a boolean expression
   */
  parse(expression: string): ParseResult {
    this.errors = [];
    this.current = 0;

    if (!expression || expression.trim() === '') {
      return { ast: null, errors: [] };
    }

    try {
      // Tokenize
      const tokenizer = new Tokenizer(expression);
      this.tokens = [];
      while (true) {
        const token = tokenizer.nextToken();
        this.tokens.push(token);
        if (token.type === 'EOF') break;
      }

      // Parse
      const ast = this.parseOr();

      // Check for unconsumed tokens
      if (this.currentToken().type !== 'EOF') {
        this.errors.push(`Unexpected token '${this.currentToken().value}' at position ${this.currentToken().position}`);
      }

      return {
        ast: this.errors.length === 0 ? ast : null,
        errors: this.errors,
      };
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
      return { ast: null, errors: this.errors };
    }
  }

  /**
   * Parse OR expression (lowest precedence)
   * or_expr ::= and_expr (('|' | 'OR') and_expr)*
   */
  private parseOr(): ExpressionNode {
    let left = this.parseAnd();

    while (this.currentToken().type === 'OR') {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }

    return left;
  }

  /**
   * Parse AND expression (medium precedence)
   * and_expr ::= not_expr (('&' | 'AND') not_expr)*
   */
  private parseAnd(): ExpressionNode {
    let left = this.parseNot();

    while (this.currentToken().type === 'AND') {
      this.advance();
      const right = this.parseNot();
      left = { type: 'and', left, right };
    }

    return left;
  }

  /**
   * Parse NOT expression (high precedence)
   * not_expr ::= ('!' | 'NOT')* primary
   */
  private parseNot(): ExpressionNode {
    if (this.currentToken().type === 'NOT') {
      this.advance();
      const operand = this.parseNot(); // Right-associative
      return { type: 'not', operand };
    }

    return this.parsePrimary();
  }

  /**
   * Parse primary expression (highest precedence)
   * primary ::= LABEL | '(' or_expr ')'
   */
  private parsePrimary(): ExpressionNode {
    const token = this.currentToken();

    if (token.type === 'LABEL') {
      this.advance();
      return { type: 'filter', label: token.value };
    }

    if (token.type === 'LPAREN') {
      this.advance();
      const expr = this.parseOr();
      if (this.currentToken().type !== 'RPAREN') {
        throw new Error(`Expected ')' at position ${this.currentToken().position}`);
      }
      this.advance();
      return expr;
    }

    throw new Error(`Expected label or '(' at position ${token.position}, got '${token.value}'`);
  }

  private currentToken(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', position: 0 };
  }

  private advance() {
    if (this.current < this.tokens.length - 1) {
      this.current++;
    }
  }
}

/**
 * Validate that all filter labels in the expression exist in the filter list
 */
export function validateFilterLabels(ast: ExpressionNode | null, validLabels: string[]): string[] {
  const errors: string[] = [];
  const validLabelSet = new Set(validLabels);

  function traverse(node: ExpressionNode) {
    switch (node.type) {
      case 'filter':
        if (!validLabelSet.has(node.label)) {
          errors.push(`Unknown filter label '${node.label}'. Available labels: ${validLabels.join(', ')}`);
        }
        break;
      case 'not':
        traverse(node.operand);
        break;
      case 'and':
      case 'or':
        traverse(node.left);
        traverse(node.right);
        break;
    }
  }

  if (ast) {
    traverse(ast);
  }

  return errors;
}

/**
 * Pretty-print an AST for debugging
 */
export function astToString(node: ExpressionNode | null, indent: number = 0): string {
  if (!node) return '';

  const spaces = '  '.repeat(indent);

  switch (node.type) {
    case 'filter':
      return `${spaces}Filter(${node.label})`;
    case 'not':
      return `${spaces}NOT\n${astToString(node.operand, indent + 1)}`;
    case 'and':
      return `${spaces}AND\n${astToString(node.left, indent + 1)}\n${astToString(node.right, indent + 1)}`;
    case 'or':
      return `${spaces}OR\n${astToString(node.left, indent + 1)}\n${astToString(node.right, indent + 1)}`;
  }
}
