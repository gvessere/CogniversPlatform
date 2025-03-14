# Cognivers API

## Authentication System

The authentication system has been standardized to use a single function:

`get_current_user` - Returns the complete User object with all attributes

For detailed documentation, see [Authentication Documentation](./docs/authentication.md).

## Type Checking

This project now uses mypy for type checking. To run the type checker:

```bash
./scripts/check_types.sh
```

### Type Checking Best Practices

1. Always use type annotations for function parameters and return values
2. Use consistent parameter naming:
   - `current_user` for the User object from `get_current_user`
3. Run the type checker before committing code

## Common Issues

### "int object has no attribute" errors

If you see an error like `'int' object has no attribute 'id'` or `'int' object has no attribute 'role'`, it means you're trying to access attributes on a non-object. Make sure you're using `get_current_user` for all endpoints.

## Development Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the API:
   ```bash
   uvicorn main:app --reload
   ```

3. Run type checking:
   ```bash
   ./scripts/check_types.sh
   ``` 