import assert from "node:assert/strict";
import ts from "typescript";

// Inspect syntax only. Never import tool implementations or execute handlers,
// schemas, service clients, environment lookups or arbitrary source expressions.
const unknown = Symbol("non-static expression");

function evaluate(node, bindings, confirmationInstruction) {
  if (!node) return unknown;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluate(node.expression, bindings, confirmationInstruction);
  }
  const read = (value) => evaluate(value, bindings, confirmationInstruction);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isIdentifier(node)) return bindings.has(node.text) ? bindings.get(node.text) : unknown;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(read);
  if (ts.isObjectLiteralExpression(node)) {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
        result[property.name.text] = read(property.initializer);
      } else if (ts.isShorthandPropertyAssignment(property)) result[property.name.text] = read(property.name);
    }
    return result;
  }
  if (ts.isPropertyAccessExpression(node)) {
    const value = read(node.expression);
    return value && typeof value === "object" && Object.hasOwn(value, node.name.text) ? value[node.name.text] : unknown;
  }
  if (ts.isBinaryExpression(node)) {
    const left = read(node.left), right = read(node.right);
    if (left === unknown || right === unknown) return unknown;
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken && typeof left === "string" && typeof right === "string") return left + right;
    if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
    if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) return left !== right;
  }
  if (ts.isConditionalExpression(node)) {
    const condition = read(node.condition);
    return typeof condition === "boolean" ? read(condition ? node.whenTrue : node.whenFalse) : unknown;
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    if (node.expression.text === "requireScopes") {
      const scopes = node.arguments.map(read);
      return scopes.length && scopes.every(value => typeof value === "string") ? scopes.join(" ") : unknown;
    }
    if (node.expression.text === "confirmedToolDescription") {
      const description = read(node.arguments[0]);
      return typeof description === "string" && typeof confirmationInstruction === "string"
        ? `${description} ${confirmationInstruction}` : unknown;
    }
  }
  return unknown;
}

export function parseRegisteredTools(source, filePath, registry, confirmationInstruction) {
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tools = new Map(), bindings = new Map();
  const bind = (name, value, scope) => {
    if (ts.isIdentifier(name)) scope.set(name.text, value);
    else if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const key = element.propertyName?.text ?? element.name.text;
        bind(element.name, value && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : unknown, scope);
      }
    }
  };
  const visit = (statement, scope) => {
    const read = node => evaluate(node, scope, confirmationInstruction);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) bind(declaration.name, read(declaration.initializer), scope);
    } else if (ts.isBlock(statement)) {
      const local = new Map(scope);
      for (const child of statement.statements) visit(child, local);
    } else if (ts.isForOfStatement(statement)) {
      const values = read(statement.expression);
      assert(Array.isArray(values), `Non-static tool loop in ${filePath}`);
      assert(ts.isVariableDeclarationList(statement.initializer), `Unsupported tool loop in ${filePath}`);
      for (const value of values) {
        const local = new Map(scope);
        bind(statement.initializer.declarations[0].name, value, local);
        visit(statement.statement, local);
      }
    } else if (ts.isExpressionStatement(statement)) {
      const call = statement.expression;
      if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== "registerTool") return;
      const name = read(call.arguments[0]), descriptor = read(call.arguments[1]);
      assert(typeof name === "string", `Non-static tool name in ${filePath}`);
      assert(!tools.has(name), `Duplicate MCP registration ${name} in ${filePath}`);
      assert(typeof descriptor.description === "string" && descriptor.description.trim(), `Non-static or empty description for ${name} in ${filePath}`);
      assert(typeof descriptor.scopeChallenge === "string" && descriptor.scopeChallenge, `Missing static OAuth scope for ${name} in ${filePath}`);
      tools.set(name, { description: descriptor.description.replace(/\s+/g, " ").trim(), scope: descriptor.scopeChallenge });
    }
  };
  for (const statement of file.statements) if (ts.isVariableStatement(statement)) visit(statement, bindings);
  const names = bindings.get(registry);
  assert(Array.isArray(names) && names.length && names.every(name => typeof name === "string"), `Missing registered tool list ${registry} in ${filePath}`);
  assert.equal(new Set(names).size, names.length, `Duplicate registry names in ${filePath}`);
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && /^register.*McpTools$/.test(statement.name?.text ?? "") && statement.body) visit(statement.body, bindings);
  }
  assert.deepEqual([...tools.keys()].sort(), [...names].sort(), `Registry and actual registrations differ in ${filePath}`);
  return { registry, names, tools };
}
