# Authentication System

This document explains the authentication system used in the Cognivers API.

## Overview

The authentication system uses JWT tokens for authentication. The main function for retrieving the current user is:

`get_current_user` - Returns the complete User object with all attributes

## Best Practices

### Use `get_current_user` for all endpoints

Always use `get_current_user` for your endpoints. This ensures you have access to all user attributes, including the role.

```python
from api.routers.users import get_current_user
from models.user import User

@router.get("/my-endpoint")
async def my_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Now you can access current_user.id, current_user.role, etc.
    return {"user_id": current_user.id, "role": current_user.role}
```

### Consistent Parameter Naming

Use consistent parameter naming to make the code more readable:

- Use `current_user` for the User object from `get_current_user`

### Type Annotations

Always use type annotations to make the code more readable and to catch errors early:

```python
from models.user import User

# Good
async def my_function(current_user: User):
    return current_user.id

# Bad
async def my_function(current_user):
    return current_user.id
```

## Role-based access control

When implementing role-based access control, use `get_current_user` to ensure you have access to the user's role:

```python
from models.user import User, UserRole

@router.get("/admin-only")
async def admin_only(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    return {"message": "You are an admin"}
``` 