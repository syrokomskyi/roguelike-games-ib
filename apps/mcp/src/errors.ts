export class McpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export class InvalidCursorError extends McpError {
  constructor(message = "Invalid cursor") {
    super(message, "INVALID_CURSOR");
    this.name = "InvalidCursorError";
  }
}

export class StaleCursorError extends McpError {
  constructor(message = "Stale cursor: canonical hash mismatch") {
    super(message, "STALE_CURSOR");
    this.name = "StaleCursorError";
  }
}

export class NotFoundError extends McpError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends McpError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
