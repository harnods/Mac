"use client";

import * as React from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type DecimalInputProps = React.ComponentProps<typeof DecimalInput>;

type QuantityCalculatorInputProps = Omit<
  DecimalInputProps,
  "value" | "onValueChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: Operator }
  | { type: "paren"; value: "(" | ")" };

type Operator = "+" | "-" | "*" | "/";

function isOperator(value: string): value is Operator {
  return value === "+" || value === "-" || value === "*" || value === "/";
}

function tokenize(expression: string) {
  const tokens: Token[] = [];
  const source = expression.replace(/,/g, ".");
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (isOperator(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }
    if (/\d|\./.test(char)) {
      const start = index;
      while (index < source.length && /[\d.]/.test(source[index])) index += 1;
      const raw = source.slice(start, index);
      if ((raw.match(/\./g) ?? []).length > 1) throw new Error("Invalid number");
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error("Invalid number");
      tokens.push({ type: "number", value });
      continue;
    }
    throw new Error("Unsupported character");
  }

  return tokens;
}

function evaluateExpression(expression: string) {
  const tokens = tokenize(expression);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume() {
    const token = tokens[index];
    index += 1;
    return token;
  }

  function parseFactor(): number {
    const token = peek();
    if (!token) throw new Error("Incomplete expression");

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      consume();
      const value = parseFactor();
      return token.value === "-" ? -value : value;
    }

    if (token.type === "number") {
      consume();
      return token.value;
    }

    if (token.type === "paren" && token.value === "(") {
      consume();
      const value = parseExpression();
      const close = consume();
      if (!close || close.type !== "paren" || close.value !== ")") {
        throw new Error("Missing closing parenthesis");
      }
      return value;
    }

    throw new Error("Expected a number");
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek()?.type === "operator" && (peek().value === "*" || peek().value === "/")) {
      const operator = consume();
      const right = parseFactor();
      if (operator.value === "*") value *= right;
      if (operator.value === "/") {
        if (right === 0) throw new Error("Cannot divide by zero");
        value /= right;
      }
    }
    return value;
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (peek()?.type === "operator" && (peek().value === "+" || peek().value === "-")) {
      const operator = consume();
      const right = parseTerm();
      value = operator.value === "+" ? value + right : value - right;
    }
    return value;
  }

  if (!expression.trim()) throw new Error("Enter a calculation");
  const result = parseExpression();
  if (index !== tokens.length) throw new Error("Invalid expression");
  if (!Number.isFinite(result)) throw new Error("Invalid result");
  return result;
}

function formatResult(value: number) {
  return String(Number(value.toFixed(4)));
}

export function QuantityCalculatorInput({
  value,
  onValueChange,
  className,
  disabled,
  ...props
}: QuantityCalculatorInputProps) {
  const [open, setOpen] = React.useState(false);
  const [expression, setExpression] = React.useState("");
  const [error, setError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  function openCalculator() {
    setExpression(value);
    setError("");
    setOpen(true);
  }

  function applyCalculation() {
    try {
      const result = evaluateExpression(expression);
      if (result < 0) {
        setError("Quantity cannot be negative");
        return;
      }
      onValueChange(formatResult(result));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid calculation");
    }
  }

  return (
    <>
      <div className="relative w-full">
        <DecimalInput
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          className={cn("pr-9", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open quantity calculator"
          disabled={disabled}
          onClick={openCalculator}
          className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <Calculator className="size-3.5" />
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculate quantity</DialogTitle>
            <DialogDescription>
              Enter a simple calculation, then press Enter to use the result.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              applyCalculation();
            }}
          >
            <Input
              ref={inputRef}
              value={expression}
              onChange={(event) => {
                setExpression(event.target.value);
                setError("");
              }}
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
