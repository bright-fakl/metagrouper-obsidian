/**
 * Boolean expression evaluator for filter expressions
 */

import { ExpressionNode } from './expression-parser';

export class ExpressionEvaluator {
  /**
   * Evaluate an expression AST with given filter results
   *
   * @param ast The parsed expression AST
   * @param filterResults Map of filter labels to their boolean results
   * @returns The final boolean result
   */
  evaluate(ast: ExpressionNode | null, filterResults: Map<string, boolean>): boolean {
    if (!ast) {
      // No expression means no filtering (return true for all files)
      return true;
    }

    return this.evaluateNode(ast, filterResults);
  }

  private evaluateNode(node: ExpressionNode, filterResults: Map<string, boolean>): boolean {
    switch (node.type) {
      case 'filter': {
        // Look up filter result by label
        const result = filterResults.get(node.label);
        if (result === undefined) {
          // Unknown filter label - treat as false for safety
          console.warn(`ExpressionEvaluator: Unknown filter label '${node.label}', treating as false`);
          return false;
        }
        return result;
      }

      case 'not': {
        return !this.evaluateNode(node.operand, filterResults);
      }

      case 'and': {
        // Short-circuit evaluation
        const leftResult = this.evaluateNode(node.left, filterResults);
        if (!leftResult) return false;
        return this.evaluateNode(node.right, filterResults);
      }

      case 'or': {
        // Short-circuit evaluation
        const leftResult = this.evaluateNode(node.left, filterResults);
        if (leftResult) return true;
        return this.evaluateNode(node.right, filterResults);
      }

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = node;
        console.error('ExpressionEvaluator: Unknown node type:', _exhaustive);
        return false;
      }
    }
  }

  /**
   * Generate a default expression for a list of filters
   * Default behavior: AND all filters together
   */
  static generateDefaultExpression(labels: string[]): string {
    if (labels.length === 0) {
      return '';
    }

    if (labels.length === 1) {
      return labels[0];
    }

    return labels.join(' & ');
  }

  /**
   * Get all filter labels used in an expression
   */
  static getUsedLabels(ast: ExpressionNode | null): Set<string> {
    const labels = new Set<string>();

    function traverse(node: ExpressionNode) {
      switch (node.type) {
        case 'filter':
          labels.add(node.label);
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

    return labels;
  }
}
